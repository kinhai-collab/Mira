from fastapi import APIRouter, Query, HTTPException
import requests, base64, re
from bs4 import BeautifulSoup
import logging

router = APIRouter()

import re

def clean_body_text(text: str) -> str:
    """Prepare Gmail body text for TTS: remove links, newlines, and excessive symbols."""
    # Remove links
    text = re.sub(r"http\S+", "", text)

    # Remove newlines and long separators
    text = re.sub(r"[\r\n]+", " ", text)
    text = re.sub(r"(\.{3,}|_{3,}|-{3,})", " ", text)

    # Remove extra spaces
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def decode_gmail_body(msg_part):
    """Decode base64 Gmail message body, clean HTML if needed."""
    # Extract base64 data from message body
    data = msg_part.get("body", {}).get("data")
    if data:
        # Decode from base64 URL-safe format
        decoded_bytes = base64.urlsafe_b64decode(data)
        text = decoded_bytes.decode("utf-8", errors="ignore")

        # Remove any HTML tags and keep only text
        clean_text = BeautifulSoup(text, "html.parser").get_text()
        return clean_body_text(clean_text)
    return ""


def extract_subject_body(payload):
    """Extract subject and body from Gmail payload."""
    # Get headers and find subject
    headers = {h.get("name").lower(): h.get("value") for h in payload.get("headers", [])}
    subject = headers.get("subject", "")
    body = ""

    # Gmail messages may contain multiple parts (plain or HTML)
    if "parts" in payload:
        for part in payload["parts"]:
            mime_type = part.get("mimeType", "")
            # Prefer plain text if available
            if mime_type == "text/plain":
                body = decode_gmail_body(part)
                break
            # Fallback to HTML if plain text not found
            elif mime_type == "text/html" and not body:
                body = decode_gmail_body(part)
        else:
            # Default to first part if no text found
            body = decode_gmail_body(payload["parts"][0])
    else:
        # Some messages have no parts, only a single body
        body = decode_gmail_body(payload)

    return subject, body


def get_latest_email_by_sender(access_token: str, sender_name: str):
    """Fetch the latest Gmail message from a specific sender."""
    headers = {"Authorization": f"Bearer {access_token}"}
    query = f'from:{sender_name}'
    url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages?q={query}&maxResults=1"
    
    # Call Gmail API to search for messages
    res = requests.get(url, headers=headers).json()
    messages = res.get("messages", [])
    if not messages:
        return None

    # Gmail API returns newest first — take the first message
    msg_id = messages[0]["id"]
    detail_url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}?format=full"
    
    # Fetch full message details
    msg_detail = requests.get(detail_url, headers=headers).json()
    payload = msg_detail.get("payload", {})
    subject, body = extract_subject_body(payload)

    return {"subject": subject, "body": body}


@router.get("/gmail/read")
def read_latest_email_by_sender(access_token: str = Query(...), sender_name: str = Query(...)):
    """API endpoint to fetch the latest email (subject & body) by sender."""
    try:
        # Retrieve latest email for given sender
        email = get_latest_email_by_sender(access_token, sender_name)
        if not email:
            return {"status": "not_found", "message": "No emails found for this sender"}
        return {"status": "success", "email": email}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
