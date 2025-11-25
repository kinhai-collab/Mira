from .greeting import generate_greeting
from .busy_level import calculate_busy_level, describe_busy_level
from .mood_check import get_user_mood, adjust_voice_tone
from .event_reader import get_today_events, read_events
from .daily_summary import get_weather_and_commute
from .emotional_closure import get_closing_phrase
from .email_summary import get_email_summary, get_email_counts

from openai import OpenAI
import os

openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def run_morning_brief(user_id: str, user_name: str, tz: str):
    """
    Orchestrates full Morning Brief flow following GA-01 to GA-05.
    """

    # 1️⃣ Greeting
    greeting_text = generate_greeting(user_name)
    print("Greeting:", greeting_text)

    # 2️⃣ Fetch today's events
    events = get_today_events(user_id, tz)

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

    # 7️⃣ Email summary
    email_summary = get_email_summary(user_id)

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

    # 11️⃣ Get email counts for UI
    email_counts = get_email_counts(user_id)

    return {
            "text": brief, 
            "audio_base64": audio_base64, 
            "audio_filename": filename,
            "events": events,
            "total_events": len(events),
            "email_counts": email_counts
        }
