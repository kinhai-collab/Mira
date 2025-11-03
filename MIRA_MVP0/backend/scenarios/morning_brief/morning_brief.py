from backend.scenarios.morning_brief.greeting import generate_greeting
from backend.scenarios.morning_brief.busy_level import calculate_busy_level, describe_busy_level
from backend.scenarios.morning_brief.mood_check import get_user_mood, adjust_voice_tone
from backend.scenarios.morning_brief.event_reader import get_today_events, read_events
from backend.scenarios.morning_brief.daily_summary import get_weather_and_commute
from backend.scenarios.morning_brief.emotional_closure import get_closing_phrase
from backend.voice.voice_generation import generate_voice


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

    # 4️⃣ Mood check-in
    mood = get_user_mood()
    adjust_voice_tone(mood)

    # 5️⃣ Daily context (weather + commute)
    weather_summary, commute_summary = get_weather_and_commute(user_id, events)

    # 6️⃣ Event read-out
    event_summary = read_events(events)

    # 7️⃣ Check if user wants quick mode
    # quick_mode = check_quick_mode()

    # 8️⃣ Emotional closure
    closing_phrase = get_closing_phrase(user_name, mood)

    # 9️⃣ Combine into single brief text
    brief = (
        f"{greeting_text}\n\n"
        f"Your day looks {busy_level_desc}.\n\n"
        f"{weather_summary}\n{commute_summary}\n\n"
        f"{event_summary}\n\n"
        f"{closing_phrase}"
    )

    # 10️⃣ Generate audio
    audio_path = generate_voice(brief)

    return {"text": brief, "audio_path": audio_path}
