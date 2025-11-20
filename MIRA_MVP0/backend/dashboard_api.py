"""Dashboard API endpoints for Gmail and Google Calendar data aggregation."""
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import requests
from datetime import datetime, timedelta, timezone
import os
import re
from dotenv import load_dotenv
from googleapiclient.discovery import build

# Import the Google Calendar service functions (same ones used by morning brief)
from Google_Calendar_API.service import get_creds, _creds
from Google_Calendar_API.tasks_service import get_all_tasks

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

router = APIRouter()


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


def analyze_email_priority(subject: str, sender: str, labels: list) -> str:
    """Simple heuristic to determine email priority."""
    subject_lower = subject.lower()
    sender_lower = sender.lower()
    
    # High priority indicators
    high_indicators = ["urgent", "important", "asap", "critical", "emergency", "deadline"]
    if any(indicator in subject_lower for indicator in high_indicators):
        return "high"
    
    if "IMPORTANT" in labels or "CATEGORY_PROMOTIONS" not in labels:
        # Check if from known important senders (simplified)
        if any(domain in sender_lower for domain in ["ceo", "director", "manager"]):
            return "high"
    
    # Low priority indicators
    low_indicators = ["newsletter", "subscription", "unsubscribe", "promo", "sale"]
    if any(indicator in subject_lower for indicator in low_indicators):
        return "low"
    
    if "CATEGORY_PROMOTIONS" in labels or "CATEGORY_SOCIAL" in labels:
        return "low"
    
    # Default to medium
    return "medium"


@router.get("/dashboard/emails")
async def get_email_stats(authorization: Optional[str] = Header(default=None)):
    """Get Gmail email statistics for dashboard."""
    try:
        user = get_user_from_token(authorization)
        print(f"📧 Dashboard: Fetching email stats for user {user['id']} ({user['email']})")
        
        # Get Google credentials (same ones used for Calendar, which include Gmail scopes)
        creds_row = get_creds(user["id"])
        if not creds_row:
            print(f"⚠️ Dashboard: No Google credentials found for user {user['id']}")
            return {
                "status": "not_connected",
                "message": "Gmail not connected",
                "data": {
                    "total_important": 0,
                    "unread": 0,
                    "priority_distribution": {"high": 0, "medium": 0, "low": 0},
                    "top_sender": "Gmail not connected",
                    "trend": 0
                }
            }
        
        # Build credentials and refresh if needed (same as morning brief)
        credentials = _creds(creds_row)
        
        # Build Gmail service using the Google API client library
        gmail_service = build("gmail", "v1", credentials=credentials)
        
        print(f"✅ Dashboard: Gmail service built successfully for user {user['id']}")
        
    except Exception as e:
        print(f"❌ Dashboard: Error in initial setup: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching email stats: {str(e)}")
    
    try:
        # Get messages from last 24 hours
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        query = f"after:{int(yesterday.timestamp())}"
        
        # Fetch messages using Gmail API
        messages_res = gmail_service.users().messages().list(
            userId="me",
            q=query,
            maxResults=100
        ).execute()
        
        messages = messages_res.get("messages", [])
        print(f"📊 Dashboard: Found {len(messages)} messages in last 24 hours")
        
        # Analyze emails
        priority_counts = {"high": 0, "medium": 0, "low": 0}
        sender_counts = {}
        unread_count = 0
        important_count = 0
        
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
                print(f"⚠️ Error processing message {msg_id}: {e}")
                continue
        
        # Get top sender
        top_sender = max(sender_counts.items(), key=lambda x: x[1])[0] if sender_counts else "N/A"
        
        # Calculate trend (simplified - compare with older messages)
        # For now, we'll use a mock trend
        trend = 15  # Mock: 15% increase
        
        print(f"✅ Dashboard: Email analysis complete - {important_count} important, {unread_count} unread")
        
        return {
            "status": "success",
            "data": {
                "total_important": important_count,
                "unread": unread_count,
                "priority_distribution": priority_counts,
                "top_sender": top_sender,
                "trend": trend,
                "timeframe": "last 24 hours"
            }
        }
    
    except Exception as e:
        print(f"❌ Error fetching email stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching email stats: {str(e)}")


