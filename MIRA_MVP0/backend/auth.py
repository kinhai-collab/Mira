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
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Dynamic redirect URI based on environment
def get_redirect_uri():
    # Check if we're running in AWS Lambda
    if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        return os.getenv("REDIRECT_URI") or "https://ytm2meewyf.execute-api.us-east-2.amazonaws.com/dev/gmail/auth/callback"
    else:
        # Local development
        return os.getenv("REDIRECT_URI") or "http://localhost:8000/gmail/auth/callback"

REDIRECT_URI = get_redirect_uri()

# Redirect user back to onboarding step 3 with Gmail access token
def get_frontend_url():
        # Check if we're running in AWS Lambda
        if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
            return os.getenv("FRONTEND_URL", "https://main.dd480r9y8ima.amplifyapp.com")
        else:
            # Local development
            return os.getenv("FRONTEND_URL", "http://localhost:3000")

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
                "refresh_token": data.get("refresh_token"),  # Include refresh token
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

# Gmail Integration OAuth endpoint (separate from user authentication)
@router.get("/gmail/auth")
def gmail_oauth_start(return_to: str = Query(None)):
    # Redirect user to Google Consent Screen
    # Store return_to in state parameter to redirect back after OAuth
    state = f"return_to={return_to}" if return_to else None
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",   # Request refresh token
        "prompt": "consent"
    }
    if state:
        params["state"] = state
    url = f"{AUTH_URL}?{urlencode(params)}"
    # Redirect user to Google's OAuth page
    return RedirectResponse(url=url)

@router.get("/gmail/auth/callback")
def gmail_oauth_callback(code: str = Query(...), state: str = Query(None)):
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
        error_msg = token_data.get("error_description", "Unknown error")
        if "invalid_client" in str(token_data):
            error_msg = f"OAuth client configuration error. Please check your Google Cloud Console OAuth client settings. Make sure the redirect URI '{REDIRECT_URI}' is added to your OAuth client's authorized redirect URIs."
        raise HTTPException(status_code=400, detail=f"Failed to retrieve access token: {error_msg}")

    access_token = token_data["access_token"]

    # Retrieve Gmail user info
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        profile_res = requests.get("https://www.googleapis.com/gmail/v1/users/me/profile", headers=headers)
        profile = profile_res.json()
        email = profile.get("emailAddress")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving Gmail profile: {str(e)}")
    
    frontend_url = get_frontend_url()
    
    # Parse state to get return_to
    return_to = None
    if state:
        for part in state.split("&"):
            if part.startswith("return_to="):
                return_to = part.split("=", 1)[1]
    
    # Always redirect to settings page first (standard flow)
    # Settings page will handle redirecting back to onboarding if return_to is present
    from urllib.parse import unquote
    settings_url = f"{frontend_url}/dashboard/settings?gmail_connected=true&access_token={access_token}&email={email}"
    if return_to:
        settings_url += f"&return_to={return_to}"
    
    redirect = RedirectResponse(url=settings_url)
    return redirect

# Microsoft settings
MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
MICROSOFT_REDIRECT_URI = os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:8000/microsoft/auth/callback")
MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
MICROSOFT_SCOPES = [
    "User.Read",
    "Calendars.ReadWrite",
    "Mail.Read"
]

# --- Helpers ---
def get_microsoft_access_token(code: str) -> str:
    # Exchange authorization code for access token
    data = {
        "client_id": MICROSOFT_CLIENT_ID,
        "scope": " ".join(MICROSOFT_SCOPES),
        "code": code,
        "redirect_uri": MICROSOFT_REDIRECT_URI,
        "grant_type": "authorization_code",
        "client_secret": MICROSOFT_CLIENT_SECRET
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    res = requests.post(MICROSOFT_TOKEN_URL, data=data, headers=headers)
    token = res.json().get("access_token")
    print("Microsoft_access_token: ", token)
    if not token:
        raise HTTPException(status_code=400, detail="Failed to get access token")
    return token

def get_microsoft_user_email(access_token: str) -> str:
    # Fetch user's email from Microsoft Graph API
    headers = {"Authorization": f"Bearer {access_token}"}
    profile = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers).json()
    return profile.get("mail") or profile.get("userPrincipalName")

def upsert_supabase_user(email: str):
    # Add or update user in Supabase
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    payload = {"email": email, "email_confirm": True}
    res = requests.post(f"{SUPABASE_URL}/auth/v1/admin/users", json=payload, headers=headers)
    # Currently no error handling for this request

