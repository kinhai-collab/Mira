import os
from datetime import timedelta

# Reads from your existing .env without touching your current config
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")
GOOGLE_WEBHOOK_URL = os.getenv("GOOGLE_WEBHOOK_URL", "")

# Optional (not needed when using PKCE)
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Tuning: full-sync window
INITIAL_SYNC_MONTHS_BACK = int(os.getenv("GCALENDAR_INITIAL_SYNC_MONTHS_BACK", "12"))
INITIAL_SYNC_MONTHS_FWD  = int(os.getenv("GCALENDAR_INITIAL_SYNC_MONTHS_FWD", "18"))

# Rate limit (1000 requests / 100s per user)
RATE_LIMIT_MAX = int(os.getenv("GCALENDAR_RATE_LIMIT_MAX", "1000"))
RATE_LIMIT_WINDOW_SEC = float(os.getenv("GCALENDAR_RATE_LIMIT_WINDOW_SEC", "100.0"))

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/tasks",
    "openid",
    "email",
]