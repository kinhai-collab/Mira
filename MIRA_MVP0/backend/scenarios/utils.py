# backend/scenarios/morning_brief/utils.py
from datetime import datetime
import pytz

def to_local_time(dt, tz_str="America/New_York"):
    """
    Converts UTC datetime to local timezone (FR-1.1.18 – 1.1.19, 1.8.5).
    """
    try:
        local_tz = pytz.timezone(tz_str)
        return dt.astimezone(local_tz)
    except Exception:
        return dt


def natural_time(dt):
    """
    Returns a natural-sounding time string (e.g., '9 in the morning').
    """
    hour = dt.hour
    minute = dt.minute
    if minute == 0:
        base = dt.strftime("%I %p").lstrip("0")
    else:
        base = dt.strftime("%I:%M %p").lstrip("0")

    if 5 <= hour < 12:
        return f"{base} in the morning"
    elif 12 <= hour < 17:
        return f"{base} in the afternoon"
    elif 17 <= hour < 21:
        return f"{base} in the evening"
    else:
        return f"{base} tonight"
