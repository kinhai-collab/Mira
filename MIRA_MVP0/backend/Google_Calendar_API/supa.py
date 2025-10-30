from supabase import create_client, Client
from . import settings

def sb() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)