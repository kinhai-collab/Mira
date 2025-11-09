import os
import re
import base64
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from datetime import datetime
from typing import Optional, List, Dict, Any
import tempfile
import json

router = APIRouter()

# Initialize ElevenLabs client with API key (lazy import)
client = None

def get_elevenlabs_client():
    global client
    if client is None:
        try:
            from elevenlabs import ElevenLabs
            api_key = os.getenv("ELEVENLABS_API_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="Voice service unavailable: ELEVENLABS_API_KEY not configured")
            client = ElevenLabs(api_key=api_key)
        except ImportError as e:
            raise HTTPException(status_code=500, detail="Voice service unavailable: elevenlabs package not available")
        except Exception as e:
            raise HTTPException(status_code=500, detail="Voice service unavailable: failed to initialize client")
    return client

@router.get("/voice")
async def generate_voice(text: str = "Hello from Mira!"):
    """
    Generates spoken audio from the given text using ElevenLabs.
    Returns an MP3 stream that the frontend can directly play.
    """
    try:
        # Get the ElevenLabs client (with lazy import)
        elevenlabs_client = get_elevenlabs_client()
        
        voice_id = os.getenv("ELEVENLABS_VOICE_ID")
        if not voice_id:
            raise HTTPException(status_code=500, detail="Missing ELEVENLABS_VOICE_ID")

        # Request the audio stream
        audio_stream = elevenlabs_client.text_to_speech.convert(
            voice_id=voice_id,
            model_id="eleven_turbo_v2",
            text=text,
            output_format="mp3_44100_128",
        )

        # Combine all chunks into one binary MP3 blob
        audio_bytes = b"".join(list(audio_stream))
        
        # Debug: Check the first few bytes to ensure it's valid MP3
        print(f"Audio bytes length: {len(audio_bytes)}")
        print(f"First 16 bytes (hex): {audio_bytes[:16].hex()}")
        print(f"First 16 bytes (ascii): {audio_bytes[:16]}")
        
        # Check if it starts with MP3 sync word (0xFF 0xFB or 0xFF 0xFA) or ID3 tag (0x49 0x44 0x33)
        if len(audio_bytes) >= 3:
            if (audio_bytes[0] == 0xFF and (audio_bytes[1] & 0xE0) == 0xE0) or \
               (audio_bytes[0] == 0x49 and audio_bytes[1] == 0x44 and audio_bytes[2] == 0x33):
                print("Audio data appears to be valid MP3")
            else:
                print("Audio data does not appear to be valid MP3")
                print("This might be base64 encoded or in a different format")
                
                # Try to decode as base64 if it looks like base64
                try:
                    import base64
                    # Check if the data looks like base64 (contains only base64 characters)
                    if all(c in b'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for c in audio_bytes):
                        print("Attempting to decode as base64...")
                        decoded_bytes = base64.b64decode(audio_bytes)
                        print(f"Decoded bytes length: {len(decoded_bytes)}")
                        print(f"Decoded first 16 bytes (hex): {decoded_bytes[:16].hex()}")
                        
                        # Check if decoded data is valid MP3
                        if len(decoded_bytes) >= 3:
                            if (decoded_bytes[0] == 0xFF and (decoded_bytes[1] & 0xE0) == 0xE0) or \
                               (decoded_bytes[0] == 0x49 and decoded_bytes[1] == 0x44 and decoded_bytes[2] == 0x33):
                                print(" Decoded audio data appears to be valid MP3")
                                audio_bytes = decoded_bytes
                            else:
                                print("Decoded data still doesn't look like MP3")
                except Exception as e:
                    print(f"Base64 decode failed: {e}")
        
        # Validate that we got audio data
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="No audio data received from ElevenLabs")

        # Return as stream response (works with frontend fetch)
        return StreamingResponse(
            iter([audio_bytes]), 
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "no-cache",
                "Content-Type": "audio/mpeg",
                "Accept-Ranges": "bytes",
                "Content-Length": str(len(audio_bytes))
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice generation failed: {e}")


@router.post("/text-query")
async def text_query_pipeline(request_data: dict):
    """
    Handles text-based queries without audio transcription.
    Similar to voice pipeline but accepts direct text input.
    """
    try:
        user_input = request_data.get("query", "").strip()
        history = request_data.get("history", [])
        
        if not user_input or len(user_input) < 1:
            return JSONResponse({
                "text": "",
                "userText": user_input,
            })
        
        # Check for morning brief intent
        import re, base64
        morning_brief_keywords = re.compile(r"(morning|daily|today).*(brief|summary|update)", re.I)
        show_brief_keywords = re.compile(r"(show|give|tell|read).*(brief|summary|morning|daily)", re.I)
        if morning_brief_keywords.search(user_input) or show_brief_keywords.search(user_input):
            return JSONResponse({
                "text": "Opening your morning brief now.",
                "userText": user_input,
                "action": "navigate",
                "actionTarget": "/scenarios/morning-brief",
            })
        
        # Check for email/calendar summary intent
        email_keywords = re.compile(r"(email|inbox|mail|messages)", re.I)
        calendar_keywords = re.compile(r"(calendar|schedule|event)", re.I)
        has_email_intent = email_keywords.search(user_input)
        has_calendar_intent = calendar_keywords.search(user_input)
        
        if has_email_intent or has_calendar_intent:
            # Determine which steps to show based on what was requested
            steps = []
            if has_email_intent:
                steps.append({"id": "emails", "label": "Checking your inbox for priority emails..."})
            if has_calendar_intent:
                steps.append({"id": "calendar", "label": "Reviewing today's calendar events..."})
                steps.append({"id": "highlights", "label": "Highlighting the most important meetings..."})
            if has_email_intent and has_calendar_intent:
                steps.append({"id": "conflicts", "label": "Noting any schedule conflicts..."})
            
            # Build action data with mock emails
            action_data = {
                "steps": steps,
                "emails": [
                    {
                        "id": "email-1",
                        "from": "david.olibear@gmail.com",
                        "subject": "Project Timeline & Budget Discussion",
                        "receivedAt": "8:42 AM",
                        "summary": "Needs sign-off on final user flows before noon.",
                    },
                    {
                        "id": "email-2",
                        "from": "kate.sponge@outlook.com",
                        "subject": "Quarterly Budget Review",
                        "receivedAt": "7:55 AM",
                        "summary": "Requested final slide revisions before the 3 PM prep.",
                    },
                    {
                        "id": "email-3",
                        "from": "kate.foret@gmail.com",
                        "subject": "Marketing Budget Approval",
                        "receivedAt": "Yesterday",
                        "summary": "Marketing budget needs approval.",
                    },
                    {
                        "id": "email-4",
                        "from": "sam.foleigh@outlook.com",
                        "subject": "Revised Marketing Budget",
                        "receivedAt": "Yesterday",
                        "summary": "Updated marketing budget proposal.",
                    },
                    {
                        "id": "email-5",
                        "from": "john.doe@gmail.com",
                        "subject": "Q4 Planning Meeting",
                        "receivedAt": "2 days ago",
                        "summary": "Planning for Q4 objectives.",
                    },
                    {
                        "id": "email-6",
                        "from": "sarah.smith@outlook.com",
                        "subject": "Team Building Event",
                        "receivedAt": "2 days ago",
                        "summary": "Details about upcoming team event.",
                    },
                ] if has_email_intent else [],
                "calendarEvents": [
                    {
                        "id": "event-1",
                        "title": "Design sync with Flowcore",
                        "timeRange": "10:30 AM – 11:15 AM",
                        "location": "Zoom",
                        "note": "Share final onboarding visuals.",
                    },
                    {
                        "id": "event-2",
                        "title": "Product + Ops standup",
                        "timeRange": "1:00 PM – 1:30 PM",
                        "location": "HQ Atrium",
                        "note": "Review blockers from yesterday.",
                    },
                ] if has_calendar_intent else [],
                "focus": "Reply to Flowcore with the signed-off flows and join the design sync prepared with the latest visuals." if (has_email_intent and has_calendar_intent) else None,
            }
            
            # Customize response text based on what was requested
            if has_email_intent and has_calendar_intent:
                response_text = "Here's what I'm seeing in your inbox and calendar."
            elif has_email_intent:
                response_text = "Here's what I'm seeing in your inbox."
            else:
                response_text = "Here's what I'm seeing on your calendar."
            
            return JSONResponse({
                "text": response_text,
                "userText": user_input,
                "action": "email_calendar_summary",
                "actionData": action_data,
            })
        
        # Build chat message array
        messages: List[Dict[str, Any]] = [
            {
                "role": "system",
                "content": (
                    "You are Mira, a warm, helpful assistant. Keep answers concise and friendly."
                ),
            },
        ]
        
        # Add history
        if isinstance(history, list):
            for msg in history[-10:]:  # Keep last 10 messages for context
                if isinstance(msg, dict) and "role" in msg and "content" in msg:
                    messages.append({"role": msg["role"], "content": msg["content"]})
        
        # Add current user query
        messages.append({"role": "user", "content": user_input})
        
        # Generate reply using GPT
        response_text = "I'm here to help!"
        try:
            from openai import OpenAI
            import os
            oa = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            comp = oa.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.8,
                max_tokens=300,
            )
            response_text = (comp.choices[0].message.content or "I'm here to help!").strip()
        except Exception as e:
            print(f"Error generating response: {e}")
            response_text = "Sorry, I encountered an issue generating a response."
        
        return JSONResponse({
            "text": response_text,
            "userText": user_input,
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text query pipeline failed: {e}")

@router.post("/voice")
async def voice_pipeline(
    audio: UploadFile = File(...),
    history: Optional[str] = Form(None)
):
    """
    Accepts recorded audio, transcribes with Whisper, generates a chat reply, and optional TTS audio.
    Returns a JSON body compatible with the frontend voice handler.
    """
    try:
        # 1) Persist upload to temp file (OpenAI SDK expects a real file object)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm", dir="/tmp") as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        # 2) Transcribe with Whisper
        user_input = ""
        try:
            from openai import OpenAI
            import os
            oa = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            with open(tmp_path, "rb") as f:
                tr = oa.audio.transcriptions.create(file=f, model="whisper-1")
            user_input = (tr.text or "").strip()
        except Exception as err:
            user_input = ""

        # Early exit on empty/noisy input
        if not user_input or len(user_input) < 3:
            return JSONResponse({
                "text": "",
                "audio": None,
                "userText": user_input,
            })

        # 2.5) Intent: Morning brief navigate
        morning_brief_keywords = re.compile(r"(morning|daily|today).*(brief|summary|update)", re.I)
        show_brief_keywords = re.compile(r"(show|give|tell|read).*(brief|summary|morning|daily)", re.I)
        if morning_brief_keywords.search(user_input) or show_brief_keywords.search(user_input):
            # Generate short TTS prompt for navigation (best-effort)
            audio_base64: Optional[str] = None
            try:
                el = get_elevenlabs_client()
                voice_id = os.getenv("ELEVENLABS_VOICE_ID")
                if voice_id:
                    stream = el.text_to_speech.convert(
                        voice_id=voice_id,
                        model_id="eleven_turbo_v2",
                        text="Opening your morning brief now.",
                        output_format="mp3_44100_128",
                    )
                    mp3_bytes = b"".join(list(stream))
                    if mp3_bytes:
                        audio_base64 = base64.b64encode(mp3_bytes).decode("ascii")
            except Exception:
                audio_base64 = None

            return JSONResponse({
                "text": "Opening your morning brief now.",
                "audio": audio_base64,
                "userText": user_input,
                "action": "navigate",
                "actionTarget": "/scenarios/morning-brief",
            })

        email_keywords = re.compile(r"(email|inbox|mail|messages)", re.I)
        calendar_keywords = re.compile(r"(calendar|schedule|event)", re.I)
        has_email_intent = email_keywords.search(user_input)
        has_calendar_intent = calendar_keywords.search(user_input)
        
        if has_email_intent or has_calendar_intent:
            # Determine which steps to show based on what was requested
            steps = []
            if has_email_intent:
                steps.append({"id": "emails", "label": "Checking your inbox for priority emails..."})
            if has_calendar_intent:
                steps.append({"id": "calendar", "label": "Reviewing today's calendar events..."})
                steps.append({"id": "highlights", "label": "Highlighting the most important meetings..."})
            if has_email_intent and has_calendar_intent:
                steps.append({"id": "conflicts", "label": "Noting any schedule conflicts..."})
            
            # Customize voice response based on what was requested
            if has_email_intent and has_calendar_intent:
                tts_text = "Let me pull up the latest emails and today's schedule."
                response_text = "Here's what I'm seeing in your inbox and calendar."
            elif has_email_intent:
                tts_text = "Let me check your inbox."
                response_text = "Here's what I'm seeing in your inbox."
            else:
                tts_text = "Let me check your calendar."
                response_text = "Here's what I'm seeing on your calendar."
            
            audio_base64: Optional[str] = None
            try:
                el = get_elevenlabs_client()
                voice_id = os.getenv("ELEVENLABS_VOICE_ID")
                if voice_id:
                    stream = el.text_to_speech.convert(
                        voice_id=voice_id,
                        model_id="eleven_turbo_v2",
                        text=tts_text,
                        output_format="mp3_44100_128",
                    )
                    mp3_bytes = b"".join(list(stream))
                    if mp3_bytes:
                        audio_base64 = base64.b64encode(mp3_bytes).decode("ascii")
            except Exception:
                audio_base64 = None

            action_data = {
                "steps": steps,
                "emails": [
                    {
                        "id": "email-1",
                        "from": "david.olibear@gmail.com",
                        "subject": "Project Timeline & Budget Discussion",
                        "receivedAt": "8:42 AM",
                        "summary": "Needs sign-off on final user flows before noon.",
                    },
                    {
                        "id": "email-2",
                        "from": "kate.sponge@outlook.com",
                        "subject": "Quarterly Budget Review",
                        "receivedAt": "7:55 AM",
                        "summary": "Requested final slide revisions before the 3 PM prep.",
                    },
                    {
                        "id": "email-3",
                        "from": "kate.foret@gmail.com",
                        "subject": "Marketing Budget Approval",
                        "receivedAt": "Yesterday",
                        "summary": "Marketing budget needs approval.",
                    },
                    {
                        "id": "email-4",
                        "from": "sam.foleigh@outlook.com",
                        "subject": "Revised Marketing Budget",
                        "receivedAt": "Yesterday",
                        "summary": "Updated marketing budget proposal.",
                    },
                    {
                        "id": "email-5",
                        "from": "john.doe@gmail.com",
                        "subject": "Q4 Planning Meeting",
                        "receivedAt": "2 days ago",
                        "summary": "Planning for Q4 objectives.",
                    },
                    {
                        "id": "email-6",
                        "from": "sarah.smith@outlook.com",
                        "subject": "Team Building Event",
                        "receivedAt": "2 days ago",
                        "summary": "Details about upcoming team event.",
                    },
                ] if has_email_intent else [],
                "calendarEvents": [
                    {
                        "id": "event-1",
                        "title": "Design sync with Flowcore",
                        "timeRange": "10:30 AM – 11:15 AM",
                        "location": "Zoom",
                        "note": "Share final onboarding visuals.",
                    },
                    {
                        "id": "event-2",
                        "title": "Product + Ops standup",
                        "timeRange": "1:00 PM – 1:30 PM",
                        "location": "HQ Atrium",
                        "note": "Review blockers from yesterday.",
                    },
                ] if has_calendar_intent else [],
                "focus": "Reply to Flowcore with the signed-off flows and join the design sync prepared with the latest visuals." if (has_email_intent and has_calendar_intent) else None,
            }

            return JSONResponse({
                "text": response_text,
                "audio": audio_base64,
                "userText": user_input,
                "action": "email_calendar_summary",
                "actionData": action_data,
            })

        # 3) Build chat message array
        messages: List[Dict[str, Any]] = [
            {
                "role": "system",
                "content": (
                    "You are Mira, a warm, voice-first assistant. Keep answers concise (1–3 sentences)."
                ),
            },
            {"role": "user", "content": user_input},
        ]
        if history:
            try:
                parsed = json.loads(history)
                if isinstance(parsed, list):
                    messages[1:1] = parsed  # insert after system
            except Exception:
                pass

        # 4) Generate reply
        response_text = "I'm here."
        try:
            from openai import OpenAI
            import os
            oa = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            comp = oa.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.8,
                max_tokens=200,
            )
            response_text = (comp.choices[0].message.content or "I'm here.").strip()
        except Exception:
            response_text = "Sorry, something went wrong while generating my response."

        # 5) TTS via ElevenLabs (best-effort)
        audio_base64: Optional[str] = None
        try:
            el = get_elevenlabs_client()
            voice_id = os.getenv("ELEVENLABS_VOICE_ID")
            if not voice_id:
                raise Exception("Missing ELEVENLABS_VOICE_ID")
            stream = el.text_to_speech.convert(
                voice_id=voice_id,
                model_id="eleven_turbo_v2",
                text=response_text,
                output_format="mp3_44100_128",
            )
            mp3_bytes = b"".join(list(stream))
            if mp3_bytes:
                audio_base64 = base64.b64encode(mp3_bytes).decode("ascii")
        except Exception:
            audio_base64 = None

        # 6) Response compatible with frontend
        return JSONResponse({
            "text": response_text,
            "audio": audio_base64,
            "userText": user_input,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice pipeline failed: {e}")

def generate_voice(text: str) -> tuple[str, str]:
    """
    Generates audio from text and returns both base64 data and a filename.
    Returns (audio_base64, filename) tuple.
    This is a synchronous utility function for use in non-async contexts.
    In Lambda, we return base64 instead of saving to disk (filesystem is read-only).
    """
    try:
        # Get the ElevenLabs client (with lazy import)
        elevenlabs_client = get_elevenlabs_client()
        
        voice_id = os.getenv("ELEVENLABS_VOICE_ID")
        if not voice_id:
            print("Warning: ELEVENLABS_VOICE_ID not set, skipping audio generation")
            return "", ""
        
        # Request the audio stream
        audio_stream = elevenlabs_client.text_to_speech.convert(
            voice_id=voice_id,
            model_id="eleven_turbo_v2",
            text=text,
            output_format="mp3_44100_128",
        )
        
        # Combine all chunks into one binary MP3 blob
        audio_bytes = b"".join(list(audio_stream))
        
        if not audio_bytes:
            print("Warning: No audio data received from ElevenLabs")
            return "", ""
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"morning_brief_{timestamp}.mp3"
        
        # Try to save to /tmp for local dev (Lambda can't write to /var/task)
        try:
            os.makedirs("/tmp/speech", exist_ok=True)
            tmp_path = os.path.join("/tmp/speech", filename)
            with open(tmp_path, "wb") as f:
                f.write(audio_bytes)
            print(f"Audio saved to: {tmp_path}")
        except Exception as save_err:
            print(f"Could not save audio file (Lambda read-only filesystem): {save_err}")
            # Continue - we'll return base64 instead
        
        # Encode to base64 for direct use
        import base64
        audio_base64 = base64.b64encode(audio_bytes).decode("ascii")
        
        return audio_base64, filename
        
    except Exception as e:
        print(f"Error generating voice: {e}")
        import traceback
        traceback.print_exc()
        return "", ""
