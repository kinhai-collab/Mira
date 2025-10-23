import os
import datetime
from typing import Dict, Optional, Tuple, Any, Callable

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import asyncio
import time
from collections import deque

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CAL_BASE = "https://www.googleapis.com/calendar/v3"

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# ------------------------------------------------------------------------------
# Router
# ------------------------------------------------------------------------------
router = APIRouter(prefix="/oauth", tags=["google-oauth"])

# ------------------------------------------------------------------------------
# Minimal in-memory token “DB” (replace with your Supabase table user_google_tokens)
# ------------------------------------------------------------------------------
_tokens: Dict[str, Dict[str, Any]] = {}  # user_id -> {access_token, refresh_token, scope, expiry}

class TokenIn(BaseModel):
    user_id: str
    access_token: str
    refresh_token: Optional[str] = None
    scope: Optional[str] = None
    expires_in: Optional[int] = 3500

@router.post("/google/store")
async def store_google_tokens(payload: TokenIn):
    """
    Called by the frontend callback page right after Google OAuth finishes.
    Stores (or updates) the user's Google tokens.
    """
    expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=payload.expires_in or 3500)
    _tokens[payload.user_id] = {
        "access_token": payload.access_token,
        "refresh_token": payload.refresh_token,
        "scope": payload.scope,
        "expiry": expiry,
    }
    return {"ok": True, "expiry": expiry.isoformat()}

# ------------------------------------------------------------------------------
# Access-token refresh
# ------------------------------------------------------------------------------
async def refresh_access_token(refresh_token: str) -> Dict[str, Any]:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth env vars not configured on backend")

    data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(GOOGLE_TOKEN_URL, data=data)
        r.raise_for_status()
        return r.json()

async def ensure_active_access_token(user_id: str) -> str:
    rec = _tokens.get(user_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No Google tokens stored for this user")

    if rec["expiry"] <= datetime.datetime.utcnow():
        # Need to refresh
        if not rec.get("refresh_token"):
            raise HTTPException(status_code=401, detail="Google access token expired and no refresh token available")
        j = await refresh_access_token(rec["refresh_token"])
        rec["access_token"] = j["access_token"]
        rec["expiry"] = datetime.datetime.utcnow() + datetime.timedelta(seconds=j.get("expires_in", 3500))

    return rec["access_token"]

# ------------------------------------------------------------------------------
# Per-user rate limiter (1000 requests / 100 seconds)
# ------------------------------------------------------------------------------
class PerUserSlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._buckets: Dict[str, deque] = {}

    def allow(self, key: str) -> Tuple[bool, float]:
        """
        Returns (allowed, retry_after_seconds).
        """
        now = time.monotonic()
        dq = self._buckets.setdefault(key, deque())
        cutoff = now - self.window
        # prune old
        while dq and dq[0] <= cutoff:
            dq.popleft()
        if len(dq) < self.limit:
            dq.append(now)
            return True, 0.0
        retry_after = max(0.0, dq[0] + self.window - now)
        return False, retry_after

_calendar_limiter = PerUserSlidingWindowLimiter(limit=1000, window_seconds=100)

async def _guard_rate_limit(user_id: str):
    ok, retry_after = _calendar_limiter.allow(user_id)
    if not ok:
        # You can choose to sleep here instead of raising:
        # await asyncio.sleep(retry_after)
        raise HTTPException(status_code=429, detail=f"Google quota hit; retry after {retry_after:.2f}s")

# ------------------------------------------------------------------------------
# Retry wrapper for Google calls (exponential backoff + Retry-After)
# ------------------------------------------------------------------------------
async def with_backoff_request(
    request_fn: Callable[[], Any],
    *,
    max_attempts: int = 5,
    base_delay: float = 0.5,
    max_delay: float = 8.0
) -> httpx.Response:
    attempt = 0
    delay = base_delay
    while True:
        attempt += 1
        try:
            resp = await request_fn()
        except httpx.RequestError:
            if attempt >= max_attempts:
                raise
            await asyncio.sleep(delay)
            delay = min(max_delay, delay * 2)
            continue

        if resp.status_code < 400:
            return resp

        # 429/503 → honor Retry-After
        if resp.status_code in (429, 503):
            ra = resp.headers.get("Retry-After")
            if ra:
                try:
                    await asyncio.sleep(float(ra))
                except ValueError:
                    await asyncio.sleep(delay)
            else:
                await asyncio.sleep(delay)
            if attempt < max_attempts:
                delay = min(max_delay, delay * 2)
                continue
            return resp

        # 403 rateLimitExceeded (Google)
        if resp.status_code == 403:
            try:
                j = resp.json()
                errs = j.get("error", {}).get("errors", [])
                if any(e.get("reason") == "rateLimitExceeded" for e in errs):
                    if attempt >= max_attempts:
                        return resp
                    await asyncio.sleep(delay)
                    delay = min(max_delay, delay * 2)
                    continue
            except Exception:
                pass

        # other errors: no retry
        return resp

# ------------------------------------------------------------------------------
# Unified helpers for Google Calendar API (ALL calls go through these)
# ------------------------------------------------------------------------------
async def google_get(user_id: str, access_token: str, path: str, params: dict):
    await _guard_rate_limit(user_id)
    headers = {"Authorization": f"Bearer {access_token}"}

    async def do_req():
        async with httpx.AsyncClient(timeout=20) as client:
            return await client.get(f"{GOOGLE_CAL_BASE}/{path}", headers=headers, params=params)

    resp = await with_backoff_request(do_req)
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise HTTPException(status_code=resp.status_code, detail=detail)
    return resp.json()

async def google_post(user_id: str, access_token: str, path: str, payload: dict):
    await _guard_rate_limit(user_id)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    async def do_req():
        async with httpx.AsyncClient(timeout=20) as client:
            return await client.post(f"{GOOGLE_CAL_BASE}/{path}", headers=headers, json=payload)

    resp = await with_backoff_request(do_req)
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise HTTPException(status_code=resp.status_code, detail=detail)
    return resp.json()

# ------------------------------------------------------------------------------
# Example endpoints using the helpers
# ------------------------------------------------------------------------------
class ListParams(BaseModel):
    user_id: str
    calendar_id: str = "primary"
    max_results: int = 10

@router.get("/google/calendar/events")
async def list_primary_events(user_id: str = Query(...), calendar_id: str = Query("primary"), max_results: int = Query(10)):
    token = await ensure_active_access_token(user_id)
    params = {
        "maxResults": max_results,
        "singleEvents": True,
        "orderBy": "startTime",
        "timeMin": datetime.datetime.utcnow().isoformat() + "Z",
    }
    return await google_get(user_id, token, f"calendars/{calendar_id}/events", params)

class NewEvent(BaseModel):
    user_id: str
    calendar_id: str = "primary"
    summary: str
    start_iso: str  # "2025-10-21T15:00:00Z"
    end_iso: str    # "2025-10-21T16:00:00Z"
    description: Optional[str] = None
    location: Optional[str] = None

@router.post("/google/calendar/events")
async def create_event(evt: NewEvent):
    token = await ensure_active_access_token(evt.user_id)
    payload = {
        "summary": evt.summary,
        "description": evt.description,
        "location": evt.location,
        "start": {"dateTime": evt.start_iso},
        "end": {"dateTime": evt.end_iso},
    }
    return await google_post(evt.user_id, token, f"calendars/{evt.calendar_id}/events", payload)