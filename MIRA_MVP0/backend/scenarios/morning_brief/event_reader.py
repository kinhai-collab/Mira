from datetime import datetime, timedelta
import re

# --- Detect video platform links ---------------------------------------------
PLATFORM_PATTERNS = {
    "Zoom": r"zoom\.us/[^\s]+",
    "Google Meet": r"meet\.google\.com/[^\s]+",
    "Microsoft Teams": r"teams\.microsoft\.com/[^\s]+",
}

# --- Utility helpers ---------------------------------------------------------

def _detect_conference_platform(text: str):
    """Return (platform, link) if a known conferencing URL is found."""
    if not text:
        return None, None
    for platform, pattern in PLATFORM_PATTERNS.items():
        match = re.search(pattern, text)
        if match:
            return platform, match.group(0)
    return None, None


def _format_duration(start, end):
    """Convert duration to friendly wording."""
    minutes = int((end - start).total_seconds() / 60)
    if minutes <= 30:
        return "30 minutes"
    elif 45 <= minutes < 75:
        return "an hour"
    elif 75 <= minutes < 105:
        return "an hour and a half"
    elif minutes < 150:
        return "2 hours"
    else:
        hours = round(minutes / 60, 1)
        return f"{hours} hours"


def _format_time(dt: datetime):
    """Format datetime to 12-hour readable format."""
    return dt.strftime("%I:%M %p").lstrip("0")


# --- Core functions ----------------------------------------------------------

def get_today_events(user_id: str, tz: str):
    """
    Mock event data for Morning Brief testing.
    Replace this later with Gmail/Outlook/Calendar integration.
    """
    print("📅 [Mock] Fetching events for user:", user_id)

    now = datetime.now()
    events = [
        {
            "summary": "Team Standup",
            "start_dt": now.replace(hour=9, minute=0),
            "end_dt": now.replace(hour=9, minute=30),
            "location": "Conference Room A",
            "description": "Daily sync with team",
            "status": "confirmed",
        },
        {
            "summary": "Design Review",
            "start_dt": now.replace(hour=11, minute=0),
            "end_dt": now.replace(hour=12, minute=0),
            "location": "Zoom",
            "description": "meet.google.com/test-link",
            "status": "confirmed",
        },
        {
            "summary": "1:1 with Manager",
            "start_dt": now.replace(hour=15, minute=0),
            "end_dt": now.replace(hour=15, minute=30),
            "location": "Room B",
            "description": "Project updates",
            "status": "confirmed",
        },
    ]
    return events


def read_events(events: list):
    """
    Create conversational schedule narration.
    Follows FR-1.4.5 – 1.4.15 (sorting, templates, conflict detection).
    """
    if not events:
        return "You don’t have any events scheduled today."

    # 1️⃣ Sort by start time
    events = sorted(events, key=lambda e: e["start_dt"])

    text_lines = []
    conflicts = []

    for i, ev in enumerate(events):
        title = ev.get("summary") or "Private event"
        start, end = ev["start_dt"], ev["end_dt"]
        duration = _format_duration(start, end)
        start_str = _format_time(start)
        location = ev.get("location", "")
        desc = ev.get("description", "")

        platform, link = _detect_conference_platform(location + " " + desc)

        # 2️⃣ Template selection
        if ev.get("all_day"):
            line = f"All-day: {title}."
        elif platform:
            line = f"At {start_str} for {duration}: {title} on {platform}. I can text you the join link."
        elif location:
            line = f"At {start_str} for {duration}: {title}, at {location}."
        else:
            line = f"At {start_str} for {duration}: {title}."

        text_lines.append(line)

        # 3️⃣ Conflict detection
        if i < len(events) - 1:
            next_event = events[i + 1]
            overlap = min(end, next_event["end_dt"]) - max(start, next_event["start_dt"])
            if overlap.total_seconds() / 60 >= 5:
                conflicts.append(
                    f"Heads-up: {title} overlaps with {next_event['summary']} "
                    f"from {_format_time(max(start, next_event['start_dt']))} "
                    f"to {_format_time(min(end, next_event['end_dt']))}."
                )

    # 4️⃣ Assemble output
    result = " ".join(text_lines)
    if conflicts:
        result += " " + " ".join(conflicts)
    return result
