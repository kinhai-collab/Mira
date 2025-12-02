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

# Voice pipeline will use simpler direct implementation
# We don't import the complex voice_generation module to keep Lambda package small
VOICE_AVAILABLE = True  # Always True - we'll implement basic voice processing here


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
    
    # Store connection in DynamoDB with fresh, empty conversation history
    try:
        ttl = int((datetime.now() + timedelta(hours=2)).timestamp())
        connections_table.put_item(
            Item={
                'connectionId': connection_id,
                'userId': user_id,
                'token': token if token != 'anonymous' else None,  # Store token for API calls
                'connectedAt': datetime.now().isoformat(),
                'conversationHistory': [],  # Initialize with empty history
                'ttl': ttl
            }
        )
        print(f"✅ Connection stored: {connection_id} (user: {user_id}) with fresh history and token")
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
    
    # Handle authorization (frontend sends this on connect with 'type' field)
    if message_type == 'authorization' or body.get('type') == 'authorization':
        print(f"✅ Authorization message received from {connection_id}")
        # Extract token if provided in message
        token = body.get('token', '')
        if token and token != 'anonymous':
            try:
                from settings import get_uid_from_token
                user_id = get_uid_from_token(token) or 'anonymous'
                # Update connection with user ID, token, and clear conversation history for fresh session
                try:
                    connections_table.update_item(
                        Key={'connectionId': connection_id},
                        UpdateExpression='SET userId = :uid, #token = :token, conversationHistory = :history',
                        ExpressionAttributeNames={
                            '#token': 'token'  # 'token' is a reserved word in DynamoDB
                        },
                        ExpressionAttributeValues={
                            ':uid': user_id,
                            ':token': token,
                            ':history': []  # Clear history on new authorization
                        }
                    )
                    print(f"✅ Updated connection {connection_id} with user ID: {user_id}, token, and cleared history")
                except Exception as e:
                    print(f"⚠️ Could not update user ID: {e}")
            except Exception:
                pass
        # Just acknowledge
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
        
        # Get audio chunk data - frontend uses 'audio_base_64' field
        audio_chunk = body.get('audio_base_64', body.get('audio', body.get('chunk', '')))
        is_commit = body.get('commit', False)
        
        if audio_chunk:  # Only store non-empty chunks
            # Store audio chunk in DynamoDB for accumulation
            try:
                # Get existing chunks or create new list
                conn_item = connections_table.get_item(Key={'connectionId': connection_id})
                item = conn_item.get('Item', {})
                existing_chunks = item.get('audioChunks', [])
                
                # Only append if chunk is not empty
                if audio_chunk:
                    existing_chunks.append(audio_chunk)
                
                # Update connection with accumulated chunks
                connections_table.update_item(
                    Key={'connectionId': connection_id},
                    UpdateExpression='SET audioChunks = :chunks, commitFlag = :commit',
                    ExpressionAttributeValues={
                        ':chunks': existing_chunks,
                        ':commit': is_commit
                    }
                )
                print(f"📥 Stored audio chunk #{len(existing_chunks)} (commit={is_commit}) from {connection_id}")
            except Exception as e:
                print(f"⚠️ Error storing audio chunk: {e}")
                import traceback
                traceback.print_exc()
        
        # If commit flag is set, trigger transcription immediately
        if is_commit:
            print(f"🔄 Commit flag received, triggering transcription for {connection_id}")
            # Get accumulated chunks and process
            try:
                conn_item = connections_table.get_item(Key={'connectionId': connection_id})
                item = conn_item.get('Item', {})
                user_id = item.get('userId', 'anonymous')
                audio_chunks = item.get('audioChunks', [])
                
                if audio_chunks:
                    # Combine all chunks
                    audio_data = ''.join(audio_chunks)
                    print(f"📦 Combining {len(audio_chunks)} chunks for transcription")
                    
                    # Clear chunks
                    connections_table.update_item(
                        Key={'connectionId': connection_id},
                        UpdateExpression='REMOVE audioChunks, commitFlag'
                    )
                    
                    # Process transcription
                    asyncio.run(process_voice_message_async(
                        apigw_client,
                        connection_id,
                        user_id,
                        audio_data,
                        []
                    ))
            except Exception as e:
                print(f"⚠️ Error processing commit: {e}")
                import traceback
                traceback.print_exc()
        
        return {'statusCode': 200, 'body': 'Audio chunk received'}
    
    # Handle transcribe request (frontend sends this to trigger transcription)
    # Frontend uses 'type' field, but we also check 'message_type' for compatibility
    if message_type == 'transcribe':
        if not VOICE_AVAILABLE:
            asyncio.run(send_message_to_connection(
                apigw_client,
                connection_id,
                {'message_type': 'error', 'error': 'Voice pipeline not available'}
            ))
            return {'statusCode': 200, 'body': 'Voice not available'}
        
        # Get user ID, accumulated audio chunks, and conversation history from connection
        try:
            conn_item = connections_table.get_item(Key={'connectionId': connection_id})
            item = conn_item.get('Item', {})
            user_id = item.get('userId', 'anonymous')
            audio_chunks = item.get('audioChunks', [])
            conversation_history = item.get('conversationHistory', [])
        except Exception as e:
            print(f"⚠️ Could not get user ID/chunks/history: {e}")
            user_id = 'anonymous'
            audio_chunks = []
            conversation_history = []
        
        # Try to get audio from message body first, then from accumulated chunks
        audio_data = body.get('audio_base_64', body.get('audio', body.get('audio_data', body.get('audio_base64', ''))))
        
        if not audio_data and audio_chunks:
            # Combine all accumulated chunks
            audio_data = ''.join(audio_chunks)
            print(f"📦 Combined {len(audio_chunks)} audio chunks from storage")
        
        if not audio_data:
            print(f"⚠️ No audio data available for transcription (chunks: {len(audio_chunks)})")
            asyncio.run(send_message_to_connection(
                apigw_client,
                connection_id,
                {'message_type': 'error', 'error': 'No audio data available'}
            ))
            return {'statusCode': 200, 'body': 'No audio data'}
        
        print(f"🎤 Processing transcription with {len(audio_data)} chars of audio data, history: {len(conversation_history)} messages")
        
        # Process the voice message (transcribe + generate response + TTS)
        # Clear chunks only AFTER successful processing
        asyncio.run(process_voice_message_async(
            apigw_client,
            connection_id,
            user_id,
            audio_data,
            conversation_history  # Use stored history instead of body.get('history', [])
        ))
        
        # Clear audio chunks after processing completes
        try:
            connections_table.update_item(
                Key={'connectionId': connection_id},
                UpdateExpression='REMOVE audioChunks, commitFlag'
            )
            print(f"🧹 Cleared audio chunks for {connection_id}")
        except Exception as e:
            print(f"⚠️ Could not clear chunks: {e}")
        
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
    """Process voice message: transcribe + generate response + TTS
    Frontend sends PCM16 little-endian audio at 16kHz, base64 encoded
    """
    import tempfile
    import struct
    import wave
    
    try:
        # Decode base64 audio data (PCM16 little-endian, 16kHz, mono)
        audio_bytes = base64.b64decode(audio_base64)
        
        if len(audio_bytes) < 100:  # Too short, likely empty
            print(f"⚠️ Audio data too short: {len(audio_bytes)} bytes")
            await send_message_to_connection(apigw_client, connection_id, {
                'message_type': 'error',
                'error': 'Audio data too short'
            })
            return
        
        # Convert PCM16 bytes to WAV file for Whisper API
        # PCM16 is 16-bit (2 bytes per sample), little-endian
        wav_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_wav:
                wav_path = temp_wav.name
                
                # Write WAV header
                sample_rate = 16000
                num_channels = 1
                bits_per_sample = 16
                num_samples = len(audio_bytes) // 2  # 2 bytes per sample
                byte_rate = sample_rate * num_channels * bits_per_sample // 8
                block_align = num_channels * bits_per_sample // 8
                data_size = num_samples * block_align
                file_size = 36 + data_size
                
                # WAV header
                temp_wav.write(b'RIFF')
                temp_wav.write(struct.pack('<I', file_size))
                temp_wav.write(b'WAVE')
                temp_wav.write(b'fmt ')
                temp_wav.write(struct.pack('<I', 16))  # fmt chunk size
                temp_wav.write(struct.pack('<H', 1))   # audio format (PCM)
                temp_wav.write(struct.pack('<H', num_channels))
                temp_wav.write(struct.pack('<I', sample_rate))
                temp_wav.write(struct.pack('<I', byte_rate))
                temp_wav.write(struct.pack('<H', block_align))
                temp_wav.write(struct.pack('<H', bits_per_sample))
                temp_wav.write(b'data')
                temp_wav.write(struct.pack('<I', data_size))
                temp_wav.write(audio_bytes)
            
            print(f"📝 Created WAV file: {len(audio_bytes)} bytes PCM16 -> {wav_path}")
            
            # Transcribe using OpenAI Whisper API
            from openai import OpenAI
            openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
            
            with open(wav_path, 'rb') as audio_file:
                transcript_response = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"  # Optional: specify language for better accuracy
                )
            
            transcript = transcript_response.text
            
            if not transcript or len(transcript.strip()) < 2:
                await send_message_to_connection(apigw_client, connection_id, {
                    'message_type': 'error',
                    'error': 'No speech detected'
                })
                return
            
            print(f"📝 Transcribed: {transcript}")
            
            # Send transcript back (frontend expects committed_transcript)
            await send_message_to_connection(apigw_client, connection_id, {
                'message_type': 'committed_transcript',
                'type': 'committed_transcript',
                'text': transcript,
                'userText': transcript
            })
            
            # ✅ CHECK FOR CALENDAR ACTIONS FIRST (schedule/cancel/reschedule)
            try:
                from voice_processor_shared import check_calendar_action, generate_tts_audio
                
                # Get user token from connection
                conn_item = connections_table.get_item(Key={'connectionId': connection_id})
                item = conn_item.get('Item', {})
                # Note: You'll need to store token in DynamoDB during connection
                # For now, we'll skip calendar actions if token not available
                user_token = item.get('token')
                
                if user_token:
                    cal_action_result = await check_calendar_action(
                        transcript,
                        user_token,
                        user_timezone="UTC"  # TODO: Get from user profile
                    )
                    
                    if cal_action_result:
                        print(f"📅 Calendar action detected: {cal_action_result.get('action')}")
                        
                        # Generate TTS for calendar action response
                        audio_b64 = await generate_tts_audio(cal_action_result.get('text', ''))
                        
                        # Send calendar action response
                        await send_message_to_connection(apigw_client, connection_id, {
                            'message_type': 'response',
                            'type': 'response',
                            'text': cal_action_result.get('text', ''),
                            'action': cal_action_result.get('action'),
                            'actionData': cal_action_result.get('actionData', {}),
                            'audio': audio_b64,
                            'audio_base_64': audio_b64,
                            'userText': transcript
                        })
                        
                        return  # Exit early - calendar action handled
            except Exception as e:
                print(f"⚠️ Error checking calendar action: {e}")
                import traceback
                traceback.print_exc()
            
            # ✅ CHECK FOR EMAIL/CALENDAR SUMMARY COMMANDS
            try:
                from voice_processor_shared import (
                    detect_email_calendar_intent,
                    fetch_email_calendar_data,
                    build_email_calendar_summary_response,
                    generate_tts_audio
                )
                
                has_email_intent, has_calendar_intent = await detect_email_calendar_intent(transcript)
                
                if has_email_intent or has_calendar_intent:
                    print(f"📧 Email/Calendar command detected (email={has_email_intent}, calendar={has_calendar_intent})")
                    
                    # Get user token
                    conn_item = connections_table.get_item(Key={'connectionId': connection_id})
                    item = conn_item.get('Item', {})
                    user_token = item.get('token')
                    
                    if user_token:
                        # Fetch data
                        emails, calendar_events = await fetch_email_calendar_data(
                            user_token,
                            has_email_intent,
                            has_calendar_intent,
                            user_timezone="UTC"  # TODO: Get from user profile
                        )
                        
                        # Build response
                        response_data = build_email_calendar_summary_response(
                            emails,
                            calendar_events,
                            has_email_intent,
                            has_calendar_intent
                        )
                        
                        # Generate TTS
                        audio_b64 = await generate_tts_audio(response_data['text'])
                        
                        # Add fields for frontend
                        response_data.update({
                            'type': 'response',
                            'audio': audio_b64,
                            'audio_base_64': audio_b64,
                            'userText': transcript
                        })
                        
                        # Send response
                        await send_message_to_connection(apigw_client, connection_id, response_data)
                        
                        print(f"✅ Sent email/calendar summary: {len(emails)} emails, {len(calendar_events)} events")
                        
                        return  # Exit early - summary handled
            except Exception as e:
                print(f"⚠️ Error handling email/calendar summary: {e}")
                import traceback
                traceback.print_exc()
            
            # Build conversation for AI response
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
            messages.append({"role": "user", "content": transcript})
            
            # Get AI response
            completion = openai_client.chat.completions.create(
                model="gpt-4",
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            
            response_text = completion.choices[0].message.content
            print(f"🤖 AI Response: {response_text}")
            
            # Update conversation history in DynamoDB
            try:
                new_history = history[-10:] if history else []  # Keep last 10 messages
                new_history.append({"role": "user", "content": transcript})
                new_history.append({"role": "assistant", "content": response_text})
                
                connections_table.update_item(
                    Key={'connectionId': connection_id},
                    UpdateExpression='SET conversationHistory = :history',
                    ExpressionAttributeValues={':history': new_history}
                )
                print(f"💾 Updated conversation history ({len(new_history)} messages)")
            except Exception as hist_err:
                print(f"⚠️ Could not update history: {hist_err}")
            
            # Generate TTS audio using ElevenLabs
            elevenlabs_key = os.environ.get('ELEVENLABS_API_KEY')
            elevenlabs_voice = os.environ.get('ELEVENLABS_VOICE_ID')
            
            if elevenlabs_key and elevenlabs_voice:
                try:
                    import httpx
                    async with httpx.AsyncClient() as client:
                        tts_response = await client.post(
                            f"https://api.elevenlabs.io/v1/text-to-speech/{elevenlabs_voice}",
                            headers={
                                "xi-api-key": elevenlabs_key,
                                "Content-Type": "application/json"
                            },
                            json={
                                "text": response_text,
                                "model_id": "eleven_multilingual_v2",  # Higher quality model (same as greeting)
                                "output_format": "mp3_44100_192",  # Higher quality MP3: 44.1kHz, 192kbps (increased from 128kbps)
                                "voice_settings": {
                                    "stability": 0.65,  # Balanced stability (matched to greeting settings)
                                    "similarity_boost": 0.8,  # Higher clarity
                                    "style": 0.3,  # Slight style for natural speech
                                    "use_speaker_boost": True  # Enhanced clarity
                                }
                            },
                            timeout=30.0
                        )
                    
                    if tts_response.status_code == 200:
                        audio_bytes = tts_response.content
                        audio_b64 = base64.b64encode(audio_bytes).decode()
                        print(f"🔊 Generated TTS audio: {len(audio_bytes)} bytes ({len(audio_b64)} chars base64)")
                        
                        # Validate audio data
                        if len(audio_bytes) < 100:
                            print(f"⚠️ TTS audio too short: {len(audio_bytes)} bytes")
                            # Send text-only response
                            await send_message_to_connection(apigw_client, connection_id, {
                                'message_type': 'response',
                                'type': 'response',
                                'text': response_text,
                                'userText': transcript
                            })
                        else:
                            # Send response with audio (frontend expects audio_base_64 field)
                            await send_message_to_connection(apigw_client, connection_id, {
                                'message_type': 'response',
                                'type': 'response',
                                'text': response_text,
                                'audio': audio_b64,
                                'audio_base_64': audio_b64,  # Frontend uses this field name
                                'userText': transcript
                            })
                    else:
                        # Send text-only response if TTS fails
                        print(f"⚠️ TTS failed: {tts_response.status_code} - {tts_response.text[:200]}")
                        await send_message_to_connection(apigw_client, connection_id, {
                            'message_type': 'response',
                            'type': 'response',
                            'text': response_text,
                            'userText': transcript
                        })
                except Exception as tts_error:
                    print(f"⚠️ TTS error: {tts_error}")
                    import traceback
                    traceback.print_exc()
                    # Send text-only response
                    await send_message_to_connection(apigw_client, connection_id, {
                        'message_type': 'response',
                        'type': 'response',
                        'text': response_text,
                        'userText': transcript
                    })
            else:
                # No TTS credentials, send text-only
                await send_message_to_connection(apigw_client, connection_id, {
                    'message_type': 'response',
                    'type': 'response',
                    'text': response_text,
                    'userText': transcript
                })
            
        finally:
            # Cleanup temp files
            try:
                if wav_path and os.path.exists(wav_path):
                    os.unlink(wav_path)
            except Exception:
                pass
            
    except Exception as e:
        print(f"❌ Error processing voice message: {e}")
        import traceback
        traceback.print_exc()
        
        await send_message_to_connection(apigw_client, connection_id, {
            'message_type': 'error',
            'error': f'Processing failed: {str(e)}'
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
        
        # Generate TTS audio using ElevenLabs (same as voice pipeline)
        elevenlabs_key = os.environ.get('ELEVENLABS_API_KEY')
        elevenlabs_voice = os.environ.get('ELEVENLABS_VOICE_ID')
        
        audio_b64 = None
        if elevenlabs_key and elevenlabs_voice:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    tts_response = await client.post(
                        f"https://api.elevenlabs.io/v1/text-to-speech/{elevenlabs_voice}",
                        headers={
                            "xi-api-key": elevenlabs_key,
                            "Content-Type": "application/json"
                        },
                        json={
                            "text": response_text,
                            "model_id": "eleven_multilingual_v2",
                            "output_format": "mp3_44100_192",
                            "voice_settings": {
                                "stability": 0.65,
                                "similarity_boost": 0.8,
                                "style": 0.3,
                                "use_speaker_boost": True
                            }
                        },
                        timeout=30.0
                    )
                
                if tts_response.status_code == 200:
                    audio_bytes = tts_response.content
                    audio_b64 = base64.b64encode(audio_bytes).decode()
            except Exception as tts_error:
                print(f"⚠️ TTS error: {tts_error}")
        
        # Send response with audio
        await send_message_to_connection(apigw_client, connection_id, {
            'message_type': 'response',
            'text': response_text,
            'audio': audio_b64,
            'audio_base_64': audio_b64,
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

