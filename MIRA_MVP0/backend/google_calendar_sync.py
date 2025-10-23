
import datetime as dt
from typing import Dict, List, Tuple, Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

# Import the helpers we just added
from google_calendar import ensure_active_access_token, google_get

GOOGLE_CAL_BASE = "https://www.googleapis.com/calendar/v3"

sync_router = APIRouter(prefix="/google/calendar", tags=["google-calendar-sync"])

# ------------------------------------------------------------------------------
# Minimal in-memory storage (replace with DB: calendar_sync_state + events table)
# ------------------------------------------------------------------------------
_sync_state: Dict[Tuple[str, str], Dict[str, Any]] = {}   # (user_id, calendar_id) -> {sync_token, last_synced_at}
_events_store: Dict[Tuple[str, str], Dict[str, Any]] = {}  # (user_id, event_id) -> event json
# ------------------------------------------------------------------------------

def get_sync_token(user_id: str, calendar_id: str) -> Optional[str]:
    rec = _sync_state.get((user_id, calendar_id))
    return rec["sync_token"] if rec else None

def set_sync_token(user_id: str, calendar_id: str, token: str):
    _sync_state[(user_id, calendar_id)] = {"sync_token": token, "last_synced_at": dt.datetime.utcnow()}

def clear_sync_token(user_id: str, calendar_id: str):
    _sync_state.pop((user_id, calendar_id), None)

def upsert_event(user_id: str, event: Dict[str, Any]):
    _events_store[(user_id, event["id"])] = event

def delete_event(user_id: str, event_id: str):
    _events_store.pop((user_id, event_id), None)

# ------------------------------------------------------------------------------
# Models
# ------------------------------------------------------------------------------
class SyncResult(BaseModel):
    upserts: List[Dict[str, Any]]
    deletes: List[str]
    next_sync_token: Optional[str] = None
    full_resync_performed: bool = False

# ------------------------------------------------------------------------------
# Internal helpers that now use `google_get` (rate limit + retries)
# ------------------------------------------------------------------------------
async def _perform_incremental_fetch(user_id: str, access_token: str, calendar_id: str, sync_token: str) -> Tuple[List[Dict[str, Any]], List[str], Optional[str]]:
    upserts: List[Dict[str, Any]] = []
    deletes: List[str] = []
    page_token: Optional[str] = None
    next_sync_token: Optional[str] = None

    while True:
        params = {
            "syncToken": sync_token,
            "showDeleted": "true",
            "maxResults": 2500,
        }
        if page_token:
            params["pageToken"] = page_token

        # Use helper (handles rate limits + retry)
        payload = await google_get(user_id, access_token, f"calendars/{calendar_id}/events", params)

        # Note: if the syncToken is invalid Google would normally respond 410.
        # `google_get` will translate that to HTTPException, which the caller handles.
        for ev in payload.get("items", []):
            if ev.get("status") == "cancelled":
                deletes.append(ev["id"])
            else:
                upserts.append(ev)

        next_sync_token = payload.get("nextSyncToken", next_sync_token)
        page_token = payload.get("nextPageToken")
        if not page_token:
            break

    return upserts, deletes, next_sync_token

async def _perform_full_fetch(user_id: str, access_token: str, calendar_id: str, time_min_iso: str) -> Tuple[List[Dict[str, Any]], List[str], Optional[str]]:
    upserts: List[Dict[str, Any]] = []
    deletes: List[str] = []
    page_token: Optional[str] = None
    next_sync_token: Optional[str] = None

    while True:
        params = {
            "timeMin": time_min_iso,
            "singleEvents": "true",
            "orderBy": "startTime",
            "showDeleted": "true",
            "maxResults": 2500,
        }
        if page_token:
            params["pageToken"] = page_token

        payload = await google_get(user_id, access_token, f"calendars/{calendar_id}/events", params)

        for ev in payload.get("items", []):
            if ev.get("status") == "cancelled":
                deletes.append(ev["id"])
            else:
                upserts.append(ev)

        next_sync_token = payload.get("nextSyncToken", next_sync_token)
        page_token = payload.get("nextPageToken")
        if not page_token:
            break

    return upserts, deletes, next_sync_token

# ------------------------------------------------------------------------------
# Public endpoint
# ------------------------------------------------------------------------------
@sync_router.post("/sync", response_model=SyncResult)
async def sync_calendar(
    user_id: str = Query(..., description="Supabase user id"),
    calendar_id: str = Query("primary"),
    lookback_days: int = Query(60, ge=0, le=3650, description="For first full sync only"),
):
    """
    Incremental sync using Google's syncToken.
    - If we have a stored sync_token → fetch only changes since last sync.
    - If token invalid (410) or missing → perform full fetch, then store new token.
    """
    # 1) Ensure we have a fresh Google access token
    access_token = await ensure_active_access_token(user_id)

    # 2) Try incremental first
    existing = get_sync_token(user_id, calendar_id)
    if existing:
        try:
            upserts, deletes, next_token = await _perform_incremental_fetch(user_id, access_token, calendar_id, existing)
        except HTTPException as e:
            # If Google says 410 Gone (invalid/expired token), fall back to full resync
            if e.status_code == 410:
                clear_sync_token(user_id, calendar_id)
            else:
                raise
        else:
            if next_token:
                for ev in upserts: upsert_event(user_id, ev)
                for ev_id in deletes: delete_event(user_id, ev_id)
                set_sync_token(user_id, calendar_id, next_token)
                return SyncResult(
                    upserts=upserts,
                    deletes=deletes,
                    next_sync_token=next_token,
                    full_resync_performed=False
                )
            # If no next_token returned, force full resync
            clear_sync_token(user_id, calendar_id)

    # 3) Full resync
    time_min = (dt.datetime.utcnow() - dt.timedelta(days=lookback_days)).replace(microsecond=0).isoformat() + "Z"
    upserts, deletes, next_token = await _perform_full_fetch(user_id, access_token, calendar_id, time_min)

    for ev in upserts: upsert_event(user_id, ev)
    for ev_id in deletes: delete_event(user_id, ev_id)

    if next_token:
        set_sync_token(user_id, calendar_id, next_token)

    return SyncResult(
        upserts=upserts,
        deletes=deletes,
        next_sync_token=next_token,
        full_resync_performed=True
    )