"""Dashboard API endpoints for Gmail and Google Calendar data aggregation."""
from fastapi import APIRouter, HTTPException, Header, Request
from typing import Optional
import requests
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import os
import re
from dotenv import load_dotenv
from googleapiclient.discovery import build
from openai import OpenAI

# Import the Google Calendar service functions (same ones used by morning brief)
from Google_Calendar_API.service import get_creds, _creds
from Google_Calendar_API.tasks_service import get_all_tasks

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GRAPH_API_URL = "https://graph.microsoft.com/v1.0"

router = APIRouter()
client = OpenAI()

# Helper function to convert Windows timezone names to IANA format
def convert_windows_to_iana_timezone(windows_tz: str) -> str:
    """
    Convert Windows timezone names (used by Outlook) to IANA timezone names (used by Python).
    Common conversions for major timezones.
    """
    windows_to_iana = {
        "India Standard Time": "Asia/Kolkata",
        "UTC": "UTC",
        "GMT Standard Time": "Europe/London",
        "Pacific Standard Time": "America/Los_Angeles",
        "Mountain Standard Time": "America/Denver",
        "Central Standard Time": "America/Chicago",
        "Eastern Standard Time": "America/New_York",
        "China Standard Time": "Asia/Shanghai",
        "Tokyo Standard Time": "Asia/Tokyo",
        "AUS Eastern Standard Time": "Australia/Sydney",
        "Central European Standard Time": "Europe/Paris",
        "W. Europe Standard Time": "Europe/Berlin",
    }
    return windows_to_iana.get(windows_tz, "UTC")

