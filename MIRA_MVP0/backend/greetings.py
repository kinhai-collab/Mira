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
            
            if not user_email:
                raise HTTPException(status_code=400, detail="No email found for user")
            
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
                    
                    if full_name:
                        if localTime:
                            time_of_day = get_time_of_day_from_local(localTime)
                        else:
                            time_of_day = "day"  # fallback
                        return JSONResponse(content={
                            "status": "success",
                            "message": f"Good {time_of_day}, {first_name}!",
                            "firstName": first_name,
                            "fullName": full_name,
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


