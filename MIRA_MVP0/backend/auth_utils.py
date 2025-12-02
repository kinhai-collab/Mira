"""
Standalone authentication utilities for Lambda functions
Does not require FastAPI - can be used in WebSocket Lambda
"""
import os
from typing import Optional

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Create Supabase client if available
supabase: Optional[Client] = None
if SUPABASE_AVAILABLE and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(SUPABASE_URL.rstrip('/'), SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        pass


def get_uid_from_token(authorization: str) -> Optional[str]:
    """
    Extract UID from the Bearer token in the Authorization header.
    Standalone version that doesn't require FastAPI.
    Returns None on error instead of raising exceptions.
    """
    if not authorization:
        return None
    
    # Handle both "Bearer <token>" and just "<token>" formats
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    else:
        token = authorization
    
    if not token or token == 'anonymous':
        return None
    
    if not SUPABASE_AVAILABLE or not supabase:
        return None
    
    try:
        user_resp = supabase.auth.get_user(token)
        if user_resp and user_resp.user:
            return user_resp.user.id
    except Exception as e:
        # Log but don't raise - return None for graceful degradation
        print(f"⚠️ Token validation error: {e}")
    
    return None


def get_email_from_token(authorization: str) -> Optional[str]:
    """
    Extract email from the Bearer token.
    Returns None on error instead of raising exceptions.
    """
    if not authorization:
        return None
    
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    else:
        token = authorization
    
    if not token or token == 'anonymous':
        return None
    
    if not SUPABASE_AVAILABLE or not supabase:
        return None
    
    try:
        user_resp = supabase.auth.get_user(token)
        if user_resp and user_resp.user:
            return user_resp.user.email
    except Exception:
        pass
    
    return None

