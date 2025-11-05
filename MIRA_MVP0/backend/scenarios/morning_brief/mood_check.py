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


def get_user_mood(timeout_seconds: int = 5, skip_interactive: bool = True) -> str:
    """
    Gets the user's mood. For API calls, skips interactive input and uses default.
    When skip_interactive is False, asks for mood (for CLI/testing only).
    FR-1.3.1 – 1.3.6 compliant.
    """
    # Skip interactive input for API calls - mood should be captured on frontend
    if skip_interactive:
        print("Using default mood (okay) for API call.")
        return DEFAULT_MOOD
    
    # Only used for CLI/testing
    print("Mira: How are you feeling this morning?")
    try:
        # Non-blocking check if running in interactive terminal
        import sys
        if not sys.stdin.isatty():
            # Not in interactive terminal (e.g., API call)
            print("No interactive terminal. Using default mood (Okay).")
            return DEFAULT_MOOD
        
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
    except (EOFError, KeyboardInterrupt):
        # Not in interactive mode or interrupted
        print("Using default mood (Okay).")
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
