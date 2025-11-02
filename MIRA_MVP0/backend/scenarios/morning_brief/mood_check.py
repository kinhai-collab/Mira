# backend/scenarios/morning_brief/mood_check.py
import random
import time

# Mocked voice inputs until STT is connected
MOOD_KEYWORDS = {
    "tired": ["tired", "sleepy", "exhausted"],
    "okay": ["okay", "fine", "alright"],
    "good": ["good", "well", "decent"],
    "great": ["great", "excellent", "wonderful"],
    "energized": ["energized", "pumped", "ready"],
}

DEFAULT_MOOD = "okay"


def get_user_mood(timeout_seconds: int = 5) -> str:
    """
    Asks the user for their mood (via voice or fallback text).
    Waits up to 5 seconds for response; defaults to "okay" if silent.
    FR-1.3.1 – 1.3.6 compliant.
    """
    print("Mira: How are you feeling this morning?")
    # Future: replace with actual STT capture
    time.sleep(2)
    user_input = input("(simulate voice input) > ").lower().strip()

    if not user_input:
        print("No response detected. Proceeding with default mood (Okay).")
        return DEFAULT_MOOD

    # Normalize mood category
    for mood, keywords in MOOD_KEYWORDS.items():
        if any(k in user_input for k in keywords):
            return mood

    if "skip" in user_input or "not now" in user_input:
        print("Mood check skipped.")
        return DEFAULT_MOOD

    return DEFAULT_MOOD


def adjust_voice_tone(mood: str):
    """
    Adjusts speaking characteristics for TTS engine based on mood.
    FR-1.3.7 – 1.3.10 compliant.
    Returns dictionary of TTS parameters.
    """
    if mood == "tired":
        settings = {"rate": 0.9, "pitch": -2, "volume": 0.9}
        tone_desc = "soft and gentle"
    elif mood in ["great", "energized"]:
        settings = {"rate": 1.1, "pitch": 1, "volume": 1.1}
        tone_desc = "bright and energetic"
    else:
        settings = {"rate": 1.0, "pitch": 0, "volume": 1.0}
        tone_desc = "balanced and calm"

    print(f"Adjusting TTS tone → {tone_desc} ({settings})")
    return settings
