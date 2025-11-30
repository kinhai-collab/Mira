from fastapi import APIRouter, Form, HTTPException, Body, Header, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
import requests
import os
from dotenv import load_dotenv
from urllib.parse import urlencode
from typing import Optional
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client

# Load environment variables
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
# Normalize URL to remove trailing slash to prevent double-slash issues
supabase: Client = create_client(SUPABASE_URL.rstrip('/') if SUPABASE_URL else "", SUPABASE_SERVICE_ROLE_KEY)

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
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/contacts.readonly",  # For looking up contacts by name
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
        "prompt": "select_account consent"
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
    refresh_token = token_data.get("refresh_token", "")
    token_scope = token_data.get("scope", "")
    expires_in = token_data.get("expires_in", 3600)
    
    # Check if calendar scopes are included in the token
    has_calendar_scope = "calendar.events" in token_scope or "calendar" in token_scope.lower()
    
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
    
    # If return_to is provided and it's an onboarding URL, redirect directly there
    # Otherwise, redirect to settings page (for users connecting from settings page)
    from urllib.parse import unquote, quote
    if return_to and ("/onboarding/step" in return_to):
        # During onboarding, redirect directly back to the onboarding step
        # Include all necessary parameters in the URL
        onboarding_url = f"{return_to}?gmail_connected=true&access_token={access_token}&email={email}"
        if has_calendar_scope:
            onboarding_url += f"&calendar_scope_granted=true"
            if refresh_token:
                onboarding_url += f"&gmail_refresh_token={refresh_token}"
        redirect = RedirectResponse(url=onboarding_url)
        return redirect
    else:
        # From settings page or other places, redirect to settings page
        settings_url = f"{frontend_url}/dashboard/settings?gmail_connected=true&access_token={access_token}&email={email}"
        if has_calendar_scope:
            settings_url += f"&calendar_scope_granted=true"
            if refresh_token:
                settings_url += f"&gmail_refresh_token={refresh_token}"
        if return_to:
            settings_url += f"&return_to={quote(return_to)}"
        
        redirect = RedirectResponse(url=settings_url)
        return redirect

