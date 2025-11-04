from datetime import datetime, timedelta
from dateutil import parser
import re
import sys
import os
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

try:
    from Google_Calendar_API.service import list_events
    from fastapi import HTTPException
    CALENDAR_AVAILABLE = True
except ImportError:
    CALENDAR_AVAILABLE = False
    print("⚠️ Google Calendar API not available - using fallback")

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


def _parse_google_calendar_datetime(dt_str: str, tz: str) -> datetime:
    """
    Parse Google Calendar datetime string (ISO format) and convert to user timezone.
    Handles both dateTime and date fields.
    """
    try:
        if isinstance(dt_str, dict):
            # Handle Google Calendar dateTime/date objects
            if "dateTime" in dt_str:
                dt = parser.isoparse(dt_str["dateTime"])
            elif "date" in dt_str:
                # All-day event - parse date only
                dt = parser.parse(dt_str["date"])
                dt = dt.replace(hour=0, minute=0, second=0)
            else:
                raise ValueError("Invalid datetime format")
        else:
            dt = parser.isoparse(dt_str)
        
        # Convert to user timezone if datetime is timezone-aware
        if dt.tzinfo:
            user_tz = ZoneInfo(tz)
            dt = dt.astimezone(user_tz)
        else:
            # Assume UTC if no timezone info
            dt = dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo(tz))
        
        return dt
    except Exception as e:
        print(f"Error parsing datetime {dt_str}: {e}")
        return datetime.now(ZoneInfo(tz))


def _transform_google_event(gcal_event: Dict[str, Any], tz: str) -> Optional[Dict[str, Any]]:
    """
    Transform Google Calendar event format to morning brief format.
    """
    try:
        start_dt = _parse_google_calendar_datetime(gcal_event.get("start", {}), tz)
        end_dt = _parse_google_calendar_datetime(gcal_event.get("end", {}), tz)
        
        # Check if this is an all-day event
        is_all_day = "date" in gcal_event.get("start", {})
        
        return {
            "summary": gcal_event.get("summary", "No title"),
            "start_dt": start_dt.replace(tzinfo=None) if start_dt.tzinfo else start_dt,
            "end_dt": end_dt.replace(tzinfo=None) if end_dt.tzinfo else end_dt,
            "location": gcal_event.get("location", ""),
            "description": gcal_event.get("description", ""),
            "status": gcal_event.get("status", "confirmed"),
            "all_day": is_all_day,
        }
    except Exception as e:
        print(f"Error transforming event {gcal_event.get('id')}: {e}")
        return None


def _filter_today_events(events: List[Dict[str, Any]], tz: str) -> List[Dict[str, Any]]:
    """
    Filter events to only include those happening today in the user's timezone.
    """
    user_tz = ZoneInfo(tz)
    now = datetime.now(user_tz)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    today_events = []
    for event in events:
        start_dt = event.get("start_dt")
        if not start_dt:
            continue
        
        # Make datetime timezone-aware for comparison
        if isinstance(start_dt, datetime):
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=user_tz)
            else:
                start_dt = start_dt.astimezone(user_tz)
            
            # Include events that start today or are ongoing
            if today_start <= start_dt < today_end:
                today_events.append(event)
    
    return today_events


# --- Core functions ----------------------------------------------------------

def get_today_events(user_id: str, tz: str) -> List[Dict[str, Any]]:
    """
    Fetch today's events from Google Calendar for the user.
    Falls back to empty list if calendar is not connected or on error.
    """
    print(f"📅 Fetching events for user: {user_id} in timezone: {tz}")
    
    # Try to fetch from Google Calendar
    if CALENDAR_AVAILABLE:
        try:
            # Calculate time range for today in user's timezone
            user_tz = ZoneInfo(tz)
            now = datetime.now(user_tz)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = today_start + timedelta(days=1)
            
            # Convert to ISO format for API
            time_min = today_start.astimezone(ZoneInfo("UTC")).isoformat()
            time_max = today_end.astimezone(ZoneInfo("UTC")).isoformat()
            
            # Fetch events from Google Calendar
            response = list_events(user_id, time_min=time_min, time_max=time_max, page_token=None)
            
            # Extract events from response
            gcal_events = response.get("items", [])
            
            if not gcal_events:
                print(f"📅 No events found for user {user_id} today")
                return []
            
            # Transform Google Calendar events to morning brief format
            transformed_events = []
            for gcal_event in gcal_events:
                transformed = _transform_google_event(gcal_event, tz)
                if transformed:
                    transformed_events.append(transformed)
            
            # Filter to ensure only today's events (extra safety)
            filtered_events = _filter_today_events(transformed_events, tz)
            
            print(f"📅 Found {len(filtered_events)} events for today")
            return filtered_events
            
        except HTTPException as e:
            if "not connected" in str(e).lower() or "400" in str(e):
                print(f"⚠️ Google Calendar not connected for user {user_id}")
            else:
                print(f"⚠️ Error fetching calendar events: {e}")
            return []
        except Exception as e:
            print(f"⚠️ Unexpected error fetching calendar events: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    # Fallback: return empty list if calendar integration not available
    print("⚠️ Calendar integration not available - returning empty events")
    return []


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
