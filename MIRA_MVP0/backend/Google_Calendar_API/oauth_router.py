from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from .service import code_verifier, authorize_url, save_state, pop_state, token_exchange, upsert_creds
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/google/calendar", tags=["google-calendar"])

def _current_user(request: Request) -> dict:
    """
    Non-invasive dependency:
    - If your framework sets request.state.user, we use it.
    - Else allow X-User-Id/X-User-Email for local/dev.
    Replace with your real dependency anytime—no other code changes required.
    """
    u = getattr(request.state, "user", None)
    if u and getattr(u, "id", None):
        return {"id": u.id, "email": getattr(u, "email", None)}
    uid = request.headers.get("x-user-id")
    email = request.headers.get("x-user-email")
    if not uid:
        raise HTTPException(401, "Unauthorized")
    return {"id": uid, "email": email}

@router.get("/oauth/start")
def oauth_start(request: Request):
    user = _current_user(request)
    v = code_verifier()
    st = __import__("uuid").uuid4().hex
    save_state(st, v, user["id"])
    return RedirectResponse(authorize_url(st, v))

@router.get("/oauth/callback")
def oauth_callback(code: str | None = None, state: str | None = None):
    if not code or not state:
        raise HTTPException(400, "Missing code/state")
    verifier, uid = pop_state(state)
    tok = token_exchange(code, verifier)

    payload = {
        "uid": uid,
        "email": "unknown@user",  # optional; you may overwrite later
        "access_token": tok["access_token"],
        "refresh_token": tok.get("refresh_token", ""),
        "expiry": (datetime.now(timezone.utc) + timedelta(seconds=tok.get("expires_in", 3600))).isoformat(),
        "scope": tok.get("scope", ""),
        "token_type": tok.get("token_type", "Bearer"),
    }
    upsert_creds(payload)

    # Return to your Settings UI (adjust domain only; keeps existing frontend unchanged)
    return RedirectResponse("http://localhost:3000/settings?calendar=google&status=connected")