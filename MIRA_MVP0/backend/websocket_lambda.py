"""
WebSocket Lambda handlers for AWS API Gateway WebSocket API
Handles real-time voice pipeline with ElevenLabs
"""
import json
import os
import boto3
import base64
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
connections_table = dynamodb.Table(os.environ.get('CONNECTIONS_TABLE', 'mira-websocket-connections-dev'))

# Import voice generation logic
try:
    # We'll need to adapt the WebSocket logic from voice_generation.py
    from voice.voice_generation import (
        process_voice_message,
        _convert_webm_to_wav,
        _transcribe_audio_whisper,
        _generate_tts_audio,
    )
    VOICE_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Voice generation not available: {e}")
    VOICE_AVAILABLE = False


def get_api_gateway_client(event: Dict[str, Any]):
    """Get API Gateway Management API client for sending WebSocket messages"""
    domain = event.get('requestContext', {}).get('domainName')
    stage = event.get('requestContext', {}).get('stage')
    
    if not domain or not stage:
        raise ValueError("Missing domain or stage in event context")
    
    endpoint_url = f"https://{domain}/{stage}"
    return boto3.client('apigatewaymanagementapi', endpoint_url=endpoint_url)


async def send_message_to_connection(apigw_client, connection_id: str, message: Dict[str, Any]):
    """Send a message to a WebSocket connection"""
    try:
        apigw_client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(message).encode('utf-8')
        )
        return True
    except apigw_client.exceptions.GoneException:
        # Connection is no longer available, remove from DynamoDB
        print(f"🗑️ Connection {connection_id} gone, removing from table")
        try:
            connections_table.delete_item(Key={'connectionId': connection_id})
        except Exception as e:
            print(f"Error removing stale connection: {e}")
        return False
    except Exception as e:
        print(f"❌ Error sending message to {connection_id}: {e}")
        return False


def connect_handler(event, context):
    """Handle WebSocket $connect route"""
    connection_id = event['requestContext']['connectionId']
    
    # Extract token from query string if provided
    query_params = event.get('queryStringParameters') or {}
    token = query_params.get('token', 'anonymous')
    
    # Extract user ID from token if possible
    user_id = 'anonymous'
    if token and token != 'anonymous':
        try:
            from settings import get_uid_from_token
            user_id = get_uid_from_token(token) or 'anonymous'
        except Exception as e:
            print(f"⚠️ Could not extract user ID from token: {e}")
    
    # Store connection in DynamoDB
    try:
        ttl = int((datetime.now() + timedelta(hours=2)).timestamp())
        connections_table.put_item(
            Item={
                'connectionId': connection_id,
                'userId': user_id,
                'connectedAt': datetime.now().isoformat(),
                'ttl': ttl
            }
        )
        print(f"✅ Connection stored: {connection_id} (user: {user_id})")
    except Exception as e:
        print(f"❌ Error storing connection: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to store connection'})
        }
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Connected',
            'connectionId': connection_id
        })
    }


def disconnect_handler(event, context):
    """Handle WebSocket $disconnect route"""
    connection_id = event['requestContext']['connectionId']
    
    # Remove connection from DynamoDB
    try:
        connections_table.delete_item(Key={'connectionId': connection_id})
        print(f"🗑️ Connection removed: {connection_id}")
    except Exception as e:
        print(f"❌ Error removing connection: {e}")
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Disconnected'})
    }


