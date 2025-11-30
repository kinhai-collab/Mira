"""
DynamoDB state management for Lambda/App Runner
Replaces in-memory state with persistent storage
"""
import boto3
import hashlib
import json
import time
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

# Singleton pattern for connection reuse across Lambda invocations
_dynamodb = None
_transcripts_table = None
_cache_table = None
_sessions_table = None

# Environment detection
IS_LAMBDA = os.getenv('AWS_EXECUTION_ENV') is not None
IS_APP_RUNNER = os.getenv('AWS_EXECUTION_ENV') is not None or os.getenv('PORT') is not None
USE_DYNAMODB = IS_LAMBDA or IS_APP_RUNNER or os.getenv('USE_DYNAMODB', '').lower() == 'true'

# Local fallback for development
_local_transcripts = set()
_local_cache = {}


def get_dynamodb():
    """Get or create DynamoDB resource (singleton)"""
    global _dynamodb
    if _dynamodb is None:
        # Lambda automatically sets AWS_DEFAULT_REGION, boto3 uses it by default
        region = os.getenv('AWS_DEFAULT_REGION') or os.getenv('AWS_REGION', 'us-east-2')
        _dynamodb = boto3.resource('dynamodb', region_name=region)
    return _dynamodb


def get_transcripts_table():
    """Get transcripts table"""
    global _transcripts_table
    if _transcripts_table is None:
        stage = os.getenv('STAGE', 'dev')
        table_name = os.getenv('TRANSCRIPTS_TABLE', f'mira-transcripts-{stage}')
        _transcripts_table = get_dynamodb().Table(table_name)
    return _transcripts_table


def get_cache_table():
    """Get cache table"""
    global _cache_table
    if _cache_table is None:
        stage = os.getenv('STAGE', 'dev')
        table_name = os.getenv('CACHE_TABLE', f'mira-cache-{stage}')
        _cache_table = get_dynamodb().Table(table_name)
    return _cache_table


def get_sessions_table():
    """Get sessions table"""
    global _sessions_table
    if _sessions_table is None:
        stage = os.getenv('STAGE', 'dev')
        table_name = os.getenv('SESSIONS_TABLE', f'mira-sessions-{stage}')
        _sessions_table = get_dynamodb().Table(table_name)
    return _sessions_table


# ============================================================================
# TRANSCRIPT DEDUPLICATION
# ============================================================================

def check_duplicate_transcript(text: str) -> bool:
    """
    Check if transcript was already processed (permanent deduplication)
    Returns True if duplicate, False if new
    """
    if not text or not text.strip():
        return True
    
    text_normalized = text.strip().lower()
    text_hash = hashlib.md5(text_normalized.encode('utf-8')).hexdigest()
    
    if not USE_DYNAMODB:
        # Local fallback for development
        return text_hash in _local_transcripts
    
    try:
        table = get_transcripts_table()
        response = table.get_item(Key={'hash': text_hash})
        return 'Item' in response
    except Exception as e:
        print(f"⚠️ Error checking duplicate transcript: {e}")
        return False


def mark_transcript_processed(text: str):
    """Mark transcript as processed (permanent storage)"""
    if not text or not text.strip():
        return
    
    text_normalized = text.strip().lower()
    text_hash = hashlib.md5(text_normalized.encode('utf-8')).hexdigest()
    
    if not USE_DYNAMODB:
        # Local fallback
        _local_transcripts.add(text_hash)
        return
    
    try:
        table = get_transcripts_table()
        table.put_item(Item={
            'hash': text_hash,
            'text': text[:200],  # Store first 200 chars for debugging
            'timestamp': int(time.time()),
            'ttl': int(time.time()) + 86400  # Auto-delete after 24 hours
        })
    except Exception as e:
        print(f"⚠️ Error marking transcript processed: {e}")


# ============================================================================
# CONVERSATION CACHE
# ============================================================================

