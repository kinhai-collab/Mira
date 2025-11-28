# backend/scenarios/morning_brief/email_summary.py
import requests
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone
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


def get_email_summary(user_id: str, gmail_service=None) -> str:
    """
    Fetches email summary from Gmail for the morning brief.
    Returns a conversational summary of unread emails and important messages.
    
    Args:
        user_id: User ID
        gmail_service: Optional pre-built Gmail service (to avoid re-fetching credentials)
    """
    print(f"📧 Fetching email summary for user: {user_id}")
    
    if not EMAIL_AVAILABLE:
        return ""
    
    try:
        # ✅ Reuse provided service if available, otherwise build new one
        if gmail_service is None:
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
            maxResults=3  # ✅ Reduce from 5 to 3 for faster loading
        ).execute()
        important_messages = important_response.get("messages", [])
        
        # Get recent unread (not just important)
        recent_response = gmail_service.users().messages().list(
            userId="me",
            q=query,
            maxResults=5  # ✅ Reduce from 10 to 5 for faster loading
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
            for msg in recent_messages[:3]:  # ✅ Check first 3 messages (was 5) for faster loading
                try:
                    message = gmail_service.users().messages().get(
                        userId="me",
                        id=msg["id"],
                        format="metadata",  # ✅ Use metadata for faster loading
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

def get_outlook_email_summary(user_id: str) -> str:
    """
    Fetch unread Outlook email summary using Microsoft Graph.
    Returns a conversational summary for Outlook inbox only.
    """
    print(f"📧 Fetching Outlook email summary for user: {user_id}")

    try:
        from supabase import create_client
        import os

        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        GRAPH_API_URL = "https://graph.microsoft.com/v1.0"

        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            print("Missing Supabase config")
            return ""

        supabase = create_client(SUPABASE_URL.rstrip('/'), SUPABASE_SERVICE_ROLE_KEY)

        # Fetch stored tokens
        res = supabase.table("outlook_credentials").select("*").eq("uid", user_id).execute()
        if not res.data:
            print("⚠ No Outlook credentials found")
            return ""

        creds = res.data[0]
        access_token = creds.get("access_token")
        refresh_token = creds.get("refresh_token")
        expiry_str = creds.get("expiry")

        # Handle expiration
        if expiry_str:
            expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)

            if expiry <= (now + timedelta(minutes=5)):
                print("🔁 Outlook token expired, refreshing...")
                MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
                MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
                TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"

                refresh_data = {
                    "client_id": MICROSOFT_CLIENT_ID,
                    "client_secret": MICROSOFT_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                    "scope": "User.Read Mail.Read"
                }

                refresh_resp = requests.post(TOKEN_URL, data=refresh_data).json()

                if "access_token" in refresh_resp:
                    access_token = refresh_resp["access_token"]
                    new_expiry = now + timedelta(seconds=refresh_resp.get("expires_in", 3600))

                    supabase.table("outlook_credentials").update({
                        "access_token": refresh_resp["access_token"],
                        "refresh_token": refresh_resp.get("refresh_token", refresh_token),
                        "expiry": new_expiry.isoformat(),
                    }).eq("uid", user_id).execute()

        if not access_token:
            print("⚠ No Outlook access token available")
            return ""

        headers = {"Authorization": f"Bearer {access_token}"}

        # unread count
        unread_url = f"{GRAPH_API_URL}/me/mailFolders/Inbox/messages?$filter=isRead eq false&$count=true&$top=1"
        unread_resp = requests.get(unread_url, headers=headers).json()
        unread_count = unread_resp.get("@odata.count", 0)

        # important unread
        important_url = f"{GRAPH_API_URL}/me/messages?$filter=isRead eq false and importance eq 'high'&$count=true&$top=1"
        important_resp = requests.get(important_url, headers=headers).json()
        important_count = important_resp.get("@odata.count", 0)

        # recent unread (24 hours)
        yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z"
        recent_url = f"{GRAPH_API_URL}/me/messages?$filter=isRead eq false and receivedDateTime ge {yesterday}&$top=5"  # ✅ Reduce from 10 to 5 for faster loading
        recent_resp = requests.get(recent_url, headers=headers).json()
        recent_msgs = recent_resp.get("value", [])

        # summary text
        summary = []

        if unread_count == 0:
            summary.append("You have no unread Outlook emails.")
        else:
            summary.append(f"You have {unread_count} unread Outlook emails.")

            if important_count > 0:
                summary.append(f"{important_count} are marked as important.")

        # sender summary
        senders = {}
        for m in recent_msgs[:3]:  # ✅ Check first 3 messages (was 5) for faster loading
            sender = m.get("from", {}).get("emailAddress", {}).get("name")
            if sender:
                senders[sender] = senders.get(sender, 0) + 1

        if senders:
            top_sender = max(senders.items(), key=lambda x: x[1])
            summary.append(f"Most unread messages are from {top_sender[0]}.")

        return " ".join(summary)

    except Exception as e:
        print("⚠ Outlook summary error:", e)
        return ""

def get_email_counts(user_id: str, gmail_service=None, outlook_token=None) -> Dict[str, int]:
    """
    Fetches email counts from both Gmail and Outlook for the morning brief UI.
    Returns structured count data for display.
    
    Args:
        user_id: User ID
        gmail_service: Optional pre-built Gmail service (to avoid re-fetching credentials)
    """
    print(f"📊 Fetching email counts for user: {user_id}")
    
    default_counts = {
        "gmail_count": 0,
        "outlook_count": 0,
        "important_count": 0,
        "total_unread": 0
    }
    
    gmail_count = 0
    outlook_count = 0
    important_count = 0
    
    # Fetch Gmail counts
    if EMAIL_AVAILABLE:
        try:
            # ✅ Reuse provided service if available, otherwise build new one
            if gmail_service is None:
                # Get Google credentials
                creds_row = get_creds(user_id)
                if creds_row:
                    # Build credentials and Gmail service
                    credentials = _creds(creds_row)
                    gmail_service = build("gmail", "v1", credentials=credentials)
                else:
                    gmail_service = None
            
            if gmail_service:
                
                # Get total unread count
                unread_response = gmail_service.users().messages().list(
                    userId="me",
                    q="is:unread",
                    maxResults=1
                ).execute()
                gmail_count = unread_response.get("resultSizeEstimate", 0)
                
                # Get important/unread emails count
                important_response = gmail_service.users().messages().list(
                    userId="me",
                    q="is:unread is:important",
                    maxResults=1
                ).execute()
                important_count = important_response.get("resultSizeEstimate", 0)
        except Exception as e:
            print(f"⚠️ Error fetching Gmail counts: {e}")
    
    # Fetch Outlook counts
    # ✅ Use provided outlook_token if available, otherwise fetch from database
    if outlook_token:
        access_token = outlook_token
        print("✅ Morning Brief: Using cached Outlook token for email counts")
    else:
        access_token = None
        try:
            from supabase import create_client
            import os
            SUPABASE_URL = os.getenv("SUPABASE_URL")
            SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            GRAPH_API_URL = "https://graph.microsoft.com/v1.0"
            
            if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
                supabase_db = create_client(SUPABASE_URL.rstrip('/'), SUPABASE_SERVICE_ROLE_KEY)
                
                # Get Outlook token from database
                res = supabase_db.table("outlook_credentials").select("*").eq("uid", user_id).execute()
                if res.data and len(res.data) > 0:
                    creds = res.data[0]
                    access_token = creds.get("access_token")
                    expiry_str = creds.get("expiry")
                    
                    # Check if token is expired (with 5 minute buffer)
                    if expiry_str:
                        try:
                            expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                            now = datetime.now(timezone.utc)
                            if expiry <= (now + timedelta(minutes=5)):
                                # Token expired, try to refresh
                                refresh_token = creds.get("refresh_token")
                                if refresh_token:
                                    MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
                                    MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
                                    MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
                                    
                                    data = {
                                        "client_id": MICROSOFT_CLIENT_ID,
                                        "scope": "User.Read Calendars.ReadWrite Mail.Read",
                                        "refresh_token": refresh_token,
                                        "grant_type": "refresh_token",
                                        "client_secret": MICROSOFT_CLIENT_SECRET
                                    }
                                    refresh_res = requests.post(MICROSOFT_TOKEN_URL, data=data)
                                    new_token_data = refresh_res.json()
                                    
                                    if "access_token" in new_token_data:
                                        expires_in = new_token_data.get("expires_in", 3600)
                                        new_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                                        update_payload = {
                                            "access_token": new_token_data.get("access_token"),
                                            "refresh_token": new_token_data.get("refresh_token", refresh_token),
                                            "expiry": new_expiry.isoformat(),
                                        }
                                        supabase_db.table("outlook_credentials").update(update_payload).eq("uid", user_id).execute()
                                        access_token = new_token_data.get("access_token")
                        except Exception as e:
                            print(f"⚠️ Error refreshing Outlook token: {e}")
        except Exception as e:
            print(f"⚠️ Error fetching Outlook token: {e}")
    
    if access_token:
        try:
            GRAPH_API_URL = "https://graph.microsoft.com/v1.0"
            # Fetch Outlook unread count
            headers = {"Authorization": f"Bearer {access_token}"}
            outlook_url = f"{GRAPH_API_URL}/me/messages?$filter=isRead eq false&$count=true&$top=1"
            response = requests.get(outlook_url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                outlook_count = data.get("@odata.count", 0)
                print(f"✅ Morning Brief: Found {outlook_count} Outlook unread emails")
        except Exception as e:
            print(f"⚠️ Error fetching Outlook counts: {e}")
    
    total_unread = gmail_count + outlook_count
    
    return {
        "gmail_count": gmail_count,
        "outlook_count": outlook_count,
        "important_count": important_count,
        "total_unread": total_unread
    }

