from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
import os
import requests
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, Field

from Google_Calendar_API.service import (
    list_events,
    create_event,
    patch_event,
    delete_event,
)

router = APIRouter(prefix="/assistant/calendar", tags=["assistant-calendar"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GRAPH_API_URL = "https://graph.microsoft.com/v1.0"


def _current_user(request: Request, authorization: Optional[str] = None) -> dict:
    """
    Extract and validate user from multiple sources:
    1. Authorization header (Bearer token) - validates with Supabase
    2. request.state.user (Supabase auth in prod)
    3. X-User-Id / X-User-Email headers (local dev)
    """
    # Method 1: Check Authorization header (preferred for frontend)
    if not authorization:
        authorization = request.headers.get("Authorization")
    
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        if SUPABASE_URL and SUPABASE_KEY:
            try:
                auth_headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"}
                res = requests.get(f"{SUPABASE_URL}/auth/v1/user", headers=auth_headers, timeout=5)
                if res.status_code == 200:
                    user_data = res.json()
                    return {
                        "id": user_data.get("id"),
                        "email": user_data.get("email"),
                    }
            except Exception as e:
                print(f"Error validating token: {e}")
    
    # Method 2: Check request.state.user (Supabase middleware)
    u = getattr(request.state, "user", None)
    if u and getattr(u, "id", None):
        return {"id": u.id, "email": getattr(u, "email", None)}

    # Method 3: Fallback to X-User-Id header (local dev)
    uid = request.headers.get("x-user-id")
    email = request.headers.get("x-user-email")
    if uid:
        return {"id": uid, "email": email}
    
    raise HTTPException(
        401, "User not authenticated (no valid token, Supabase user, or X-User-Id header)"
    )


class TimeWindow(BaseModel):
    start: datetime = Field(..., description="Start time (ISO-8601, with timezone)")
    end: datetime = Field(..., description="End time (ISO-8601, with timezone)")


class ScheduleRequest(TimeWindow):
    summary: str = Field(..., description="Event title, e.g. 'Sync with Tony'")
    description: Optional[str] = Field(None, description="Notes / agenda")
    location: Optional[str] = Field(None, description="Room, Zoom link, etc.")
    attendees: List[str] = Field(
        default_factory=list,
        description="List of attendee email addresses",
    )


class CancelRequest(BaseModel):
    event_id: Optional[str] = Field(
        None,
        description=(
            "If provided, cancel this exact event. "
            "If omitted, we try to find it by time/summary."
        ),
    )
    start: Optional[datetime] = Field(
        None, description="Approximate original start time (used when event_id is not given)."
    )
    summary: Optional[str] = Field(
        None, description="Optional title filter (used when event_id is not given)."
    )


class RescheduleRequest(BaseModel):
    event_id: Optional[str] = Field(
        None,
        description=(
            "If provided, reschedule this exact event. "
            "If omitted, we try to find it by old_start/summary."
        ),
    )
    old_start: Optional[datetime] = Field(
        None, description="Original start time, for fuzzy matching when event_id isn't known."
    )
    summary: Optional[str] = None

    new_start: datetime
    new_end: datetime


def _normalize_datetime(dt: datetime) -> datetime:
    """
    Normalize a datetime to UTC for consistent comparison.
    Handles both timezone-aware and timezone-naive datetimes.
    """
    if dt.tzinfo is None:
        # Assume UTC if no timezone info
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_event_datetime(dt_str: str) -> Optional[datetime]:
    """
    Parse a datetime string from calendar events (Google or Outlook format).
    Returns None if parsing fails.
    """
    if not dt_str:
        return None
    
    try:
        # Handle date-only format (all-day events)
        if len(dt_str) == 10:
            dt = datetime.fromisoformat(dt_str)
            return dt.replace(tzinfo=timezone.utc)
        
        # Parse ISO format datetime
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return _normalize_datetime(dt)
    except (ValueError, AttributeError) as e:
        print(f"⚠️ Error parsing datetime '{dt_str}': {e}")
        return None


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """
    Check if two time intervals overlap.
    Returns True if intervals overlap (including exact matches at boundaries).
    Adjacent events (e.g., 3-4pm and 4-5pm) do NOT overlap.
    
    Test Cases Handled:
    1. Exact match: 4pm-5pm vs 4pm-5pm -> CONFLICT ✅
    2. Partial overlap: 3:30pm-4:30pm vs 4pm-5pm -> CONFLICT ✅
    3. Adjacent (no overlap): 3pm-4pm vs 4pm-5pm -> NO CONFLICT ✅
    4. One contains other: 2pm-6pm vs 3pm-4pm -> CONFLICT ✅
    5. Same start, different end: 4pm-5pm vs 4pm-6pm -> CONFLICT ✅
    6. Different start, same end: 3pm-5pm vs 4pm-5pm -> CONFLICT ✅
    
    Args:
        a_start, a_end: First interval (new event being scheduled)
        b_start, b_end: Second interval (existing event)
    
    Returns:
        True if intervals overlap, False otherwise
    """
    # Normalize all times to UTC for comparison
    a_start = _normalize_datetime(a_start)
    a_end = _normalize_datetime(a_end)
    b_start = _normalize_datetime(b_start)
    b_end = _normalize_datetime(b_end)
    
    # Two intervals overlap if: a_start < b_end AND b_start < a_end
    # This handles all cases:
    # - Exact match: a_start=b_start, a_end=b_end -> overlaps
    # - Partial overlap: a_start < b_start < a_end < b_end -> overlaps
    # - One contains the other: a_start < b_start < b_end < a_end -> overlaps
    # - Adjacent (no overlap): a_end = b_start -> does NOT overlap (a_start < b_end is true, but b_start < a_end is false)
    return a_start < b_end and b_start < a_end


def _get_outlook_token(uid: str) -> Optional[str]:
    """
    Get Outlook access token from database and refresh if expired.
    Returns None if Outlook is not connected.
    """
    try:
        from supabase import create_client
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            return None
        
        supabase_db = create_client(SUPABASE_URL.rstrip('/'), SUPABASE_SERVICE_ROLE_KEY)
        
        # Get Outlook token from database
        res = supabase_db.table("outlook_credentials").select("*").eq("uid", uid).execute()
        if not res.data or len(res.data) == 0:
            return None
        
        creds = res.data[0]
        access_token = creds.get("access_token")
        expiry_str = creds.get("expiry")
        
        # Check if token is expired (with 5 minute buffer)
        if expiry_str:
            try:
                expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                now = datetime.now(timezone.utc)
                # Refresh if expires within 5 minutes
                if expiry <= (now + timedelta(minutes=5)):
                    refresh_token = creds.get("refresh_token")
                    if refresh_token:
                        try:
                            # Refresh the token
                            MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
                            MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
                            MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
                            
                            data = {
                                "client_id": MICROSOFT_CLIENT_ID,
                                "scope": "offline_access User.Read Calendars.ReadWrite Mail.Read",
                                "refresh_token": refresh_token,
                                "grant_type": "refresh_token",
                                "client_secret": MICROSOFT_CLIENT_SECRET
                            }
                            headers = {"Content-Type": "application/x-www-form-urlencoded"}
                            refresh_res = requests.post(MICROSOFT_TOKEN_URL, data=data, headers=headers, timeout=10)
                            new_token_data = refresh_res.json()
                            
                            if "access_token" in new_token_data:
                                # Update database with new tokens
                                expires_in = new_token_data.get("expires_in", 3600)
                                new_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                                update_payload = {
                                    "access_token": new_token_data.get("access_token"),
                                    "refresh_token": new_token_data.get("refresh_token", refresh_token),
                                    "expiry": new_expiry.isoformat(),
                                    "updated_at": datetime.now(timezone.utc).isoformat()
                                }
                                supabase_db.table("outlook_credentials").update(update_payload).eq("uid", uid).execute()
                                access_token = new_token_data.get("access_token")
                                print(f"✅ Calendar Actions: Outlook token refreshed for user {uid}")
                            else:
                                print(f"⚠️ Calendar Actions: Failed to refresh Outlook token: {new_token_data.get('error_description')}")
                                access_token = None
                        except Exception as e:
                            print(f"⚠️ Calendar Actions: Error refreshing Outlook token: {e}")
                            access_token = None
                    else:
                        access_token = None
                else:
                    # Token is still valid
                    access_token = creds.get("access_token")
            except Exception as e:
                print(f"⚠️ Calendar Actions: Error parsing expiry date: {e}")
                access_token = creds.get("access_token")
        else:
            access_token = creds.get("access_token")
        
        return access_token
    except Exception as e:
        print(f"⚠️ Calendar Actions: Error getting Outlook token: {e}")
        return None


def _fetch_outlook_events(uid: str, time_min: datetime, time_max: datetime) -> List[Dict[str, Any]]:
    """
    Fetch Outlook calendar events for a given time window.
    Returns a list of events in Google Calendar format for consistency.
    """
    access_token = _get_outlook_token(uid)
    if not access_token:
        return []
    
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        # Convert to ISO format for Microsoft Graph API
        start_iso = time_min.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        end_iso = time_max.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        
        outlook_url = (
            f"{GRAPH_API_URL}/me/calendar/calendarView?"
            f"startDateTime={start_iso}&"
            f"endDateTime={end_iso}&"
            f"$top=250&"
            f"$select=id,subject,start,end,location,bodyPreview,body,onlineMeeting"
        )
        
        response = requests.get(outlook_url, headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"⚠️ Calendar Actions: Failed to fetch Outlook events (status {response.status_code})")
            return []
        
        outlook_events = response.json().get("value", [])
        # Transform Outlook events to Google Calendar format for consistency
        transformed_events = []
        for o_event in outlook_events:
            # Transform to Google Calendar format
            start_data = o_event.get("start", {})
            end_data = o_event.get("end", {})
            
            # Outlook uses dateTime field, Google uses dateTime or date
            start_dt = start_data.get("dateTime")
            end_dt = end_data.get("dateTime")
            
            if not start_dt or not end_dt:
                continue
            
            # Create event in Google Calendar format
            transformed_event = {
                "id": o_event.get("id", ""),
                "summary": o_event.get("subject", "No title"),
                "start": {"dateTime": start_dt},
                "end": {"dateTime": end_dt},
                "location": o_event.get("location", {}).get("displayName", ""),
                "description": o_event.get("bodyPreview", ""),
                "_provider": "outlook"  # Mark as Outlook event
            }
            transformed_events.append(transformed_event)
        
        print(f"✅ Calendar Actions: Found {len(transformed_events)} Outlook events")
        return transformed_events
    except Exception as e:
        print(f"⚠️ Calendar Actions: Error fetching Outlook events: {e}")
        return []


def _get_all_events_for_window(uid: str, time_min: datetime, time_max: datetime) -> List[Dict[str, Any]]:
    """
    Fetch events from both Google Calendar and Outlook for a given time window.
    Returns a unified list of events in Google Calendar format.
    """
    all_events = []
    
    # Fetch from Google Calendar
    try:
        events_resp = list_events(
            uid,
            time_min.astimezone(timezone.utc).isoformat(),
            time_max.astimezone(timezone.utc).isoformat(),
            None,
        )
        items = events_resp.get("items") if isinstance(events_resp, dict) else events_resp
        if items:
            # Mark Google Calendar events
            for item in items:
                item["_provider"] = "google"
            all_events.extend(items)
            print(f"✅ Calendar Actions: Found {len(items)} Google Calendar events")
    except Exception as e:
        print(f"⚠️ Calendar Actions: Error fetching Google Calendar events: {e}")
    
    # Fetch from Outlook
    outlook_events = _fetch_outlook_events(uid, time_min, time_max)
    all_events.extend(outlook_events)
    
    print(f"📅 Calendar Actions: Total events found: {len(all_events)} (Google: {len([e for e in all_events if e.get('_provider') == 'google'])}, Outlook: {len([e for e in all_events if e.get('_provider') == 'outlook'])})")
    return all_events


@router.post("/check-conflicts")
def check_conflicts(
    request: Request, 
    window: TimeWindow,
    authorization: Optional[str] = Header(default=None)
):
    """
    Backend for: "Hey Mira, check for conflicts."

    Checks for conflicts in BOTH Google Calendar and Outlook calendars.
    The frontend / LLM should convert natural language into a concrete
    time window and call this endpoint.
    """
    user = _current_user(request, authorization)
    uid = user["id"]

    # Fetch events from both Google Calendar and Outlook
    all_events = _get_all_events_for_window(uid, window.start, window.end)

    conflicts = []
    for e in all_events:
        start_str = (
            e.get("start", {}).get("dateTime")
            or e.get("start", {}).get("date")  # all-day
        )
        end_str = (
            e.get("end", {}).get("dateTime")
            or e.get("end", {}).get("date")
        )
        if not start_str or not end_str:
            continue

        # Parse event times
        s = _parse_event_datetime(start_str)
        e_end = _parse_event_datetime(end_str)
        
        if s is None or e_end is None:
            print(f"⚠️ Skipping event '{e.get('summary', 'Unknown')}' due to invalid datetime")
            continue
        
        # For all-day events, we need special handling
        # An all-day event conflicts if the window overlaps with the entire day
        if len(start_str) == 10:  # All-day event (date-only)
            # All-day events span the entire day in UTC
            # Check if the window overlaps with this day
            day_start = s.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            if _overlaps(window.start, window.end, day_start, day_end):
                conflicts.append(e)
                print(f"  ⚠️ Conflict detected: All-day event '{e.get('summary', 'Unknown')}' on {start_str}")
        else:
            # Regular timed event
            if _overlaps(window.start, window.end, s, e_end):
                conflicts.append(e)
                provider = e.get("_provider", "unknown")
                print(f"  ⚠️ Conflict detected: Event '{e.get('summary', 'Unknown')}' ({provider}) from {s} to {e_end}")

    print(f"🔍 Conflict check: Found {len(conflicts)} conflicts in window {window.start} to {window.end}")
    return {
        "has_conflict": len(conflicts) > 0,
        "conflicts": conflicts,
    }


@router.post("/schedule")
def schedule_event(
    request: Request, 
    payload: ScheduleRequest,
    authorization: Optional[str] = Header(default=None)
):
    """
    Create a new Google Calendar event (invite).
    
    Automatically checks for conflicts in BOTH Google Calendar and Outlook
    before creating the event. BLOCKS the operation if conflicts are detected.
    
    Use Cases Tested:
    1. Outlook event at 4pm, schedule Google event at 4pm -> BLOCKED ✅
    2. Google event at 4pm, schedule Google event at 4pm -> BLOCKED ✅
    3. BOTH Outlook event at 4pm AND Google event at 4pm, schedule new event at 4pm -> BLOCKED (detects both) ✅
    4. Outlook event at 4pm, schedule Google event at 3:30pm (overlaps) -> BLOCKED ✅
    5. No conflicts -> Event created ✅
    6. All-day events -> Properly handled ✅
    7. Timezone differences -> Normalized to UTC for comparison ✅

    Maps to: "Hey Mira, schedule a meeting at 9PM with Tony"
    once the LLM has turned that into times + emails.
    """
    user = _current_user(request, authorization)
    uid = user["id"]

    # ✅ Check for conflicts BEFORE creating the event
    # Expand the window slightly to catch events that might overlap but start/end outside the window
    # e.g., an event from 3:30pm-4:30pm should be detected when scheduling 4pm-5pm
    buffer = timedelta(minutes=1)  # Small buffer to ensure we catch all overlapping events
    fetch_start = payload.start - buffer
    fetch_end = payload.end + buffer
    
    print(f"🔍 Checking for conflicts before scheduling event...")
    print(f"   Event window: {payload.start} to {payload.end}")
    print(f"   Fetch window: {fetch_start} to {fetch_end} (with buffer)")
    all_events = _get_all_events_for_window(uid, fetch_start, fetch_end)
    
    conflicts = []
    google_events_count = len([e for e in all_events if e.get("_provider") == "google"])
    outlook_events_count = len([e for e in all_events if e.get("_provider") == "outlook"])
    
    print(f"🔍 Checking {len(all_events)} events for conflicts with new event: {payload.start} to {payload.end}")
    print(f"   Events breakdown: {google_events_count} from Google Calendar, {outlook_events_count} from Outlook")
    
    # ✅ IMPORTANT: This loop checks ALL events from BOTH calendars
    # If you have:
    #   - Outlook event at 4pm
    #   - Google Calendar event at 4pm
    #   - Try to schedule new event at 4pm
    # Both existing events will be detected as conflicts and the operation will be BLOCKED
    for e in all_events:
        start_str = (
            e.get("start", {}).get("dateTime")
            or e.get("start", {}).get("date")  # all-day
        )
        end_str = (
            e.get("end", {}).get("dateTime")
            or e.get("end", {}).get("date")
        )
        if not start_str or not end_str:
            continue

        # Parse event times
        s = _parse_event_datetime(start_str)
        e_end = _parse_event_datetime(end_str)
        
        if s is None or e_end is None:
            print(f"⚠️ Skipping event '{e.get('summary', 'Unknown')}' due to invalid datetime")
            continue
        
        # For all-day events, we need special handling
        if len(start_str) == 10:  # All-day event (date-only)
            day_start = s.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            if _overlaps(payload.start, payload.end, day_start, day_end):
                conflicts.append(e)
                provider = e.get("_provider", "unknown")
                print(f"  ⚠️ Conflict: All-day event '{e.get('summary', 'Unknown')}' ({provider}) on {start_str}")
        else:
            # Regular timed event
            if _overlaps(payload.start, payload.end, s, e_end):
                conflicts.append(e)
                provider = e.get("_provider", "unknown")
                print(f"  ⚠️ Conflict: Event '{e.get('summary', 'Unknown')}' ({provider}) from {s} to {e_end}")
    
    # Prepare event body
    attendees = [{"email": a} for a in payload.attendees] if payload.attendees else None

    body = {
        "summary": payload.summary,
        "description": payload.description,
        "location": payload.location,
        "start": {"dateTime": payload.start.astimezone(timezone.utc).isoformat()},
        "end": {"dateTime": payload.end.astimezone(timezone.utc).isoformat()},
        "attendees": attendees,
    }

    # Strip None fields
    body = {k: v for k, v in body.items() if v is not None}

    print(f"📅 Creating calendar event for user {uid}:")
    print(f"   Summary: {body.get('summary')}")
    print(f"   Start: {body.get('start', {}).get('dateTime')}")
    print(f"   End: {body.get('end', {}).get('dateTime')}")
    print(f"   Attendees: {body.get('attendees', [])}")
    
    if conflicts:
        conflict_summaries = [c.get("summary", "Untitled event") for c in conflicts]
        conflict_details = []
        google_conflicts = 0
        outlook_conflicts = 0
        
        for c in conflicts:
            start_str = c.get("start", {}).get("dateTime") or c.get("start", {}).get("date", "")
            end_str = c.get("end", {}).get("dateTime") or c.get("end", {}).get("date", "")
            provider = c.get("_provider", "unknown")
            
            if provider == "google":
                google_conflicts += 1
            elif provider == "outlook":
                outlook_conflicts += 1
            
            conflict_details.append({
                "summary": c.get("summary", "Untitled event"),
                "start": start_str,
                "end": end_str,
                "provider": provider,
                "calendar": "Google Calendar" if provider == "google" else "Outlook" if provider == "outlook" else "Unknown"
            })
        
        # Build detailed conflict message
        conflict_sources = []
        if google_conflicts > 0:
            conflict_sources.append(f"{google_conflicts} from Google Calendar")
        if outlook_conflicts > 0:
            conflict_sources.append(f"{outlook_conflicts} from Outlook")
        
        conflict_source_msg = " and ".join(conflict_sources) if conflict_sources else "existing events"
        
        # Detailed logging
        print(f"❌ BLOCKED: Found {len(conflicts)} conflict(s) ({conflict_source_msg})")
        for i, c in enumerate(conflicts, 1):
            provider = c.get("_provider", "unknown")
            calendar_name = "Google Calendar" if provider == "google" else "Outlook" if provider == "outlook" else "Unknown"
            print(f"   Conflict {i}: '{c.get('summary', 'Unknown')}' in {calendar_name}")
        print(f"   All conflicts: {', '.join(conflict_summaries)}")
        raise HTTPException(
            status_code=409,  # Conflict status code
            detail={
                "error": "Schedule conflict detected",
                "message": f"Cannot schedule event: conflicts with {len(conflicts)} existing event(s) ({conflict_source_msg})",
                "conflicts": conflict_details,
                "conflict_count": len(conflicts),
                "google_conflicts": google_conflicts,
                "outlook_conflicts": outlook_conflicts
            }
        )
    
    print(f"✅ No conflicts found, proceeding with event creation")
    try:
        created = create_event(uid, body)
        print(f"✅ Event created successfully: {created.get('id', 'unknown')}")
        print(f"   Event link: {created.get('htmlLink', 'N/A')}")
        return {"status": "scheduled", "event": created, "has_conflict": False}
    except Exception as e:
        print(f"❌ Failed to create event: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create calendar event: {str(e)}")


def _get_user_timezone(uid: str) -> str:
    """Get user's timezone from preferences, default to UTC."""
    try:
        from supabase import create_client
        import os
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            supabase = create_client(SUPABASE_URL.rstrip('/'), SUPABASE_SERVICE_ROLE_KEY)
            result = supabase.table("user_profile").select("time_zone").eq("uid", uid).execute()
            if result.data and len(result.data) > 0:
                tz = result.data[0].get("time_zone")
                if tz:
                    return tz
    except Exception as e:
        print(f"⚠️ Could not get user timezone: {e}")
    return "UTC"


def _find_single_event_by_time(
    uid: str,
    target_start: datetime,
    summary: Optional[str] = None,
) -> str:
    """
    Helper: lookup a single event around target_start.
    Used when the user just says "the meeting at 8PM".
    """
    # Get user's timezone to ensure proper time comparisons
    user_tz_str = _get_user_timezone(uid)
    try:
        from zoneinfo import ZoneInfo
        user_tz = ZoneInfo(user_tz_str)
    except:
        user_tz = timezone.utc
    
    # Ensure target_start is in user's timezone for accurate comparison
    if target_start.tzinfo is None:
        target_start = target_start.replace(tzinfo=user_tz)
    else:
        target_start = target_start.astimezone(user_tz)
    
    # Use a 1-hour window (30 min before/after) to find events near the target time
    window_start = target_start - timedelta(minutes=30)
    window_end = target_start + timedelta(minutes=30)

    resp = list_events(
        uid,
        window_start.astimezone(timezone.utc).isoformat(),
        window_end.astimezone(timezone.utc).isoformat(),
        None,
    )
    items = resp.get("items") if isinstance(resp, dict) else resp or []
    candidates = []
    
    print(f"🔍 Searching {len(items)} events in window {window_start} to {window_end}")

    for e in items:
        start_str = (
            e.get("start", {}).get("dateTime")
            or e.get("start", {}).get("date")
        )
        if not start_str:
            continue

        try:
            if len(start_str) == 10:
                s = datetime.fromisoformat(start_str).replace(tzinfo=timezone.utc)
            else:
                s = datetime.fromisoformat(start_str)
        except Exception:
            continue

        # Normalize both times to user's timezone for accurate comparison
        if s.tzinfo is None:
            s = s.replace(tzinfo=timezone.utc)
        # Convert both to user's timezone
        s_normalized = s.astimezone(user_tz)
        target_start_normalized = target_start  # Already in user_tz from above
        
        # within 30 minutes of the requested time (strict matching to avoid wrong events)
        time_diff_seconds = abs((s_normalized - target_start_normalized).total_seconds())
        time_diff_minutes = time_diff_seconds / 60
        if time_diff_minutes <= 30:  # 30 minute window (was 2 hours - too lenient!)
            event_summary = e.get("summary") or ""
            print(f"  ⏰ Event '{event_summary}' at {s_normalized} (target: {target_start_normalized}, diff: {time_diff_minutes:.1f} min)")
            
            if summary:
                summary_lower = summary.lower()
                event_summary_lower = event_summary.lower()
                # More flexible matching: check if summary contains keywords or vice versa
                # Also check if summary is just "event" (generic) - match any event at that time
                if summary_lower == "event" or summary_lower in event_summary_lower or event_summary_lower in summary_lower or any(word in event_summary_lower for word in summary_lower.split() if len(word) > 2):
                    print(f"    ✅ Matches summary filter")
                    candidates.append(e)
                else:
                    print(f"    ❌ Summary doesn't match: '{summary_lower}' vs '{event_summary_lower}'")
            else:
                print(f"    ✅ No summary filter, adding candidate")
                candidates.append(e)

    if not candidates:
        raise HTTPException(404, "No matching event found to cancel/reschedule")

    if len(candidates) > 1:
        raise HTTPException(
            409,
            "Multiple events match this time. Frontend should ask user to clarify.",
        )

    return candidates[0]["id"]


@router.post("/cancel")
def cancel_event(
    request: Request, 
    payload: CancelRequest,
    authorization: Optional[str] = Header(default=None)
):
    """
    Cancel (delete) a calendar event.

    Maps to: "Hey Mira, please cancel the meeting at 8PM."
    """
    user = _current_user(request, authorization)
    uid = user["id"]

    print(f"🗑️ Cancel request: event_id={payload.event_id}, start={payload.start}, summary={payload.summary}")

    if payload.event_id:
        eid = payload.event_id
        print(f"✅ Using provided event_id: {eid}")
    else:
        if not payload.start:
            raise HTTPException(
                400, "Either event_id or start must be provided to cancel an event."
            )
        print(f"🔍 Searching for event at {payload.start} with summary '{payload.summary}'")
        try:
            eid = _find_single_event_by_time(uid, payload.start, payload.summary)
            print(f"✅ Found event: {eid}")
        except HTTPException as e:
            print(f"❌ Event not found: {e.detail}")
            raise

    print(f"🗑️ Deleting event {eid}")
    delete_event(uid, eid)
    print(f"✅ Event {eid} cancelled successfully")
    return {"status": "cancelled", "event_id": eid}


@router.post("/reschedule")
def reschedule_event(
    request: Request, 
    payload: RescheduleRequest,
    authorization: Optional[str] = Header(default=None)
):
    """
    Reschedule an existing event by updating start/end.
    
    Automatically checks for conflicts in BOTH Google Calendar and Outlook
    before rescheduling the event.

    Maps to: "Hey Mira, move my 3PM with Tony to 4PM."
    """
    user = _current_user(request, authorization)
    uid = user["id"]

    if payload.event_id:
        eid = payload.event_id
    else:
        if not payload.old_start:
            raise HTTPException(
                400,
                "Either event_id or old_start must be provided to reschedule an event.",
            )
        eid = _find_single_event_by_time(uid, payload.old_start, payload.summary)

    # ✅ Check for conflicts BEFORE rescheduling the event
    # Expand the window slightly to catch events that might overlap but start/end outside the window
    buffer = timedelta(minutes=1)  # Small buffer to ensure we catch all overlapping events
    fetch_start = payload.new_start - buffer
    fetch_end = payload.new_end + buffer
    
    print(f"🔍 Checking for conflicts before rescheduling event...")
    print(f"   New event window: {payload.new_start} to {payload.new_end}")
    print(f"   Fetch window: {fetch_start} to {fetch_end} (with buffer)")
    all_events = _get_all_events_for_window(uid, fetch_start, fetch_end)
    
    conflicts = []
    print(f"🔍 Checking {len(all_events)} events for conflicts with rescheduled event: {payload.new_start} to {payload.new_end}")
    
    for e in all_events:
        # Skip the event we're rescheduling (if we have its ID)
        if payload.event_id and e.get("id") == payload.event_id:
            print(f"  ⏭️ Skipping event being rescheduled: {e.get('summary', 'Unknown')}")
            continue
            
        start_str = (
            e.get("start", {}).get("dateTime")
            or e.get("start", {}).get("date")  # all-day
        )
        end_str = (
            e.get("end", {}).get("dateTime")
            or e.get("end", {}).get("date")
        )
        if not start_str or not end_str:
            continue

        # Parse event times
        s = _parse_event_datetime(start_str)
        e_end = _parse_event_datetime(end_str)
        
        if s is None or e_end is None:
            print(f"⚠️ Skipping event '{e.get('summary', 'Unknown')}' due to invalid datetime")
            continue
        
        # For all-day events, we need special handling
        if len(start_str) == 10:  # All-day event (date-only)
            day_start = s.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            if _overlaps(payload.new_start, payload.new_end, day_start, day_end):
                conflicts.append(e)
                provider = e.get("_provider", "unknown")
                print(f"  ⚠️ Conflict: All-day event '{e.get('summary', 'Unknown')}' ({provider}) on {start_str}")
        else:
            # Regular timed event
            if _overlaps(payload.new_start, payload.new_end, s, e_end):
                conflicts.append(e)
                provider = e.get("_provider", "unknown")
                print(f"  ⚠️ Conflict: Event '{e.get('summary', 'Unknown')}' ({provider}) from {s} to {e_end}")

    body = {
        "start": {"dateTime": payload.new_start.astimezone(timezone.utc).isoformat()},
        "end": {"dateTime": payload.new_end.astimezone(timezone.utc).isoformat()},
    }

    if conflicts:
        conflict_summaries = [c.get("summary", "Untitled event") for c in conflicts]
        conflict_details = []
        google_conflicts = 0
        outlook_conflicts = 0
        
        for c in conflicts:
            start_str = c.get("start", {}).get("dateTime") or c.get("start", {}).get("date", "")
            end_str = c.get("end", {}).get("dateTime") or c.get("end", {}).get("date", "")
            provider = c.get("_provider", "unknown")
            
            if provider == "google":
                google_conflicts += 1
            elif provider == "outlook":
                outlook_conflicts += 1
            
            conflict_details.append({
                "summary": c.get("summary", "Untitled event"),
                "start": start_str,
                "end": end_str,
                "provider": provider,
                "calendar": "Google Calendar" if provider == "google" else "Outlook" if provider == "outlook" else "Unknown"
            })
        
        # Build detailed conflict message
        conflict_sources = []
        if google_conflicts > 0:
            conflict_sources.append(f"{google_conflicts} from Google Calendar")
        if outlook_conflicts > 0:
            conflict_sources.append(f"{outlook_conflicts} from Outlook")
        
        conflict_source_msg = " and ".join(conflict_sources) if conflict_sources else "existing events"
        
        print(f"❌ BLOCKED: Found {len(conflicts)} conflict(s) at new time ({conflict_source_msg}): {', '.join(conflict_summaries)}")
        raise HTTPException(
            status_code=409,  # Conflict status code
            detail={
                "error": "Schedule conflict detected",
                "message": f"Cannot reschedule event: conflicts with {len(conflicts)} existing event(s) ({conflict_source_msg})",
                "conflicts": conflict_details,
                "conflict_count": len(conflicts),
                "google_conflicts": google_conflicts,
                "outlook_conflicts": outlook_conflicts
            }
        )
    
    print(f"✅ No conflicts found at new time, proceeding with reschedule")
    updated = patch_event(uid, eid, body)
    return {
        "status": "rescheduled",
        "event_id": eid,
        "event": updated,
        "has_conflict": False
    }