# Endpoint to save Gmail credentials to backend for persistence
@router.post("/gmail/credentials/save")
async def save_gmail_credentials(
    authorization: Optional[str] = Header(default=None),
    gmail_access_token: str = Body(...),
    gmail_refresh_token: Optional[str] = Body(default=None)
):
    """
    Save Gmail credentials to backend so connection persists across sessions.
    This prevents connections from dropping when localStorage is cleared.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    try:
        # Get user ID and email from auth token
        token = authorization.split(" ")[1]
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        uid = user_resp.user.id
        user_email = user_resp.user.email
        
        # Save Gmail credentials to user_profile table
        from datetime import datetime, timedelta, timezone
        
        # Check if user profile already exists
        existing = supabase.table("user_profile").select("*").eq("uid", uid).execute()
        
        if existing.data and len(existing.data) > 0:
            # User exists - UPDATE only Gmail credentials
            gmail_data = {
                "gmail_access_token": gmail_access_token,
                "gmail_refresh_token": gmail_refresh_token or "",
                "gmail_token_expiry": (datetime.now(timezone.utc) + timedelta(seconds=3600)).isoformat(),
                "gmail_connected_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Also ensure Gmail is in connectedEmails list
            current_connected_emails = existing.data[0].get("connectedEmails", [])
            if not isinstance(current_connected_emails, list):
                current_connected_emails = []
            if "Gmail" not in current_connected_emails:
                gmail_data["connectedEmails"] = current_connected_emails + ["Gmail"]
            
            result = supabase.table("user_profile").update(gmail_data).eq("uid", uid).execute()
        else:
            # User doesn't exist - INSERT with all required fields
            # Get user name from metadata if available
            user_metadata = user_resp.user.user_metadata or {}
            first_name = user_metadata.get("given_name") or user_metadata.get("full_name", "").split()[0] or user_email.split("@")[0].capitalize()
            last_name = user_metadata.get("family_name") or ""
            
            gmail_data = {
                "uid": uid,
                "email": user_email,
                "firstName": first_name,
                "lastName": last_name,
                "gmail_access_token": gmail_access_token,
                "gmail_refresh_token": gmail_refresh_token or "",
                "gmail_token_expiry": (datetime.now(timezone.utc) + timedelta(seconds=3600)).isoformat(),
                "gmail_connected_at": datetime.now(timezone.utc).isoformat(),
                "connectedEmails": ["Gmail"]  # Add Gmail to connected emails
            }
            
            result = supabase.table("user_profile").insert(gmail_data).execute()
        
        print(f"Gmail credentials saved for user {uid}")
        
        return JSONResponse(content={
            "status": "success",
            "message": "Gmail credentials saved successfully"
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving Gmail credentials: {str(e)}")

# Endpoint to save calendar credentials from Gmail OAuth (when calendar scopes were granted)
@router.post("/gmail/calendar/save-from-gmail")
async def save_calendar_from_gmail(
    authorization: Optional[str] = Header(default=None),
    gmail_access_token: str = Body(...),
    gmail_refresh_token: Optional[str] = Body(default=None)
):
    """
    Save Google Calendar credentials using the Gmail OAuth token.
    This is called when Gmail OAuth includes calendar scopes.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    try:
        # Get user ID from auth token
        token = authorization.split(" ")[1]
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        uid = user_resp.user.id
        
        # Import calendar service functions
        from Google_Calendar_API.service import upsert_creds
        from datetime import datetime, timedelta, timezone
        
        # Save calendar credentials using the Gmail token
        payload = {
            "uid": uid,
            "email": user_resp.user.email or "unknown@user",
            "access_token": gmail_access_token,
            "refresh_token": gmail_refresh_token or "",
            "expiry": (datetime.now(timezone.utc) + timedelta(seconds=3600)).isoformat(),
            "scope": "https://www.googleapis.com/auth/calendar.events",
            "token_type": "Bearer",
        }
        
        upsert_creds(payload)
        
        return JSONResponse(content={
            "status": "success",
            "message": "Calendar credentials saved from Gmail OAuth"
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving calendar credentials: {str(e)}")

# Microsoft settings
MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
MICROSOFT_REDIRECT_URI = os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:8000/microsoft/auth/callback")
MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
MICROSOFT_SCOPES = [
    "offline_access",  # Required to get refresh_token for long-term access
    "User.Read",
    "Calendars.ReadWrite",
    "Mail.Read"
]

# --- Helpers ---
def get_microsoft_access_token(code: str) -> dict:
    """
    Exchange authorization code for access token and refresh token.
    Returns full token response including refresh_token for persistence.
    """
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
    response_data = res.json()
    token = response_data.get("access_token")
    
    if not token:
        error = response_data.get("error", "unknown_error")
        error_description = response_data.get("error_description", "Unknown error occurred")
        
        # Handle specific error cases
        if "AADSTS700016" in error_description or "was not found in the directory" in error_description:
            raise HTTPException(
                status_code=403,
                detail=(
                    "This application requires admin approval in your organization. "
                    "Please contact your IT administrator to approve the MIRA application "
                    "for your organization, or try using a personal Microsoft account instead."
                )
            )
        elif "AADSTS65005" in error_description or "consent" in error_description.lower():
            raise HTTPException(
                status_code=403,
                detail=(
                    "Admin consent is required for this application in your organization. "
                    "Please contact your IT administrator to grant consent for MIRA."
                )
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to get access token: {error_description}"
            )
    
    print(f"✅ Microsoft token exchange successful (access_token length: {len(token)})")
    # Return full token response including refresh_token
    return response_data

def get_microsoft_user_email(access_token: str) -> str:
    # Fetch user's email from Microsoft Graph API
    headers = {"Authorization": f"Bearer {access_token}"}
    profile = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers).json()
    return profile.get("mail") or profile.get("userPrincipalName")

# ---------- Outlook credentials database helpers ----------
def upsert_outlook_creds(uid: str, email: str, token_data: dict):
    """
    Save or update Outlook credentials in database for persistence.
    Similar to Google Calendar credentials storage.
    """
    from datetime import datetime, timedelta, timezone
    
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token", "")
    expires_in = token_data.get("expires_in", 3600)  # Default 1 hour
    scope = token_data.get("scope", " ".join(MICROSOFT_SCOPES))
    token_type = token_data.get("token_type", "Bearer")
    
    # Calculate expiry time
    expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    
    payload = {
        "uid": uid,
        "email": email,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expiry": expiry.isoformat(),
        "scope": scope,
        "token_type": token_type,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        res = supabase.table("outlook_credentials").upsert(payload).execute()
        print(f"✅ Outlook credentials saved to database for user {uid} ({email})")
        return res
    except Exception as e:
        print(f"❌ Error saving Outlook credentials: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save Outlook credentials: {str(e)}")

def get_outlook_creds(uid: str) -> Optional[dict]:
    """Get Outlook credentials from database for a user."""
    try:
        res = supabase.table("outlook_credentials").select("*").eq("uid", uid).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as e:
        print(f"⚠️ Error fetching Outlook credentials: {e}")
        return None

def refresh_outlook_token(refresh_token: str) -> dict:
    """
    Refresh an expired Outlook access token using refresh token.
    Returns new token data including access_token and refresh_token.
    """
    data = {
        "client_id": MICROSOFT_CLIENT_ID,
        "scope": " ".join(MICROSOFT_SCOPES),
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
        "client_secret": MICROSOFT_CLIENT_SECRET
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    res = requests.post(MICROSOFT_TOKEN_URL, data=data, headers=headers)
    response_data = res.json()
    
    if "access_token" not in response_data:
        error = response_data.get("error", "unknown_error")
        error_description = response_data.get("error_description", "Unknown error occurred")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to refresh Outlook token: {error_description}"
        )
    
    print("✅ Outlook token refreshed successfully")
    return response_data

def get_valid_outlook_token(uid: str) -> Optional[str]:
    """
    Get a valid Outlook access token for a user.
    Checks database first, refreshes if expired, falls back to None if no credentials.
    """
    creds = get_outlook_creds(uid)
    if not creds:
        return None
    
    from datetime import datetime, timezone
    
    # Check if token is expired (with 5 minute buffer)
    expiry_str = creds.get("expiry")
    if expiry_str:
        try:
            expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            # Refresh if expires within 5 minutes
            if expiry <= (now + timedelta(minutes=5)):
                print(f"🔄 Outlook token expired, refreshing for user {uid}")
                refresh_token = creds.get("refresh_token")
                if refresh_token:
                    try:
                        new_token_data = refresh_outlook_token(refresh_token)
                        # Update database with new tokens
                        email = creds.get("email")
                        upsert_outlook_creds(uid, email, new_token_data)
                        return new_token_data.get("access_token")
                    except Exception as e:
                        print(f"❌ Failed to refresh Outlook token: {e}")
                        return None
        except Exception as e:
            print(f"⚠️ Error parsing expiry date: {e}")
    
    # Token is still valid
    return creds.get("access_token")

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
def microsoft_oauth_start(request: Request, purpose: str = Query(None), return_to: str = Query(None), token: Optional[str] = Query(default=None), authorization: Optional[str] = Header(default=None)):
    # Start OAuth flow by redirecting to Microsoft login
    # Use state parameter to pass purpose, return_to, and user_id information
    # return_to is used to redirect back to onboarding after OAuth completes
    
    # Try to get user ID from token query parameter or authorization header (if user is already logged in)
    user_id = None
    
    # Try token query parameter first (from frontend)
    if token:
        try:
            user_resp = supabase.auth.get_user(token)
            if user_resp and user_resp.user:
                user_id = user_resp.user.id
                print(f"✅ Got user ID from token query parameter: {user_id}")
        except Exception as e:
            print(f"⚠️ Failed to get user from token query parameter: {e}")
    
    # Fallback to authorization header
    if not user_id and authorization and authorization.lower().startswith("bearer "):
        try:
            bearer_token = authorization.split(" ")[1]
            user_resp = supabase.auth.get_user(bearer_token)
            if user_resp and user_resp.user:
                user_id = user_resp.user.id
                print(f"✅ Got user ID from authorization header: {user_id}")
        except Exception as e:
            print(f"⚠️ Failed to get user from authorization header: {e}")
    
    state_parts = []
    if user_id:
        state_parts.append(f"uid={user_id}")
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
        "prompt": "select_account"  # Let user select account; consent will be requested if needed
    }
    if state:
        params["state"] = state
    url = f"{MICROSOFT_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(url=url)

@router.get("/microsoft/auth/callback")
def microsoft_oauth_callback(code: str = Query(...), state: str = Query(None), error: str = Query(None), error_description: str = Query(None)):
    # Handle callback from Microsoft OAuth
    # Check for OAuth errors first
    if error:
        frontend_url = get_frontend_url()
        error_msg = error_description or error
        
        # Parse state to get return_to for error redirect
        return_to = None
        if state:
            for part in state.split("&"):
                if part.startswith("return_to="):
                    return_to = part.split("=", 1)[1]
        
        # Redirect to settings with error message
        error_url = f"{frontend_url}/dashboard/settings?ms_error={error}&error_msg={error_msg}"
        if return_to:
            error_url += f"&return_to={return_to}"
        
        return RedirectResponse(url=error_url)
    
    try:
        token_data = get_microsoft_access_token(code)  # Now returns full token response
        access_token = token_data.get("access_token")
        email = get_microsoft_user_email(access_token)
        frontend_url = get_frontend_url()
        
        # ✅ Get user ID from state parameter (passed from OAuth start)
        uid = None
        if state:
            for part in state.split("&"):
                if part.startswith("uid="):
                    uid = part.split("=", 1)[1]
                    break
        
        # If uid not in state, try to find by email (backward compatibility)
        if not uid:
            upsert_supabase_user(email)
            try:
                user_resp = supabase.auth.admin.list_users()
                # Handle both list and object response formats
                users_list = user_resp if isinstance(user_resp, list) else (user_resp.users if hasattr(user_resp, 'users') else [])
                for user in users_list:
                    user_email = user.email if hasattr(user, 'email') else user.get('email')
                    user_id = user.id if hasattr(user, 'id') else user.get('id')
                    if user_email == email:
                        uid = user_id
                        break
                
                # If still not found, try REST API
                if not uid:
                    admin_headers = {
                        "apikey": SUPABASE_SERVICE_ROLE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                        "Content-Type": "application/json"
                    }
                    list_resp = requests.get(
                        f"{SUPABASE_URL}/auth/v1/admin/users",
                        headers=admin_headers,
                        params={"per_page": 1000}
                    )
                    if list_resp.status_code == 200:
                        users = list_resp.json().get("users", [])
                        for user in users:
                            if user.get("email") == email:
                                uid = user.get("id")
                                break
            except Exception as e:
                print(f"⚠️ Error looking up user by email: {e}")
        
        # Save Outlook credentials to database for persistence
        try:
            if uid:
                upsert_outlook_creds(uid, email, token_data)
                print(f"✅ Outlook credentials saved to database for user {uid} (email: {email})")
            else:
                print(f"⚠️ Could not determine user ID, credentials saved to cookie only (Outlook email: {email})")
        except Exception as e:
            print(f"⚠️ Error saving Outlook credentials to database: {e}")
            import traceback
            traceback.print_exc()
            # Continue anyway - cookie will still be set
    except HTTPException as e:
        # Handle HTTP exceptions (like admin consent errors)
        frontend_url = get_frontend_url()
        
        # Parse state to get return_to for error redirect
        return_to = None
        if state:
            for part in state.split("&"):
                if part.startswith("return_to="):
                    return_to = part.split("=", 1)[1]
        
        # Redirect to settings with error message
        error_url = f"{frontend_url}/dashboard/settings?ms_error=consent_required&error_msg={e.detail}"
        if return_to:
            error_url += f"&return_to={return_to}"
        
        return RedirectResponse(url=error_url)
    
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
            
            raise HTTPException(
                status_code=r.status_code, 
                detail={
                    "message": error_msg, 
                    "status": "error", 
                    "error_code": error_code,
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