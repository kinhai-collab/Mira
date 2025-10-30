from fastapi import APIRouter, HTTPException, Body, Header
from supabase import create_client, Client
import os

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

router = APIRouter()

# Helper function to extract UID from Authorization header
def get_uid_from_token(authorization: str):
    """
    Extract UID from the Bearer token in the Authorization header.
    """
    try:
        token = authorization.split(" ")[1]  # Expecting 'Bearer <token>'
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_resp.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authorization header")

# Helper function to save or update user data
def save_user_data(uid: str, data: dict, table: str = "user_profile"):
    """
    Save or update user data in Supabase.
    - If the user exists, update the record.
    - If the user does not exist, insert a new record.
    """
    existing = supabase.table(table).select("*").eq("uid", uid).execute()
    if existing.data and len(existing.data) > 0:
        # Update existing user record
        response = supabase.table(table).update(data).eq("uid", uid).execute()
        return response.data
    # Insert new user record
    response = supabase.table(table).insert({"uid": uid, **data}).execute()
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
    data = {"email": email, "firstName": firstName, "middleName": middleName, "lastName": lastName}
    result = save_user_data(uid, data)
    return {"message": "User profile saved successfully!", "data": result}

# Route to save or update user preferences
@router.post("/user_preferences_save")
async def user_preferences_save(
    language: str = Body(...),
    timezone: str = Body(...),
    voice: str = Body(...),
    authorization: str = Header(...)
):
    """
    Save or update user preferences (language, timezone, voice).
    """
    uid = get_uid_from_token(authorization)
    data = {"language": language, "time_zone": timezone, "voice": voice}
    result = save_user_data(uid, data)
    return {"message": "User preferences saved successfully!", "data": result}

# Route to save or update user notifications settings
@router.post("/user_notifications_save")
async def user_notifications_save(
    pushNotifications: bool = Body(...),
    microphoneAccess: bool = Body(...),
    wakeWordDetection: bool = Body(...),
    authorization: str = Header(...)
):
    """
    Save or update user notifications settings.
    """
    uid = get_uid_from_token(authorization)
    data = {
        "pushNotifications": pushNotifications,
        "microphoneAccess": microphoneAccess,
        "wakeWordDetection": wakeWordDetection
    }
    result = save_user_data(uid, data)
    return {"message": "User notifications saved successfully!", "data": result}

# Route to save or update user privacy settings
@router.post("/user_privacy_save")
async def user_privacy_save(
    connectedEmails: dict = Body(...),
    connectedCalendars: dict = Body(...),
    authorization: str = Header(...)
):
    """
    Save or update user privacy settings (connected emails and calendars).
    """
    uid = get_uid_from_token(authorization)
    data = {"connectedEmails": connectedEmails, "connectedCalendars": connectedCalendars}
    result = save_user_data(uid, data)
    return {"message": "User privacy saved successfully!", "data": result}

# Route to save or update user subscription plan
@router.post("/user_subscription_save")
async def user_subscription_save(
    plan: str = Body(..., embed=True),
    authorization: str = Header(...)
):
    """
    Save or update user's subscription plan.
    """
    uid = get_uid_from_token(authorization)
    data = {"subscriptionPlan": plan}
    result = save_user_data(uid, data)
    return {"message": "User subscription saved successfully!", "data": result}
