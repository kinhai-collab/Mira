"""
Shared voice processing logic for both FastAPI WebSocket and AWS Lambda WebSocket
This module contains the core business logic that can be used by:
- voice_generation.py (FastAPI WebSocket for local/ECS)
- websocket_lambda.py (AWS API Gateway WebSocket for Lambda)
"""
import os
import re
import base64
import logging
from typing import Dict, Any, Optional, Tuple, List

logger = logging.getLogger(__name__)


async def detect_email_calendar_intent(text: str) -> Tuple[bool, bool]:
    """
    Detect if user wants to view emails and/or calendar
    Returns: (has_email_intent, has_calendar_intent)
    """
    view_keywords = re.compile(
        r"(show|view|see|check|what|tell|read|summary|list|display).*(email|inbox|mail|mails|messages|calendar|schedule|event|meeting)",
        re.I
    )
    email_keywords = re.compile(r"(email|inbox|mail|mails|messages)", re.I)
    calendar_keywords = re.compile(r"(calendar|schedule|event|events|meeting)", re.I)
    
    has_view_intent = view_keywords.search(text)
    has_email_intent = email_keywords.search(text) and has_view_intent
    has_calendar_intent = calendar_keywords.search(text) and has_view_intent
    
    return bool(has_email_intent), bool(has_calendar_intent)


async def fetch_email_calendar_data(
    user_token: str,
    has_email: bool,
    has_calendar: bool,
    user_timezone: str = "UTC"
) -> Tuple[List[Dict], List[Dict]]:
    """
    Fetch email and calendar data from dashboard API
    Returns: (emails, calendar_events)
    """
    import httpx
    
    emails = []
    calendar_events = []
    
    # Determine base URL
    base_url = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Fetch emails if requested
            if has_email:
                try:
                    email_response = await client.get(
                        f"{base_url}/dashboard/emails/list",
                        headers={"Authorization": f"Bearer {user_token}"},
                        params={"timezone": user_timezone}
                    )
                    if email_response.status_code == 200:
                        email_data = email_response.json()
                        emails = email_data.get("emails", [])
                        logger.info(f"✅ Fetched {len(emails)} emails")
                except Exception as e:
                    logger.error(f"❌ Failed to fetch emails: {e}")
            
            # Fetch calendar events if requested
            if has_calendar:
                try:
                    calendar_response = await client.get(
                        f"{base_url}/dashboard/calendar/events",
                        headers={"Authorization": f"Bearer {user_token}"},
                        params={"timezone": user_timezone}
                    )
                    if calendar_response.status_code == 200:
                        calendar_data = calendar_response.json()
                        calendar_events = calendar_data.get("events", [])
                        logger.info(f"✅ Fetched {len(calendar_events)} calendar events")
                except Exception as e:
                    logger.error(f"❌ Failed to fetch calendar: {e}")
    
    except Exception as e:
        logger.error(f"❌ Error fetching dashboard data: {e}")
    
    return emails, calendar_events


async def generate_tts_audio(text: str, voice_id: str = None, api_key: str = None) -> Optional[str]:
    """
    Generate TTS audio using ElevenLabs
    Returns: base64 encoded audio or None
    """
    if not voice_id:
        voice_id = os.getenv("ELEVENLABS_VOICE_ID")
    if not api_key:
        api_key = os.getenv("ELEVENLABS_API_KEY")
    
    if not voice_id or not api_key:
        logger.warning("Missing ElevenLabs credentials")
        return None
    
    try:
        import httpx
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers={
                    "xi-api-key": api_key,
                    "Content-Type": "application/json"
                },
                json={
                    "text": text,
                    "model_id": "eleven_flash_v2_5",
                    "output_format": "mp3_44100_128",
                }
            )
            
            if response.status_code == 200:
                audio_bytes = response.content
                audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
                logger.info(f"✅ Generated TTS audio ({len(audio_bytes)} bytes)")
                return audio_b64
            else:
                logger.error(f"❌ TTS failed: {response.status_code}")
                return None
    
    except Exception as e:
        logger.error(f"❌ TTS error: {e}")
        return None


def build_email_calendar_summary_response(
    emails: List[Dict],
    calendar_events: List[Dict],
    has_email_intent: bool,
    has_calendar_intent: bool
) -> Dict[str, Any]:
    """
    Build response data for email/calendar summary
    Returns: response dictionary with action and actionData
    """
    steps = []
    if has_email_intent:
        steps.append({"id": "emails", "label": "Checking your inbox for priority emails..."})
    if has_calendar_intent:
        steps.append({"id": "calendar", "label": "Reviewing today's calendar events..."})
        steps.append({"id": "highlights", "label": "Highlighting the most important meetings..."})
    if has_email_intent and has_calendar_intent:
        steps.append({"id": "conflicts", "label": "Noting any schedule conflicts..."})
    
    action_data = {
        "steps": steps,
        "emails": emails if has_email_intent else [],
        "calendarEvents": calendar_events if has_calendar_intent else [],
        "focus": (
            "You have upcoming events and important unread emails — review your schedule and respond accordingly."
            if has_email_intent and has_calendar_intent
            else None
        ),
    }
    
    response_text = (
        "Here's what I'm seeing in your inbox and calendar."
        if has_email_intent and has_calendar_intent
        else "Here's what I'm seeing in your inbox."
        if has_email_intent
        else "Here's what I'm seeing on your calendar."
    )
    
    return {
        "message_type": "response",
        "text": response_text,
        "action": "email_calendar_summary",
        "actionData": action_data,
    }


async def check_calendar_action(text: str, user_token: str, user_timezone: str = None) -> Optional[Dict[str, Any]]:
    """
    Check if text contains a calendar action (schedule/cancel/reschedule)
    Returns: action result dictionary or None
    """
    try:
        # Import calendar actions handler
        from calendar_actions import _handle_calendar_voice_command
        
        result = await _handle_calendar_voice_command(
            text,
            f"Bearer {user_token}",
            return_dict=True,
            user_timezone=user_timezone
        )
        
        if result and result.get("action", "").startswith("calendar_"):
            logger.info(f"📅 Calendar action detected: {result.get('action')}")
            return result
        
        return None
    
    except ImportError:
        logger.warning("Calendar actions module not available")
        return None
    except Exception as e:
        logger.error(f"Error checking calendar action: {e}")
        return None

