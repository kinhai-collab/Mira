"""
WebSocket Lambda handlers for AWS API Gateway WebSocket API
Handles real-time voice pipeline with ElevenLabs
VERSION: 2024-12-02-v3 - Fixed S3 chunk cleanup on connect/disconnect
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
s3_client = boto3.client('s3')
connections_table = dynamodb.Table(os.environ.get('CONNECTIONS_TABLE', 'mira-websocket-connections-dev'))
S3_BUCKET = os.environ.get('S3_BUCKET', 'mira-data-dev-058057616533')

# Voice pipeline will use simpler direct implementation
# We don't import the complex voice_generation module to keep Lambda package small
VOICE_AVAILABLE = True  # Always True - we'll implement basic voice processing here

# Check S3 availability (cache result)
_S3_AVAILABLE = None

def run_async_safe(coro):
    """Run async coroutine safely in Lambda environment
    Handles both cases: with and without existing event loop
    Lambda typically doesn't have a running event loop, but handles edge cases
    """
    try:
        # Try to get existing event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Event loop is running - shouldn't happen in Lambda, but create task if needed
            # This is a fallback - in Lambda we should never hit this
            import concurrent.futures
            import threading
            result = None
            exception = None
            
            def run_in_thread():
                nonlocal result, exception
                try:
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    result = new_loop.run_until_complete(coro)
                    new_loop.close()
                except Exception as e:
                    exception = e
            
            thread = threading.Thread(target=run_in_thread)
            thread.start()
            thread.join()
            
            if exception:
                raise exception
            return result
        else:
            # Event loop exists but not running - use it (common in Lambda)
            return loop.run_until_complete(coro)
    except RuntimeError:
        # No event loop exists - create new one (normal case in Lambda)
        return asyncio.run(coro)

def is_s3_available():
    """Check if S3 bucket is available"""
    global _S3_AVAILABLE
    if _S3_AVAILABLE is not None:
        return _S3_AVAILABLE
    
    try:
        s3_client.head_bucket(Bucket=S3_BUCKET)
        _S3_AVAILABLE = True
        print(f"✅ S3 bucket '{S3_BUCKET}' is available")
        return True
    except Exception as e:
        _S3_AVAILABLE = False
        print(f"⚠️ S3 bucket '{S3_BUCKET}' is not available: {e}. Using DynamoDB fallback.")
        return False


def get_chunks_from_dynamodb(connection_id: str) -> list:
    """Get audio chunks from DynamoDB (fallback when S3 unavailable)"""
    try:
        conn_item = connections_table.get_item(Key={'connectionId': connection_id})
        item = conn_item.get('Item', {})
        chunks = item.get('audioChunks', [])
        return chunks if isinstance(chunks, list) else []
    except Exception as e:
        print(f"⚠️ Error reading chunks from DynamoDB: {e}")
        return []


def store_chunks_in_dynamodb(connection_id: str, chunks: list, is_commit: bool = False):
    """Store audio chunks in DynamoDB (fallback when S3 unavailable)
    Note: DynamoDB has 400KB item limit, so we limit total chunk size
    """
    try:
        # Calculate total size - DynamoDB item limit is 400KB
        total_size = sum(len(c) for c in chunks)
        max_size = 350000  # Leave some headroom (350KB)
        
        if total_size > max_size:
            print(f"⚠️ Chunks too large for DynamoDB ({total_size}B > {max_size}B), truncating")
            # Keep only the most recent chunks that fit
            truncated = []
            current_size = 0
            for chunk in reversed(chunks):
                if current_size + len(chunk) <= max_size:
                    truncated.insert(0, chunk)
                    current_size += len(chunk)
                else:
                    break
            chunks = truncated
        
        connections_table.update_item(
            Key={'connectionId': connection_id},
            UpdateExpression='SET audioChunks = :chunks, chunkCommit = :commit, chunkUpdatedAt = :updated',
            ExpressionAttributeValues={
                ':chunks': chunks,
                ':commit': is_commit,
                ':updated': datetime.now().isoformat()
            }
        )
        print(f"📥 Stored {len(chunks)} chunks in DynamoDB (size={total_size}B)")
    except Exception as e:
        print(f"⚠️ Error storing chunks in DynamoDB: {e}")


def clear_chunks_from_dynamodb(connection_id: str):
    """Clear audio chunks from DynamoDB"""
    try:
        connections_table.update_item(
            Key={'connectionId': connection_id},
            UpdateExpression='REMOVE audioChunks, chunkCommit, chunkUpdatedAt'
        )
    except Exception as e:
        print(f"⚠️ Error clearing chunks from DynamoDB: {e}")


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


async def send_audio_in_chunks(apigw_client, connection_id: str, audio_b64: str, response_text: str, user_text: str):
    """Safely send TTS audio while respecting API Gateway 32KB limit.
    - For small audios: send a single response with embedded base64 audio.
    - For large audios: fall back to text-only (no audio) to avoid 413 errors.
    NOTE: We do NOT try to stream by splitting MP3 bytes, because arbitrary
    splits are not valid standalone audio files and will fail to play.
    """
    if not audio_b64:
        # Nothing to send, just send text-only
        await send_message_to_connection(apigw_client, connection_id, {
            'message_type': 'response',
            'type': 'response',
            'text': response_text,
            'userText': user_text
        })
        return

    # Conservative max size for base64 audio inside a single WebSocket message.
    # API Gateway hard limit is 32KB per frame; we leave headroom for JSON.
    MAX_B64_SIZE = 30000

    if len(audio_b64) <= MAX_B64_SIZE:
        # Safe to include audio directly in the response
        await send_message_to_connection(apigw_client, connection_id, {
            'message_type': 'response',
            'type': 'response',
            'text': response_text,
            'audio': audio_b64,
            'audio_base_64': audio_b64,
            'userText': user_text
        })
    else:
        # Audio would exceed frame limit – send text-only to avoid 413
        print(f"⚠️ TTS audio too large to send safely ({len(audio_b64)} base64 chars). Sending text-only response.")
        await send_message_to_connection(apigw_client, connection_id, {
            'message_type': 'response',
            'type': 'response',
            'text': response_text,
            'userText': user_text
        })


def connect_handler(event, context):
    """Handle WebSocket $connect route"""
    connection_id = event['requestContext']['connectionId']
    print(f"🚀 CONNECT v3: New connection {connection_id}")
    
    # Extract token from query string if provided
    query_params = event.get('queryStringParameters') or {}
    token = query_params.get('token', 'anonymous')
    
    # Extract user ID from token if possible
    user_id = 'anonymous'
    if token and token != 'anonymous':
        try:
            from auth_utils import get_uid_from_token
            # Pass token directly (not "Bearer <token>" format)
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
        
        # ✅ CRITICAL: Clear any old audio chunks from S3 for this connection
        # This prevents old audio from previous sessions being mixed with new audio
        try:
            s3_key = f"websocket-audio/{connection_id}/chunks.json"
            s3_client.delete_object(Bucket=S3_BUCKET, Key=s3_key)
            print(f"🧹 Cleared old S3 chunks for new connection {connection_id}")
        except Exception as s3_err:
            # Ignore errors - chunks might not exist
            print(f"📝 No old S3 chunks to clear for {connection_id}")
            
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
    
    # Clean up S3 audio chunks
    try:
        s3_key = f"websocket-audio/{connection_id}/chunks.json"
        s3_client.delete_object(Bucket=S3_BUCKET, Key=s3_key)
        print(f"🧹 Cleared S3 chunks on disconnect for {connection_id}")
    except Exception:
        pass  # Ignore errors
    
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
    
    print(f"📨 [v3] Received message from {connection_id}: {message_type}")
    
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
                from auth_utils import get_uid_from_token
                # Pass token directly (not "Bearer <token>" format)
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
        run_async_safe(send_message_to_connection(
            apigw_client,
            connection_id,
            {'message_type': 'pong', 'timestamp': datetime.now().isoformat()}
        ))
        return {'statusCode': 200, 'body': 'Pong sent'}
    
    # Handle stop_audio signal
    if message_type == 'stop_audio':
        run_async_safe(send_message_to_connection(
            apigw_client,
            connection_id,
            {'message_type': 'audio_stopped'}
        ))
        return {'statusCode': 200, 'body': 'Audio stopped'}
    
    # Handle input_audio_chunk (frontend sends audio data in chunks)
    if message_type == 'input_audio_chunk':
        if not VOICE_AVAILABLE:
            run_async_safe(send_message_to_connection(
                apigw_client,
                connection_id,
                {'message_type': 'error', 'error': 'Voice pipeline not available'}
            ))
            return {'statusCode': 200, 'body': 'Voice not available'}
        
        # Get audio chunk data - frontend uses 'audio_base_64' field
        audio_chunk = body.get('audio_base_64', body.get('audio', body.get('chunk', '')))
        is_commit = body.get('commit', False)
        
        # ✅ Use S3 for chunk storage, with DynamoDB fallback if S3 unavailable
        # S3 is preferred for large data (no 400KB limit), DynamoDB is fallback
        s3_key = f"websocket-audio/{connection_id}/chunks.json"
        use_s3 = is_s3_available()
        
        try:
            # Get connection info
            conn_item = connections_table.get_item(Key={'connectionId': connection_id})
            item = conn_item.get('Item', {})
            user_id = item.get('userId', 'anonymous')
            
            # Check processing flag - but only block COMMITS, not chunk storage
            # This allows new audio to be buffered while a previous request is being processed
            processing_flag = item.get('processing', False)
            
            # Get existing chunks (from S3 or DynamoDB)
            existing_chunks = []
            if use_s3:
                try:
                    s3_response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
                    existing_data = json.loads(s3_response['Body'].read().decode('utf-8'))
                    existing_chunks = existing_data.get('chunks', [])
                    print(f"📥 Retrieved {len(existing_chunks)} existing chunks from S3")
                except s3_client.exceptions.NoSuchKey:
                    # No existing chunks - start fresh
                    print(f"📥 No existing chunks in S3, starting fresh")
                    pass
                except Exception as s3_err:
                    print(f"⚠️ Error reading from S3: {s3_err}, falling back to DynamoDB")
                    use_s3 = False  # Switch to DynamoDB for this connection
                    existing_chunks = get_chunks_from_dynamodb(connection_id)
                    print(f"📥 Retrieved {len(existing_chunks)} existing chunks from DynamoDB (S3 fallback)")
            else:
                # S3 not available, use DynamoDB
                existing_chunks = get_chunks_from_dynamodb(connection_id)
                print(f"📥 Retrieved {len(existing_chunks)} existing chunks from DynamoDB (S3 unavailable)")
            
            # Add new chunk only if it's not empty (commit messages may have empty audio)
            if audio_chunk and len(audio_chunk.strip()) > 0:
                existing_chunks.append(audio_chunk)
            
            chunk_count = len(existing_chunks)
            total_size = sum(len(c) for c in existing_chunks)
            
            # If commit flag is set, process immediately without storing
            if is_commit:
                # ✅ Re-read processing flag fresh (it might have changed since we read the connection item)
                try:
                    fresh_item = connections_table.get_item(Key={'connectionId': connection_id})
                    processing_flag = fresh_item.get('Item', {}).get('processing', False)
                except Exception:
                    pass  # Use the old value if re-read fails
                
                # Block commits if already processing
                if processing_flag:
                    print(f"⚠️ Already processing transcription for {connection_id}, queueing commit for later")
                    # Send error to client so they know to retry
                    run_async_safe(send_message_to_connection(
                        apigw_client,
                        connection_id,
                        {'message_type': 'error', 'type': 'error', 'error': 'Already processing previous request'}
                    ))
                    return {'statusCode': 200, 'body': 'Already processing'}
                
                if not existing_chunks:
                    print(f"⚠️ Commit received but no chunks available")
                    return {'statusCode': 200, 'body': 'No chunks to process'}
                
                print(f"🔄 Commit received with {chunk_count} chunks (size={total_size}B), processing transcription")
                # Process immediately - don't store chunks when committing
                # (They'll be cleared after processing)
            else:
                # Store updated chunks (in S3 or DynamoDB) only if not committing
                if use_s3:
                    try:
                        chunks_data = {
                            'chunks': existing_chunks,
                            'commit': False,
                            'updated_at': datetime.now().isoformat()
                        }
                        s3_client.put_object(
                            Bucket=S3_BUCKET,
                            Key=s3_key,
                            Body=json.dumps(chunks_data).encode('utf-8'),
                            ContentType='application/json'
                        )
                        print(f"📥 Stored audio chunk #{chunk_count} in S3 (size={total_size}B) from {connection_id}")
                    except Exception as s3_err:
                        print(f"⚠️ Error storing chunk in S3: {s3_err}, falling back to DynamoDB")
                        use_s3 = False  # Switch to DynamoDB
                        store_chunks_in_dynamodb(connection_id, existing_chunks, False)
                else:
                    # Use DynamoDB fallback
                    store_chunks_in_dynamodb(connection_id, existing_chunks, False)
                
                # Return early if not committing - wait for more chunks
                print(f"📦 Chunk #{chunk_count} stored (commit=False), waiting for more chunks...")
                return {'statusCode': 200, 'body': 'Audio chunk received and stored'}
                
        except Exception as e:
            print(f"⚠️ Error handling audio chunk: {e}")
            import traceback
            traceback.print_exc()
            return {'statusCode': 200, 'body': 'Error handling chunk'}
        
        # If commit flag is set, process the accumulated chunks
        if is_commit:
            print(f"🔄 Commit flag received, processing {chunk_count} accumulated chunks")
            try:
                # ✅ FIX: Use conditional update to atomically set processing flag (prevents race conditions)
                try:
                    # Try to set processing flag atomically - will fail if already set
                    # Use boto3 client directly for ConditionalCheckFailedException
                    from botocore.exceptions import ClientError
                    try:
                        connections_table.update_item(
                            Key={'connectionId': connection_id},
                            UpdateExpression='SET #proc = :true',
                            ConditionExpression='attribute_not_exists(#proc) OR #proc = :false',
                            ExpressionAttributeNames={'#proc': 'processing'},
                            ExpressionAttributeValues={':true': True, ':false': False}
                        )
                        print(f"✅ Set processing flag for {connection_id}")
                    except ClientError as e:
                        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                            # Another Lambda instance is already processing
                            print(f"⚠️ Already processing transcription for {connection_id}, skipping duplicate")
                            return {'statusCode': 200, 'body': 'Already processing'}
                        raise
                except Exception as flag_err:
                    print(f"⚠️ Error setting processing flag: {flag_err}")
                    # Check if already processing
                    conn_item = connections_table.get_item(Key={'connectionId': connection_id})
                    if conn_item.get('Item', {}).get('processing', False):
                        print(f"⚠️ Already processing (checked after flag set failed)")
                        return {'statusCode': 200, 'body': 'Already processing'}
                    # Continue if flag set failed but not already processing
                
                # Combine all chunks - decode each base64 chunk and combine binary data
                combined_audio_bytes = bytearray()
                for chunk in existing_chunks:
                    if chunk and len(chunk.strip()) > 0:
                        try:
                            decoded = base64.b64decode(chunk)
                            combined_audio_bytes.extend(decoded)
                        except Exception as decode_err:
                            print(f"⚠️ Error decoding chunk: {decode_err}")
                            continue
                
                if len(combined_audio_bytes) == 0:
                    print(f"⚠️ No valid audio data after decoding chunks")
                    # Clear processing flag
                    try:
                        connections_table.update_item(
                            Key={'connectionId': connection_id},
                            UpdateExpression='REMOVE #proc',
                            ExpressionAttributeNames={'#proc': 'processing'}
                        )
                    except Exception:
                        pass
                    return {'statusCode': 200, 'body': 'No valid audio data'}
                
                # Re-encode combined binary data as base64 for process_voice_message_async
                audio_data = base64.b64encode(combined_audio_bytes).decode('utf-8')
                print(f"📦 Combined {len(existing_chunks)} chunks: {len(combined_audio_bytes)} bytes PCM16 -> {len(audio_data)} chars base64")
                
                # Clear chunks from storage (prevent reprocessing)
                if use_s3:
                    try:
                        s3_client.delete_object(Bucket=S3_BUCKET, Key=s3_key)
                    except Exception:
                        pass  # Ignore errors deleting
                else:
                    clear_chunks_from_dynamodb(connection_id)
                
                # Process transcription
                try:
                    print(f"🚀 Starting async transcription processing...")
                    run_async_safe(process_voice_message_async(
                        apigw_client,
                        connection_id,
                        user_id,
                        audio_data,
                        item.get('conversationHistory', [])
                    ))
                    print(f"✅ Transcription processing completed")
                except Exception as proc_err:
                    print(f"❌ Error in async transcription processing: {proc_err}")
                    import traceback
                    traceback.print_exc()
                    # Send error to client
                    try:
                        run_async_safe(send_message_to_connection(
                            apigw_client,
                            connection_id,
                            {'message_type': 'error', 'error': f'Transcription failed: {str(proc_err)}'}
                        ))
                    except Exception:
                        pass
                finally:
                    # Clear processing flag
                    try:
                        connections_table.update_item(
                            Key={'connectionId': connection_id},
                            UpdateExpression='REMOVE #proc',
                            ExpressionAttributeNames={'#proc': 'processing'}
                        )
                        print(f"🧹 Cleared processing flag for {connection_id}")
                    except Exception as flag_err:
                        print(f"⚠️ Error clearing processing flag: {flag_err}")
            except Exception as e:
                print(f"⚠️ Error processing commit: {e}")
                import traceback
                traceback.print_exc()
                # Clear processing flag on error
                try:
                    connections_table.update_item(
                        Key={'connectionId': connection_id},
                        UpdateExpression='REMOVE #proc',
                        ExpressionAttributeNames={'#proc': 'processing'}
                    )
                except Exception:
                    pass
        
        return {'statusCode': 200, 'body': 'Audio chunk received'}
    
    # Handle transcribe request (frontend sends this to trigger transcription)
    # Frontend uses 'type' field, but we also check 'message_type' for compatibility
    if message_type == 'transcribe':
        if not VOICE_AVAILABLE:
            run_async_safe(send_message_to_connection(
                apigw_client,
                connection_id,
                {'message_type': 'error', 'error': 'Voice pipeline not available'}
            ))
            return {'statusCode': 200, 'body': 'Voice not available'}
        
        # Get user ID and conversation history from connection
        try:
            conn_item = connections_table.get_item(Key={'connectionId': connection_id})
            item = conn_item.get('Item', {})
            user_id = item.get('userId', 'anonymous')
            conversation_history = item.get('conversationHistory', [])
            
            # ✅ Prevent duplicate processing with a lock flag
            processing_flag = item.get('processing', False)
            if processing_flag:
                print(f"⚠️ Already processing transcription for {connection_id}, skipping duplicate")
                run_async_safe(send_message_to_connection(
                    apigw_client,
                    connection_id,
                    {'message_type': 'error', 'error': 'Already processing previous request'}
                ))
                return {'statusCode': 200, 'body': 'Already processing'}
            
            # Set processing flag
            try:
                connections_table.update_item(
                    Key={'connectionId': connection_id},
                    UpdateExpression='SET #proc = :true',
                    ExpressionAttributeNames={'#proc': 'processing'},
                    ExpressionAttributeValues={':true': True}
                )
            except Exception:
                pass  # Continue even if flag set fails
        except Exception as e:
            print(f"⚠️ Could not get user ID/history: {e}")
            user_id = 'anonymous'
            conversation_history = []
        
        # Try to get audio from message body first, then from S3
        audio_data = body.get('audio_base_64', body.get('audio', body.get('audio_data', body.get('audio_base64', ''))))
        
        if not audio_data:
            # Try to read from S3 or DynamoDB
            s3_key = f"websocket-audio/{connection_id}/chunks.json"
            use_s3 = is_s3_available()
            
            audio_chunks = []
            if use_s3:
                try:
                    s3_response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
                    chunks_data = json.loads(s3_response['Body'].read().decode('utf-8'))
                    audio_chunks = chunks_data.get('chunks', [])
                except s3_client.exceptions.NoSuchKey:
                    # Try DynamoDB fallback
                    audio_chunks = get_chunks_from_dynamodb(connection_id)
                except Exception as s3_err:
                    print(f"⚠️ Error reading from S3: {s3_err}, trying DynamoDB")
                    audio_chunks = get_chunks_from_dynamodb(connection_id)
            else:
                # S3 not available, use DynamoDB
                audio_chunks = get_chunks_from_dynamodb(connection_id)
            
            if audio_chunks:
                # Decode each base64 chunk and combine binary data
                combined_audio_bytes = bytearray()
                for chunk in audio_chunks:
                    if chunk and len(chunk.strip()) > 0:
                        try:
                            decoded = base64.b64decode(chunk)
                            combined_audio_bytes.extend(decoded)
                        except Exception as decode_err:
                            print(f"⚠️ Error decoding chunk: {decode_err}")
                            continue
                
                if len(combined_audio_bytes) == 0:
                    print(f"⚠️ No valid audio data after decoding chunks")
                    # Clear processing flag
                    try:
                        connections_table.update_item(
                            Key={'connectionId': connection_id},
                            UpdateExpression='REMOVE #proc',
                            ExpressionAttributeNames={'#proc': 'processing'}
                        )
                    except Exception:
                        pass
                    run_async_safe(send_message_to_connection(
                        apigw_client,
                        connection_id,
                        {'message_type': 'error', 'error': 'No valid audio data'}
                    ))
                    return {'statusCode': 200, 'body': 'No audio data'}
                
                # Re-encode combined binary data as base64
                audio_data = base64.b64encode(combined_audio_bytes).decode('utf-8')
                print(f"📦 Combined {len(audio_chunks)} chunks: {len(combined_audio_bytes)} bytes PCM16 -> {len(audio_data)} chars base64")
        
        if not audio_data:
            print(f"⚠️ No audio data available for transcription")
            # Clear processing flag
            try:
                connections_table.update_item(
                    Key={'connectionId': connection_id},
                    UpdateExpression='REMOVE #proc',
                    ExpressionAttributeNames={'#proc': 'processing'}
                )
            except Exception:
                pass
            run_async_safe(send_message_to_connection(
                apigw_client,
                connection_id,
                {'message_type': 'error', 'error': 'No audio data available'}
            ))
            return {'statusCode': 200, 'body': 'No audio data'}
        
        print(f"🎤 Processing transcription with {len(audio_data)} chars of audio data, history: {len(conversation_history)} messages")
        
        # Process the voice message (transcribe + generate response + TTS)
        try:
            print(f"🚀 Starting async transcription processing...")
            run_async_safe(process_voice_message_async(
                apigw_client,
                connection_id,
                user_id,
                audio_data,
                conversation_history
            ))
            print(f"✅ Transcription processing completed")
        except Exception as proc_err:
            print(f"❌ Error in async transcription processing: {proc_err}")
            import traceback
            traceback.print_exc()
            # Send error to client
            try:
                run_async_safe(send_message_to_connection(
                    apigw_client,
                    connection_id,
                    {'message_type': 'error', 'error': f'Transcription failed: {str(proc_err)}'}
                ))
            except Exception:
                pass
        finally:
            # Clear processing flag and audio chunks (from S3 or DynamoDB) after processing completes
            try:
                connections_table.update_item(
                    Key={'connectionId': connection_id},
                    UpdateExpression='REMOVE #proc',
                    ExpressionAttributeNames={'#proc': 'processing'}
                )
                use_s3 = is_s3_available()
                if use_s3:
                    try:
                        s3_key = f"websocket-audio/{connection_id}/chunks.json"
                        s3_client.delete_object(Bucket=S3_BUCKET, Key=s3_key)
                        print(f"🧹 Cleared audio chunks from S3 and processing flag for {connection_id}")
                    except Exception:
                        # If S3 delete fails, also clear from DynamoDB just in case
                        clear_chunks_from_dynamodb(connection_id)
                        print(f"🧹 Cleared audio chunks from DynamoDB (S3 failed) and processing flag for {connection_id}")
                else:
                    clear_chunks_from_dynamodb(connection_id)
                    print(f"🧹 Cleared audio chunks from DynamoDB and processing flag for {connection_id}")
            except Exception as e:
                print(f"⚠️ Could not clear chunks/flag: {e}")
        
        return {'statusCode': 200, 'body': 'Processing transcription'}
    
    # Handle legacy audio_chunk/audio_input (for backward compatibility)
    if message_type == 'audio_chunk' or message_type == 'audio_input':
        if not VOICE_AVAILABLE:
            run_async_safe(send_message_to_connection(
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
        
        run_async_safe(process_voice_message_async(
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
        
        run_async_safe(process_text_query_async(
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
    
    # Helper to clear processing flag AND S3 chunks
    def clear_processing_flag():
        # Clear processing flag from DynamoDB
        try:
            connections_table.update_item(
                Key={'connectionId': connection_id},
                UpdateExpression='REMOVE #proc',
                ExpressionAttributeNames={'#proc': 'processing'}
            )
            print(f"🧹 Cleared processing flag for {connection_id}")
        except Exception as e:
            print(f"⚠️ Error clearing processing flag: {e}")
        
        # Also clear S3 chunks to prevent old audio from being reused
        try:
            s3_key = f"websocket-audio/{connection_id}/chunks.json"
            s3_client.delete_object(Bucket=S3_BUCKET, Key=s3_key)
            print(f"🧹 Cleared S3 chunks for {connection_id}")
        except Exception:
            pass  # Ignore errors - chunks might not exist
    
    try:
        # Decode base64 audio data (PCM16 little-endian, 16kHz, mono)
        audio_bytes = base64.b64decode(audio_base64)
        
        if len(audio_bytes) < 100:  # Too short, likely empty
            print(f"⚠️ Audio data too short: {len(audio_bytes)} bytes")
            await send_message_to_connection(apigw_client, connection_id, {
                'message_type': 'error',
                'error': 'Audio data too short'
            })
            clear_processing_flag()  # Clear flag on early return
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
            print(f"🎙️ Calling OpenAI Whisper API for transcription (file size: {os.path.getsize(wav_path)} bytes)...")
            from openai import OpenAI
            openai_api_key = os.environ.get('OPENAI_API_KEY')
            if not openai_api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            
            openai_client = OpenAI(api_key=openai_api_key)
            
            try:
                with open(wav_path, 'rb') as audio_file:
                    print(f"📤 Sending audio file to Whisper API...")
                    transcript_response = openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="en"  # Optional: specify language for better accuracy
                    )
                    print(f"📥 Received response from Whisper API")
                
                transcript = transcript_response.text
                print(f"✅ Whisper API returned transcript: '{transcript}' (length: {len(transcript)})")
            except Exception as whisper_err:
                print(f"❌ Whisper API error: {whisper_err}")
                import traceback
                traceback.print_exc()
                raise
            
            # Check if transcript is valid (not empty or too short)
            transcript_clean = transcript.strip() if transcript else ''
            if not transcript_clean or len(transcript_clean) < 1:
                print(f"⚠️ Empty or invalid transcript received from Whisper (original: '{transcript}', cleaned: '{transcript_clean}', audio size: {len(audio_bytes)} bytes, duration: ~{len(audio_bytes)/32000:.2f}s)")
                await send_message_to_connection(apigw_client, connection_id, {
                    'message_type': 'error',
                    'type': 'error',
                    'error': 'No speech detected'
                })
                clear_processing_flag()  # Clear flag on early return
                return
            
            # Use cleaned transcript
            transcript = transcript_clean
            
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
                        
                        clear_processing_flag()  # Clear flag on early return
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
                            'userText': transcript
                        })
                        
                        # Send response (chunked if needed)
                        if audio_b64:
                            # Send response data first (without audio)
                            await send_message_to_connection(apigw_client, connection_id, response_data)
                            # Then send audio in chunks
                            await send_audio_in_chunks(apigw_client, connection_id, audio_b64, response_data['text'], transcript)
                        else:
                            await send_message_to_connection(apigw_client, connection_id, response_data)
                        
                        print(f"✅ Sent email/calendar summary: {len(emails)} emails, {len(calendar_events)} events")
                        
                        clear_processing_flag()  # Clear flag on early return
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
            
            # Generate TTS audio using ElevenLabs (same format as local)
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
                                "model_id": "eleven_flash_v2_5",  # Same as local implementation
                                "output_format": "mp3_44100_128",  # Same as local (lower bitrate to reduce size)
                                "voice_settings": {
                                    "stability": 0.85,  # Matched to local settings
                                    "similarity_boost": 0.85,
                                    "style": 0,  # No style variation for consistency
                                    "use_speaker_boost": True
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
                            # Send audio in chunks to avoid 32KB WebSocket limit
                            await send_audio_in_chunks(apigw_client, connection_id, audio_b64, response_text, transcript)
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
            # Always clear processing flag when done
            clear_processing_flag()
            
    except Exception as e:
        print(f"❌ Error processing voice message: {e}")
        import traceback
        traceback.print_exc()
        
        await send_message_to_connection(apigw_client, connection_id, {
            'message_type': 'error',
            'error': f'Processing failed: {str(e)}'
        })
        # Clear processing flag on error
        clear_processing_flag()


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
        
        # Generate TTS audio using ElevenLabs (same format as local)
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
                            "model_id": "eleven_flash_v2_5",  # Same as local
                            "output_format": "mp3_44100_128",  # Same as local
                            "voice_settings": {
                                "stability": 0.85,
                                "similarity_boost": 0.85,
                                "style": 0,
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
        
        # Send response with audio (chunked if needed)
        if audio_b64:
            await send_audio_in_chunks(apigw_client, connection_id, audio_b64, response_text, text)
        else:
            await send_message_to_connection(apigw_client, connection_id, {
                'message_type': 'response',
                'text': response_text,
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