def get_user_from_token(authorization: Optional[str]) -> dict:
    """Extract and validate user from Supabase token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = authorization.split(" ", 1)[1].strip()
    auth_headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"}
    
    try:
        res = requests.get(f"{SUPABASE_URL}/auth/v1/user", headers=auth_headers)
        if res.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_data = res.json()
        return {
            "email": user_data.get("email"),
            "id": user_data.get("id"),
            "token": token
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def _get_outlook_token(request: Request, user_id: str) -> Optional[str]:
    """Get Outlook access token from cookies."""
    outlook_token = request.cookies.get("ms_access_token")
    if outlook_token:
        print("✅ Found Outlook token in cookie")
        # Validate token by making a test request
        headers = {"Authorization": f"Bearer {outlook_token}"}
        try:
            response = requests.get(f"{GRAPH_API_URL}/me", headers=headers, timeout=5)
            if response.status_code == 200:
                user_info = response.json()
                email = user_info.get("mail") or user_info.get("userPrincipalName")
                print(f"✅ Dashboard: Outlook token is valid for user {user_id}")
                return outlook_token
            else:
                print(f"⚠️ Dashboard: Outlook token is invalid (status {response.status_code})")
                return None
        except Exception as e:
            print(f"⚠️ Dashboard: Error validating Outlook token: {e}")
            return None
    else:
        print("⚠️ Dashboard: No Outlook token found in cookie")
        return None


def analyze_email_priority(subject: str, sender: str, labels: Optional[list] = None, importance: Optional[str] = None) -> str:
    """Simple heuristic to determine email priority."""
    subject_lower = subject.lower()
    sender_lower = sender.lower()
    
    # For Outlook emails, use the importance field if provided
    if importance:
        if importance == "high":
            return "high"
        elif importance == "low":
            return "low"
    
    # High priority indicators
    high_indicators = ["urgent", "important", "asap", "critical", "emergency", "deadline"]
    if any(indicator in subject_lower for indicator in high_indicators):
        return "high"
    
    if labels:
        if "IMPORTANT" in labels or "CATEGORY_PROMOTIONS" not in labels:
            # Check if from known important senders (simplified)
            if any(domain in sender_lower for domain in ["ceo", "director", "manager"]):
                return "high"
    
    # Low priority indicators
    low_indicators = ["newsletter", "subscription", "unsubscribe", "promo", "sale"]
    if any(indicator in subject_lower for indicator in low_indicators):
        return "low"
    
    if labels and ("CATEGORY_PROMOTIONS" in labels or "CATEGORY_SOCIAL" in labels):
        return "low"
    
    # Default to medium
    return "medium"


@router.get("/dashboard/emails")
async def get_email_stats(request: Request, authorization: Optional[str] = Header(default=None)):
    """Get email statistics for dashboard from both Gmail and Outlook."""
    try:
        user = get_user_from_token(authorization)
        print(f"📧 Dashboard: Fetching email stats for user {user['id']} ({user['email']})")
        
        gmail_service = None
        outlook_token = None
        connected_providers = []
        
        # Try to get Google credentials
        try:
            creds_row = get_creds(user["id"])
            if creds_row:
                credentials = _creds(creds_row)
                gmail_service = build("gmail", "v1", credentials=credentials)
                print(f"✅ Dashboard: Gmail credentials found for user {user['id']}")
                connected_providers.append("Gmail")
        except Exception as e:
            print(f"⚠️ Dashboard: Could not initialize Gmail service: {e}")
        
        # Try to get Outlook token from cookies
        outlook_token = _get_outlook_token(request, user["id"])
        if outlook_token:
            connected_providers.append("Outlook")
        
        # If neither service is connected, return not_connected
        if not gmail_service and not outlook_token:
            print(f"⚠️ Dashboard: No valid Gmail or Outlook credentials for user {user['id']}")
            return {
                "status": "not_connected",
                "message": "No email services connected",
                "data": {
                    "total_important": 0,
                    "unread": 0,
                    "priority_distribution": {"high": 0, "medium": 0, "low": 0},
                    "top_sender": "No email service connected",
                    "trend": 0,
                    "providers": []
                }
            }
        
    except Exception as e:
        print(f"❌ Dashboard: Error in initial setup: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching email stats: {str(e)}")
    
    try:
        # Initialize combined analysis variables
        priority_counts = {"high": 0, "medium": 0, "low": 0}
        sender_counts = {}
        unread_count = 0
        important_count = 0
        
        # Get messages from last 24 hours
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        
        # FETCH FROM GMAIL
        if gmail_service:
            try:
                query = f"after:{int(yesterday.timestamp())}"
                messages_res = gmail_service.users().messages().list(
                    userId="me",
                    q=query,
                    maxResults=100
                ).execute()
                
                messages = messages_res.get("messages", [])
                print(f"📊 Dashboard: Found {len(messages)} Gmail messages in last 24 hours")
                
                for msg in messages[:50]:  # Limit detailed analysis to 50 most recent
                    try:
                        msg_id = msg["id"]
                        detail_data = gmail_service.users().messages().get(
                            userId="me",
                            id=msg_id,
                            format="metadata",
                            metadataHeaders=["From", "Subject"]
                        ).execute()
                        
                        # Extract headers
                        headers_list = detail_data.get("payload", {}).get("headers", [])
                        subject = next((h["value"] for h in headers_list if h["name"].lower() == "subject"), "")
                        sender = next((h["value"] for h in headers_list if h["name"].lower() == "from"), "")
                        
                        # Extract sender name
                        sender_name = sender.split("<")[0].strip() if "<" in sender else sender.split("@")[0]
                        
                        # Get labels
                        labels = detail_data.get("labelIds", [])
                        
                        # Count unread
                        if "UNREAD" in labels:
                            unread_count += 1
                        
                        # Count important (not in promotions/social/spam)
                        if "IMPORTANT" in labels or ("INBOX" in labels and "CATEGORY_PROMOTIONS" not in labels):
                            important_count += 1
                        
                        # Determine priority
                        priority = analyze_email_priority(subject, sender, labels)
                        priority_counts[priority] += 1
                        
                        # Count senders
                        if sender_name:
                            sender_counts[sender_name] = sender_counts.get(sender_name, 0) + 1
                    except Exception as e:
                        print(f"⚠️ Error processing Gmail message {msg_id}: {e}")
                        continue
            except Exception as e:
                print(f"⚠️ Error fetching Gmail messages: {e}")
        
        # FETCH FROM OUTLOOK
        if outlook_token:
            try:
                headers = {"Authorization": f"Bearer {outlook_token}"}
                
                # Format date for Microsoft Graph API - CRITICAL FIX
                # Microsoft Graph requires ISO 8601 format with 'Z' for UTC
                yesterday_iso = yesterday.strftime("%Y-%m-%dT%H:%M:%SZ")
                
                outlook_url = (
                    f"{GRAPH_API_URL}/me/messages?"
                    f"$top=100&"
                    f"$filter=receivedDateTime ge {yesterday_iso}&"
                    f"$select=id,subject,from,isRead,importance,receivedDateTime"
                )
                
                # Also test without filter to see if there's ANY data
                # First, check the mailbox being accessed
                mailbox_info_url = f"{GRAPH_API_URL}/me/mailFolders/inbox"
                mailbox_response = requests.get(mailbox_info_url, headers=headers, timeout=10)
                
                test_url = f"{GRAPH_API_URL}/me/messages?$top=5&$select=id,subject,receivedDateTime"
                test_response = requests.get(test_url, headers=headers, timeout=10)
                
                response = requests.get(outlook_url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    response_json = response.json()
                    outlook_messages = response_json.get("value", [])
                    print(f"📊 Dashboard: Found {len(outlook_messages)} Outlook messages in last 24 hours")
                    
                    for msg in outlook_messages[:50]:  # Limit to 50 most recent
                        try:
                            subject = msg.get("subject", "")
                            from_field = msg.get("from", {}).get("emailAddress", {})
                            sender = from_field.get("address", "")
                            sender_name = from_field.get("name", sender.split("@")[0])
                            
                            # Count unread
                            if not msg.get("isRead", True):
                                unread_count += 1
                            
                            # Count important (all Outlook inbox messages are considered important unless explicitly low priority)
                            importance_value = msg.get("importance", "normal")
                            if importance_value != "low":
                                important_count += 1
                            
                            # Determine priority
                            priority = analyze_email_priority(subject, sender, importance=importance_value)
                            priority_counts[priority] += 1
                            
                            # Count senders
                            if sender_name:
                                sender_counts[sender_name] = sender_counts.get(sender_name, 0) + 1
                        except Exception as e:
                            print(f"⚠️ Error processing Outlook message: {e}")
                            continue
                else:
                    print(f"⚠️ Dashboard: Failed to fetch Outlook messages (status {response.status_code}): {response.text}")
            except Exception as e:
                print(f"⚠️ Error fetching Outlook messages: {e}")
        
        # Get top sender
        top_sender = max(sender_counts.items(), key=lambda x: x[1])[0] if sender_counts else "N/A"
        
        # Calculate trend (simplified - mock for now)
        trend = 15  # Mock: 15% increase
        
        print(f"✅ Dashboard: Combined email analysis complete - {important_count} important, {unread_count} unread from {', '.join(connected_providers)}")
        
        return {
            "status": "success",
            "data": {
                "total_important": important_count,
                "unread": unread_count,
                "priority_distribution": priority_counts,
                "top_sender": top_sender,
                "trend": trend,
                "timeframe": "last 24 hours",
                "providers": connected_providers
            }
        }
    
    except Exception as e:
        print(f"❌ Error fetching email stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching email stats: {str(e)}")


@router.get("/dashboard/events")
async def get_event_stats(request: Request, authorization: Optional[str] = Header(default=None)):
    """Get event statistics for dashboard from both Google Calendar and Outlook Calendar."""
    try:
        user = get_user_from_token(authorization)
        print(f"📅 Dashboard: Fetching event stats for user {user['id']} ({user['email']})")
        
        calendar_service = None
        outlook_token = None
        connected_providers = []
        
        # Try to get Google credentials
        try:
            creds_row = get_creds(user["id"])
            if creds_row:
                credentials = _creds(creds_row)
                calendar_service = build("calendar", "v3", credentials=credentials)
                print(f"✅ Dashboard: Google Calendar credentials found for user {user['id']}")
                connected_providers.append("Google Calendar")
        except Exception as e:
            print(f"⚠️ Dashboard: Could not initialize Google Calendar service: {e}")
        
        # Try to get Outlook token from cookies
        outlook_token = _get_outlook_token(request, user["id"])
        if outlook_token:
            connected_providers.append("Outlook Calendar")
        
        # If neither service is connected, return not_connected
        if not calendar_service and not outlook_token:
            print(f"⚠️ Dashboard: No valid Google Calendar or Outlook credentials for user {user['id']}")
            return {
                "status": "not_connected",
                "message": "No calendar services connected",
                "data": {
                    "total_events": 0,
                    "total_hours": 0,
                    "rsvp_pending": 0,
                    "busy_level": "light",
                    "deep_work_blocks": 0,
                    "at_risk_tasks": 0,
                    "next_event": None,
                    "events": [],
                    "providers": []
                }
            }
        
        print(f"✅ Dashboard: Calendar services built successfully for user {user['id']}")
        
    except Exception as e:
        print(f"❌ Dashboard: Error in initial setup: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching event stats: {str(e)}")
    
    try:
        # Get today's events
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        # Combined events list
        all_events = []
        
        # FETCH FROM GOOGLE CALENDAR
        if calendar_service:
            try:
                events_res = calendar_service.events().list(
                    calendarId="primary",
                    timeMin=today_start.isoformat(),
                    timeMax=today_end.isoformat(),
                    singleEvents=True,
                    orderBy="startTime",
                    maxResults=100
                ).execute()
                
                google_events = events_res.get("items", [])
                print(f"📊 Dashboard: Found {len(google_events)} Google Calendar events today")
                
                # Tag events with provider
                for event in google_events:
                    event["_provider"] = "google"
                    all_events.append(event)
            except Exception as e:
                print(f"⚠️ Error fetching Google Calendar events: {e}")
        
        # FETCH FROM OUTLOOK CALENDAR
        if outlook_token:
            try:
                headers = {"Authorization": f"Bearer {outlook_token}"}
                
                # Format dates for Microsoft Graph API - CRITICAL FIX
                # Microsoft Graph requires ISO 8601 format with 'Z' for UTC
                today_start_iso = today_start.strftime("%Y-%m-%dT%H:%M:%SZ")
                today_end_iso = today_end.strftime("%Y-%m-%dT%H:%M:%SZ")
                
                outlook_events_url = (
                    f"{GRAPH_API_URL}/me/calendar/calendarView?"
                    f"startDateTime={today_start_iso}&"
                    f"endDateTime={today_end_iso}&"
                    f"$top=100"
                )
                
                # Check what calendars exist
                calendars_url = f"{GRAPH_API_URL}/me/calendars"
                calendars_response = requests.get(calendars_url, headers=headers, timeout=10)
                
                # Check ALL calendars for events (not just primary)
                future_end = (now + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
                all_calendars_url = f"{GRAPH_API_URL}/me/calendarView?startDateTime={today_start_iso}&endDateTime={future_end}&$top=10"
                all_cal_response = requests.get(all_calendars_url, headers=headers, timeout=10)
                
                response = requests.get(outlook_events_url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    response_json = response.json()
                    outlook_events = response_json.get("value", [])
                    print(f"📊 Dashboard: Found {len(outlook_events)} Outlook Calendar events today")
                    
                    # Transform Outlook events to Google Calendar format for consistency
                    for o_event in outlook_events:
                        transformed_event = {
                            "id": o_event.get("id", ""),
                            "summary": o_event.get("subject", "Untitled Event"),
                            "start": {
                                "dateTime": o_event.get("start", {}).get("dateTime", ""),
                                "timeZone": o_event.get("start", {}).get("timeZone", "UTC")
                            },
                            "end": {
                                "dateTime": o_event.get("end", {}).get("dateTime", ""),
                                "timeZone": o_event.get("end", {}).get("timeZone", "UTC")
                            },
                            "location": o_event.get("location", {}).get("displayName", ""),
                            "description": o_event.get("bodyPreview", ""),
                            "attendees": [{"email": att.get("emailAddress", {}).get("address", "")} for att in o_event.get("attendees", [])],
                            "_provider": "outlook",
                            "_importance": o_event.get("importance", "normal"),
                            "_onlineMeeting": o_event.get("onlineMeeting")
                        }
                        all_events.append(transformed_event)
                else:
                    print(f"⚠️ Dashboard: Failed to fetch Outlook events (status {response.status_code}): {response.text}")
            except Exception as e:
                print(f"⚠️ Error fetching Outlook Calendar events: {e}")
        
        # Sort combined events by start time
        def get_event_start_time(event):
            start = event.get("start", {})
            start_time = start.get("dateTime") or start.get("date")
            if start_time:
                try:
                    # Handle both Google (with Z or +00:00) and Outlook (with timeZone field) formats
                    dt = datetime.fromisoformat(start_time.replace("Z", "+00:00").split('.')[0])
                    
                    # If timezone-naive, check for Outlook timeZone field
                    if dt.tzinfo is None:
                        tz_name = start.get("timeZone", "UTC")
                        try:
                            # Convert Windows timezone names to IANA format
                            tz_name = convert_windows_to_iana_timezone(tz_name)
                            dt = dt.replace(tzinfo=ZoneInfo(tz_name))
                        except Exception as e:
                            print(f"⚠️ Could not parse timezone '{tz_name}': {e}, assuming UTC")
                            dt = dt.replace(tzinfo=timezone.utc)
                    return dt
                except:
                    return datetime.min.replace(tzinfo=timezone.utc)
            return datetime.min.replace(tzinfo=timezone.utc)
        
        all_events.sort(key=get_event_start_time)
        
        print(f"📊 Dashboard: Analyzing {len(all_events)} combined events")
        
        # Analyze combined events
        total_events = len(all_events)
        total_minutes = 0
        rsvp_pending = 0
        next_event = None
        deep_work_blocks = 0
        at_risk_tasks = 0
        
        for event in all_events:
            # Calculate duration
            start = event.get("start", {})
            end = event.get("end", {})
            
            start_time = start.get("dateTime") or start.get("date")
            end_time = end.get("dateTime") or end.get("date")
            
            if start_time and end_time:
                try:
                    # Parse and ensure timezone-aware (handle both Google and Outlook formats)
                    start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00").split('.')[0])
                    if start_dt.tzinfo is None:
                        # Check for Outlook timeZone field
                        tz_name = start.get("timeZone", "UTC")
                        try:
                            tz_name = convert_windows_to_iana_timezone(tz_name)
                            start_dt = start_dt.replace(tzinfo=ZoneInfo(tz_name))
                        except:
                            start_dt = start_dt.replace(tzinfo=timezone.utc)
                    
                    end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00").split('.')[0])
                    if end_dt.tzinfo is None:
                        # Check for Outlook timeZone field
                        tz_name = end.get("timeZone", "UTC")
                        try:
                            tz_name = convert_windows_to_iana_timezone(tz_name)
                            end_dt = end_dt.replace(tzinfo=ZoneInfo(tz_name))
                        except:
                            end_dt = end_dt.replace(tzinfo=timezone.utc)
                    
                    duration_minutes = (end_dt - start_dt).total_seconds() / 60
                    total_minutes += duration_minutes
                    
                    # Detect deep work blocks (events >60 min without calls)
                    summary = event.get("summary", "").lower()
                    if duration_minutes >= 60 and not any(word in summary for word in ["meeting", "call", "standup", "sync"]):
                        deep_work_blocks += 1
                    
                    # Detect at-risk tasks (events starting soon without preparation time)
                    if start_dt > now and (start_dt - now).total_seconds() < 1800:  # <30 min away
                        at_risk_tasks += 1
                    
                except Exception as e:
                    print(f"⚠️ Error processing event timing: {e}")
                    pass
            
            # Check RSVP status
            attendees = event.get("attendees", [])
            for attendee in attendees:
                if attendee.get("self") and attendee.get("responseStatus") == "needsAction":
                    rsvp_pending += 1
                    break
            
            # Get next upcoming event
            if not next_event and start_time:
                try:
                    # Parse and ensure timezone-aware
                    start_dt_next = datetime.fromisoformat(start_time.replace("Z", "+00:00").split('.')[0])
                    if start_dt_next.tzinfo is None:
                        # Check for Outlook timeZone field
                        tz_name = start.get("timeZone", "UTC")
                        try:
                            tz_name = convert_windows_to_iana_timezone(tz_name)
                            start_dt_next = start_dt_next.replace(tzinfo=ZoneInfo(tz_name))
                        except:
                            start_dt_next = start_dt_next.replace(tzinfo=timezone.utc)
                    
                    if start_dt_next > now:
                        # Calculate duration
                        evt_duration = 0
                        if end_time:
                            end_dt_next = datetime.fromisoformat(end_time.replace("Z", "+00:00").split('.')[0])
                            if end_dt_next.tzinfo is None:
                                end_dt_next = end_dt_next.replace(tzinfo=timezone.utc)
                            evt_duration = int((end_dt_next - start_dt_next).total_seconds() / 60)
                        
                        # Convert datetime to proper ISO format with timezone for frontend
                        # This ensures JavaScript's Date() can properly parse and convert to local time
                        start_iso = start_dt_next.isoformat()
                        
                        next_event = {
                            "summary": event.get("summary", "Untitled Event"),
                            "start": start_iso,  # ✅ Send as ISO string with timezone
                            "duration": evt_duration,
                            "location": event.get("location"),
                            "conference_data": event.get("conferenceData"),
                            "attendees_count": len(attendees),
                            "provider": event.get("_provider", "google")  # ✅ Check _provider for Outlook events
                        }
                except Exception as e:
                    print(f"⚠️ Error setting next_event: {e}")
                    pass
        
        # Calculate total hours
        total_hours = round(total_minutes / 60, 1)
        
        # Determine busy level
        if total_hours < 3:
            busy_level = "light"
        elif total_hours < 6:
            busy_level = "moderate"
        else:
            busy_level = "busy"
        
        print(f"✅ Dashboard: Combined event analysis complete - {total_events} events, {total_hours}h total, busy level: {busy_level} from {', '.join(connected_providers)}")
        
        # Format events for frontend display (needed for homepage overlay)
        formatted_events = []
        for event in all_events:
            start = event.get("start", {})
            end = event.get("end", {})
            start_time = start.get("dateTime") or start.get("date")
            end_time = end.get("dateTime") or end.get("date")
            
            # Format time range for display
            time_range = "All day"
            if start_time and end_time:
                try:
                    start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00").split('.')[0])
                    if start_dt.tzinfo is None:
                        # Check for Outlook timeZone field
                        tz_name = start.get("timeZone", "UTC")
                        try:
                            tz_name = convert_windows_to_iana_timezone(tz_name)
                            start_dt = start_dt.replace(tzinfo=ZoneInfo(tz_name))
                        except:
                            start_dt = start_dt.replace(tzinfo=timezone.utc)
                    
                    end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00").split('.')[0])
                    if end_dt.tzinfo is None:
                        # Check for Outlook timeZone field
                        tz_name = end.get("timeZone", "UTC")
                        try:
                            tz_name = convert_windows_to_iana_timezone(tz_name)
                            end_dt = end_dt.replace(tzinfo=ZoneInfo(tz_name))
                        except:
                            end_dt = end_dt.replace(tzinfo=timezone.utc)
                    
                    time_range = f"{start_dt.strftime('%I:%M %p')} - {end_dt.strftime('%I:%M %p')}"
                except Exception:
                    time_range = "Time TBD"
            
            # Get original description for provider detection and meeting link extraction
            raw_description = event.get("description", "")
            
            # Extract meeting link from description or conferenceData
            meeting_link = ""
            if event.get("conferenceData"):
                # Try to get hangout link from conferenceData (Google Meet)
                entry_points = event.get("conferenceData", {}).get("entryPoints", [])
                for entry in entry_points:
                    if entry.get("entryPointType") == "video":
                        meeting_link = entry.get("uri", "")
                        break
            
            # If no link from conferenceData, extract from description
            if not meeting_link and raw_description:
                # Extract Teams or Meet links
                teams_match = re.search(r'https://teams\.(?:live|microsoft)\.com/[^\s<>]+', raw_description)
                meet_match = re.search(r'https://meet\.google\.com/[^\s<>]+', raw_description)
                zoom_match = re.search(r'https://[\w-]+\.zoom\.us/[^\s<>]+', raw_description)
                
                if teams_match:
                    meeting_link = teams_match.group(0)
                elif meet_match:
                    meeting_link = meet_match.group(0)
                elif zoom_match:
                    meeting_link = zoom_match.group(0)
            
            # Detect meeting provider
            provider = "other"
            
            # For Outlook events, check for Teams meeting
            if event.get("_provider") == "outlook":
                if event.get("_onlineMeeting"):
                    provider = "microsoft-teams"
                elif raw_description and "teams" in raw_description.lower():
                    provider = "microsoft-teams"
            # For Google events
            elif event.get("conferenceData"):
                conference_solution = event.get("conferenceData", {}).get("conferenceSolution", {}).get("name", "").lower()
                if "meet" in conference_solution:
                    provider = "google-meet"
                elif "teams" in conference_solution:
                    provider = "microsoft-teams"
            elif raw_description:
                desc_lower = raw_description.lower()
                if "teams.microsoft" in desc_lower or "teams.live.com" in desc_lower or "microsoft teams meeting" in desc_lower:
                    provider = "microsoft-teams"
                elif "meet.google" in desc_lower or "google meet" in desc_lower:
                    provider = "google-meet"
                elif "zoom" in desc_lower:
                    provider = "zoom"
            
            # Clean up description for display (keep it short and readable)
            description = raw_description
            if description:
                # Extract only the first meaningful sentence/paragraph before meeting details
                meeting_indicators = [
                    'Microsoft Teams meeting',
                    'Join on your computer',
                    'Click here to join',
                    'Meeting ID:',
                    'Join online meeting',
                    '_____________________',
                    '________________',
                ]
                
                # Find the first occurrence of any meeting indicator
                split_pos = len(description)
                for indicator in meeting_indicators:
                    pos = description.find(indicator)
                    if pos != -1 and pos < split_pos:
                        split_pos = pos
                
                # Take only the text before meeting details
                description = description[:split_pos].strip()
                
                # Remove any URLs from the description (we have them separately)
                description = re.sub(r'https?://\S+', '', description)
                
                # Remove extra whitespace and newlines
                description = re.sub(r'\s+', ' ', description).strip()
                
                # Truncate to 100 characters for better display
                if len(description) > 100:
                    description = description[:97] + "..."
            
            formatted_events.append({
                "id": event.get("id", ""),
                "title": event.get("summary", "Untitled Event"),
                "timeRange": time_range,
                "location": event.get("location", ""),
                "note": description if description else None,
                "meetingLink": meeting_link if meeting_link else None,
                "provider": provider,  # Meeting provider (teams, meet, zoom, etc.)
                "calendar_provider": event.get("_provider", "google")  # ✅ Calendar provider (google/outlook)
            })
        
        return {
            "status": "success",
            "data": {
                "total_events": total_events,
                "total_hours": total_hours,
                "rsvp_pending": rsvp_pending,
                "next_event": next_event,
                "busy_level": busy_level,
                "deep_work_blocks": deep_work_blocks,
                "at_risk_tasks": at_risk_tasks,
                "events": formatted_events,  # ✅ Added events list for homepage overlay
                "providers": connected_providers  # ✅ Added providers list
            }
        }
    
    except Exception as e:
        print(f"❌ Error fetching event stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching event stats: {str(e)}")


@router.get("/dashboard/tasks")
async def get_task_stats(authorization: Optional[str] = Header(default=None)):
    """Get user tasks statistics for dashboard - from both Google Tasks and MIRA."""
    try:
        user = get_user_from_token(authorization)
        print(f"📋 Dashboard: Fetching task stats for user {user['id']} ({user['email']})")
        
        all_tasks = []
        
        # 1. Fetch from Google Tasks
        try:
            google_tasks = get_all_tasks(user["id"], show_completed=False)
            print(f"📊 Dashboard: Found {len(google_tasks)} tasks from Google Tasks")
            
            # Transform Google Tasks to unified format
            for gtask in google_tasks:
                task_info = {
                    "id": f"google_{gtask['id']}",
                    "title": gtask.get("title", "Untitled Task"),
                    "due_date": gtask.get("due"),  # RFC 3339 format
                    "priority": "medium",  # Google Tasks doesn't have priority
                    "status": "completed" if gtask.get("status") == "completed" else "pending",
                    "source": "google",
                    "task_list_name": gtask.get("task_list_name", "")
                }
                all_tasks.append(task_info)
        except Exception as e:
            print(f"⚠️ Could not fetch Google Tasks (user may not have connected): {e}")
        
        # 2. Fetch from Supabase (MIRA tasks)
        try:
            from supabase import create_client
            SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            # Normalize URL to remove trailing slash to prevent double-slash issues
            supabase = create_client(SUPABASE_URL.rstrip('/') if SUPABASE_URL else "", SUPABASE_SERVICE_ROLE_KEY)
            
            tasks_res = supabase.table("user_tasks").select("*").eq("uid", user["id"]).in_("status", ["pending", "in_progress"]).order("due_date", desc=False).execute()
            
            mira_tasks = tasks_res.data if tasks_res.data else []
            print(f"📊 Dashboard: Found {len(mira_tasks)} tasks from MIRA")
            
            # Transform MIRA tasks to unified format
            for mtask in mira_tasks:
                task_info = {
                    "id": f"mira_{mtask['id']}",
                    "title": mtask["title"],
                    "due_date": mtask.get("due_date"),
                    "priority": mtask.get("priority", "medium"),
                    "status": mtask.get("status", "pending"),
                    "source": "mira"
                }
                all_tasks.append(task_info)
        except Exception as e:
            print(f"⚠️ Could not fetch MIRA tasks: {e}")
        
        # 3. Analyze combined tasks
        total_tasks = len(all_tasks)
        today = datetime.now(timezone.utc).date()
        
        tasks_due_today = []
        overdue_tasks = []
        upcoming_tasks = []
        
        for task in all_tasks:
            if task.get("due_date"):
                try:
                    # Handle both RFC 3339 (Google) and ISO 8601 (Supabase) formats
                    due_date_str = task["due_date"]
                    if "T" in due_date_str:
                        due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                    else:
                        # Date only format
                        due_date = datetime.strptime(due_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    
                    due_date_only = due_date.date()
                    
                    if due_date_only < today:
                        overdue_tasks.append(task)
                    elif due_date_only == today:
                        tasks_due_today.append(task)
                    else:
                        upcoming_tasks.append(task)
                except Exception as e:
                    print(f"⚠️ Error parsing due date for task {task.get('id')}: {e}")
                    upcoming_tasks.append(task)
            else:
                upcoming_tasks.append(task)
        
        # Sort all tasks by due date (overdue first, then due today, then upcoming)
        def get_due_date_timestamp(task):
            if not task.get("due_date"):
                return float('inf')  # Tasks without due date go to the end
            try:
                due_date_str = task["due_date"]
                if "T" in due_date_str:
                    return datetime.fromisoformat(due_date_str.replace("Z", "+00:00")).timestamp()
                else:
                    return datetime.strptime(due_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
            except:
                return float('inf')
        
        sorted_tasks = sorted(all_tasks, key=get_due_date_timestamp)
        
        # Get next 3 tasks
        next_tasks = sorted_tasks[:3]
        
        print(f"✅ Dashboard: Task analysis complete - {total_tasks} total ({len(overdue_tasks)} overdue, {len(tasks_due_today)} due today)")
        
        return {
            "status": "success",
            "data": {
                "total_tasks": total_tasks,
                "overdue": len(overdue_tasks),
                "due_today": len(tasks_due_today),
                "upcoming": len(upcoming_tasks),
                "next_tasks": next_tasks
            }
        }
    
    except Exception as e:
        print(f"❌ Error fetching task stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching task stats: {str(e)}")


@router.get("/dashboard/reminders")
async def get_reminder_stats(authorization: Optional[str] = Header(default=None)):
    """Get user reminders statistics for dashboard."""
    try:
        user = get_user_from_token(authorization)
        print(f"⏰ Dashboard: Fetching reminder stats for user {user['id']} ({user['email']})")
        
        # Query Supabase for user reminders
        from supabase import create_client
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        # Normalize URL to remove trailing slash to prevent double-slash issues
        supabase = create_client(SUPABASE_URL.rstrip('/') if SUPABASE_URL else "", SUPABASE_SERVICE_ROLE_KEY)
        
        # Get all active reminders
        reminders_res = supabase.table("user_reminders").select("*").eq("uid", user["id"]).eq("status", "active").order("reminder_time", desc=False).execute()
        
        reminders = reminders_res.data if reminders_res.data else []
        print(f"📊 Dashboard: Found {len(reminders)} active reminders")
        
        # Analyze reminders
        total_reminders = len(reminders)
        now = datetime.now(timezone.utc)
        today_end = now.replace(hour=23, minute=59, second=59)
        
        # Get reminders due today and upcoming
        reminders_due_today = []
        upcoming_reminders = []
        overdue_reminders = []
        
        for reminder in reminders:
            if reminder.get("reminder_time"):
                try:
                    reminder_time = datetime.fromisoformat(reminder["reminder_time"].replace("Z", "+00:00"))
                    
                    if reminder_time < now:
                        overdue_reminders.append(reminder)
                    elif reminder_time <= today_end:
                        reminders_due_today.append(reminder)
                    else:
                        upcoming_reminders.append(reminder)
                except Exception as e:
                    print(f"⚠️ Error parsing reminder time for reminder {reminder.get('id')}: {e}")
                    upcoming_reminders.append(reminder)
        
        # Get next 3 reminders
        next_reminders = []
        for reminder in reminders[:3]:
            reminder_info = {
                "id": reminder["id"],
                "title": reminder["title"],
                "reminder_time": reminder.get("reminder_time"),
                "repeat_type": reminder.get("repeat_type", "none")
            }
            next_reminders.append(reminder_info)
        
        print(f"✅ Dashboard: Reminder analysis complete - {total_reminders} total, {len(overdue_reminders)} overdue, {len(reminders_due_today)} due today")
        
        return {
            "status": "success",
            "data": {
                "total_reminders": total_reminders,
                "overdue": len(overdue_reminders),
                "due_today": len(reminders_due_today),
                "upcoming": len(upcoming_reminders),
                "next_reminders": next_reminders
            }
        }
    
    except Exception as e:
        print(f"❌ Error fetching reminder stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching reminder stats: {str(e)}")

# Summarize the emails using GPT-4o-mini
async def summarize_email(text: str) -> str:
    # Ignore tiny useless bodies
    if not text or len(text.strip()) < 20:
        return ""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Summarize this email in a short clear paragraph."},
                {"role": "user", "content": text}
            ],
            max_tokens=120
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print("Summary error:", e)
        return ""

@router.get("/dashboard/emails/list")
async def get_email_list(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    max_results: int = 50,
    days_back: int = 7
):
    """Get detailed list of emails from both Gmail and Outlook for the emails page."""
    try:
        user = get_user_from_token(authorization)
        print(f"📧 Dashboard: Fetching email list for user {user['id']} ({user['email']})")
        
        gmail_service = None
        outlook_token = None
        connected_providers = []
        
        # Try to get Google credentials
        try:
            creds_row = get_creds(user["id"])
            if creds_row:
                credentials = _creds(creds_row)
                gmail_service = build("gmail", "v1", credentials=credentials)
                print(f"✅ Dashboard: Gmail service built successfully for user {user['id']}")
                connected_providers.append("gmail")
        except Exception as e:
            print(f"⚠️ Could not initialize Gmail service: {e}")
        
        # Try to get Outlook token from cookies
        outlook_token = _get_outlook_token(request, user["id"])
        if outlook_token:
            connected_providers.append("outlook")
        
        # If neither service is connected, return empty
        if not gmail_service and not outlook_token:
            print(f"⚠️ Dashboard: No email services connected for user {user['id']}")
            return {
                "status": "not_connected",
                "message": "No email services connected",
                "data": {
                    "emails": [],
                    "total_count": 0,
                    "providers": []
                }
            }
        
        # Get messages from specified days back
        days_ago = datetime.now(timezone.utc) - timedelta(days=days_back)
        emails_list = []
        
        # ========== FETCH GMAIL EMAILS ==========
        if gmail_service:
            try:
                query = f"after:{int(days_ago.timestamp())}"
                
                # Fetch messages using Gmail API
                messages_res = gmail_service.users().messages().list(
                    userId="me",
                    q=query,
                    maxResults=max_results
                ).execute()
                
                messages = messages_res.get("messages", [])
                print(f"📊 Dashboard: Found {len(messages)} Gmail messages in last {days_back} days")
                
                # Fetch detailed info for each Gmail email
                for i, msg in enumerate(messages):
                    try:
                        msg_id = msg["id"]
                        detail_data = gmail_service.users().messages().get(
                            userId="me",
                            id=msg_id,
                            format="full"
                        ).execute()
                        
                        # Extract headers
                        headers_list = detail_data.get("payload", {}).get("headers", [])
                        subject = next((h["value"] for h in headers_list if h["name"].lower() == "subject"), "No Subject")
                        sender = next((h["value"] for h in headers_list if h["name"].lower() == "from"), "Unknown")
                        
                        # Extract sender name and email
                        if "<" in sender:
                            sender_name = sender.split("<")[0].strip().strip('"')
                            sender_email = sender.split("<")[1].strip(">")
                        else:
                            sender_name = sender.split("@")[0]
                            sender_email = sender
                        
                        # Get labels
                        labels = detail_data.get("labelIds", [])
                        
                        # Determine priority
                        priority = analyze_email_priority(subject, sender, labels)
                        
                        # Parse internal date (milliseconds since epoch)
                        internal_date = int(detail_data.get("internalDate", 0))
                        email_datetime = datetime.fromtimestamp(internal_date / 1000, tz=timezone.utc)
                        
                        # Calculate time ago
                        time_diff = datetime.now(timezone.utc) - email_datetime
                        if time_diff.total_seconds() < 60:
                            time_ago = "just now"
                        elif time_diff.total_seconds() < 3600:
                            minutes = int(time_diff.total_seconds() / 60)
                            time_ago = f"{minutes}m ago"
                        elif time_diff.total_seconds() < 86400:
                            hours = int(time_diff.total_seconds() / 3600)
                            time_ago = f"{hours}h ago"
                        else:
                            days = int(time_diff.days)
                            time_ago = f"{days}d ago"
                        
                        # Extract snippet/preview
                        snippet = detail_data.get("snippet", "")
                        
                        # Get email body
                        body = ""
                        payload = detail_data.get("payload", {})
                        
                        # Try to extract HTML or plain text body
                        def get_body_from_parts(parts):
                            for part in parts:
                                if part.get("mimeType") == "text/html":
                                    data = part.get("body", {}).get("data", "")
                                    if data:
                                        import base64
                                        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                                elif part.get("mimeType") == "text/plain":
                                    data = part.get("body", {}).get("data", "")
                                    if data:
                                        import base64
                                        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                                elif "parts" in part:
                                    nested_body = get_body_from_parts(part["parts"])
                                    if nested_body:
                                        return nested_body
                            return ""
                        
                        if "parts" in payload:
                            body = get_body_from_parts(payload["parts"])
                        elif payload.get("body", {}).get("data"):
                            import base64
                            body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")
                        
                        if not body:
                            body = snippet
                        
                        # Check if unread
                        is_unread = "UNREAD" in labels

                        # Only summarize the first 10 Gmail emails
                        if i < 10:
                            summary = await summarize_email(body)
                        else:
                            summary = ""

                        email_info = {
                            "id": f"gmail_{msg_id}",  # ✅ Prefix with provider
                            "sender_name": sender_name,
                            "sender_email": sender_email,
                            "from": sender,
                            "senderEmail": sender_email,
                            "subject": subject,
                            "snippet": snippet,
                            "body": body,
                            "summary": summary,
                            "priority": priority,
                            "time_ago": time_ago,
                            "timestamp": email_datetime.isoformat(),
                            "receivedAt": email_datetime.isoformat(),
                            "is_unread": is_unread,
                            "labels": labels,
                            "provider": "gmail"  # ✅ Add provider field
                        }
                        
                        emails_list.append(email_info)
                        
                    except Exception as e:
                        print(f"⚠️ Error processing Gmail message {msg_id}: {e}")
                        continue
                
                print(f"✅ Dashboard: Successfully fetched {len(emails_list)} Gmail emails")
                
            except Exception as e:
                print(f"⚠️ Error fetching Gmail emails: {e}")
        
        # ========== FETCH OUTLOOK EMAILS ==========
        if outlook_token:
            try:
                headers = {
                    "Authorization": f"Bearer {outlook_token}",
                    "Content-Type": "application/json"
                }
                
                # Calculate date filter for Outlook
                days_ago_iso = days_ago.strftime("%Y-%m-%dT%H:%M:%SZ")
                
                # Fetch Outlook messages (max 50 to match Gmail)
                outlook_url = f"{GRAPH_API_URL}/me/messages?$top={max_results}&$filter=receivedDateTime ge {days_ago_iso}&$select=id,subject,from,isRead,importance,receivedDateTime,bodyPreview,body&$orderby=receivedDateTime desc"
                print(f"📊 Dashboard: Fetching Outlook emails from URL: {outlook_url}")
                
                response = requests.get(outlook_url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    outlook_messages = response.json().get("value", [])
                    print(f"📊 Dashboard: Found {len(outlook_messages)} Outlook messages in last {days_back} days")
                    
                    # Process Outlook emails
                    for i, msg in enumerate(outlook_messages):
                        try:
                            # Extract sender info
                            sender_obj = msg.get("from", {}).get("emailAddress", {})
                            sender_name = sender_obj.get("name", "Unknown")
                            sender_email = sender_obj.get("address", "unknown@outlook.com")
                            sender = f"{sender_name} <{sender_email}>"
                            
                            # Extract subject
                            subject = msg.get("subject", "No Subject")
                            
                            # Extract importance and determine priority
                            importance = msg.get("importance", "normal")
                            priority = analyze_email_priority(subject, sender, importance=importance)
                            
                            # Parse received date
                            received_date_str = msg.get("receivedDateTime", "")
                            if received_date_str:
                                email_datetime = datetime.fromisoformat(received_date_str.replace("Z", "+00:00"))
                            else:
                                email_datetime = datetime.now(timezone.utc)
                            
                            # Calculate time ago
                            time_diff = datetime.now(timezone.utc) - email_datetime
                            if time_diff.total_seconds() < 60:
                                time_ago = "just now"
                            elif time_diff.total_seconds() < 3600:
                                minutes = int(time_diff.total_seconds() / 60)
                                time_ago = f"{minutes}m ago"
                            elif time_diff.total_seconds() < 86400:
                                hours = int(time_diff.total_seconds() / 3600)
                                time_ago = f"{hours}h ago"
                            else:
                                days = int(time_diff.days)
                                time_ago = f"{days}d ago"
                            
                            # Extract body and snippet
                            snippet = msg.get("bodyPreview", "")
                            body = msg.get("body", {}).get("content", snippet)
                            
                            # Check if unread
                            is_unread = not msg.get("isRead", True)
                            
                            # Only summarize the first 10 Outlook emails
                            if i < 10 and len(body) > 20:
                                summary = await summarize_email(body)
                            else:
                                summary = ""
                            
                            email_info = {
                                "id": f"outlook_{msg['id']}",  # ✅ Prefix with provider
                                "sender_name": sender_name,
                                "sender_email": sender_email,
                                "from": sender,
                                "senderEmail": sender_email,
                                "subject": subject,
                                "snippet": snippet,
                                "body": body,
                                "summary": summary,
                                "priority": priority,
                                "time_ago": time_ago,
                                "timestamp": email_datetime.isoformat(),
                                "receivedAt": email_datetime.isoformat(),
                                "is_unread": is_unread,
                                "labels": ["OUTLOOK"],  # Mark as Outlook for consistency
                                "provider": "outlook"  # ✅ Add provider field
                            }
                            
                            emails_list.append(email_info)
                            
                        except Exception as e:
                            print(f"⚠️ Error processing Outlook message {msg.get('id')}: {e}")
                            continue
                    
                    print(f"✅ Dashboard: Successfully fetched {len(outlook_messages)} Outlook emails")
                else:
                    print(f"⚠️ Outlook API returned status {response.status_code}")
                    
            except Exception as e:
                print(f"⚠️ Error fetching Outlook emails: {e}")
        
        # Sort all emails by timestamp (most recent first)
        emails_list.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        print(f"✅ Dashboard: Successfully fetched {len(emails_list)} total emails from {len(connected_providers)} provider(s)")
        
        return {
            "status": "success",
            "data": {
                "emails": emails_list,
                "total_count": len(emails_list),
                "providers": connected_providers  # ✅ List of connected providers
            }
        }
    
    except Exception as e:
        print(f"❌ Error fetching email list: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching email list: {str(e)}")


@router.get("/dashboard/summary")
async def get_dashboard_summary(authorization: Optional[str] = Header(default=None)):
    """Get combined dashboard summary data."""
    try:
        # Fetch all dashboard data
        email_stats = await get_email_stats(authorization)
        event_stats = await get_event_stats(authorization)
        task_stats = await get_task_stats(authorization)
        reminder_stats = await get_reminder_stats(authorization)
        
        return {
            "status": "success",
            "data": {
                "emails": email_stats.get("data", {}),
                "events": event_stats.get("data", {}),
                "tasks": task_stats.get("data", {}),
                "reminders": reminder_stats.get("data", {}),
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        }
    except Exception as e:
        print(f"Error fetching dashboard summary: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard summary: {str(e)}")

