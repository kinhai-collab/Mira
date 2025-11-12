from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from .service import code_verifier, authorize_url, save_state, pop_state, token_exchange, upsert_creds
from datetime import datetime, timedelta, timezone
import os

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
    from fastapi import Query, Header
    from typing import Optional
    import os
    import requests
    
    return_to = request.query_params.get("return_to") if hasattr(request, 'query_params') else None
    
    # Try to get user from various sources
    user = None
    
    # Method 1: Check if user is set in request state (from middleware)
    u = getattr(request.state, "user", None)
    if u and getattr(u, "id", None):
        user = {"id": u.id, "email": getattr(u, "email", None)}
    
    # Method 2: Check headers (x-user-id)
    if not user:
        uid = request.headers.get("x-user-id")
        email = request.headers.get("x-user-email")
        if uid:
            user = {"id": uid, "email": email}
    
    # Method 3: Extract from token (Authorization header or token query param)
    if not user:
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        else:
            token = request.query_params.get("token") if hasattr(request, 'query_params') else None
        
        if token:
            # Verify token and get user ID from Supabase
            SUPABASE_URL = os.getenv("SUPABASE_URL")
            SUPABASE_KEY = os.getenv("SUPABASE_KEY")
            if SUPABASE_URL and SUPABASE_KEY:
                try:
                    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"}
                    user_res = requests.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers, timeout=5)
                    if user_res.status_code == 200:
                        user_data = user_res.json()
                        user = {"id": user_data.get("id"), "email": user_data.get("email")}
                except Exception as e:
                    print(f"Error fetching user from token: {e}")
    
    if not user or not user.get("id"):
        raise HTTPException(401, "Unauthorized: Could not determine user. Please ensure you are logged in.")
    
    v = code_verifier()
    st = __import__("uuid").uuid4().hex
    save_state(st, v, user["id"])
    # Pass return_to via Google's state parameter (Google will return it in callback)
    # We append it to our state token
    google_state = st
    if return_to:
        google_state = f"{st}&return_to={return_to}"
    return RedirectResponse(authorize_url(google_state, v))

@router.get("/oauth/callback")
def oauth_callback(code: str | None = None, state: str | None = None):
    if not code or not state:
        raise HTTPException(400, "Missing code/state")
    
    # Extract return_to from state if present
    return_to = None
    actual_state = state
    if "&return_to=" in state:
        parts = state.split("&return_to=", 1)
        actual_state = parts[0]
        return_to = parts[1]
    
    verifier, uid = pop_state(actual_state)
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

    # If return_to is provided and it's an onboarding URL, redirect directly there
    # Otherwise, redirect to settings page (for users connecting from settings page)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    if return_to and ("/onboarding/step" in return_to):
        # During onboarding, redirect directly back to the onboarding step
        onboarding_url = f"{return_to}?calendar=google&status=connected"
        return RedirectResponse(onboarding_url)
    else:
        # From settings page or other places, redirect to settings page
        settings_url = f"{frontend_url}/dashboard/settings?calendar=google&status=connected"
        if return_to:
            from urllib.parse import quote
            settings_url += f"&return_to={quote(return_to)}"
        return RedirectResponse(settings_url)