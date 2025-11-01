# backend/scenarios/morning_brief/busy_level.py
from datetime import datetime, timedelta, time

# Thresholds (minutes)
RELAXED_MAX = 240      # ≤ 4h
NORMAL_MAX = 480       # 4–8h
ALL_DAY_MINUTES = 480  # 8h equivalent

def calculate_busy_level(events: list, tz_str: str) -> int:
    """
    Calculates total busy minutes between 06:00–22:00 local.
    Collapses overlapping events and counts all-day events as 480 min.
    """
    # 1️⃣ Filter & convert
    today = datetime.now().astimezone().date()
    start_window = datetime.combine(today, time(6, 0))
    end_window = datetime.combine(today, time(22, 0))

    blocks = []

    for e in events:
        if e.get("status") == "declined":
            continue

        # handle all-day
        if e.get("all_day"):
            blocks.append((start_window, start_window + timedelta(minutes=ALL_DAY_MINUTES)))
            continue

        start = e.get("start_dt")
        end = e.get("end_dt")
        if not start or not end:
            continue

        start = max(start, start_window)
        end = min(end, end_window)
        if start < end:
            blocks.append((start, end))

    # 2️⃣ Merge overlaps
    blocks.sort(key=lambda x: x[0])
    merged = []
    for s, e in blocks:
        if not merged or s > merged[-1][1]:
            merged.append([s, e])
        else:
            merged[-1][1] = max(merged[-1][1], e)

    # 3️⃣ Sum minutes
    total_minutes = sum(int((end - start).total_seconds() / 60) for start, end in merged)
    return total_minutes


def describe_busy_level(total_minutes: int, events: list) -> str:
    """
    Generates natural language description of workload.
    FR-1.1.11 – 1.1.17 compliant.
    """
    num_events = len(events)
    if total_minutes == 0:
        return "You have no events today."

    if total_minutes <= RELAXED_MAX:
        phrases = [
            "looks like a pretty open day",
            "seems like a lighter schedule",
            "you’ve got plenty of breathing room today"
        ]
        level = "Relaxed"
    elif total_minutes <= NORMAL_MAX:
        phrases = [
            "you’ve got a solid day ahead",
            "a moderate schedule — a good balance",
            "a decent amount going on today"
        ]
        level = "Normal"
    else:
        phrases = [
            "you’ve got a packed day ahead",
            "today’s going to be a busy one",
            "your schedule’s looking full"
        ]
        level = "Busy"

    # optional mentions
    desc = f"It {phrases[0]}"
    if num_events:
        desc += f" with {num_events} meeting{'s' if num_events>1 else ''}"
        first_event = min(e['start_dt'] for e in events if e.get('start_dt'))
        desc += f", starting around {first_event.strftime('%I:%M %p').lstrip('0')}"
    desc += "."
    return desc