def default_handler(event, context):
    """Handle WebSocket $default route (all other messages)"""
    connection_id = event['requestContext']['connectionId']
    
    # Parse message body
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        body = {}
    
    # Support both 'message_type' and 'type' fields for compatibility
    message_type = body.get('message_type', body.get('type', 'unknown'))
    
    print(f"📨 Received message from {connection_id}: {message_type}")
    
    # Get API Gateway client for sending responses
    try:
        apigw_client = get_api_gateway_client(event)
    except Exception as e:
        print(f"❌ Failed to get API Gateway client: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
    
    # Handle authorization (frontend sends this on connect)
    if message_type == 'authorization':
        print(f"✅ Authorization message received from {connection_id}")
        # Just acknowledge - we already stored the connection in connect_handler
        return {'statusCode': 200, 'body': 'Authorization acknowledged'}
    
    # Handle ping/pong for keepalive
    if message_type == 'ping':
        asyncio.run(send_message_to_connection(
            apigw_client,
            connection_id,
            {'message_type': 'pong', 'timestamp': datetime.now().isoformat()}
        ))
        return {'statusCode': 200, 'body': 'Pong sent'}
    
    # Handle stop_audio signal
    if message_type == 'stop_audio':
        asyncio.run(send_message_to_connection(
            apigw_client,
            connection_id,
            {'message_type': 'audio_stopped'}
        ))
        return {'statusCode': 200, 'body': 'Audio stopped'}
    
    # Handle input_audio_chunk (frontend sends audio data in chunks)
    if message_type == 'input_audio_chunk':
        if not VOICE_AVAILABLE:
            asyncio.run(send_message_to_connection(
                apigw_client,
                connection_id,
                {'message_type': 'error', 'error': 'Voice pipeline not available'}
            ))
            return {'statusCode': 200, 'body': 'Voice not available'}
        
        # Get audio chunk data
        audio_chunk = body.get('audio', body.get('chunk', ''))
        if audio_chunk:
            # Store audio chunk in DynamoDB for accumulation
            try:
                # Get existing chunks or create new list
                conn_item = connections_table.get_item(Key={'connectionId': connection_id})
                existing_chunks = conn_item.get('Item', {}).get('audioChunks', [])
                existing_chunks.append(audio_chunk)
                
                # Update connection with accumulated chunks
                connections_table.update_item(
                    Key={'connectionId': connection_id},
                    UpdateExpression='SET audioChunks = :chunks',
                    ExpressionAttributeValues={':chunks': existing_chunks}
                )
                print(f"📥 Stored audio chunk #{len(existing_chunks)} from {connection_id}")
            except Exception as e:
                print(f"⚠️ Error storing audio chunk: {e}")
        
        return {'statusCode': 200, 'body': 'Audio chunk received'}
    
    # Handle transcribe request (frontend sends this to trigger transcription)
    if message_type == 'transcribe':
        if not VOICE_AVAILABLE:
            asyncio.run(send_message_to_connection(
                apigw_client,
                connection_id,
                {'message_type': 'error', 'error': 'Voice pipeline not available'}
            ))
            return {'statusCode': 200, 'body': 'Voice not available'}
        
        # Get user ID and accumulated audio chunks from connection
        try:
            conn_item = connections_table.get_item(Key={'connectionId': connection_id})
            user_id = conn_item.get('Item', {}).get('userId', 'anonymous')
            audio_chunks = conn_item.get('Item', {}).get('audioChunks', [])
        except Exception as e:
            print(f"⚠️ Could not get user ID/chunks: {e}")
            user_id = 'anonymous'
            audio_chunks = []
        
        # Try to get audio from message body first, then from accumulated chunks
        audio_data = body.get('audio', body.get('audio_data', body.get('audio_base64', '')))
        
        if not audio_data and audio_chunks:
            # Combine all accumulated chunks
            audio_data = ''.join(audio_chunks)
            print(f"📦 Combined {len(audio_chunks)} audio chunks")
            
            # Clear stored chunks after processing
            try:
                connections_table.update_item(
                    Key={'connectionId': connection_id},
                    UpdateExpression='REMOVE audioChunks'
                )
            except Exception:
                pass
        
        if not audio_data:
            print(f"⚠️ No audio data available for transcription")
            asyncio.run(send_message_to_connection(
                apigw_client,
                connection_id,
                {'message_type': 'error', 'error': 'No audio data available'}
            ))
            return {'statusCode': 200, 'body': 'No audio data'}
        
        # Process the voice message (transcribe + generate response + TTS)
        asyncio.run(process_voice_message_async(
            apigw_client,
            connection_id,
            user_id,
            audio_data,
            body.get('history', [])
        ))
        
        return {'statusCode': 200, 'body': 'Processing transcription'}
    
    # Handle legacy audio_chunk/audio_input (for backward compatibility)
    if message_type == 'audio_chunk' or message_type == 'audio_input':
        if not VOICE_AVAILABLE:
            asyncio.run(send_message_to_connection(
                apigw_client,
                connection_id,
                {'message_type': 'error', 'error': 'Voice pipeline not available'}
            ))
            return {'statusCode': 200, 'body': 'Voice not available'}
        
        # Get user ID
        try:
            conn_item = connections_table.get_item(Key={'connectionId': connection_id})
            user_id = conn_item.get('Item', {}).get('userId', 'anonymous')
        except Exception:
            user_id = 'anonymous'
        
        audio_data = body.get('audio', body.get('audio_data', ''))
        if not audio_data:
            return {'statusCode': 400, 'body': 'Missing audio data'}
        
        asyncio.run(process_voice_message_async(
            apigw_client,
            connection_id,
            user_id,
            audio_data,
            body.get('history', [])
        ))
        
        return {'statusCode': 200, 'body': 'Processing audio'}
    
    # Handle text query (fallback)
    if message_type == 'text_query':
        text = body.get('text', '')
        if not text:
            return {'statusCode': 400, 'body': 'Missing text'}
        
        # Get user ID
        try:
            conn_item = connections_table.get_item(Key={'connectionId': connection_id})
            user_id = conn_item.get('Item', {}).get('userId', 'anonymous')
        except Exception:
            user_id = 'anonymous'
        
        asyncio.run(process_text_query_async(
            apigw_client,
            connection_id,
            user_id,
            text,
            body.get('history', [])
        ))
        
        return {'statusCode': 200, 'body': 'Processing text'}
    
    # Unknown message type - log but don't send error to avoid spam
    print(f"⚠️ Unknown message type: {message_type} from {connection_id}")
    
    return {'statusCode': 200, 'body': 'Message received'}


async def process_voice_message_async(apigw_client, connection_id: str, user_id: str, audio_base64: str, history: list):
    """Process voice message: transcribe + generate response + TTS"""
    import tempfile
    import os
    
    try:
        # Decode audio data
        audio_bytes = base64.b64decode(audio_base64)
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            webm_path = temp_audio.name
        
        try:
            # Convert to WAV
            wav_path = webm_path.replace('.webm', '.wav')
            success = _convert_webm_to_wav(webm_path, wav_path)
            
            if not success:
                await send_message_to_connection(apigw_client, connection_id, {
                    'message_type': 'error',
                    'error': 'Failed to convert audio'
                })
                return
            
            # Transcribe
            transcript = _transcribe_audio_whisper(wav_path)
            
            if not transcript or len(transcript.strip()) < 2:
                await send_message_to_connection(apigw_client, connection_id, {
                    'message_type': 'error',
                    'error': 'No speech detected'
                })
                return
            
            # Send transcript back
            await send_message_to_connection(apigw_client, connection_id, {
                'message_type': 'transcript',
                'text': transcript,
                'userText': transcript
            })
            
            # Generate AI response (import OpenAI client)
            from openai import OpenAI
            openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
            
            # Build conversation
            messages = []
            messages.append({
                "role": "system",
                "content": "You are Mira, a helpful AI assistant. Keep responses concise and natural."
            })
            
            # Add history
            for msg in history[-10:]:  # Keep last 10 messages
                if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                    messages.append(msg)
            
            # Add user message
            messages.append({"role": "user", "content": transcript})
            
            # Get response
            completion = openai_client.chat.completions.create(
                model="gpt-4",
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            
            response_text = completion.choices[0].message.content
            
            # Send text response
            await send_message_to_connection(apigw_client, connection_id, {
                'message_type': 'response',
                'text': response_text,
                'userText': transcript
            })
            
            # Generate TTS audio
            audio_b64 = _generate_tts_audio(response_text)
            
            if audio_b64:
                # Send audio response
                await send_message_to_connection(apigw_client, connection_id, {
                    'message_type': 'audio_response',
                    'text': response_text,
                    'audio': audio_b64,
                    'userText': transcript
                })
            
        finally:
            # Cleanup temp files
            try:
                os.unlink(webm_path)
                if os.path.exists(wav_path):
                    os.unlink(wav_path)
            except Exception:
                pass
            
    except Exception as e:
        print(f"❌ Error processing voice message: {e}")
        import traceback
        traceback.print_exc()
        
        await send_message_to_connection(apigw_client, connection_id, {
            'message_type': 'error',
            'error': str(e)
        })


async def process_text_query_async(apigw_client, connection_id: str, user_id: str, text: str, history: list):
    """Process text query: generate response + TTS"""
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
        
        # Build conversation
        messages = [
            {
                "role": "system",
                "content": "You are Mira, a helpful AI assistant. Keep responses concise and natural."
            }
        ]
        
        # Add history
        for msg in history[-10:]:
            if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                messages.append(msg)
        
        # Add user message
        messages.append({"role": "user", "content": text})
        
        # Get response
        completion = openai_client.chat.completions.create(
            model="gpt-4",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        
        response_text = completion.choices[0].message.content
        
        # Send text response
        await send_message_to_connection(apigw_client, connection_id, {
            'message_type': 'response',
            'text': response_text,
            'userText': text
        })
        
        # Generate TTS audio
        audio_b64 = _generate_tts_audio(response_text)
        
        if audio_b64:
            await send_message_to_connection(apigw_client, connection_id, {
                'message_type': 'audio_response',
                'text': response_text,
                'audio': audio_b64,
                'userText': text
            })
        
    except Exception as e:
        print(f"❌ Error processing text query: {e}")
        import traceback
        traceback.print_exc()
        
        await send_message_to_connection(apigw_client, connection_id, {
            'message_type': 'error',
            'error': str(e)
        })

