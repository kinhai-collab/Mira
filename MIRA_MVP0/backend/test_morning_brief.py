import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scenarios.morning_brief.morning_brief import run_morning_brief

if __name__ == "__main__":
    # Mock user and timezone for testing
    user_id = "demo_user_1"
    user_name = "Anusha"
    tz = "America/New_York"

    result = run_morning_brief(user_id, user_name, tz)
    print("\n🪞 --- TEXT OUTPUT ---")
    print(result["text"])
    print("\n🎧 --- AUDIO FILE PATH ---")
    print(result["audio_path"])
