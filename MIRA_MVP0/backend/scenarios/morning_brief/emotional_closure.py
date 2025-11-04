
import json
import os
import random
from datetime import date
from pathlib import Path

# Use relative path based on current file location
_current_dir = Path(__file__).parent
# In Lambda, /var/task is read-only. Use /tmp for ephemeral writes.
CLOSING_FILE = os.environ.get("CLOSING_STATE_PATH", "/tmp/_last_closing.json")

CLOSING_PHRASES = [
    "You’ve got this, {name}.",
    "Have a wonderful day, {name}.",
    "You’re ready for today.",
    "Make it a great one.",
    "Today is yours.",
    "Go make it happen.",
    "You’re all set for the day.",
    "Have a fantastic day.",
    "You’re prepared and ready.",
    "Enjoy your day, {name}.",
    "You’ve got everything you need, {name}.",
    "Keep your energy up today.",
    "Let’s make it a good one.",
    "Step into today with confidence.",
    "You’re unstoppable today, {name}."
]


def _get_recent_closings():
    """Load recent closings to avoid repetition."""
    if not os.path.exists(CLOSING_FILE):
        return []
    try:
        with open(CLOSING_FILE, "r") as f:
            data = json.load(f)
            return data.get("recent", [])
    except Exception:
        return []


def _save_closing(phrase):
    """Track the last 7 phrases to ensure variety."""
    try:
        os.makedirs(os.path.dirname(CLOSING_FILE), exist_ok=True)
        history = _get_recent_closings()
        if phrase not in history:
            history.append(phrase)
        history = history[-7:]  # keep last 7 days
        with open(CLOSING_FILE, "w") as f:
            json.dump({"recent": history, "date": str(date.today())}, f)
    except Exception:
        # If writing fails (e.g., filesystem constraints), skip persistence
        pass


def get_closing_phrase(user_name: str, mood: str) -> str:
    """
    Returns a motivational closing line personalized to the user.
    FR-1.7.1 – FR-1.7.6 compliant.
    """
    # Avoid repeating recent phrases
    used = _get_recent_closings()
    available = [p for p in CLOSING_PHRASES if p not in used]
    phrase = random.choice(available).format(name=user_name.split()[0])
    _save_closing(phrase)

    # Adjust tone slightly based on mood
    if mood in ["tired"]:
        phrase = phrase.replace(".", ",").rstrip(",") + ". Take it easy today."
    elif mood in ["great", "energized"]:
        phrase = phrase.replace(".", "!").rstrip("!") + " Let’s make today amazing!"

    return phrase


# --------------------------------------------------------------------------- #
# Optional Mindfulness Prompt (EC-02)
# --------------------------------------------------------------------------- #

def offer_mindfulness_session():
    """
    Offers a short mindfulness prompt after the closing phrase.
    FR-1.7.7 – FR-1.7.16 partial implementation.
    """
    options = [
        "Would you like to start your day with a 2-minute breathing exercise?",
        "Care for a moment of calm before you begin?",
        "Want to take a mindful minute?"
    ]
    prompt = random.choice(options)
    print(f"Mira: {prompt}")

    # Placeholder for future STT logic
    response = input("(simulate voice input) > ").lower().strip()
    if response in ["yes", "sure", "okay", "let's do it"]:
        print("Starting 2-minute breathing guidance...")
        return "Starting 2-minute breathing exercise."
    elif response in ["no", "skip", "not today", "maybe later"]:
        print("Skipping mindfulness session.")
        return "Alright, have a great day!"
    else:
        print("No response detected. Skipping mindfulness session.")
        return "Alright, have a great day!"
