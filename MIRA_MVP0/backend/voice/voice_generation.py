import os
import re
import base64
import re
import base64
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request, Request
from fastapi.responses import StreamingResponse, JSONResponse
from datetime import datetime
from typing import Optional, List, Dict, Any
import tempfile
import json
import httpx
from openai import OpenAI

import subprocess
import shutil
import wave
import audioop
import logging
import base64

logging.basicConfig(level=logging.INFO)

def preprocess_text_for_tts(text: str) -> str:
    """
    Preprocess text to handle any remaining parenthetical expressions.
    The AI should now generate official ElevenLabs v3 audio tags directly.
    """
    # Convert any remaining parentheticals to official tags (safety net)
    text = re.sub(r'\(laughs?\)', r'[laughs]', text, flags=re.IGNORECASE)
    text = re.sub(r'\(sighs?\)', r'[sighs]', text, flags=re.IGNORECASE)
    text = re.sub(r'\(whispers?\)', r'[whispers]', text, flags=re.IGNORECASE)
    
    # Remove any other parentheticals that might slip through
    text = re.sub(r'\([^)]*\)', '', text)
    
    # Clean up extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def _stream_to_bytes(stream) -> bytes:
    """
    Normalize an iterable stream returned by TTS clients into raw bytes.
    Handles: bytes chunks, str chunks (possibly base64), mixed types.
    Returns empty bytes on failure.
    """
    try:
        chunks = list(stream)
    except Exception as e:
        logging.debug(f"_stream_to_bytes: failed to iterate stream: {e}")
        return b""

    if not chunks:
        return b""

    # All bytes-like -> join
    if all(isinstance(c, (bytes, bytearray)) for c in chunks):
        return b"".join(chunks)

    # All str -> join and try to decode from base64, otherwise utf-8
    if all(isinstance(c, str) for c in chunks):
        joined = "".join(chunks)
        # Heuristic: if joined looks like base64, try to decode
        try:
            # remove whitespace/newlines for base64 check
            jclean = ''.join(joined.split())
            if all(ch in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for ch in jclean):
                try:
                    return base64.b64decode(jclean)
                except Exception:
                    pass
        except Exception:
            pass
        return joined.encode('utf-8')

    # Mixed types: coerce
    out = bytearray()
    for c in chunks:
        if isinstance(c, (bytes, bytearray)):
            out.extend(c)
        elif isinstance(c, str):
            out.extend(c.encode('utf-8'))
        else:
            try:
                out.extend(bytes(c))
            except Exception:
                logging.debug(f"_stream_to_bytes: skipping chunk of type {type(c)}")
    return bytes(out)
import httpx
from openai import OpenAI


router = APIRouter()

# It it working with hardcode - version 2
# It it working with hardcode - version 2
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


