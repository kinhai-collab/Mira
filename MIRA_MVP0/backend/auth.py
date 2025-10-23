from fastapi import APIRouter, Form, HTTPException, Body, Header, Query
from fastapi.responses import JSONResponse, RedirectResponse
import requests
import os
from dotenv import load_dotenv
from urllib.parse import urlencode
from fastapi import Header
from typing import Optional

# Load environment variables
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Missing Supabase credentials in .env file")

router = APIRouter()

# User Signup endpoint
@router.post("/signup")
async def sign_up(email: str = Form(...), password: str = Form(...)):
    try:
        # Prepare Supabase signup request
        url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/signup"
        headers = {"apikey": SUPABASE_KEY, "Content-Type": "application/json"}
        payload = {"email": email, "password": password}
        res = requests.post(url, headers=headers, json=payload)
        data = res.json()

        # Return success response if signup is successful
        if res.status_code == 200:
            return JSONResponse(content={
                "status": "success",
                "message": "User created successfully.",
                "email": data.get("user", {}).get("email")
            })
        else:
            # Raise HTTP exception if signup fails
            error_msg = data.get("msg") or data.get("error_description") or "Signup failed."
            raise HTTPException(status_code=res.status_code, detail={"status": "error", "message": error_msg})
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(status_code=500, detail={"status": "error", "message": f"Error: {e}"})


# User Sign-in endpoint
@router.post("/signin")
async def sign_in(email: str = Form(...), password: str = Form(...)):
    try:
        # Prepare Supabase sign-in request
        url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password"
        headers = {"apikey": SUPABASE_KEY, "Content-Type": "application/json"}
        payload = {"email": email, "password": password}
        res = requests.post(url, headers=headers, json=payload)
        data = res.json()

        # Return access token and user email if sign-in is successful
        if res.status_code == 200:
            return JSONResponse(content={
                "status": "success",
                "message": "Sign in successful.",
                "access_token": data.get("access_token"),
                "user_email": data.get("user", {}).get("email", email)
            })
        else:
            # Raise HTTP exception if sign-in fails
            error_msg = data.get("msg") or data.get("error_description") or "Sign in failed."
            raise HTTPException(status_code=res.status_code, detail={"status": "error", "message": error_msg})
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(status_code=500, detail={"status": "error", "message": f"Error: {e}"})


# Gmail OAuth Integration
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email"
]

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"

# Google signup/in endpoint
@router.get("/auth/google")
def google_oauth_start():
    # Redirect user to Google Consent Screen
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",   # Request refresh token
        "prompt": "consent"
    }
    url = f"{AUTH_URL}?{urlencode(params)}"
    # Redirect user to Google's OAuth page
    return RedirectResponse(url=url)

