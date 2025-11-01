# backend/scenarios/morning_brief/adaptive_behavior.py
import re
import time

HURRY_KEYWORDS = [
    "hurry",
    "quick version",
    "just the highlights",
    "fast brief",
    "speed it up",
    "make it quick",
    "short version",
]

def check_quick_mode(timeout_seconds: int = 4) -> bool:
    """
    Detects 'hurry' intent from the user's voice input.
    FR-1.6.1 – FR-1.6.7 compliant (partial: voice-first placeholder).
    """
    print("Mira: Do you want the quick version today?")
    time.sleep(1)
    user_input = input("(simulate voice input) > ").lower().strip()

    if not user_input:
        return False

    return any(re.search(keyword, user_input) for keyword in HURRY_KEYWORDS)


def condense_brief(full_brief: str, events: list) -> str:
    """
    Produces a condensed brief: top 3 important events + key notes.
    FR-1.6.3 – FR-1.6.5 compliant.
    """
    short_intro = "Here’s your quick brief: "
    condensed = []

    # Top 3 events only
    top_events = events[:3]
    for ev in top_events:
        title = ev.get("summary", "event")
        start = ev.get("start_dt")
        time_str = start.strftime("%I:%M %p").lstrip("0") if start else ""
        condensed.append(f"{title} at {time_str}")

    if not top_events:
        condensed.append("You have no meetings today.")

    # Add weather or time-sensitive notes later from daily_summary
    brief = short_intro + ", ".join(condensed) + "."
    return brief