@router.get("/microsoft/auth")
def microsoft_oauth_start(purpose: str = Query(None), return_to: str = Query(None)):
    # Start OAuth flow by redirecting to Microsoft login
    # Use state parameter to pass purpose and return_to information
    # return_to is used to redirect back to onboarding after OAuth completes
    state_parts = []
    if purpose:
        state_parts.append(f"purpose={purpose}")
    if return_to:
        state_parts.append(f"return_to={return_to}")
    state = "&".join(state_parts) if state_parts else None
    
    params = {
        "client_id": MICROSOFT_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": MICROSOFT_REDIRECT_URI,
        "response_mode": "query",
        "scope": " ".join(MICROSOFT_SCOPES),
        "prompt": "consent"
    }
    if state:
        params["state"] = state
    url = f"{MICROSOFT_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(url=url)

@router.get("/microsoft/auth/callback")
def microsoft_oauth_callback(code: str = Query(...), state: str = Query(None)):
    # Handle callback from Microsoft OAuth
    access_token = get_microsoft_access_token(code)
    email = get_microsoft_user_email(access_token)
    upsert_supabase_user(email)
    frontend_url = get_frontend_url()
    
    # Parse state parameter to get purpose and return_to
    purpose = None
    return_to = None
    if state:
        for part in state.split("&"):
            if part.startswith("purpose="):
                purpose = part.split("=", 1)[1]
            elif part.startswith("return_to="):
                return_to = part.split("=", 1)[1]
    
    # Always redirect to settings page (standard flow like Google Calendar)
    # Settings page will handle redirecting back to onboarding if return_to is present
    settings_url = f"{frontend_url}/dashboard/settings?ms_connected=true&email={email}"
    if purpose:
        settings_url += f"&purpose={purpose}"
    if return_to:
        settings_url += f"&return_to={return_to}"
    
    redirect_url = settings_url

    # Set access token as HttpOnly cookie
    response = RedirectResponse(url=redirect_url)
    # Only set secure=True in production (HTTPS), not in local development
    is_production = os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.getenv("FRONTEND_URL", "").startswith("https://")
    
    # Set cookie domain - use None (default) which sets cookie for current domain
    # This ensures cookies work for both localhost (same origin) and cross-origin requests
    cookie_kwargs = {
        "key": "ms_access_token",
        "value": access_token,
        "httponly": True,
        "secure": is_production,   # Only secure in production (HTTPS)
        "samesite": "lax"
    }
    # Don't set domain explicitly - let it default to the request domain
    # This works for both localhost and production
    response.set_cookie(**cookie_kwargs)
    
    print(f"[Microsoft OAuth] Cookie set: ms_access_token (secure={is_production})")

    return response


@router.post("/refresh_token")
def refresh_token(refresh_token: str = Body(..., embed=True)):
    """
    Refresh an expired access token using a refresh token.
    """
    try:
        url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=refresh_token"
        headers = {"apikey": SUPABASE_KEY, "Content-Type": "application/json"}
        payload = {"refresh_token": refresh_token}
        res = requests.post(url, headers=headers, json=payload)
        data = res.json()

        if res.status_code == 200:
            return JSONResponse(content={
                "status": "success",
                "access_token": data.get("access_token"),
                "refresh_token": data.get("refresh_token"),
            })
        else:
            error_msg = data.get("msg") or data.get("error_description") or "Token refresh failed."
            raise HTTPException(status_code=res.status_code, detail={"status": "error", "message": error_msg})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"status": "error", "message": f"Error: {e}"})

