import random, json, os
from datetime import date

GREETING_FILE = "backend/scenarios/morning_brief/_last_greeting.json"

GREETING_LIBRARY = [
    "Good morning, {name}.",
    "Morning, {name}! Let’s see what today looks like.",
    "Hey {name}, rise and shine!",
    "Top of the morning, {name}.",
    "Hi {name}, ready to start the day?",
    "Good day, {name}. Let’s make it a good one.",
    "Morning sunshine, {name}.",
    "Hey {name}, how did you sleep?",
    "Good morning, {name}. Let’s get going.",
    "Morning, {name}! Today’s a fresh start."
]

def _load_last():
    if os.path.exists(GREETING_FILE):
        try:
            with open(GREETING_FILE) as f:
                d = json.load(f)
                if d.get("date") == str(date.today()):
                    return d.get("greeting")
        except: pass
    return None

def _save_today(g):
    os.makedirs(os.path.dirname(GREETING_FILE), exist_ok=True)
    with open(GREETING_FILE, "w") as f:
        json.dump({"date": str(date.today()), "greeting": g}, f)

def generate_greeting(name: str) -> str:
    last = _load_last()
    pool = [g for g in GREETING_LIBRARY if g != last]
    chosen = random.choice(pool).format(name=name.split()[0])
    _save_today(chosen)
    return chosen
