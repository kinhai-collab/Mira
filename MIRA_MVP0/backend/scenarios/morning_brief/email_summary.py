# backend/scenarios/morning_brief/email_summary.py
import requests
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

try:
    from Google_Calendar_API.service import get_creds, _creds
    from googleapiclient.discovery import build
    EMAIL_AVAILABLE = True
except ImportError:
    EMAIL_AVAILABLE = False
    print("⚠️ Gmail API not available - using fallback")


def get_email_summary(user_id: str) -> str:
    """
    Fetches email summary from Gmail for the morning brief.
    Returns a conversational summary of unread emails and important messages.
    """
    print(f"📧 Fetching email summary for user: {user_id}")
    
    if not EMAIL_AVAILABLE:
        return ""
    
    try:
        # Get Google credentials (same ones used for Calendar, which include Gmail scopes)
        creds_row = get_creds(user_id)
        if not creds_row:
            print("⚠️ Google credentials not found - skipping email summary")
            return ""
        
        # Build credentials and refresh if needed
        credentials = _creds(creds_row)
        
        # Build Gmail service
        gmail_service = build("gmail", "v1", credentials=credentials)
        
        # Get unread count
        unread_response = gmail_service.users().messages().list(
            userId="me",
            q="is:unread",
            maxResults=1
        ).execute()
        unread_count = unread_response.get("resultSizeEstimate", 0)
        
        # Get important/unread emails from last 24 hours
        yesterday = datetime.now() - timedelta(days=1)
        query = f"is:unread newer_than:{int(yesterday.timestamp())}"
        
        important_response = gmail_service.users().messages().list(
            userId="me",
            q=f"{query} is:important",
            maxResults=5
        ).execute()
        important_messages = important_response.get("messages", [])
        
        # Get recent unread (not just important)
        recent_response = gmail_service.users().messages().list(
            userId="me",
            q=query,
            maxResults=10
        ).execute()
        recent_messages = recent_response.get("messages", [])
        
        # Build summary
        summary_parts = []
        
        if unread_count == 0:
            summary_parts.append("You have no unread emails. Your inbox is clean!")
        else:
            summary_parts.append(f"You have {unread_count} unread email{'s' if unread_count != 1 else ''}.")
            
            if important_messages:
                summary_parts.append(f"{len(important_messages)} of them are marked as important.")
        
        # Get sender summary from recent messages
        if recent_messages:
            senders = {}
            for msg in recent_messages[:5]:  # Check first 5 messages
                try:
                    message = gmail_service.users().messages().get(
                        userId="me",
                        id=msg["id"],
                        format="metadata",
                        metadataHeaders=["From"]
                    ).execute()
                    
                    headers = message.get("payload", {}).get("headers", [])
                    for header in headers:
                        if header.get("name", "").lower() == "from":
                            sender = header.get("value", "")
                            # Extract name from "Name <email>" format
                            sender_name = sender.split("<")[0].strip() if "<" in sender else sender
                            senders[sender_name] = senders.get(sender_name, 0) + 1
                            break
                except Exception as e:
                    print(f"Error fetching message {msg['id']}: {e}")
                    continue
            
            if senders:
                top_sender = max(senders.items(), key=lambda x: x[1])
                summary_parts.append(f"Most emails are from {top_sender[0]}.")
        
        return " ".join(summary_parts) if summary_parts else ""
        
    except Exception as e:
        print(f"⚠️ Error fetching email summary: {e}")
        import traceback
        traceback.print_exc()
        return ""


def get_email_counts(user_id: str) -> Dict[str, int]:
    """
    Fetches email counts from Gmail for the morning brief UI.
    Returns structured count data for display.
    """
    print(f"📊 Fetching email counts for user: {user_id}")
    
    default_counts = {
        "gmail_count": 0,
        "outlook_count": 0,
        "important_count": 0,
        "total_unread": 0
    }
    
    if not EMAIL_AVAILABLE:
        return default_counts
    
    try:
        # Get Google credentials
        creds_row = get_creds(user_id)
        if not creds_row:
            print("⚠️ Google credentials not found - returning zero counts")
            return default_counts
        
        # Build credentials and Gmail service
        credentials = _creds(creds_row)
        gmail_service = build("gmail", "v1", credentials=credentials)
        
        # Get total unread count
        unread_response = gmail_service.users().messages().list(
            userId="me",
            q="is:unread",
            maxResults=1
        ).execute()
        total_unread = unread_response.get("resultSizeEstimate", 0)
        
        # Get important/unread emails count
        important_response = gmail_service.users().messages().list(
            userId="me",
            q="is:unread is:important",
            maxResults=1
        ).execute()
        important_count = important_response.get("resultSizeEstimate", 0)
        
        return {
            "gmail_count": total_unread,  # All Gmail unread
            "outlook_count": 0,  # Outlook integration disabled
            "important_count": important_count,
            "total_unread": total_unread
        }
        
    except Exception as e:
        print(f"⚠️ Error fetching email counts: {e}")
        import traceback
        traceback.print_exc()
        return default_counts

