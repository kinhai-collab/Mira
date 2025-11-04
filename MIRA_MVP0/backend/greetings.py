from fastapi import APIRouter, Form, HTTPException, Body, Header, Query
from fastapi.responses import JSONResponse, RedirectResponse
import requests
import os
from dotenv import load_dotenv
from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo
import httpx

# Load environment variables
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

router = APIRouter()


def get_time_of_day_from_local(local_time: str):
    """
    Returns 'morning', 'afternoon', or 'evening' based on the hour in local_time.
    Supports 'MM/DD/YYYY, HH:MM:SS AM/PM' format.
    """
    for fmt in ["%d/%m/%Y, %H:%M:%S", "%m/%d/%Y, %I:%M:%S %p"]:
        try:
            dt = datetime.strptime(local_time, fmt)
            hour = dt.hour
            if 5 <= hour < 12:
                return "morning"
            elif 12 <= hour < 17:
                return "afternoon"
            else:
                return "evening"
        except Exception:
            continue
    return "day"


@router.post("/greeting")
async def get_greeting(
    authorization: Optional[str] = Header(default=None),
    timestamp: Optional[str] = Form(default=None),
    timezone: Optional[str] = Form(default=None),
    localTime: Optional[str] = Form(default=None)
):
    """
    Returns a personalized greeting message based on the user's name from onboarding data.
    Requires Authorization header with Bearer token.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = authorization.split(" ", 1)[1].strip()
    
    auth_headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient() as client:
            user_res = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=auth_headers)
            if user_res.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            user_data = user_res.json()
            user_email = user_data.get("email")
            user_metadata = user_data.get("user_metadata", {})
            
            if not user_email:
                raise HTTPException(status_code=400, detail="No email found for user")
            
            # Priority 1: Try to get name from user_metadata (most up-to-date, updated via profile_update)
            first_name = None
            full_name = None
            
            if user_metadata:
                full_name = user_metadata.get("full_name") or ""
                first_name = user_metadata.get("given_name") or ""
                if not first_name and full_name:
                    # Extract first name from full_name
                    first_name = full_name.split()[0] if full_name else ""
            
            # Priority 2: If not in user_metadata, try user_profile table
            if not first_name:
                try:
                    # Use REST API to query user_profile table
                    db_headers = {
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY if not SUPABASE_SERVICE_ROLE_KEY else SUPABASE_SERVICE_ROLE_KEY}",
                    }
                    user_id = user_data.get("id")
                    if user_id:
                        user_profile_res = await client.get(
                            f"{SUPABASE_URL}/rest/v1/user_profile?uid=eq.{user_id}&select=firstName,lastName",
                            headers=db_headers
                        )
                        if user_profile_res.status_code == 200:
                            profile_data_list = user_profile_res.json()
                            if profile_data_list and len(profile_data_list) > 0:
                                profile_data = profile_data_list[0]
                                first_name = profile_data.get("firstName", "")
                                if first_name:
                                    last_name = profile_data.get("lastName", "")
                                    full_name = f"{first_name} {last_name}".strip() if last_name else first_name
                except Exception as e:
                    print(f"Error fetching from user_profile: {e}")
            
            # Priority 3: Fallback to onboarding table (for legacy/new users)
            if not first_name:
                db_headers = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                }
                onboarding_res = await client.get(
                    f"{SUPABASE_URL}/rest/v1/onboarding?email=eq.{user_email}",
                    headers=db_headers
                )
                
                if onboarding_res.status_code == 200:
                    onboarding_data = onboarding_res.json()
                    if onboarding_data and len(onboarding_data) > 0:
                        first_name = onboarding_data[0].get("firstName", "")
                        middle_name = onboarding_data[0].get("middleName", "")
                        last_name = onboarding_data[0].get("lastName", "")
                        
                        # Construct full name
                        name_parts = [first_name, middle_name, last_name]
                        full_name = " ".join([part for part in name_parts if part]).strip()
            
            # If we found a name, use it
            if first_name:
                if localTime:
                    time_of_day = get_time_of_day_from_local(localTime)
                else:
                    time_of_day = "day"  # fallback
                return JSONResponse(content={
                    "status": "success",
                    "message": f"Good {time_of_day}, {first_name}!",
                    "firstName": first_name,
                    "fullName": full_name or first_name,
                    "timeOfDay": time_of_day,
                    "timestamp": timestamp,
                    "timezone": timezone,
                    "localTime": localTime
                })
        
        # Fallback if no name is found
        time_of_day = "day"  # default fallback
        if localTime:
            time_of_day = get_time_of_day_from_local(localTime)
        return JSONResponse(content={
            "status": "success",
            "message": f"Good {time_of_day}!",
            "timeOfDay": time_of_day,
            "timestamp": timestamp,
            "timezone": timezone,
            "localTime": localTime
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")


