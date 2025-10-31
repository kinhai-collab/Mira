from fastapi import APIRouter, HTTPException, Body, Header, Request
from supabase import create_client, Client
import os
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

router = APIRouter()

# Helper function to extract UID from Authorization header
def get_uid_from_token(authorization: str):
    """
    Extract UID from the Bearer token in the Authorization header.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    try:
        token = authorization.split(" ")[1]  # Expecting 'Bearer <token>'
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_resp.user.id
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        # Check if token is expired
        if "expired" in error_msg.lower() or "invalid" in error_msg.lower():
            raise HTTPException(
                status_code=401,
                detail={"message": "Your session has expired. Please refresh your token or log in again.", "status": "error", "error_code": "token_expired"}
            )
        raise HTTPException(status_code=401, detail=f"Invalid authorization header: {error_msg}")

# Helper function to get user email from token
def get_email_from_token(authorization: str):
    """
    Extract email from the Bearer token in the Authorization header.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    try:
        token = authorization.split(" ")[1]
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_resp.user.email
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "expired" in error_msg.lower() or "invalid" in error_msg.lower():
            raise HTTPException(
                status_code=401,
                detail={"message": "Your session has expired. Please refresh your token or log in again.", "status": "error", "error_code": "token_expired"}
            )
        raise HTTPException(status_code=401, detail=f"Invalid authorization header: {error_msg}")

