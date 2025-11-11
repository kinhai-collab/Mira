import os, base64, hashlib, uuid, requests
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from fastapi import HTTPException
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


from .supa import sb
from .rate_limit import acquire
from . import settings

from supabase import create_client
import os

# Initialize Supabase client once
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def _now() -> datetime:
    return datetime.now(timezone.utc)

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

# ---------- pkce ----------
def code_verifier() -> str:
    return base64.urlsafe_b64encode(os.urandom(40)).decode().rstrip("=")

def code_challenge(verifier: str) -> str:
    dig = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(dig).decode().rstrip("=")

# ---------- state storage ----------
def save_state(state: str, verifier: str, uid: Optional[str]):
    sb().table("oauth_pkce_state").insert({"state": state, "code_verifier": verifier, "uid": uid}).execute()

def pop_state(state: str) -> Tuple[str, Optional[str]]:
    res = sb().table("oauth_pkce_state").select("*").eq("state", state).single().execute()
    if not res.data:
        raise HTTPException(400, "Invalid/expired state")
    verifier = res.data["code_verifier"]
    uid = res.data.get("uid")
    sb().table("oauth_pkce_state").delete().eq("state", state).execute()
    return verifier, uid

# ---------- authorize url / token exchange ----------
from urllib.parse import urlencode

def authorize_url(state: str, verifier: str) -> str:
    q = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(settings.SCOPES),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "select_account consent",
        "state": state,
        "code_challenge": code_challenge(verifier),
        "code_challenge_method": "S256",
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(q)

def token_exchange(code: str, verifier: str) -> Dict[str, Any]:
    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "code_verifier": verifier,
    }
    # Web OAuth client requires client_secret
    if settings.GOOGLE_CLIENT_SECRET:
        data["client_secret"] = settings.GOOGLE_CLIENT_SECRET
    resp = requests.post("https://oauth2.googleapis.com/token", data=data, timeout=20)
    if resp.status_code != 200:
        raise HTTPException(400, f"Token exchange failed: {resp.text}")
    return resp.json()

def token_refresh(refresh_token: str) -> Dict[str, Any]:
    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    if settings.GOOGLE_CLIENT_SECRET:
        data["client_secret"] = settings.GOOGLE_CLIENT_SECRET
    resp = requests.post("https://oauth2.googleapis.com/token", data=data, timeout=20)
    if resp.status_code != 200:
        raise HTTPException(400, f"Refresh failed: {resp.text}")
    return resp.json()

# ---------- db helpers ----------
def upsert_creds(payload):
    """Insert or update Google Calendar credentials for this user."""
    res = supabase.table("google_calendar_credentials").upsert(payload).execute()

    # Handle both new and old supabase-py response types
    status_code = getattr(res, "status_code", None)
    data = getattr(res, "data", None)

    # Debugging log (optional)
    print(f"[Google Calendar] Upsert response: status={status_code}, data={data}")

    # Treat as success if data returned and no explicit error
    if status_code and status_code not in (200, 201, 204):
        raise HTTPException(400, f"Supabase upsert failed: {status_code}, response: {data}")
    if data is None or (isinstance(data, list) and len(data) == 0):
        raise HTTPException(400, f"Supabase returned empty data: {res}")

    print(f"[Google Calendar] ✅ Tokens stored for user {payload.get('uid')}")
    return data

def get_creds(uid: str) -> Optional[Dict[str, Any]]:
    res = sb().table("google_calendar_credentials").select("*").eq("uid", uid).maybe_single().execute()
    return res.data if res.data else None

def delete_creds(uid: str):
    sb().table("google_calendar_credentials").delete().eq("uid", uid).execute()