@router.get("/dashboard/events")
async def get_event_stats(authorization: Optional[str] = Header(default=None)):
    """Get Google Calendar event statistics for dashboard."""
    try:
        user = get_user_from_token(authorization)
        print(f"📅 Dashboard: Fetching event stats for user {user['id']} ({user['email']})")
        
        # Get Google credentials (same method as morning brief)
        creds_row = get_creds(user["id"])
        if not creds_row:
            print(f"⚠️ Dashboard: No Google Calendar credentials found for user {user['id']}")
            return {
                "status": "not_connected",
                "message": "Calendar not connected",
                "data": {
                    "total_events": 0,
                    "total_hours": 0,
                    "rsvp_pending": 0,
                    "next_event": None,
                    "busy_level": "light",
                    "deep_work_blocks": 0,
                    "at_risk_tasks": 0,
                    "events": []
                }
            }

        
        # Build credentials and refresh if needed
        credentials = _creds(creds_row)
        
        # Build Calendar service using the Google API client library
        calendar_service = build("calendar", "v3", credentials=credentials)
        
        print(f"✅ Dashboard: Calendar service built successfully for user {user['id']}")
        
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
        
        # Fetch events using Calendar API
        events_res = calendar_service.events().list(
            calendarId="primary",
            timeMin=today_start.isoformat(),
            timeMax=today_end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=100
        ).execute()
        
        events = events_res.get("items", [])
        print(f"📊 Dashboard: Found {len(events)} events today")
        
        # Analyze events
        total_events = len(events)
        total_minutes = 0
        rsvp_pending = 0
        next_event = None
        deep_work_blocks = 0
        at_risk_tasks = 0
        
        for event in events:
            # Calculate duration
            start = event.get("start", {})
            end = event.get("end", {})
            
            start_time = start.get("dateTime") or start.get("date")
            end_time = end.get("dateTime") or end.get("date")
            
            if start_time and end_time:
                try:
                    start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                    end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
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
                    start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                    if start_dt > now:
                        duration_minutes = (end_dt - start_dt).total_seconds() / 60 if end_time else 0
                        
                        next_event = {
                            "summary": event.get("summary", "Untitled Event"),
                            "start": start_time,
                            "duration": int(duration_minutes),
                            "location": event.get("location"),
                            "conference_data": event.get("conferenceData"),
                            "attendees_count": len(attendees)
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
        
        print(f"✅ Dashboard: Event analysis complete - {total_events} events, {total_hours}h total, busy level: {busy_level}")
        
        # Format events for frontend display (needed for homepage overlay)
        formatted_events = []
        for event in events:
            start = event.get("start", {})
            end = event.get("end", {})
            start_time = start.get("dateTime") or start.get("date")
            end_time = end.get("dateTime") or end.get("date")
            
            # Format time range for display
            time_range = "All day"
            if start_time and end_time:
                try:
                    start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                    end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
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
            if event.get("conferenceData"):
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
                "provider": provider
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
                "events": formatted_events  # ✅ Added events list for homepage overlay
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
            supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            
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
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
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


@router.get("/dashboard/emails/list")
async def get_email_list(
    authorization: Optional[str] = Header(default=None),
    max_results: int = 50,
    days_back: int = 7
):
    """Get detailed list of emails for the emails page."""
    try:
        user = get_user_from_token(authorization)
        print(f"📧 Dashboard: Fetching email list for user {user['id']} ({user['email']})")
        
        # Get Google credentials
        creds_row = get_creds(user["id"])
        if not creds_row:
            print(f"⚠️ Dashboard: No Google credentials found for user {user['id']}")
            return {
                "status": "not_connected",
                "message": "Gmail not connected",
                "data": {
                    "emails": [],
                    "total_count": 0
                }
            }
        
        # Build credentials and Gmail service
        credentials = _creds(creds_row)
        gmail_service = build("gmail", "v1", credentials=credentials)
        
        print(f"✅ Dashboard: Gmail service built successfully for user {user['id']}")
        
        # Get messages from specified days back
        days_ago = datetime.now(timezone.utc) - timedelta(days=days_back)
        query = f"after:{int(days_ago.timestamp())}"
        
        # Fetch messages using Gmail API
        messages_res = gmail_service.users().messages().list(
            userId="me",
            q=query,
            maxResults=max_results
        ).execute()
        
        messages = messages_res.get("messages", [])
        print(f"📊 Dashboard: Found {len(messages)} messages in last {days_back} days")
        
        # Fetch detailed info for each email
        emails_list = []
        
        for msg in messages:
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
                
                email_info = {
                    "id": msg_id,
                    "sender_name": sender_name,
                    "sender_email": sender_email,
                    "subject": subject,
                    "snippet": snippet,
                    "body": body,
                    "priority": priority,
                    "time_ago": time_ago,
                    "timestamp": email_datetime.isoformat(),
                    "is_unread": is_unread,
                    "labels": labels
                }
                
                emails_list.append(email_info)
                
            except Exception as e:
                print(f"⚠️ Error processing message {msg_id}: {e}")
                continue
        
        print(f"✅ Dashboard: Successfully fetched {len(emails_list)} emails")
        
        return {
            "status": "success",
            "data": {
                "provider": "gmail", 
                "emails": emails_list,
                "total_count": len(emails_list)
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

