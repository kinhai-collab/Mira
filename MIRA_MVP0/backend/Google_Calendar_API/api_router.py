from fastapi import APIRouter, Request
from fastapi import HTTPException
from .service import (
    list_events, create_event, patch_event, delete_event,
    start_watch, stop_watch
)
from .supa import sb

router = APIRouter(prefix="/google/calendar", tags=["google-calendar"])

def _current_user(request: Request) -> dict:
    u = getattr(request.state, "user", None)
    if u and getattr(u, "id", None):
        return {"id": u.id, "email": getattr(u, "email", None)}
    uid = request.headers.get("x-user-id")
    email = request.headers.get("x-user-email")
    if not uid:
        raise HTTPException(401, "Unauthorized")
    return {"id": uid, "email": email}

@router.get("/events")
def get_events(request: Request, timeMin: str | None = None, timeMax: str | None = None, pageToken: str | None = None):
    user = _current_user(request)
    return list_events(user["id"], time_min=timeMin, time_max=timeMax, page_token=pageToken)

@router.post("/events")
def post_event(request: Request, body: dict):
    user = _current_user(request)
    return create_event(user["id"], body)

@router.patch("/events/{event_id}")
def patch_event_api(request: Request, event_id: str, body: dict):
    user = _current_user(request)
    return patch_event(user["id"], event_id, body)

@router.delete("/events/{event_id}")
def delete_event_api(request: Request, event_id: str):
    user = _current_user(request)
    return delete_event(user["id"], event_id)

@router.post("/watch")
def watch(request: Request):
    user = _current_user(request)
    return start_watch(user["id"])

@router.post("/stop")
def stop(request: Request):
    user = _current_user(request)
    return stop_watch(user["id"])

# Google push webhook
@router.post("/notifications")
def notifications(request: Request):
    resource_id = request.headers.get("X-Goog-Resource-ID")
    channel_id = request.headers.get("X-Goog-Channel-ID")
    if not resource_id or not channel_id:
        return {"status": "ignored"}

    res = sb().table("google_calendar_credentials").select("uid").eq("resource_id", resource_id).eq("channel_id", channel_id).single().execute()
    if not res.data:
        return {"status": "unknown_channel"}

    uid = res.data["uid"]
    try:
        _ = list_events(uid, None, None, None)  # incremental pull via syncToken
        return {"status": "synced"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}