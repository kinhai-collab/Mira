from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
import requests
from icalendar import Calendar
import base64
from bs4 import BeautifulSoup

router = APIRouter()

def get_attachment_content(msg_id, attachment_id, access_token):
    """Fetch Gmail attachment content using attachmentId."""
    url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}/attachments/{attachment_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    res = requests.get(url, headers=headers)
    data = res.json().get("data")
    return base64.urlsafe_b64decode(data) if data else None


def is_invitation_email(part):
    """
    Detect if an email part is a calendar invitation based on MIME type or headers.
    """
    mime_type = part.get("mimeType", "")
    headers = {h.get("name").lower(): h.get("value") for h in part.get("headers", [])}

    # Check MIME type
    if mime_type == "text/calendar":
        return True

    # Check Content-Type header
    if "text/calendar" in headers.get("content-type", "").lower():
        return True

    # Check method header
    method = headers.get("method", "")
    if method.upper() in ["REQUEST", "CANCEL", "REPLY"]:
        return True

    return False


def extract_ics_from_part(part, msg_id, access_token):
    """Recursively extract .ics calendar events and email info from an email part."""
    events = []
    filename = part.get("filename", "")
    mime_type = part.get("mimeType", "")
    headers = {h.get("name").lower(): h.get("value") for h in part.get("headers", [])}

    # Detect invitation
    is_invite = is_invitation_email(part)

    if filename.endswith(".ics") or is_invite:

        # Inline .ics data
        data_base64 = part.get("body", {}).get("data")
        if data_base64:
            ics_bytes = base64.urlsafe_b64decode(data_base64)
            cal = Calendar.from_ical(ics_bytes)
            for component in cal.walk():
                if component.name == "VEVENT":
                    description_raw = str(component.get("DESCRIPTION"))
                    description_clean = BeautifulSoup(description_raw, "html.parser").get_text()
                    events.append({
                        "organizer": str(component.get("ORGANIZER", headers.get("from", ""))),
                        "subject": str(component.get("SUMMARY", headers.get("subject", ""))),
                        "start": str(component.get("DTSTART").dt),
                        "end": str(component.get("DTEND").dt),
                        "location": str(component.get("LOCATION", "")),
                        "description": description_clean
                    })

        # Attachment .ics
        attachment_id = part.get("body", {}).get("attachmentId")
        if attachment_id:
            ics_bytes = get_attachment_content(msg_id, attachment_id, access_token)
            if ics_bytes:
                cal = Calendar.from_ical(ics_bytes)
                for component in cal.walk():
                    if component.name == "VEVENT":
                        description_raw = str(component.get("DESCRIPTION"))
                        description_clean = BeautifulSoup(description_raw, "html.parser").get_text()
                        events.append({
                            "organizer": str(component.get("ORGANIZER", headers.get("from", ""))),
                            "subject": str(component.get("SUMMARY", headers.get("subject", ""))),
                            "start": str(component.get("DTSTART").dt),
                            "end": str(component.get("DTEND").dt),
                            "location": str(component.get("LOCATION", "")),
                            "description": description_clean
                        })

    # Recursively process nested parts
    for subpart in part.get("parts", []):
        events.extend(extract_ics_from_part(subpart, msg_id, access_token))

    return events


def get_gmail_events(access_token, max_messages=10):
    """Fetch Gmail messages and extract all .ics calendar events."""
    headers = {"Authorization": f"Bearer {access_token}"}
    messages_res = requests.get(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=has:attachment filename:ics",
        headers=headers
    )
    messages = messages_res.json().get("messages", [])
    events = []

    for msg in messages[:max_messages]:
        msg_id = msg['id']
        msg_detail = requests.get(
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}?format=full",
            headers=headers
        ).json()
        payload = msg_detail.get("payload", {})
        events.extend(extract_ics_from_part(payload, msg_id, access_token))

    # Remove duplicate events
    unique_events = [dict(t) for t in {tuple(d.items()) for d in events}]
    return unique_events


@router.get("/gmail/events")
def fetch_gmail_events(access_token: str = Query(...), limit: int = 20):
    """API endpoint to fetch Gmail .ics events for a user."""
    try:
        events = get_gmail_events(access_token, max_messages=limit)
        return {"status": "success", "events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching events: {e}")
