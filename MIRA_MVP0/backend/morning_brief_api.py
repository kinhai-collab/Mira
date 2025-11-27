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

# ✅ Simple in-memory cache to prevent duplicate requests within 10 seconds
_brief_cache = {}
_cache_timeout = 10  # seconds

@router.get("/audio/morning-brief/{filename}")
async def get_morning_brief_audio(filename: str):
    """Serve the generated morning brief audio file.
    
    In Lambda, audio files are ephemeral in /tmp. This endpoint may not work reliably.
    Prefer using the base64 audio returned directly in the morning-brief response.
    """
    # In Lambda, check /tmp first, then fallback to local speech directory
    if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        filepath = os.path.join("/tmp/speech", filename)
        if not os.path.exists(filepath):
            # Try local directory as fallback (unlikely to exist in Lambda)
            filepath = os.path.join(os.getcwd(), "speech", filename)
    else:
        filepath = os.path.join(os.getcwd(), "speech", filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=404, 
            detail="Audio file not found. In Lambda, audio is returned as base64 in the response."
        )
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
            
            # ✅ Check cache to prevent duplicate requests
            cache_key = f"{user_id}_{timezone}"
            from time import time
            current_time = time()
            
            if cache_key in _brief_cache:
                cached_time, cached_result = _brief_cache[cache_key]
                if current_time - cached_time < _cache_timeout:
                    print(f"✅ Morning Brief: Returning cached result for user {user_id} (prevented duplicate request)")
                    return cached_result
                else:
                    # Cache expired, remove it
                    del _brief_cache[cache_key]
            
            # Get user's first name
            user_metadata = user_data.get("user_metadata", {})
            first_name = user_metadata.get("given_name") or user_metadata.get("full_name", "").split()[0] if user_metadata.get("full_name") else "there"
            
            # Generate morning brief
            try:
                result = run_morning_brief(user_id, first_name, timezone)
                audio_base64 = result.get("audio_base64", "")
                audio_filename = result.get("audio_filename", "")
                events = result.get("events", [])
                email_counts = result.get("email_counts", {})
                
                # Return audio as base64 for direct playback (Lambda can't reliably serve files)
                audio_url = None
                if audio_base64 and audio_filename:
                    # Return the base64 directly - frontend can play it directly
                    # Also provide a URL endpoint that serves the base64 as audio
                    audio_url = f"/audio/morning-brief/{audio_filename}"
                
                # Format events for frontend
                formatted_events = []
                for ev in events[:5]:  # Limit to 5 events for display
                    start_dt = ev.get('start_dt')
                    end_dt = ev.get('end_dt')
                    
                    # Format time range
                    time_range = "N/A"
                    if start_dt and end_dt:
                        try:
                            start_str = start_dt.strftime('%I:%M %p').lstrip('0')
                            end_str = end_dt.strftime('%I:%M %p').lstrip('0')
                            time_range = f"{start_str} - {end_str}"
                        except:
                            time_range = "N/A"
                    
                    formatted_events.append({
                        "id": ev.get("id", f"{ev.get('summary', 'event')}_{start_dt.isoformat() if start_dt else ''}"),
                        "title": ev.get("summary", "No title"),
                        "timeRange": time_range,
                        "meetingLink": ev.get("meetingLink"),
                        "provider": ev.get("provider"),  # Meeting provider (google-meet, microsoft-teams, zoom)
                        "calendar_provider": ev.get("calendar_provider", "google")  # Calendar source (google/outlook)
                    })
                
                # Find next event (first event that hasn't started yet)
                next_event = None
                if events:
                    from datetime import datetime
                    from zoneinfo import ZoneInfo
                    now = datetime.now(ZoneInfo(timezone))
                    for ev in events:
                        start_dt = ev.get('start_dt')
                        if start_dt and isinstance(start_dt, datetime):
                            # Make start_dt timezone-aware if it isn't
                            if start_dt.tzinfo is None:
                                start_dt = start_dt.replace(tzinfo=ZoneInfo(timezone))
                            if start_dt > now:
                                end_dt = ev.get('end_dt', start_dt)
                                # Make end_dt timezone-aware if it isn't
                                if isinstance(end_dt, datetime) and end_dt.tzinfo is None:
                                    end_dt = end_dt.replace(tzinfo=ZoneInfo(timezone))
                                
                                # Calculate duration safely
                                try:
                                    duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
                                except (TypeError, AttributeError):
                                    duration_minutes = 60  # Default to 1 hour if calculation fails
                                
                                next_event = {
                                    "summary": ev.get("summary", "No title"),
                                    "start": start_dt.strftime("%I:%M %p").lstrip('0'),
                                    "duration": duration_minutes
                                }
                                break
                
                # Count Teams events (simplified - checking for "teams" in description/location)
                teams_count = sum(1 for ev in events if "teams" in (ev.get("description", "") + ev.get("location", "")).lower())
                
                response_data = {
                    "status": "success",
                    "text": result.get("text", ""),
                    "audio_base64": audio_base64,  # Direct base64 for playback
                    "audio_url": audio_url,  # URL endpoint (optional, for compatibility)
                    "user_name": first_name,
                    # Event data
                    "events": formatted_events,
                    "total_events": result.get("total_events", 0),
                    "total_teams": teams_count,
                    "next_event": next_event,
                    # Email data
                    "email_important": email_counts.get("important_count", 0),
                    "gmail_count": email_counts.get("gmail_count", 0),
                    "outlook_count": email_counts.get("outlook_count", 0),
                    "total_unread": email_counts.get("total_unread", 0)
                }
                
                # ✅ Cache the result
                _brief_cache[cache_key] = (current_time, response_data)
                
                return response_data
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
