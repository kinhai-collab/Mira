from .greeting import generate_greeting
from .busy_level import calculate_busy_level, describe_busy_level
from .mood_check import get_user_mood, adjust_voice_tone
from .event_reader import get_today_events, read_events
from .daily_summary import get_weather_and_commute
from .emotional_closure import get_closing_phrase
from .email_summary import get_email_summary, get_email_counts
from voice.voice_generation import generate_voice
from Google_Calendar_API.service import get_creds, _creds
from googleapiclient.discovery import build
import asyncio
import concurrent.futures
from datetime import datetime, timedelta, timezone

from openai import OpenAI
import os

openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def run_morning_brief(user_id: str, user_name: str, tz: str):
    """
    Orchestrates full Morning Brief flow following GA-01 to GA-05.
    Optimized to fetch credentials once and parallelize operations.
    """

    # ✅ Fetch credentials ONCE and reuse them
    print(f"📋 Morning Brief: Fetching credentials once for user {user_id}")
    gmail_creds_row = get_creds(user_id)
    gmail_credentials = None
    outlook_token = None
    
    if gmail_creds_row:
        gmail_credentials = _creds(gmail_creds_row)  # ✅ Store credentials, not service (services aren't thread-safe)
        print("✅ Morning Brief: Gmail credentials fetched (will build services per-thread)")
    
    # ✅ Fetch Outlook token once and cache it
    try:
        from supabase import create_client
        import os
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            supabase_db = create_client(SUPABASE_URL.rstrip('/'), SUPABASE_SERVICE_ROLE_KEY)
            res = supabase_db.table("outlook_credentials").select("*").eq("uid", user_id).execute()
            if res.data and len(res.data) > 0:
                creds = res.data[0]
                outlook_token = creds.get("access_token")
                expiry_str = creds.get("expiry")
                
                # Check if token is expired and refresh if needed
                if expiry_str:
                    from datetime import timezone
                    try:
                        expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                        now_utc = datetime.now(timezone.utc)
                        if expiry <= (now_utc + timedelta(minutes=5)):
                            refresh_token = creds.get("refresh_token")
                            if refresh_token:
                                import requests
                                MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
                                MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
                                MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
                                
                                data = {
                                    "client_id": MICROSOFT_CLIENT_ID,
                                    "scope": "User.Read Calendars.ReadWrite Mail.Read",
                                    "refresh_token": refresh_token,
                                    "grant_type": "refresh_token",
                                    "client_secret": MICROSOFT_CLIENT_SECRET
                                }
                                refresh_res = requests.post(MICROSOFT_TOKEN_URL, data=data)
                                new_token_data = refresh_res.json()
                                
                                if "access_token" in new_token_data:
                                    expires_in = new_token_data.get("expires_in", 3600)
                                    new_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                                    update_payload = {
                                        "access_token": new_token_data.get("access_token"),
                                        "refresh_token": new_token_data.get("refresh_token", refresh_token),
                                        "expiry": new_expiry.isoformat(),
                                    }
                                    supabase_db.table("outlook_credentials").update(update_payload).eq("uid", user_id).execute()
                                    outlook_token = new_token_data.get("access_token")
                                    print("✅ Morning Brief: Outlook token refreshed")
                    except Exception as e:
                        print(f"⚠️ Error refreshing Outlook token in morning brief: {e}")
                        import traceback
                        traceback.print_exc()
    except Exception as e:
        print(f"⚠️ Error fetching Outlook token: {e}")
    
    if outlook_token:
        print("✅ Morning Brief: Outlook token fetched (cached)")

    # 1️⃣ Greeting
    greeting_text = generate_greeting(user_name)
    print("Greeting:", greeting_text)

    # ✅ Fetch events (pass outlook_token to avoid re-fetching credentials)
    events = get_today_events(user_id, tz, outlook_token)
    
    # ✅ Fetch email summary and counts - run sequentially to avoid SSL/thread-safety issues
    # Gmail API client is not thread-safe, so we run sequentially but still reuse credentials
    email_summary = ""
    email_counts = {"gmail_count": 0, "outlook_count": 0, "important_count": 0, "total_unread": 0}
    
    if gmail_credentials:
        # ✅ Build service instances sequentially (Gmail API is not thread-safe)
        # But we still avoid re-fetching credentials by passing them
        gmail_service = build("gmail", "v1", credentials=gmail_credentials)
        email_summary = get_email_summary(user_id, gmail_service)
        
        # Build new service instance for counts (to avoid connection reuse issues)
        # ✅ Also pass outlook_token to avoid re-fetching Outlook credentials
        gmail_service2 = build("gmail", "v1", credentials=gmail_credentials)
        email_counts = get_email_counts(user_id, gmail_service2, outlook_token)
    else:
        # Fallback if no Gmail credentials
        email_summary = get_email_summary(user_id)
        email_counts = get_email_counts(user_id, None, outlook_token)  # ✅ Still pass outlook_token

    # 3️⃣ Busy level analysis
    busy_minutes = calculate_busy_level(events, tz)
    busy_level_desc = describe_busy_level(busy_minutes, events)
    print("Busy Level:", busy_level_desc)

    # 4️⃣ Mood check-in (skip interactive input for API calls)
    mood = get_user_mood(skip_interactive=True)
    adjust_voice_tone(mood)

    # 5️⃣ Daily context (weather + commute)
    weather_summary, commute_summary = get_weather_and_commute(user_id, events)

    # 6️⃣ Event read-out
    event_summary = read_events(events)

    # 8️⃣ Emotional closure
    closing_phrase = get_closing_phrase(user_name, mood)

    # 9️⃣ Combine into single brief text
    brief_parts = [
        greeting_text,
        f"Your day looks {busy_level_desc}.",
        weather_summary,
        commute_summary,
        event_summary,
    ]
    
    if email_summary:
        brief_parts.append(email_summary)
    
    brief_parts.append(closing_phrase)
    
    brief = "\n\n".join(filter(None, brief_parts))

    # 10️⃣ Generate audio
    audio_base64, filename = generate_voice(brief)

    return {
            "text": brief, 
            "audio_base64": audio_base64, 
            "audio_filename": filename,
            "events": events,
            "total_events": len(events),
            "email_counts": email_counts
        }
