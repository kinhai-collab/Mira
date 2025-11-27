from datetime import datetime, timedelta, timezone
from typing import List, Optional
import os
import requests

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


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


@router.post("/check-conflicts")
def check_conflicts(
    request: Request, 
    window: TimeWindow,
    authorization: Optional[str] = Header(default=None)
):
    """
    Backend for: "Hey Mira, check for conflicts."

    The frontend / LLM should convert natural language into a concrete
    time window and call this endpoint.
    """
    user = _current_user(request, authorization)
    uid = user["id"]

    events_resp = list_events(
        uid,
        window.start.astimezone(timezone.utc).isoformat(),
        window.end.astimezone(timezone.utc).isoformat(),
        None,
    )

    items = events_resp.get("items") if isinstance(events_resp, dict) else events_resp
    if items is None:
        items = []

    conflicts = []
    for e in items:
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

        # All-day events (date-only)
        if len(start_str) == 10:
            s = datetime.fromisoformat(start_str).replace(tzinfo=timezone.utc)
            e_end = datetime.fromisoformat(end_str).replace(tzinfo=timezone.utc)
        else:
            s = datetime.fromisoformat(start_str)
            e_end = datetime.fromisoformat(end_str)

        if _overlaps(window.start, window.end, s, e_end):
            conflicts.append(e)

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

    Maps to: "Hey Mira, schedule a meeting at 9PM with Tony"
    once the LLM has turned that into times + emails.
    """
    user = _current_user(request, authorization)
    uid = user["id"]

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

    try:
        created = create_event(uid, body)
        print(f"✅ Event created successfully: {created.get('id', 'unknown')}")
        print(f"   Event link: {created.get('htmlLink', 'N/A')}")
        return {"status": "scheduled", "event": created}
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

    body = {
        "start": {"dateTime": payload.new_start.astimezone(timezone.utc).isoformat()},
        "end": {"dateTime": payload.new_end.astimezone(timezone.utc).isoformat()},
    }

    updated = patch_event(uid, eid, body)
    return {"status": "rescheduled", "event_id": eid, "event": updated}