def get_conversation_cache(user_id: str, cache_type: str = "conversation") -> Optional[Dict[str, Any]]:
    """
    Get cached data for user
    cache_type: "conversation", "calendar", "email", etc.
    """
    if not USE_DYNAMODB:
        # Local fallback
        key = f"{user_id}:{cache_type}"
        cached = _local_cache.get(key)
        if cached and cached.get('expires', 0) > time.time():
            return cached.get('data')
        return None
    
    try:
        table = get_cache_table()
        response = table.get_item(Key={
            'userId': user_id,
            'cacheType': cache_type
        })
        
        item = response.get('Item')
        if not item:
            return None
        
        # Check TTL
        if item.get('ttl', 0) < int(time.time()):
            return None
        
        return item.get('data')
    except Exception as e:
        print(f"⚠️ Error getting cache: {e}")
        return None


def set_conversation_cache(user_id: str, data: Dict[str, Any], cache_type: str = "conversation", ttl_seconds: int = 3600):
    """
    Cache data for user
    ttl_seconds: Time to live in seconds (default: 1 hour)
    """
    if not USE_DYNAMODB:
        # Local fallback
        key = f"{user_id}:{cache_type}"
        _local_cache[key] = {
            'data': data,
            'expires': time.time() + ttl_seconds
        }
        return
    
    try:
        table = get_cache_table()
        table.put_item(Item={
            'userId': user_id,
            'cacheType': cache_type,
            'data': data,
            'timestamp': int(time.time()),
            'ttl': int(time.time()) + ttl_seconds
        })
    except Exception as e:
        print(f"⚠️ Error setting cache: {e}")


def clear_conversation_cache(user_id: str, cache_type: str = "conversation"):
    """Clear cached data for user"""
    if not USE_DYNAMODB:
        key = f"{user_id}:{cache_type}"
        _local_cache.pop(key, None)
        return
    
    try:
        table = get_cache_table()
        table.delete_item(Key={
            'userId': user_id,
            'cacheType': cache_type
        })
    except Exception as e:
        print(f"⚠️ Error clearing cache: {e}")


# ============================================================================
# SESSION MANAGEMENT (for App Runner WebSocket tracking)
# ============================================================================

def store_websocket_session(connection_id: str, user_id: str, metadata: Optional[Dict] = None):
    """Store WebSocket session info"""
    if not USE_DYNAMODB:
        return
    
    try:
        table = get_sessions_table()
        table.put_item(Item={
            'connectionId': connection_id,
            'userId': user_id,
            'metadata': metadata or {},
            'connectedAt': datetime.utcnow().isoformat(),
            'timestamp': int(time.time()),
            'ttl': int(time.time()) + 3600  # 1 hour session
        })
    except Exception as e:
        print(f"⚠️ Error storing WebSocket session: {e}")


def get_websocket_session(connection_id: str) -> Optional[Dict[str, Any]]:
    """Get WebSocket session info"""
    if not USE_DYNAMODB:
        return None
    
    try:
        table = get_sessions_table()
        response = table.get_item(Key={'connectionId': connection_id})
        return response.get('Item')
    except Exception as e:
        print(f"⚠️ Error getting WebSocket session: {e}")
        return None


def delete_websocket_session(connection_id: str):
    """Delete WebSocket session"""
    if not USE_DYNAMODB:
        return
    
    try:
        table = get_sessions_table()
        table.delete_item(Key={'connectionId': connection_id})
    except Exception as e:
        print(f"⚠️ Error deleting WebSocket session: {e}")


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_all_user_sessions(user_id: str) -> List[Dict[str, Any]]:
    """Get all active sessions for a user"""
    if not USE_DYNAMODB:
        return []
    
    try:
        table = get_sessions_table()
        response = table.query(
            IndexName='UserIdIndex',
            KeyConditionExpression='userId = :uid',
            ExpressionAttributeValues={':uid': user_id}
        )
        return response.get('Items', [])
    except Exception as e:
        print(f"⚠️ Error getting user sessions: {e}")
        return []


def cleanup_expired_cache():
    """
    Clean up expired cache entries (optional maintenance function)
    Note: DynamoDB TTL handles this automatically
    """
    pass


# ============================================================================
# INITIALIZATION
# ============================================================================

def init_dynamodb():
    """Initialize DynamoDB connections (call once at startup)"""
    if USE_DYNAMODB:
        try:
            get_dynamodb()
            get_transcripts_table()
            get_cache_table()
            get_sessions_table()
            print("✅ DynamoDB connections initialized")
        except Exception as e:
            print(f"⚠️ Error initializing DynamoDB: {e}")
    else:
        print("ℹ️ Using local state (development mode)")

