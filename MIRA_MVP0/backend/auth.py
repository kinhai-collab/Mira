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
    "https://www.googleapis.com/auth/gmail.send"
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
    # Exchange code for access token
    data = {
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    
    # Send POST request to get access token
    res = requests.post(TOKEN_URL, data=data)
    token_data = res.json()

    if "access_token" not in token_data:
        raise HTTPException(status_code=400, detail="Failed to retrieve access token")

    access_token = token_data["access_token"]

    # Get Gmail user info
    headers = {"Authorization": f"Bearer {access_token}"}
    profile_res = requests.get("https://www.googleapis.com/gmail/v1/users/me/profile", headers=headers)
    profile = profile_res.json()

    return JSONResponse({
        "status": "success",
        "email": profile.get("emailAddress"),
        "access_token": access_token,
        "refresh_token": token_data.get("refresh_token")
    })

@router.post("/auth/google/refresh")
def google_refresh_token(refresh_token: str = Query(...)):
    # Refresh access token using the provided refresh token
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }

    res = requests.post(TOKEN_URL, data=data)
    token_data = res.json()

    if "access_token" not in token_data:
        raise HTTPException(status_code=400, detail="Failed to refresh access token")

    return JSONResponse({
        "access_token": token_data["access_token"],
        "expires_in": token_data.get("expires_in")
    })

    
@router.get("/me")
def me(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"}
    try:
        r = requests.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers)
        return JSONResponse(status_code=r.status_code, content=r.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")

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
            f"{SUPABASE_URL}/rest/v1/onboarding?on_conflict=email",
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