# Helper function to get user name from token metadata
def get_user_name_from_token(authorization: str):
    """
    Extract firstName and lastName from user metadata in the token.
    Falls back to empty strings if not found.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None, None
    
    try:
        token = authorization.split(" ")[1]
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            return None, None
        
        user_metadata = user_resp.user.user_metadata or {}
        first_name = user_metadata.get("given_name") or ""
        last_name = user_metadata.get("family_name") or ""
        
        # If not in metadata, try to extract from full_name
        if not first_name:
            full_name = user_metadata.get("full_name") or ""
            if full_name:
                name_parts = full_name.split()
                first_name = name_parts[0] if name_parts else ""
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
        
        return first_name, last_name
    except Exception:
        return None, None

# Helper function to save or update user data
def save_user_data(uid: str, data: dict, email: str = None, authorization: str = None, table: str = "user_profile"):
    """
    Save or update user data in Supabase.
    - If the user exists, update the record.
    - If the user does not exist, insert a new record.
    Email and firstName are required for inserts (to satisfy NOT NULL constraints).
    """
    existing = supabase.table(table).select("*").eq("uid", uid).execute()
    if existing.data and len(existing.data) > 0:
        # Update existing user record
        response = supabase.table(table).update(data).eq("uid", uid).execute()
        return response.data
    
    # Insert new user record - email and firstName are required
    if not email:
        raise ValueError("Email is required for creating new user_profile record")
    
    # Get firstName and lastName if not in data (required fields)
    if "firstName" not in data or not data.get("firstName"):
        if authorization:
            first_name, last_name = get_user_name_from_token(authorization)
            if first_name and "firstName" not in data:
                data["firstName"] = first_name
            if last_name and "lastName" not in data:
                data["lastName"] = last_name
    
    # Ensure firstName exists (required field)
    if "firstName" not in data or not data.get("firstName"):
        # Try to extract from email as last resort
        email_prefix = email.split("@")[0] if email else ""
        data["firstName"] = email_prefix.capitalize() if email_prefix else "User"
    
    # Ensure lastName exists (even if empty string)
    if "lastName" not in data:
        data["lastName"] = ""
    
    response = supabase.table(table).insert({"uid": uid, "email": email, **data}).execute()
    return response.data

# Route to save or update user profile
@router.post("/user_profile_save")
async def user_profile_save(
    email: str = Body(...),
    firstName: str = Body(...),
    middleName: str = Body(None),
    lastName: str = Body(...),
    authorization: str = Header(...)
):
    """
    Save or update user's profile information (email, first, middle, last name).
    """
    uid = get_uid_from_token(authorization)
    # Verify the email matches the authenticated user
    auth_email = get_email_from_token(authorization)
    if email != auth_email:
        raise HTTPException(status_code=403, detail="Email does not match authenticated user")
    data = {"email": email, "firstName": firstName, "middleName": middleName, "lastName": lastName}
    result = save_user_data(uid, data, email=email)
    return {"message": "User profile saved successfully!", "data": result}

# Route to save or update user preferences
@router.post("/user_preferences_save")
async def user_preferences_save(
    payload: dict = Body(...),
    authorization: str = Header(...)
):
    """
    Save or update user preferences (language, timezone, voice).
    Expected payload: {"language": "...", "timeZone": "...", "voice": "..."}
    """
    uid = get_uid_from_token(authorization)
    email = get_email_from_token(authorization)
    data = {
        "language": payload.get("language"),
        "time_zone": payload.get("timeZone"),
        "voice": payload.get("voice")
    }
    # Remove None values
    data = {k: v for k, v in data.items() if v is not None}
    result = save_user_data(uid, data, email=email, authorization=authorization)
    return {"status": "success", "message": "User preferences saved successfully!", "data": result}

# Route to save or update user notifications settings
@router.post("/user_notifications_save")
async def user_notifications_save(
    payload: dict = Body(...),
    authorization: str = Header(...)
):
    """
    Save or update user notifications settings.
    Expected payload: {"pushNotifications": bool, "microphoneAccess": bool, "wakeWordDetection": bool}
    """
    uid = get_uid_from_token(authorization)
    email = get_email_from_token(authorization)
    data = {
        "pushNotifications": payload.get("pushNotifications"),
        "microphoneAccess": payload.get("microphoneAccess"),
        "wakeWordDetection": payload.get("wakeWordDetection")
    }
    # Remove None values
    data = {k: v for k, v in data.items() if v is not None}
    result = save_user_data(uid, data, email=email, authorization=authorization)
    return {"status": "success", "message": "User notifications saved successfully!", "data": result}

# Route to save or update user privacy settings
@router.post("/user_privacy_save")
async def user_privacy_save(
    payload: dict = Body(...),
    authorization: str = Header(...)
):
    """
    Save or update user privacy settings (connected emails and calendars).
    Expected payload: {"connectedEmails": [...], "connectedCalendars": [...]}
    """
    uid = get_uid_from_token(authorization)
    email = get_email_from_token(authorization)
    data = {
        "connectedEmails": payload.get("connectedEmails"),
        "connectedCalendars": payload.get("connectedCalendars")
    }
    # Remove None values
    data = {k: v for k, v in data.items() if v is not None}
    result = save_user_data(uid, data, email=email, authorization=authorization)
    return {"status": "success", "message": "User privacy saved successfully!", "data": result}

# Route to save or update user subscription plan
@router.post("/user_subscription_save")
async def user_subscription_save(
    payload: dict = Body(...),
    authorization: str = Header(...)
):
    """
    Save or update user's subscription plan and billing details.
    Expected payload: {
        "selectedPlan": "...",
        "cardName": "...",
        "cardNumber": "...",
        "expDate": "...",
        "cvv": "...",
        "address": "...",
        "city": "...",
        "state": "...",
        "postalCode": "..."
    }
    """
    uid = get_uid_from_token(authorization)
    email = get_email_from_token(authorization)
    data = {
        "subscriptionPlan": payload.get("selectedPlan"),
        "cardName": payload.get("cardName"),
        "cardNumber": payload.get("cardNumber"),
        "expDate": payload.get("expDate"),
        "cvv": payload.get("cvv"),
        "address": payload.get("address"),
        "city": payload.get("city"),
        "state": payload.get("state"),
        "postalCode": payload.get("postalCode")
    }
    # Remove None and empty string values
    data = {k: v for k, v in data.items() if v is not None and v != ""}
    result = save_user_data(uid, data, email=email, authorization=authorization)
    return {"status": "success", "message": "User subscription saved successfully!", "data": result}

def check_microsoft_token_validity(token: str) -> bool:
    """
    Check if Microsoft access token is valid by making a request to Microsoft Graph API.
    Returns True if token is valid, False otherwise.
    """
    try:
        headers = {"Authorization": f"Bearer {token}"}
        # Make a lightweight request to verify token
        response = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers, timeout=5)
        return response.status_code == 200
    except Exception:
        return False

# Route to get user settings/profile
@router.get("/user_settings")
async def get_user_settings(request: Request, authorization: str = Header(...)):
    """
    Get all user settings and profile data.
    Also checks actual connection status for:
    - Google Calendar from google_calendar_credentials table
    - Outlook Calendar from ms_access_token cookie
    """
    uid = get_uid_from_token(authorization)
    try:
        result = supabase.table("user_profile").select("*").eq("uid", uid).execute()
        user_data = result.data[0] if result.data and len(result.data) > 0 else {}
        
        connected_calendars = user_data.get("connectedCalendars", [])
        if not isinstance(connected_calendars, list):
            connected_calendars = []
        
        # Check actual Google Calendar connection status from google_calendar_credentials table
        try:
            from Google_Calendar_API.service import get_creds
            google_creds = get_creds(uid)
            if google_creds:
                # Google Calendar is actually connected
                # Ensure "Google Calendar" is in the list if it's actually connected
                if "Google Calendar" not in connected_calendars:
                    connected_calendars = list(connected_calendars)  # Make a copy
                    connected_calendars.append("Google Calendar")
            else:
                # Google Calendar is not connected, remove it from the list if present
                if "Google Calendar" in connected_calendars:
                    connected_calendars = list(connected_calendars)  # Make a copy
                    connected_calendars.remove("Google Calendar")
        except Exception as google_check_error:
            # If we can't check Google Calendar status, log but don't fail
            print(f"Warning: Could not check Google Calendar connection status: {google_check_error}")
        
        # Check actual Outlook Calendar connection status from ms_access_token cookie
        # Note: Microsoft token includes both Mail.Read and Calendars.ReadWrite scopes,
        # so if the token is valid, both Outlook email and calendar are connected
        connected_emails = user_data.get("connectedEmails", [])
        if not isinstance(connected_emails, list):
            connected_emails = []
        
        try:
            ms_token = request.cookies.get("ms_access_token")
            if ms_token and check_microsoft_token_validity(ms_token):
                # Microsoft token is valid - this means both Outlook Calendar AND Outlook email are connected
                # Outlook Calendar
                if "Outlook Calendar" not in connected_calendars:
                    connected_calendars = list(connected_calendars)  # Make a copy
                    connected_calendars.append("Outlook Calendar")
                # Outlook Email (same token, Mail.Read scope)
                if "Outlook" not in connected_emails:
                    connected_emails = list(connected_emails)  # Make a copy
                    connected_emails.append("Outlook")
            else:
                # Microsoft token is invalid or missing - remove both Outlook Calendar and Outlook email
                if "Outlook Calendar" in connected_calendars:
                    connected_calendars = list(connected_calendars)  # Make a copy
                    connected_calendars.remove("Outlook Calendar")
                if "Outlook" in connected_emails:
                    connected_emails = list(connected_emails)  # Make a copy
                    connected_emails.remove("Outlook")
        except Exception as outlook_check_error:
            # If we can't check Outlook status, log but don't fail
            print(f"Warning: Could not check Outlook connection status: {outlook_check_error}")
        
        # Note: Gmail tokens are stored in localStorage (frontend only), not in backend database
        # So we can't verify Gmail connection status from backend
        # The frontend will handle Gmail connection status via localStorage
        
        # Update user_data with the corrected connected_calendars and connected_emails
        user_data["connectedCalendars"] = connected_calendars
        user_data["connectedEmails"] = connected_emails
        
        return {"status": "success", "data": user_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user settings: {str(e)}")
