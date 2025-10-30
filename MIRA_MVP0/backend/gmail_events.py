from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
import requests, base64, datetime, logging, pytz
from bs4 import BeautifulSoup
from icalendar import Calendar
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from email.mime.text import MIMEText

from datetime import datetime, timedelta, timezone
from dateutil import parser 
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

router = APIRouter()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Gmail ICS Extraction 

def get_attachment_content(msg_id, attachment_id, access_token):
    """Fetch Gmail attachment content using Gmail API."""
    url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}/attachments/{attachment_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    res = requests.get(url, headers=headers)
    data = res.json().get("data")
    # Decode base64 data into bytes
    return base64.urlsafe_b64decode(data) if data else None


def is_invitation_email(part):
    """Check if an email part is a calendar invitation (.ics) based on headers or MIME type."""
    mime_type = part.get("mimeType", "")
    headers = {h.get("name").lower(): h.get("value") for h in part.get("headers", [])}

    # Detect "text/calendar" MIME type
    if mime_type == "text/calendar" or "text/calendar" in headers.get("content-type", "").lower():
        return True

    method = headers.get("method", "")
    return method.upper() in ["REQUEST", "CANCEL", "REPLY"]


def extract_ics_from_part(part, msg_id, access_token):
    """Recursively extract .ics events and related info from Gmail message parts."""
    events, filename = [], part.get("filename", "")
    headers = {h.get("name").lower(): h.get("value") for h in part.get("headers", [])}
    is_invite = is_invitation_email(part)

    # If the part is an .ics file or an inline calendar invite
    if filename.endswith(".ics") or is_invite:

        # Inline .ics data 
        data_base64 = part.get("body", {}).get("data")
        if data_base64:
            ics_bytes = base64.urlsafe_b64decode(data_base64)
            events += parse_ics_data(ics_bytes, headers)

        # Attached .ics file 
        attachment_id = part.get("body", {}).get("attachmentId")
        if attachment_id:
            ics_bytes = get_attachment_content(msg_id, attachment_id, access_token)
            if ics_bytes:
                events += parse_ics_data(ics_bytes, headers)

    # Recursively handle nested parts in multipart emails
    for subpart in part.get("parts", []):
        events.extend(extract_ics_from_part(subpart, msg_id, access_token))

    return events


def parse_ics_data(ics_bytes, headers):
    """Parse ICS file content and convert it into structured event objects."""
    events, cal = [], Calendar.from_ical(ics_bytes)

    for component in cal.walk():
        if component.name == "VEVENT":
            # Clean HTML from description field if present
            desc_raw = str(component.get("DESCRIPTION"))
            desc_clean = BeautifulSoup(desc_raw, "html.parser").get_text()

            events.append({
                "organizer": str(component.get("ORGANIZER", headers.get("from", ""))),
                "subject": str(component.get("SUMMARY", headers.get("subject", ""))),
                "start": str(component.get("DTSTART").dt),
                "end": str(component.get("DTEND").dt),
                "location": str(component.get("LOCATION", "")),
                "description": desc_clean
            })
    return events


def get_gmail_events(access_token, max_messages=10):
    """Fetch Gmail messages containing .ics files and extract event data."""
    headers = {"Authorization": f"Bearer {access_token}"}
    query_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=has:attachment filename:ics"

    # Fetch messages that contain calendar attachments
    messages = requests.get(query_url, headers=headers).json().get("messages", [])
    events = []

    # Iterate through messages and extract .ics content
    for msg in messages[:max_messages]:
        msg_id = msg["id"]
        detail_url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}?format=full"
        msg_detail = requests.get(detail_url, headers=headers).json()
        payload = msg_detail.get("payload", {})
        events.extend(extract_ics_from_part(payload, msg_id, access_token))

    # Remove duplicates using a set
    return [dict(t) for t in {tuple(d.items()) for d in events}]


@router.get("/gmail/events")
def fetch_gmail_events(access_token: str = Query(...), limit: int = 20):
    """API endpoint to fetch Gmail .ics events for a user."""
    try:
        events = get_gmail_events(access_token, max_messages=limit)
        return {"status": "success", "events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching events: {e}")


# RSVP via Google Calendar
def find_event_id(credentials: Credentials, summary: str, organizer_email: str, start_date: str):
    """Find a specific Google Calendar event by matching title, organizer, and flexible date format."""
    logger.info(f"Searching event: summary='{summary}', organizer='{organizer_email}', start='{start_date}'")

    service = build("calendar", "v3", credentials=credentials)

    try:
        # Parse start date flexibly (supports YYYY-MM-DD or ISO datetime with timezone)
        dt = parser.parse(start_date)

        # Normalize to UTC for the search
        if dt.tzinfo is None:
            dt = pytz.UTC.localize(dt)
        else:
            dt = dt.astimezone(pytz.UTC)

        # Define time window
        timeMin = dt.isoformat()
        timeMax = (dt + timedelta(days=1)).isoformat()

        events = service.events().list(
            calendarId="primary",
            timeMin=timeMin,
            timeMax=timeMax,
            singleEvents=True
        ).execute().get("items", [])

        logger.info(f"Found {len(events)} events in calendar")

        for event in events:
            summary_match = event.get("summary", "").strip().lower()
            organizer_match = event.get("organizer", {}).get("email", "").lower().replace("mailto:", "")

            if summary_match == summary.lower() and organizer_match == organizer_email.lower():
                logger.info(f"Match found for event '{summary}'")
                return event.get("id")

        logger.warning("No matching event found")
        return None

    except Exception as e:
        logger.error(f"Date parsing or event search error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid date format or failed search: {e}")


def send_rsvp(credentials: Credentials, event_id: str, attendee_email: str, response_status="accepted"):
    """Send RSVP (accept/decline/tentative) update to a specific Google Calendar event."""
    service = build("calendar", "v3", credentials=credentials)

    # Retrieve existing event details
    event = service.events().get(calendarId="primary", eventId=event_id).execute()

    # Update attendee response status
    for attendee in event.get("attendees", []):
        if attendee.get("email") == attendee_email:
            attendee["responseStatus"] = response_status

    # Push update to Google Calendar
    updated_event = service.events().update(
        calendarId="primary",
        eventId=event_id,
        body=event
    ).execute()

    logger.info("RSVP sent successfully")
    return updated_event


def get_user_email_from_token(access_token: str):
    """Fetch the user's email address using an OAuth access token."""
    headers = {"Authorization": f"Bearer {access_token}"}
    res = requests.get("https://www.googleapis.com/oauth2/v3/userinfo", headers=headers)

    if res.status_code == 200:
        return res.json().get("email")
    raise HTTPException(status_code=401, detail="Failed to fetch user info")


@router.post("/gmail/events/rsvp")
def rsvp_event(
    access_token: str = Query(...),
    summary: str = Query(...),
    organizer_email: str = Query(...),
    start_date: str = Query(...),
    response_status: str = Query("accepted")
):
    """API endpoint to send RSVP response to a Google Calendar event."""
    try:
        # Build credentials from access token
        creds = Credentials(token=access_token)

        # Get current user's email
        attendee_email = get_user_email_from_token(access_token)

        # Search for matching event in user's calendar
        event_id = find_event_id(creds, summary, organizer_email, start_date)
        if not event_id:
            raise HTTPException(status_code=404, detail="Event not found")

        # Send RSVP response (Accepted / Declined / Tentative)
        updated_event = send_rsvp(creds, event_id, attendee_email, response_status)
        return {"status": "success", "event": updated_event}

    except Exception as e:
        logger.exception("Error in RSVP process")
        raise HTTPException(status_code=500, detail=str(e))

