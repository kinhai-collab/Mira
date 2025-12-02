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
    "Zoom": r"zoom\.us/[^\s]+|zoom\.com/[^\s]+",
    "Google Meet": r"meet\.google\.com/[^\s]+|hangouts\.google\.com/[^\s]+|google\.com/meet/[^\s]+",
    "Microsoft Teams": r"teams\.microsoft\.com/[^\s]+|teams\.live\.com/[^\s]+|microsoft\.com/teams/[^\s]+",
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
        
        # Extract meeting link and provider
        location = gcal_event.get("location", "")
        description = gcal_event.get("description", "")
        meeting_link = ""
        provider = None
        
        # Check conferenceData for Google Meet
        if gcal_event.get("conferenceData"):
            entry_points = gcal_event.get("conferenceData", {}).get("entryPoints", [])
            for entry in entry_points:
                if entry.get("entryPointType") == "video":
                    meeting_link = entry.get("uri", "")
                    provider = "google-meet"
                    print(f"✅ Detected Google Meet from conferenceData: {meeting_link[:50]}...")
                    break
        
        # If no link from conferenceData, extract from description/location
        if not meeting_link:
            platform, link = _detect_conference_platform(location + " " + description)
            if link:
                meeting_link = link
                if platform == "Google Meet":
                    provider = "google-meet"
                    print(f"✅ Detected Google Meet from description/location: {link[:50]}...")
                elif platform == "Microsoft Teams":
                    provider = "microsoft-teams"
                elif platform == "Zoom":
                    provider = "zoom"
        
        # Debug: Log if we found a Google Meet
        if provider == "google-meet":
            print(f"📞 Google Meet detected for event: {gcal_event.get('summary', 'Unknown')} - Link: {meeting_link[:80] if meeting_link else 'None'}")
        
        return {
            "summary": gcal_event.get("summary", "No title"),
            "start_dt": start_dt.replace(tzinfo=None) if start_dt.tzinfo else start_dt,
            "end_dt": end_dt.replace(tzinfo=None) if end_dt.tzinfo else end_dt,
            "location": location,
            "description": description,
            "status": gcal_event.get("status", "confirmed"),
            "all_day": is_all_day,
            "meetingLink": meeting_link if meeting_link else None,
            "provider": provider,
            "calendar_provider": "google",
            "id": gcal_event.get("id", ""),
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

def _transform_outlook_event(o_event: Dict[str, Any], tz: str) -> Optional[Dict[str, Any]]:
    """
    Transform Outlook Calendar event format to morning brief format.
    """
    try:
        start_dt = _parse_google_calendar_datetime(o_event.get("start", {}).get("dateTime", ""), tz)
        end_dt = _parse_google_calendar_datetime(o_event.get("end", {}).get("dateTime", ""), tz)
        
        location = o_event.get("location", {}).get("displayName", "")
        description = o_event.get("bodyPreview", "") or o_event.get("body", {}).get("content", "")
        
        # Extract meeting link and provider from Outlook
        meeting_link = ""
        provider = None
        
        # Check for onlineMeeting (Teams)
        online_meeting = o_event.get("onlineMeeting")
        if online_meeting and isinstance(online_meeting, dict):
            meeting_link = online_meeting.get("joinUrl", "")
            if meeting_link:
                # Verify it's actually a Teams link
                link_lower = meeting_link.lower()
                if any(pattern in link_lower for pattern in ["teams.microsoft.com", "teams.live.com", "microsoft.com/teams"]):
                    provider = "microsoft-teams"
                    print(f"✅ Detected Teams from onlineMeeting.joinUrl: {meeting_link[:50]}...")
                else:
                    # If joinUrl exists but doesn't match Teams patterns, try to detect platform
                    platform, _ = _detect_conference_platform(meeting_link)
                    if platform == "Microsoft Teams":
                        provider = "microsoft-teams"
                        print(f"✅ Detected Teams from joinUrl via pattern matching: {meeting_link[:50]}...")
                    elif platform == "Google Meet":
                        provider = "google-meet"
                    elif platform == "Zoom":
                        provider = "zoom"
        
        # If no link from onlineMeeting, extract from description/location
        if not meeting_link:
            platform, link = _detect_conference_platform(location + " " + description)
            if link:
                meeting_link = link
                if platform == "Google Meet":
                    provider = "google-meet"
                elif platform == "Microsoft Teams":
                    provider = "microsoft-teams"
                    print(f"✅ Detected Teams from description/location: {link[:50]}...")
                elif platform == "Zoom":
                    provider = "zoom"
        
        # Debug: Log if we found a Teams meeting
        if provider == "microsoft-teams":
            print(f"📞 Teams meeting detected for event: {o_event.get('subject', 'Unknown')} - Link: {meeting_link[:80] if meeting_link else 'None'}")
        
        return {
            "summary": o_event.get("subject", "No title"),
            "start_dt": start_dt.replace(tzinfo=None) if start_dt.tzinfo else start_dt,
            "end_dt": end_dt.replace(tzinfo=None) if end_dt.tzinfo else end_dt,
            "location": location,
            "description": description,
            "status": "confirmed",
            "all_day": False,
            "meetingLink": meeting_link if meeting_link else None,
            "provider": provider,
            "calendar_provider": "outlook",
            "id": o_event.get("id", ""),
        }
    except Exception as e:
        print(f"Error transforming Outlook event {o_event.get('id')}: {e}")
        return None


def get_today_events(user_id: str, tz: str, outlook_token: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch today's events from both Google Calendar and Outlook for the user.
    Falls back to empty list if calendar is not connected or on error.
    
    Args:
        user_id: User ID
        tz: User's timezone
        outlook_token: Optional cached Outlook token to avoid re-fetching credentials
    """
    print(f"📅 Fetching events for user: {user_id} in timezone: {tz}")
    
    all_events = []
    
    # Calculate time range for today in user's timezone
    user_tz = ZoneInfo(tz)
    now = datetime.now(user_tz)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    # Convert to ISO format for API
    time_min = today_start.astimezone(ZoneInfo("UTC")).isoformat()
    time_max = today_end.astimezone(ZoneInfo("UTC")).isoformat()
    
    # Fetch from Google Calendar
    if CALENDAR_AVAILABLE:
        try:
            # Fetch events from Google Calendar
            response = list_events(user_id, time_min=time_min, time_max=time_max, page_token=None)
            
            # Extract events from response
            gcal_events = response.get("items", [])
            
            if gcal_events:
                # Transform Google Calendar events to morning brief format
                for gcal_event in gcal_events:
                    transformed = _transform_google_event(gcal_event, tz)
                    if transformed:
                        all_events.append(transformed)
        except HTTPException as e:
            if "not connected" not in str(e).lower():
                print(f"⚠️ Error fetching Google Calendar events: {e}")
        except Exception as e:
            print(f"⚠️ Unexpected error fetching Google Calendar events: {e}")
    
    # Fetch from Outlook Calendar
    # ✅ Use provided outlook_token if available, otherwise fetch from database
    access_token = outlook_token
    if outlook_token:
        print("✅ Morning Brief: Using cached Outlook token for events")
    else:
        try:
            import os
            import requests
            from supabase import create_client
            from datetime import timezone  # ✅ Import timezone class, use timezone.utc
            
            SUPABASE_URL = os.getenv("SUPABASE_URL")
            SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            GRAPH_API_URL = "https://graph.microsoft.com/v1.0"
            
            if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
                supabase_db = create_client(SUPABASE_URL.rstrip('/'), SUPABASE_SERVICE_ROLE_KEY)
                
                # Get Outlook token from database
                res = supabase_db.table("outlook_credentials").select("*").eq("uid", user_id).execute()
                if res.data and len(res.data) > 0:
                    creds = res.data[0]
                    access_token = creds.get("access_token")
                    expiry_str = creds.get("expiry")
                    
                    # Check if token is expired and refresh if needed
                    if expiry_str:
                        try:
                            expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                            now_utc = datetime.now(timezone.utc)  # ✅ Use timezone.utc (instance), not timezone (class)
                            if expiry <= (now_utc + timedelta(minutes=5)):
                                refresh_token = creds.get("refresh_token")
                                if refresh_token:
                                    MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
                                    MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
                                    MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
                                    
                                    data = {
                                        "client_id": MICROSOFT_CLIENT_ID,
                                        "scope": "User.Read Calendars.ReadWrite Mail.Read",
                                        "refresh_token": refresh_token,
                                        "grant_type": "refresh_token",
                                        "client_secret": MICROSOFT_CLIENT_SECRET
                                    }
                                    refresh_res = requests.post(MICROSOFT_TOKEN_URL, data=data)
                                    new_token_data = refresh_res.json()
                                    
                                    if "access_token" in new_token_data:
                                        expires_in = new_token_data.get("expires_in", 3600)
                                        new_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)  # ✅ Use timezone.utc
                                        update_payload = {
                                            "access_token": new_token_data.get("access_token"),
                                            "refresh_token": new_token_data.get("refresh_token", refresh_token),
                                            "expiry": new_expiry.isoformat(),
                                        }
                                        supabase_db.table("outlook_credentials").update(update_payload).eq("uid", user_id).execute()
                                        access_token = new_token_data.get("access_token")
                        except Exception as e:
                            print(f"⚠️ Error refreshing Outlook token: {e}")
        except Exception as e:
            print(f"⚠️ Error fetching Outlook token: {e}")
    
    if access_token:
        try:
            # Fetch Outlook events
            import requests
            GRAPH_API_URL = "https://graph.microsoft.com/v1.0"
            headers = {"Authorization": f"Bearer {access_token}"}
            start_iso = today_start.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
            end_iso = today_end.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
            
            outlook_url = (
                f"{GRAPH_API_URL}/me/calendar/calendarView?"
                f"startDateTime={start_iso}&"
                f"endDateTime={end_iso}&"
                f"$top=250&"
                f"$select=id,subject,start,end,location,bodyPreview,body,onlineMeeting"
            )
            
            response = requests.get(outlook_url, headers=headers, timeout=10)
            if response.status_code == 200:
                outlook_events = response.json().get("value", [])
                for o_event in outlook_events:
                    transformed = _transform_outlook_event(o_event, tz)
                    if transformed:
                        all_events.append(transformed)
                print(f"✅ Morning Brief: Found {len(outlook_events)} Outlook events")
        except Exception as e:
            print(f"⚠️ Error fetching Outlook events: {e}")
    
    # Filter to ensure only today's events
    filtered_events = _filter_today_events(all_events, tz)
    
    print(f"📅 Found {len(filtered_events)} total events for today (Google + Outlook)")
    return filtered_events


def read_events(events: list):
    """
    Create conversational schedule narration.
    Follows FR-1.4.5 – 1.4.15 (sorting, templates, conflict detection).
    Shortened format: After first Microsoft Teams/Meet meeting, groups remaining meetings.
    """
    if not events:
        return "You don't have any events scheduled today."

    # 1️⃣ Sort by start time
    events = sorted(events, key=lambda e: e["start_dt"])

    text_lines = []
    conflicts = []
    
    # Track if we've found the first Microsoft Teams/Meet meeting
    first_microsoft_meeting_found = False
    remaining_meetings = []
    remaining_events = []

    for i, ev in enumerate(events):
        title = ev.get("summary") or "Private event"
        start, end = ev["start_dt"], ev["end_dt"]
        duration = _format_duration(start, end)
        start_str = _format_time(start)
        location = ev.get("location", "")
        desc = ev.get("description", "")

        platform, link = _detect_conference_platform(location + " " + desc)
        
        # Check if this is a Microsoft Teams/Meet meeting
        provider = ev.get("provider", "").lower() if ev.get("provider") else ""
        is_microsoft_meeting = (
            provider in ["microsoft-teams", "microsoft teams"] or
            platform == "Microsoft Teams" or
            (link and ("teams.microsoft.com" in link.lower() or "teams.live.com" in link.lower()))
        )
        
        # Check if this is any meeting (has platform/provider)
        is_meeting = bool(platform or provider or ev.get("meetingLink"))

        # 2️⃣ Template selection - handle first Microsoft meeting specially
        if not first_microsoft_meeting_found and is_microsoft_meeting:
            # This is the first Microsoft Teams/Meet meeting - read it out fully
            first_microsoft_meeting_found = True
            if ev.get("all_day"):
                line = f"All-day: {title}."
            elif platform:
                line = f"At {start_str} for {duration}: {title} on {platform}. I can text you the join link."
            elif location:
                line = f"At {start_str} for {duration}: {title}, at {location}."
            else:
                line = f"At {start_str} for {duration}: {title}."
            text_lines.append(line)
        elif first_microsoft_meeting_found and is_meeting:
            # After first Microsoft meeting, collect remaining meetings
            remaining_meetings.append(ev)
        elif first_microsoft_meeting_found:
            # After first Microsoft meeting, collect non-meeting events
            remaining_events.append(ev)
        else:
            # Before first Microsoft meeting, read out normally
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

    # 4️⃣ Add shortened summary for remaining meetings and events
    if first_microsoft_meeting_found:
        if remaining_meetings:
            meeting_count = len(remaining_meetings)
            if meeting_count == 1:
                text_lines.append("Other than this, you have 1 meet.")
            else:
                text_lines.append(f"Other than this, you have {meeting_count} meets.")
        
        if remaining_events:
            text_lines.append("And the rest of the day.")

    # 5️⃣ Assemble output
    result = " ".join(text_lines)
    if conflicts:
        result += " " + " ".join(conflicts)
    return result
