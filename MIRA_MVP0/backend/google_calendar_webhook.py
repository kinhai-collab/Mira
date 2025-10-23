
import uuid
import datetime as dt
from typing import Optional, Dict, Any

from fastapi import APIRouter, Request, HTTPException, Query, status
from pydantic import BaseModel

from google_calendar import ensure_active_access_token, google_post  # our helpers
from google_calendar_sync import (  # reuse your sync logic
    _perform_incremental_fetch,
    _perform_full_fetch,
    get_sync_token,
    set_sync_token,
    clear_sync_token,
    upsert_event,
    delete_event,
)

router = APIRouter(prefix="/google/calendar", tags=["google-calendar-webhook"])

# ------------------------------------------------------------------------------
# Replace these stubs with real DB calls to Supabase calendar_watch_channels
# ------------------------------------------------------------------------------
# In-memory: channel_id -> record
_watch_store: Dict[str, Dict[str, Any]] = {}

def save_watch_record(user_id: str, calendar_id: str, channel_id: str, resource_id: str, address: str, expiration_ms: Optional[int]):
    expiry = None
    if expiration_ms:
        expiry = dt.datetime.utcfromtimestamp(expiration_ms / 1000.0)
    _watch_store[channel_id] = {
        "user_id": user_id,
        "calendar_id": calendar_id,
        "resource_id": resource_id,
        "address": address,
        "expiration": expiry,
        "created_at": dt.datetime.utcnow(),
    }

def get_watch_record_by_channel(channel_id: str) -> Optional[Dict[str, Any]]:
    return _watch_store.get(channel_id)

def delete_watch_record(channel_id: str):
    _watch_store.pop(channel_id, None)

# ------------------------------------------------------------------------------
# Start a watch (events.watch)
# ------------------------------------------------------------------------------
class StartWatchIn(BaseModel):
    user_id: str
    calendar_id: str = "primary"
    webhook_address: str  # https://your-domain.com/google/calendar/webhook

@router.post("/watch/start")
async def start_watch(body: StartWatchIn):
    """
    Opens a push notification channel against Google's Calendar Events API.
    Requirements:
      - webhook_address must be HTTPS and on a domain you control/verified.
    """
    # 1) Get Google access token for this user
    access_token = await ensure_active_access_token(body.user_id)

    # 2) Generate channel id (must be unique per watch)
    channel_id = str(uuid.uuid4())

    # 3) Build watch payload
    watch_payload = {
        "id": channel_id,
        "type": "web_hook",
        "address": body.webhook_address,
        # Optional: "token": "opaque-string",   # echoed back in notifications if set
        # Optional: "params": {"ttl": "86400"}  # some APIs support TTL; Calendar may ignore
    }

    # 4) Call Google events.watch
    resp = await google_post(
        body.user_id,
        access_token,
        f"calendars/{body.calendar_id}/events/watch",
        watch_payload,
    )

    # 5) Persist channel info (resourceId + expiration)
    resource_id = resp.get("resourceId")
    expiration_ms = resp.get("expiration")  # ms since epoch
    save_watch_record(
        user_id=body.user_id,
        calendar_id=body.calendar_id,
        channel_id=channel_id,
        resource_id=resource_id,
        address=body.webhook_address,
        expiration_ms=int(expiration_ms) if expiration_ms else None,
    )

    return {
        "ok": True,
        "channel_id": channel_id,
        "resource_id": resource_id,
        "expiration": expiration_ms,
    }

# ------------------------------------------------------------------------------
# Stop a watch (channels.stop)
# ------------------------------------------------------------------------------
class StopWatchIn(BaseModel):
    channel_id: str

@router.post("/watch/stop")
async def stop_watch(body: StopWatchIn):
    rec = get_watch_record_by_channel(body.channel_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Unknown channel_id")

    user_id = rec["user_id"]
    access_token = await ensure_active_access_token(user_id)

    payload = {
        "id": body.channel_id,
        "resourceId": rec["resource_id"],
    }
    # The stop endpoint is not under /calendar/v3; it's a top-level endpoint:
    # We'll reuse google_post but with the absolute path trick:
    # => we can add a helper or call httpx directly; for simplicity, use google_post with full path segment.
    # However our google_post builds <GOOGLE_CAL_BASE> + path; channels.stop is outside that base.
    # So handle it inline here with httpx:
    import httpx
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post("https://www.googleapis.com/calendar/v3/channels/stop", headers=headers, json=payload)
        r.raise_for_status()

    delete_watch_record(body.channel_id)
    return {"ok": True}

# ------------------------------------------------------------------------------
# Webhook receiver - Google POSTs here
# ------------------------------------------------------------------------------
@router.post("/webhook")
async def webhook(request: Request):
    """
    Receives push notifications from Google.
    We don't get payloads — only headers. Use them to identify the channel/user and then run incremental sync.
    """
    # Google sends key metadata in headers:
    channel_id = request.headers.get("X-Goog-Channel-ID")
    resource_id = request.headers.get("X-Goog-Resource-ID")
    message_number = request.headers.get("X-Goog-Message-Number")
    resource_state = request.headers.get("X-Goog-Resource-State")  # 'exists', 'sync', 'not_exists'

    if not channel_id or not resource_id:
        # not a valid notification
        return {"ok": True}

    rec = get_watch_record_by_channel(channel_id)
    if not rec:
        # Unknown channel — maybe already stopped. Acknowledge 200 so Google doesn't retry.
        return {"ok": True}

    user_id = rec["user_id"]
    calendar_id = rec["calendar_id"]

    # Run incremental sync for that user/calendar
    try:
        access_token = await ensure_active_access_token(user_id)
        existing_token = get_sync_token(user_id, calendar_id)

        if existing_token:
            # Try incremental
            upserts, deletes, next_token = await _perform_incremental_fetch(user_id, access_token, calendar_id, existing_token)
            if next_token:
                for ev in upserts: upsert_event(user_id, ev)
                for ev_id in deletes: delete_event(user_id, ev_id)
                set_sync_token(user_id, calendar_id, next_token)
            else:
                # missing next token => do full
                clear_sync_token(user_id, calendar_id)
                time_min = (dt.datetime.utcnow() - dt.timedelta(days=60)).replace(microsecond=0).isoformat() + "Z"
                upserts, deletes, next_token = await _perform_full_fetch(user_id, access_token, calendar_id, time_min)
                for ev in upserts: upsert_event(user_id, ev)
                for ev_id in deletes: delete_event(user_id, ev_id)
                if next_token:
                    set_sync_token(user_id, calendar_id, next_token)
        else:
            # No token yet => bootstrap full sync
            time_min = (dt.datetime.utcnow() - dt.timedelta(days=60)).replace(microsecond=0).isoformat() + "Z"
            upserts, deletes, next_token = await _perform_full_fetch(user_id, access_token, calendar_id, time_min)
            for ev in upserts: upsert_event(user_id, ev)
            for ev_id in deletes: delete_event(user_id, ev_id)
            if next_token:
                set_sync_token(user_id, calendar_id, next_token)

    except Exception:
        # Always return 200 to prevent Google retry storms; you can log the error.
        # A background job can reattempt sync on failure.
        return {"ok": True, "handled": False}

    # Acknowledge quickly (Google cares about response time)
    return {"ok": True, "handled": True}