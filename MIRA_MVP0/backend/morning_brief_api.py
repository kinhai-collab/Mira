# backend/morning_brief_api.py
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import FileResponse
import httpx
import os
from dotenv import load_dotenv
from typing import Optional
from scenarios.morning_brief.morning_brief import run_morning_brief
from Google_Calendar_API.service import list_events, patch_event, delete_event
from Google_Calendar_API.service import get_creds, _creds
from googleapiclient.discovery import build
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import re

load_dotenv()

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

@router.get("/audio/morning-brief/{filename}")
async def get_morning_brief_audio(filename: str):
    """Serve the generated morning brief audio file."""
    filepath = os.path.join(os.getcwd(), "speech", filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(filepath, media_type="audio/mpeg")

@router.post("/morning-brief")
async def get_morning_brief(
    authorization: Optional[str] = Header(default=None),
    timezone: Optional[str] = Query(default="America/New_York")
):
    """Generate and return the morning brief."""
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
            user_id = user_data.get("id")
            user_email = user_data.get("email")
            
            if not user_id:
                raise HTTPException(status_code=400, detail="No user ID found")
            
            # Get user's first name
            user_metadata = user_data.get("user_metadata", {})
            first_name = user_metadata.get("given_name") or user_metadata.get("full_name", "").split()[0] if user_metadata.get("full_name") else "there"
            
            # Generate morning brief
            try:
                result = run_morning_brief(user_id, first_name, timezone)
                audio_path = result.get("audio_path", "")
                
                # Convert local file path to URL if audio was generated
                audio_url = None
                if audio_path:
                    # Extract just the filename from the full path
                    import os
                    filename = os.path.basename(audio_path)
                    # Return relative URL that the frontend can use to fetch the audio
                    # Frontend will construct the full URL using its API base
                    audio_url = f"/audio/morning-brief/{filename}"
                
                return {
                    "status": "success",
                    "text": result.get("text", ""),
                    "audio_path": audio_path,
                    "audio_url": audio_url,
                    "user_name": first_name
                }
            except Exception as e:
                print(f"Error generating morning brief: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error generating morning brief: {str(e)}")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Auth service error: {str(e)}")

@router.post("/calendar/modify-event")
async def modify_calendar_event(
    authorization: Optional[str] = Header(default=None),
    event_query: Optional[str] = Query(default=None),  # e.g., "Team Standup", "meeting at 9am"
    action: Optional[str] = Query(default=None),  # "reschedule", "cancel", "delete", "update"
    new_time: Optional[str] = Query(default=None),  # ISO datetime or relative like "tomorrow 2pm"
    event_id: Optional[str] = Query(default=None),  # Direct event ID if known
):
    """
    Modify a calendar event based on voice command.
    Can search for events by name/time and then modify them.
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
            user_id = user_data.get("id")
            
            if not user_id:
                raise HTTPException(status_code=400, detail="No user ID found")
            
            # Get Google Calendar credentials
            creds_row = get_creds(user_id)
            if not creds_row:
                raise HTTPException(status_code=400, detail="Google Calendar not connected")
            
            credentials = _creds(creds_row)
            service = build("calendar", "v3", credentials=credentials)
            
            # If event_id is provided, use it directly
            if event_id:
                target_event_id = event_id
            else:
                # Search for event by name/time
                if not event_query:
                    raise HTTPException(status_code=400, detail="event_query or event_id required")
                
                # Get today's events to search
                now = datetime.now(ZoneInfo("America/New_York"))
                time_min = (now - timedelta(days=1)).isoformat()
                time_max = (now + timedelta(days=7)).isoformat()
                
                events_result = service.events().list(
                    calendarId="primary",
                    timeMin=time_min,
                    timeMax=time_max,
                    maxResults=50,
                    singleEvents=True,
                    orderBy="startTime"
                ).execute()
                
                events = events_result.get("items", [])
                
                # Find matching event
                target_event_id = None
                query_lower = event_query.lower()
                for event in events:
                    summary = event.get("summary", "").lower()
                    if query_lower in summary:
                        target_event_id = event["id"]
                        break
                
                if not target_event_id:
                    return {
                        "status": "error",
                        "message": f"Could not find event matching '{event_query}'. Please be more specific."
                    }
            
            # Perform action
            if action == "cancel" or action == "delete":
                service.events().delete(calendarId="primary", eventId=target_event_id).execute()
                return {
                    "status": "success",
                    "message": "Event cancelled successfully.",
                    "event_id": target_event_id
                }
            elif action == "reschedule" or action == "move":
                if not new_time:
                    return {
                        "status": "error",
                        "message": "Please specify the new time for the event."
                    }
                
                # Parse new_time (simplified - could be enhanced)
                # For now, assume ISO format or parse common formats
                try:
                    # Try parsing ISO format
                    new_dt = datetime.fromisoformat(new_time.replace("Z", "+00:00"))
                except:
                    return {
                        "status": "error",
                        "message": f"Could not parse time '{new_time}'. Please use format like '2024-01-15T14:00:00'"
                    }
                
                # Get current event to preserve other details
                event = service.events().get(calendarId="primary", eventId=target_event_id).execute()
                
                # Update start time
                if "dateTime" in event["start"]:
                    event["start"]["dateTime"] = new_dt.isoformat()
                    event["end"]["dateTime"] = (new_dt + timedelta(hours=1)).isoformat()
                else:
                    event["start"]["date"] = new_dt.date().isoformat()
                    event["end"]["date"] = new_dt.date().isoformat()
                
                service.events().patch(calendarId="primary", eventId=target_event_id, body=event).execute()
                
                return {
                    "status": "success",
                    "message": f"Event rescheduled to {new_dt.strftime('%Y-%m-%d %H:%M')}.",
                    "event_id": target_event_id
                }
            else:
                return {
                    "status": "error",
                    "message": f"Unknown action: {action}. Supported: cancel, delete, reschedule, move"
                }
                
    except Exception as e:
        print(f"Error modifying calendar event: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error modifying event: {str(e)}")