@router.get("/me")
def me(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"}
    try:
        r = requests.get(f"{SUPABASE_URL.rstrip('/')}/auth/v1/user", headers=headers)
        if r.status_code == 200:
            return JSONResponse(status_code=200, content=r.json())
        else:
            try:
                error_data = r.json()
                raise HTTPException(status_code=r.status_code, detail=error_data)
            except:
                raise HTTPException(status_code=r.status_code, detail={"error": r.text})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

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
    
    # Validate service role key is available
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set")

    # First, get the user ID from the token
    headers_user = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    
    try:
        # Get user info to extract user ID and existing metadata
        r_user = requests.get(
            f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
            headers=headers_user
        )
        
        if r_user.status_code != 200:
            try:
                err = r_user.json()
                error_code = err.get("code") or err.get("error_code")
                error_msg = err.get("message") or err.get("error_description") or err.get("msg") or str(err)
                
                # Check if token is expired
                if error_code == "bad_jwt" or "expired" in error_msg.lower() or "invalid JWT" in error_msg:
                    raise HTTPException(
                        status_code=401,
                        detail={
                            "message": "Your session has expired. Please refresh your token or log in again.",
                            "status": "error",
                            "error_code": "token_expired"
                        }
                    )
            except HTTPException:
                raise
            except Exception:
                error_msg = r_user.text or f"HTTP {r_user.status_code}"
            
            raise HTTPException(status_code=r_user.status_code, detail={"message": error_msg, "status": "error"})
        
        user_data = r_user.json()
        user_id = user_data.get("id")
        
        if not user_id:
            raise HTTPException(status_code=400, detail={"message": "Unable to extract user ID from token", "status": "error"})

        # Get existing user_metadata to merge with new data
        existing_metadata = user_data.get("user_metadata") or {}

        # Build user_metadata update (merge with existing)
        first_name = (payload or {}).get("firstName")
        middle_name = (payload or {}).get("middleName")
        last_name = (payload or {}).get("lastName")
        full_name = (payload or {}).get("fullName")
        picture = (payload or {}).get("picture")

        if not full_name:
            names = [n for n in [first_name, last_name] if n]
            if names:
                full_name = " ".join(names)

        # Merge new metadata with existing
        user_metadata: dict = dict(existing_metadata)  # Start with existing
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

        # Check if there are actual changes
        has_changes = any(
            user_metadata.get(key) != existing_metadata.get(key)
            for key in ["given_name", "middle_name", "family_name", "full_name", "avatar_url"]
        )
        
        if not has_changes and not any([first_name, middle_name, last_name, full_name, picture]):
            return {"status": "noop", "message": "No profile fields provided or no changes detected"}

        # Use service role key to update user metadata via admin API
        headers_admin = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        }

        # Prepare update payload - Supabase admin API expects user_metadata in the payload
        update_payload = {
            "user_metadata": user_metadata
        }

        # Try PUT first (Supabase admin API standard)
        r = requests.put(
            f"{SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{user_id}",
            headers=headers_admin,
            json=update_payload,
        )

        # If PUT fails with 403, try PATCH
        if r.status_code == 403:
            print(f"PUT returned 403, trying PATCH instead...")
            r = requests.patch(
                f"{SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{user_id}",
                headers=headers_admin,
                json=update_payload,
            )

        if r.status_code not in (200, 201):
            try:
                err = r.json()
                error_msg = err.get("message") or err.get("error_description") or err.get("msg") or str(err)
                error_code = err.get("code") or err.get("error_code")
            except Exception:
                error_msg = r.text or f"HTTP {r.status_code}: {r.reason}"
                error_code = None
            
            print(f"Supabase admin API error: {r.status_code} - {error_msg}")
            print(f"Request URL: {SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{user_id}")
            print(f"Service role key present: {bool(SUPABASE_SERVICE_ROLE_KEY)}")
            
            raise HTTPException(
                status_code=r.status_code, 
                detail={
                    "message": error_msg, 
                    "status": "error", 
                    "error_code": error_code,
                    "debug": f"Failed to update user {user_id}",
                    "hint": "Check if SUPABASE_SERVICE_ROLE_KEY is correctly set in environment variables"
                }
            )

        # Return updated user data
        updated_user = r.json()
        return {"status": "success", "user": updated_user}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = str(e)
        print(f"Profile update error: {error_detail}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail={"message": f"Internal server error: {error_detail}", "status": "error"})


# Test endpoint to verify server is working
@router.get("/test")
def test():
    return {"status": "ok", "message": "Server is running"}

# Debug endpoint to check environment variables
@router.get("/debug/env")
def debug_env():
    return {
        "CLIENT_ID": CLIENT_ID,
        "CLIENT_SECRET_SET": bool(CLIENT_SECRET),
        "REDIRECT_URI": REDIRECT_URI,
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_KEY_SET": bool(SUPABASE_KEY),
        "TOKEN_URL": TOKEN_URL,
        "AUTH_URL": AUTH_URL
    }

# Handle CORS preflight for profile_update
@router.options("/profile_update")
@router.options("/profile_update/")
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
    This is ONLY for new user onboarding during signup.
    For user profile updates after signup, use /user_preferences_save, /user_notifications_save, etc.
    
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
        # If no email provided, get it from the token
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

@router.get("/onboarding_data")
def get_onboarding_data(
    email: Optional[str] = Query(None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Returns the full onboarding data for the given email.
    If email is not provided, we derive it from the Supabase auth token in the Authorization header.
    Response: Full onboarding data including permissions, connected services, etc.
    """
    try:
        # If no email provided, get it from the token
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
            params={"select": "*", "email": f"eq.{email}"},
        )
        if r.status_code != 200:
            try:
                err = r.json()
            except Exception:
                err = {"error": r.text}
            raise HTTPException(status_code=r.status_code, detail=err)

        rows = r.json() or []
        if len(rows) > 0:
            return {"email": email, "onboarded": True, "data": rows[0]}
        else:
            return {"email": email, "onboarded": False, "data": None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")