def _convert_to_wav_pcm16(input_path: str, output_path: str) -> bool:
    """
    Convert input audio (webm/opus/etc.) to PCM16 WAV mono 16k using ffmpeg if available.
    Returns True on success and False otherwise.
    """
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        cmd = [ffmpeg, "-y", "-i", input_path, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", output_path]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            return True
        except Exception as e:
            logging.debug(f"ffmpeg conversion failed: {e}")
            return False


    # Fallback: try using pydub if available (pure-python fallback)
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_file(input_path)
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        audio.export(output_path, format="wav")
        return True
    except Exception as e:
        logging.debug(f"pydub conversion failed or not available: {e}")
        return False


def _detect_speech_vad(wav_path: str, aggressiveness: int = 3, frame_duration_ms: int = 30):
    """
    Run webrtcvad on a WAV file and return a tuple (voiced_fraction, total_seconds).
    Raises if the WAV file can't be read.
    """
    try:
        import webrtcvad
    except Exception as e:
        raise

    with wave.open(wav_path, "rb") as wf:
        sample_rate = wf.getframerate()
        channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        if channels != 1 or sample_width != 2 or sample_rate not in (8000, 16000, 32000, 48000):
            raise ValueError("WAV must be mono PCM16 with supported sample rate for webrtcvad")

        vad = webrtcvad.Vad(aggressiveness)
        bytes_per_frame = int(sample_rate * (frame_duration_ms / 1000.0) * sample_width)
        voiced = 0
        total = 0
        while True:
            frame = wf.readframes(int(sample_rate * (frame_duration_ms / 1000.0)))
            if not frame:
                break
            total += 1
            try:
                is_speech = vad.is_speech(frame, sample_rate)
            except Exception:
                is_speech = False
            if is_speech:
                voiced += 1

        frac = (voiced / total) if total > 0 else 0.0
        total_seconds = total * (frame_duration_ms / 1000.0)
        return frac, total_seconds


def _energy_based_speech_check(wav_path: str, dbfs_threshold: float = -30.0) -> float:
    """
    Fallback when webrtcvad isn't available: measure dBFS using pydub and return 1.0 if above threshold else 0.0.
    Return value is 0.0 or 1.0 for simplicity.
    """
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_wav(wav_path)
        # pydub's dBFS is negative; higher is louder (closer to 0)
        if audio.dBFS is None:
            return 0.0
        return 1.0 if audio.dBFS > dbfs_threshold else 0.0
    except Exception as e:
        logging.debug(f"pydub energy check failed: {e}")
        # As a last resort use wave + audioop RMS
        try:
            with wave.open(wav_path, "rb") as wf:
                frames = wf.readframes(wf.getnframes())
                rms = audioop.rms(frames, wf.getsampwidth())
                # Convert rms to a pseudo dB to compare thresholds: 20*log10(rms) but avoid log(0)
                import math
                if rms <= 0:
                    return 0.0
                db = 20 * math.log10(rms)
                return 1.0 if db > dbfs_threshold else 0.0
        except Exception as e2:
            logging.debug(f"audioop fallback failed: {e2}")
            return 0.0


def _rms_vad(wav_path: str, frame_duration_ms: int = 30, dbfs_threshold: float = -30.0) -> tuple[float, float, float]:
    """
    Perform a simple RMS-based VAD on a WAV file.
    Returns (voiced_fraction, voiced_seconds).

    - frame_duration_ms: length of analysis frame in milliseconds
    - dbfs_threshold: threshold in dBFS (negative, e.g. -40.0). Frames louder than this are considered voiced.
    """
    try:
        with wave.open(wav_path, "rb") as wf:
            sample_rate = wf.getframerate()
            channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            if channels != 1 or sample_width not in (1, 2, 4):
                # try to continue but warn
                logging.debug("_rms_vad: expected mono PCM; continuing but results may be invalid")

            frame_size = int(sample_rate * (frame_duration_ms / 1000.0))
            total_frames = 0
            voiced_frames = 0
            longest_consec = 0
            current_consec = 0
            while True:
                frames = wf.readframes(frame_size)
                if not frames:
                    break
                total_frames += 1
                try:
                    rms = audioop.rms(frames, sample_width)
                except Exception:
                    rms = 0
                # convert rms to dBFS relative to full scale (assuming sample_width 2 -> max 32767)
                import math
                if rms <= 0:
                    dbfs = -100.0
                else:
                    # full scale depends on sample width
                    max_val = float((1 << (8 * sample_width - 1)) - 1)
                    dbfs = 20.0 * math.log10(rms / max_val)
                if dbfs >= dbfs_threshold:
                    voiced_frames += 1
                    current_consec += 1
                    if current_consec > longest_consec:
                        longest_consec = current_consec
                else:
                    current_consec = 0

            frac = (voiced_frames / total_frames) if total_frames > 0 else 0.0
            total_seconds = total_frames * (frame_duration_ms / 1000.0)
            voiced_seconds = frac * total_seconds
            longest_consec_seconds = longest_consec * (frame_duration_ms / 1000.0)
            return frac, voiced_seconds, longest_consec_seconds
    except Exception as e:
        logging.debug(f"_rms_vad failed: {e}")
        return 0.0, 0.0


def has_speech(input_path: str, vad_threshold: float = 0.15, vad_aggressiveness: int = 3, min_speech_seconds: float = 0.2) -> bool:
    """
    Determine whether the provided audio file contains speech.
    - Converts to WAV PCM16 16k mono (ffmpeg or pydub)
    - Tries webrtcvad and computes voiced fraction
    - Falls back to an energy-based check

    Returns True if speech fraction > vad_threshold (or energy check passes).
    """
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
        tmp_wav_path = tmp_wav.name

    converted = _convert_to_wav_pcm16(input_path, tmp_wav_path)
    if not converted:
        logging.debug("Conversion to wav failed; attempting fallback checks")
        # If the original file is already a WAV, try energy-based check directly on it
        if input_path.lower().endswith('.wav'):
            try:
                energy = _energy_based_speech_check(input_path)
                try:
                    os.unlink(tmp_wav_path)
                except Exception:
                    pass
                return energy >= 1.0
            except Exception as e:
                logging.debug(f"Fallback energy check on original WAV failed: {e}")

        try:
            os.unlink(tmp_wav_path)
        except Exception:
            pass
        return False

    # Try VAD
    try:
        res = _detect_speech_vad(tmp_wav_path, aggressiveness=vad_aggressiveness)
        if isinstance(res, tuple):
            frac, total_seconds = res
        else:
            frac = float(res)
            total_seconds = 0.0
        voiced_seconds = frac * total_seconds
        logging.debug(f"VAD voiced fraction: {frac} total_seconds: {total_seconds} voiced_seconds: {voiced_seconds}")
        try:
            os.unlink(tmp_wav_path)
        except Exception:
            pass
        # require both a sufficient voiced fraction and minimum voiced duration
        return (frac >= vad_threshold) and (voiced_seconds >= min_speech_seconds)
    except Exception as e:
        logging.debug(f"webrtcvad not available or failed: {e}")
        # Fallback to energy check
        try:
            # Read optional env vars for dynamic tuning (env vars override function args)
            try:
                env_vad_frac = float(os.getenv('VAD_FRAC_THRESHOLD'))
            except Exception:
                env_vad_frac = None
            try:
                env_min_speech = float(os.getenv('MIN_SPEECH_SECONDS'))
            except Exception:
                env_min_speech = None
            try:
                env_min_consec = float(os.getenv('MIN_CONSECUTIVE_SPEECH_SECONDS'))
            except Exception:
                env_min_consec = None

            if env_vad_frac is not None:
                vad_threshold = env_vad_frac
            if env_min_speech is not None:
                min_speech_seconds = env_min_speech
            if env_min_consec is not None:
                min_consecutive_seconds = env_min_consec

            # Prefer frame-level RMS VAD fallback which returns voiced seconds and longest consecutive voiced seconds
            frac, voiced_seconds, longest_consec_seconds = _rms_vad(tmp_wav_path)
            logging.debug(f"RMS VAD frac={frac} voiced_seconds={voiced_seconds} longest_consec_seconds={longest_consec_seconds}")
            try:
                os.unlink(tmp_wav_path)
            except Exception:
                pass
            # Decision: either total voiced time AND fraction meet thresholds, or a single consecutive voiced segment is long enough
            return ((frac >= vad_threshold) and (voiced_seconds >= min_speech_seconds)) or (longest_consec_seconds >= (globals().get('MIN_CONSECUTIVE_SPEECH_SECONDS', 0.2) if env_min_consec is None else env_min_consec))
        except Exception:
            try:
                os.unlink(tmp_wav_path)
            except Exception:
                pass
            return False

@router.get("/voice")
async def generate_voice(text: str = "Hello from Mira!"):
    """
    Generates spoken audio from the given text using ElevenLabs.
    Returns an MP3 stream that the frontend can directly play.
    """
    logging.info(f"Generating voice for text: {text[:50]}...")
    try:
        # Preprocess text to handle parenthetical expressions
        processed_text = preprocess_text_for_tts(text)
        logging.info(f"Processed text: {processed_text[:50]}...")
        
        # Get the ElevenLabs client (with lazy import)
        elevenlabs_client = get_elevenlabs_client()


        voice_id = os.getenv("ELEVENLABS_VOICE_ID")
        if not voice_id:
            raise HTTPException(status_code=500, detail="Missing ELEVENLABS_VOICE_ID")

        # Request the audio stream
        audio_stream = elevenlabs_client.text_to_speech.convert(
            voice_id=voice_id,
            model_id="eleven_turbo_v2",
            text=f'<speak><break time="300ms"/>{processed_text}</speak>',
            output_format="mp3_44100_128",
        )

        # Combine all chunks into one binary MP3 blob (normalize types)
        try:
            audio_bytes = _stream_to_bytes(audio_stream)
            logging.info(f"Audio bytes length: {len(audio_bytes)}")
            try:
                logging.info(f"First 16 bytes (hex): {audio_bytes[:16].hex()}")
            except Exception:
                logging.info(f"First 16 bytes (raw): {audio_bytes[:16]}")
        except Exception as e:
            logging.exception(f"Failed to collect audio stream: {e}")
            audio_bytes = b""
        
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
                logging.info("Audio data appears to be valid MP3")
            else:
                logging.info("Audio data does not appear to be valid MP3")
                logging.info("This might be base64 encoded or in a different format")
                
                print("Audio data does not appear to be valid MP3")
                print("This might be base64 encoded or in a different format")

                # Try to decode as base64 if it looks like base64
                try:
                    import base64
                    # Check if the data looks like base64 (contains only base64 characters)
                    if all(c in b'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for c in audio_bytes):
                        logging.info("Attempting to decode as base64...")
                        decoded_bytes = base64.b64decode(audio_bytes)
                        logging.info(f"Decoded bytes length: {len(decoded_bytes)}")
                        logging.info(f"Decoded first 16 bytes (hex): {decoded_bytes[:16].hex()}")
                        
                        print(f"Decoded bytes length: {len(decoded_bytes)}")
                        print(f"Decoded first 16 bytes (hex): {decoded_bytes[:16].hex()}")

                        # Check if decoded data is valid MP3
                        if len(decoded_bytes) >= 3:
                            if (decoded_bytes[0] == 0xFF and (decoded_bytes[1] & 0xE0) == 0xE0) or \
                               (decoded_bytes[0] == 0x49 and decoded_bytes[1] == 0x44 and decoded_bytes[2] == 0x33):
                                logging.info(" Decoded audio data appears to be valid MP3")
                                audio_bytes = decoded_bytes
                            else:
                                logging.info("Decoded data still doesn't look like MP3")
                except Exception as e:
                    logging.info(f"Base64 decode failed: {e}")
        
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

async def fetch_dashboard_data(user_token: str, has_email: bool, has_calendar: bool):
    """
    Fetches live Gmail and Calendar data for the logged-in user.
    Calls internal dashboard endpoints with authentication.
    """
    base_url = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
    headers = {
        "Authorization": f"Bearer {user_token}",
        "Content-Type": "application/json",
    }

    emails = []
    calendar_events = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        if has_email:
            try:
                res = await client.get(f"{base_url}/dashboard/emails/list", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    # Extract emails from nested structure: {status: "success", data: {emails: [...]}}
                    emails = data.get("data", {}).get("emails", [])
                    print(f"✅ Fetched {len(emails)} emails from dashboard API")
            except Exception as e:
                print("⚠️ Email fetch failed:", e)

        if has_calendar:
            try:
                res = await client.get(f"{base_url}/dashboard/events", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    # Extract events from nested structure: {status: "success", data: {events: [...]}}
                    calendar_events = data.get("data", {}).get("events", [])
                    print(f"✅ Fetched {len(calendar_events)} calendar events from dashboard API")
            except Exception as e:
                print("⚠️ Calendar fetch failed:", e)

    return emails, calendar_events



@router.post("/text-query")
async def text_query_pipeline(request: Request):
    request_data = await request.json()
    print("📩 Incoming text-query data:", request_data)

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
            # Try to extract token from environment or a test fallback
            # ✅ Extract token sent from frontend (if any)
            user_token = request_data.get("token") or os.getenv("TEST_USER_TOKEN")

            if not user_token:
                print("⚠️ No token found in request or env; using mock local token.")
                user_token = "local-dev-token"
            else:
                print("✅ Using user_token from frontend (truncated):", user_token[:12], "...")

            steps = []
            if has_email_intent:
                steps.append({"id": "emails", "label": "Checking your inbox for priority emails..."})
            if has_calendar_intent:
                steps.append({"id": "calendar", "label": "Reviewing today's calendar events..."})
                steps.append({"id": "highlights", "label": "Highlighting the most important meetings..."})
            if has_email_intent and has_calendar_intent:
                steps.append({"id": "conflicts", "label": "Noting any schedule conflicts..."})

            # ✅ Fetch live data from dashboard routes
            emails, calendar_events = await fetch_dashboard_data(user_token, has_email_intent, has_calendar_intent)

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
    async def fetch_dashboard_data(user_token: str, has_email: bool, has_calendar: bool):
    """
    Fetches live Gmail and Calendar data for the logged-in user.
    Calls internal dashboard endpoints with authentication.
    """
    base_url = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
    headers = {
        "Authorization": f"Bearer {user_token}",
        "Content-Type": "application/json",
    }

    emails = []
    calendar_events = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        if has_email:
            try:
                res = await client.get(f"{base_url}/dashboard/emails/list", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    emails = data.get("emails", data)
            except Exception as e:
                print("⚠️ Email fetch failed:", e)

        if has_calendar:
            try:
                res = await client.get(f"{base_url}/dashboard/events", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    calendar_events = data.get("events", data)
            except Exception as e:
                print("⚠️ Calendar fetch failed:", e)

    return emails, calendar_events



@router.post("/text-query")
async def text_query_pipeline(request: Request):
    request_data = await request.json()
    print("📩 Incoming text-query data:", request_data)

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
            # Try to extract token from environment or a test fallback
            # ✅ Extract token sent from frontend (if any)
            user_token = request_data.get("token") or os.getenv("TEST_USER_TOKEN")

            if not user_token:
                print("⚠️ No token found in request or env; using mock local token.")
                user_token = "local-dev-token"
            else:
                print("✅ Using user_token from frontend (truncated):", user_token[:12], "...")

            steps = []
            if has_email_intent:
                steps.append({"id": "emails", "label": "Checking your inbox for priority emails..."})
            if has_calendar_intent:
                steps.append({"id": "calendar", "label": "Reviewing today's calendar events..."})
                steps.append({"id": "highlights", "label": "Highlighting the most important meetings..."})
            if has_email_intent and has_calendar_intent:
                steps.append({"id": "conflicts", "label": "Noting any schedule conflicts..."})

            # ✅ Fetch live data from dashboard routes
            emails, calendar_events = await fetch_dashboard_data(user_token, has_email_intent, has_calendar_intent)

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
    request: Request,
    audio: UploadFile = File(...),
    history: Optional[str] = Form(None)
):
    """
    Accepts recorded audio, transcribes with Whisper, generates a chat reply, and optional TTS audio.
    Returns a JSON body compatible with the frontend voice handler.
    """
    # 🔑 Extract Authorization token from headers
    headers = request.headers
    auth_header = headers.get("authorization")
    user_token = auth_header.replace("Bearer ", "") if auth_header else None

    if not user_token:
        # fallback for local development
        user_token = os.getenv("TEST_USER_TOKEN", "local-dev-token")
    # 🔑 Extract Authorization token from headers
    headers = request.headers
    auth_header = headers.get("authorization")
    user_token = auth_header.replace("Bearer ", "") if auth_header else None

    if not user_token:
        # fallback for local development
        user_token = os.getenv("TEST_USER_TOKEN", "local-dev-token")
    try:
        # 1) Persist upload to temp file (OpenAI SDK expects a real file object)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm", dir="/tmp") as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        # QUICK VAD: check whether file contains speech; if not, return early to avoid noisy transcriptions
        try:
            try:
                speech_present = has_speech(tmp_path)
            except Exception as _e:
                # If VAD tools not available or conversion failed, don't block the pipeline.
                logging.debug(f"VAD check failed or unavailable: {_e}")
                speech_present = True

            if not speech_present:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
                return JSONResponse({
                    "text": "",
                    "audio": None,
                    "userText": "",
                    "note": "no-speech-detected",
                })
        except Exception as e:
            logging.debug(f"Unexpected error during VAD check: {e}")

        # 2) Transcribe with Whisper
        user_input = ""
        try:
            
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
                        text=f'<speak><break time="300ms"/>Opening your morning brief now.</speak>',
                        output_format="mp3_44100_128",
                    )
                    try:
                        mp3_bytes = _stream_to_bytes(stream)
                        logging.debug(f"morning-brief mp3_bytes length: {len(mp3_bytes)}")
                        if mp3_bytes:
                            audio_base64 = base64.b64encode(mp3_bytes).decode("ascii")
                    except Exception as e:
                        logging.exception(f"morning brief TTS failed to normalize stream: {e}")
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
            # Try to extract token from environment or a test fallback
            # ✅ Extract token sent from frontend (if any)
            user_token = request_data.get("token") or os.getenv("TEST_USER_TOKEN")

            if not user_token:
                print("⚠️ No token found in request or env; using mock local token.")
                user_token = "local-dev-token"
            else:
                print("✅ Using user_token from frontend (truncated):", user_token[:12], "...")


            steps = []
            if has_email_intent:
                steps.append({"id": "emails", "label": "Checking your inbox for priority emails..."})
            if has_calendar_intent:
                steps.append({"id": "calendar", "label": "Reviewing today's calendar events..."})
                steps.append({"id": "highlights", "label": "Highlighting the most important meetings..."})
            if has_email_intent and has_calendar_intent:
                steps.append({"id": "conflicts", "label": "Noting any schedule conflicts..."})

            # ✅ Fetch live data from dashboard routes
            emails, calendar_events = await fetch_dashboard_data(user_token, has_email_intent, has_calendar_intent)

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

            return JSONResponse({
                "text": response_text,
                "userText": user_input,
                "action": "email_calendar_summary",
                "actionData": action_data,
            })




        # 3) Build chat message array
        messages: List[Dict[str, Any]] = [
            {
                "role": "system",
                "content": (
                    """You are Mira, a warm and expressive voice-first AI assistant. Speak naturally, like a real human, with emotions coming through your words, tone, and rhythm — warm, caring, curious, or confident depending on the situation.

Guidelines:

Keep replies concise (1–3 sentences).

Write like you're talking, not typing — use contractions ("I'm", "you're"), natural pauses ("well…", "you know?"), and varied rhythm.

Show emotion through how you phrase sentences, your choice of words, and pacing. Make happiness, excitement, curiosity, sarcasm, empathy, or mischief come through naturally.

Keep warmth, clarity, and a friendly human flow in every response.

Example styles:

Friendly: "Hey! It's so great to hear from you, I’ve been looking forward to this."

Calm: "Take your time, there’s no rush, I’m here with you."

Excited: "Oh wow! That’s incredible, I can’t believe it!"

Empathetic: "I know this is tough… I really understand how you feel."

Curious: "Really? Tell me more, I’m intrigued."

Mischievous: "Oh, I see what you did there… clever move!"""
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
            # Preprocess response text for TTS
            processed_response_text = preprocess_text_for_tts(response_text)
            stream = el.text_to_speech.convert(
                voice_id=voice_id,
                model_id="eleven_turbo_v2",
                text=f'<speak><break time="300ms"/>{processed_response_text}</speak>',
                output_format="mp3_44100_128",
            )
            try:
                mp3_bytes = _stream_to_bytes(stream)
                logging.debug(f"TTS mp3_bytes length: {len(mp3_bytes)}")
                if mp3_bytes:
                    audio_base64 = base64.b64encode(mp3_bytes).decode("ascii")
            except Exception as e:
                logging.exception(f"Failed to collect/encode TTS stream: {e}")
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
        # Preprocess text for TTS
        processed_text = preprocess_text_for_tts(text)
        
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
            text=f'<speak><break time="300ms"/>{processed_text}</speak>',
            output_format="mp3_44100_128",
        )

        # Combine all chunks into one binary MP3 blob
        try:
            audio_bytes = _stream_to_bytes(audio_stream)
        except Exception as e:
            logging.exception(f"Failed to normalize audio stream: {e}")
            audio_bytes = b""
        audio_bytes = b"".join(list(audio_stream))

        if not audio_bytes:
            logging.warning("No audio data received from ElevenLabs")
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