from supabase import create_client, Client
from . import settings

def sb() -> Client:
    # Normalize URL to remove trailing slash to prevent double-slash issues
    url = settings.SUPABASE_URL.rstrip('/')
    return create_client(url, settings.SUPABASE_SERVICE_ROLE_KEY)