# ---------- google client ----------
def _creds(row: Dict[str, Any]) -> Credentials:
    c = Credentials(
        token=row["access_token"],
        refresh_token=row["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET or None,
        scopes=settings.SCOPES,
    )
    # naive refresh check
    if row.get("expiry"):
        try:
            expiry = datetime.fromisoformat(row["expiry"].replace("Z","")).astimezone(timezone.utc)
            if _now() >= expiry:
                new = token_refresh(row["refresh_token"])
                row["access_token"] = new["access_token"]
                row["expiry"] = _iso(_now() + timedelta(seconds=new.get("expires_in", 3600)))
                upsert_creds(row)
                c.token = row["access_token"]
        except Exception:
            pass
    return c

def service(uid: str):
    row = get_creds(uid)
    if not row:
        raise HTTPException(400, "Google Calendar not connected")
    acquire(uid)
    return build("calendar", "v3", credentials=_creds(row)), row

# ---------- events & sync ----------
def initial_window():
    start = _now() - timedelta(days=30 * settings.INITIAL_SYNC_MONTHS_BACK)
    end   = _now() + timedelta(days=30 * settings.INITIAL_SYNC_MONTHS_FWD)
    return _iso(start), _iso(end)

def list_events(uid: str, time_min: str | None, time_max: str | None, page_token: str | None):
    svc, row = service(uid)
    params = {"calendarId": "primary", "singleEvents": True, "maxResults": 2500}
    if row.get("next_sync_token") and not (time_min or time_max):
        params["syncToken"] = row["next_sync_token"]
    else:
        if not time_min or not time_max:
            time_min, time_max = initial_window()
        params["timeMin"] = time_min
        params["timeMax"] = time_max
        if page_token:
            params["pageToken"] = page_token
    try:
        acquire(uid)
        resp = svc.events().list(**params).execute()
    except Exception as e:
        if "410" in str(e) or "Sync token is no longer valid" in str(e):
            time_min, time_max = initial_window()
            acquire(uid)
            resp = svc.events().list(calendarId="primary", singleEvents=True, maxResults=2500,
                                     timeMin=time_min, timeMax=time_max).execute()
        else:
            raise
    nst = resp.get("nextSyncToken")
    if nst:
        row["next_sync_token"] = nst
        upsert_creds(row)
    return resp

def create_event(uid: str, body: Dict[str, Any]):
    svc, _ = service(uid)
    acquire(uid)
    return svc.events().insert(calendarId="primary", body=body).execute()

def patch_event(uid: str, event_id: str, body: Dict[str, Any]):
    svc, _ = service(uid)
    acquire(uid)
    return svc.events().patch(calendarId="primary", eventId=event_id, body=body).execute()

def delete_event(uid: str, event_id: str):
    svc, _ = service(uid)
    acquire(uid)
    svc.events().delete(calendarId="primary", eventId=event_id).execute()
    return {"status": "deleted"}

# ---------- push notifications ----------
def start_watch(uid: str):
    svc, row = service(uid)
    channel_id = str(uuid.uuid4())
    body = {
        "id": channel_id,
        "type": "web_hook",
        "address": settings.GOOGLE_WEBHOOK_URL,
    }
    acquire(uid)
    watch = svc.events().watch(calendarId="primary", body=body).execute()
    row["channel_id"] = watch.get("id") or channel_id
    row["resource_id"] = watch.get("resourceId")
    if watch.get("expiration"):
        exp_ms = int(watch["expiration"])
        row["channel_expiration"] = _iso(datetime.fromtimestamp(exp_ms/1000, tz=timezone.utc))
    upsert_creds(row)
    return watch

def stop_watch(uid: str):
    row = get_creds(uid)
    if not row or not row.get("channel_id") or not row.get("resource_id"):
        return {"status": "no_channel"}
    svc, _ = service(uid)
    acquire(uid)
    svc.channels().stop(body={"id": row["channel_id"], "resourceId": row["resource_id"]}).execute()
    row["channel_id"] = None
    row["resource_id"] = None
    row["channel_expiration"] = None
    upsert_creds(row)
    return {"status": "stopped"}