@router.get("/auth/google/callback")
def google_oauth_callback(code: str = Query(...)):
    # Exchange the authorization code for an access token
    data = {
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code"
    }

    try:
        res = requests.post(TOKEN_URL, data=data)
        token_data = res.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error requesting access token: {str(e)}")

    if "access_token" not in token_data:
        raise HTTPException(status_code=400, detail="Failed to retrieve access token")

    access_token = token_data["access_token"]

    # Retrieve Gmail user info
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        profile_res = requests.get("https://www.googleapis.com/gmail/v1/users/me/profile", headers=headers)
        profile = profile_res.json()
        email = profile.get("emailAddress")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving Gmail profile: {str(e)}")

    # Sign up the user in Supabase
    try:
        supabase_url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/signup"
        headers_sup = {"apikey": SUPABASE_KEY, "Content-Type": "application/json"}
        payload = {"email": email, "password": os.urandom(16).hex()}
        requests.post(supabase_url, headers=headers_sup, json=payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error signing up in Supabase: {str(e)}")

    # Redirect user to frontend onboarding
    frontend_onboarding_url = "https://main.dd480r9y8ima.amplifyapp.com/onboarding/step1"
    redirect = RedirectResponse(
        url=f"{frontend_onboarding_url}?email={email}&access_token={access_token}"
    )
    return redirect

@router.get("/me")
def me(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"}
    try:
        r = requests.get(f"{SUPABASE_URL.rstrip('/')}/auth/v1/user", headers=headers)
        return JSONResponse(status_code=r.status_code, content=r.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")

@router.post("/profile_update")
def profile_update(
    payload: dict = Body(...),
    authorization: Optional[str] = Header(default=None)
):
    """
    Updates the authenticated user's Supabase auth user_metadata with profile info.

    Expected payload (JSON):
    {
      "firstName": "...",       // optional
      "middleName": "...",      // optional
      "lastName": "...",        // optional
      "fullName": "...",        // optional (fallback: first + last)
      "picture": "https://..."   // optional avatar URL
    }
    Requires Authorization: Bearer <user_access_token> header.
    """
    # Validate Authorization header
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ", 1)[1].strip()

    # Build user_metadata update
    first_name = (payload or {}).get("firstName")
    middle_name = (payload or {}).get("middleName")
    last_name = (payload or {}).get("lastName")
    full_name = (payload or {}).get("fullName")
    picture = (payload or {}).get("picture")

    if not full_name:
        names = [n for n in [first_name, last_name] if n]
        if names:
            full_name = " ".join(names)

    user_metadata: dict = {}
    if first_name:
        user_metadata["given_name"] = first_name
    if middle_name:
        user_metadata["middle_name"] = middle_name
    if last_name:
        user_metadata["family_name"] = last_name
    if full_name:
        user_metadata["full_name"] = full_name
    if picture:
        user_metadata["avatar_url"] = picture

    if not user_metadata:
        return {"status": "noop", "message": "No profile fields provided"}

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        # PATCH auth user metadata
        r = requests.patch(
            f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
            headers=headers,
            json={"data": user_metadata},
        )

        if r.status_code not in (200, 201):
            try:
                err = r.json()
            except Exception:
                err = {"error": r.text}
            raise HTTPException(status_code=r.status_code, detail=err)

        return {"status": "success", "user": r.json()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")

# Trailing-slash alias to avoid 405 when client sends /profile_update/
@router.post("/profile_update/")
def profile_update_alias(
    payload: dict = Body(...),
    authorization: Optional[str] = Header(default=None)
):
    return profile_update(payload=payload, authorization=authorization)

# Test endpoint to verify server is working
@router.get("/test")
def test():
    return {"status": "ok", "message": "Server is running"}

# Handle CORS preflight for profile_update
@router.options("/profile_update")
def profile_update_options():
    return JSONResponse(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )

@router.post("/onboarding_save")
def onboarding_save(payload: dict = Body(...)):
    """
    Upserts the exact onboarding selections into Supabase.
    Expected payload (JSON):
    {
      "email": "user@example.com",
      "step1": { "consents": {...}, "selectedTools": ["Gmail","Outlook"] },
      "step2": { "firstName":"", "middleName":"", "lastName":"" },
      "step3": { "connectedEmails": ["..."] },
      "step4": { "connectedCalendars": ["..."] },
      "step5": { "permissions": { "pushNotifications": true, "microphoneAccess": false, "wakeWordDetection": false } }
    }
    """
    if not payload or "email" not in payload:
        raise HTTPException(status_code=400, detail="Payload must include 'email'")

    # Flatten + map fields to columns in 'public.onboarding'
    step1 = payload.get("step1") or {}
    step2 = payload.get("step2") or {}
    step3 = payload.get("step3") or {}
    step4 = payload.get("step4") or {}
    step5 = payload.get("step5") or {}
    perms = (step5.get("permissions") or {})

    row = {
        "email": payload.get("email"),
        "consents": step1.get("consents"),
        "selectedTools": step1.get("selectedTools"),
        "firstName": step2.get("firstName"),
        "middleName": step2.get("middleName"),
        "lastName": step2.get("lastName"),
        "connectedEmails": step3.get("connectedEmails"),
        "connectedCalendars": step4.get("connectedCalendars"),
        "pushNotifications": bool(perms.get("pushNotifications", True)),
        "microphoneAccess": bool(perms.get("microphoneAccess", False)),
        "wakeWordDetection": bool(perms.get("wakeWordDetection", False)),
    }

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation,resolution=merge-duplicates",
    }
    try:
        r = requests.post(
            f"{SUPABASE_URL.rstrip('/')}/rest/v1/onboarding?on_conflict=email",
            headers=headers,
            json=row
        )
        if r.status_code in (200, 201):
            return {"status": "success", "message": "Onboarding saved.", "data": r.json()}
        try:
            err = r.json()
        except Exception:
            err = {"error": r.text}
        raise HTTPException(status_code=r.status_code, detail=err)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")

@router.get("/onboarding_status")
def onboarding_status(
    email: Optional[str] = Query(None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Returns whether an onboarding row exists for the given email.
    If email is not provided, we derive it from the Supabase auth token in the Authorization header.
    Response: {"email": "...", "onboarded": true/false}
    """
    try:
        if not email:
            if not authorization or not authorization.lower().startswith("bearer "):
                raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
            token = authorization.split(" ", 1)[1].strip()
            headers_me = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"}
            r_me = requests.get(f"{SUPABASE_URL.rstrip('/')}/auth/v1/user", headers=headers_me)
            if r_me.status_code != 200:
                raise HTTPException(status_code=401, detail="Unable to fetch user from token")
            email = (r_me.json() or {}).get("email")
            if not email:
                raise HTTPException(status_code=400, detail="No email in Supabase user response")

        headers_sb = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        }
        r = requests.get(
            f"{SUPABASE_URL.rstrip('/')}/rest/v1/onboarding",
            headers=headers_sb,
            params={"select": "email", "email": f"eq.{email}"},
        )
        if r.status_code != 200:
            try:
                err = r.json()
            except Exception:
                err = {"error": r.text}
            raise HTTPException(status_code=r.status_code, detail=err)

        rows = r.json() or []
        return {"email": email, "onboarded": len(rows) > 0}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")