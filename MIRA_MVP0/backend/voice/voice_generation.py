import os
import re
import base64
import asyncio
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, JSONResponse
from datetime import datetime
from typing import Optional, List, Dict, Any
import tempfile
import json
import httpx
from openai import OpenAI
from settings import get_uid_from_token

# Optional memory imports - handle gracefully if modules don't exist
try:
    from memory_service import get_memory_service
except ImportError:
    get_memory_service = None

try:
    from memory_manager import get_memory_manager
except ImportError:
    get_memory_manager = None

try:
    from intelligent_learner import get_intelligent_learner
except ImportError:
    get_intelligent_learner = None

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
async def stream_voice(text: str = "Hello from Mira!"):
    """
    Generates spoken audio from the given text using ElevenLabs and returns an MP3 stream.
    Renamed handler to avoid conflict with the synchronous `generate_voice` helper below.
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

        # Normalize stream into bytes
        try:
            audio_bytes = _stream_to_bytes(audio_stream)
            logging.info(f"Audio bytes length: {len(audio_bytes)}")
        except Exception as e:
            logging.exception(f"Failed to collect audio stream: {e}")
            audio_bytes = b""

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
                    emails = data.get("data", {}).get("emails", [])
            except Exception as e:
                logging.debug(f"Email fetch failed: {e}")

        if has_calendar:
            try:
                res = await client.get(f"{base_url}/dashboard/events", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    calendar_events = data.get("data", {}).get("events", [])
            except Exception as e:
                logging.debug(f"Calendar fetch failed: {e}")

    return emails, calendar_events


@router.post("/text-query")
async def text_query_pipeline(request: Request):
    request_data = await request.json()
    print("📩 Incoming text-query data:", request_data)

    # Support token provided either in Authorization header or in request body as `token`
    auth_header = request.headers.get("authorization") or None
    if not auth_header:
        body_token = request_data.get("token") if isinstance(request_data, dict) else None
        if body_token:
            auth_header = f"Bearer {body_token}"

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
        # Add current user query
        messages.append({"role": "user", "content": user_input})

        




        

        # Retrieve relevant memories for context
        # Extract user ID from authorization header (we may have pulled token from body earlier)
        user_id = None
        if auth_header:
            try:
                user_id = get_uid_from_token(auth_header)
            except Exception as e:
                print(f"Could not extract user ID from token: {e}")
                user_id = "anonymous"

        # Get memory service/manager/learner if available
        memory_service = get_memory_service() if get_memory_service else None
        memory_manager = get_memory_manager() if get_memory_manager else None
        intelligent_learner = get_intelligent_learner() if get_intelligent_learner else None

        relevant_memories = []
        memory_context = ""
        if user_id and user_id != "anonymous" and memory_service:
            try:
                relevant_memories = memory_service.retrieve_relevant_memories(
                    user_id=user_id,
                    query=user_input,
                    limit=3,
                    memory_type="conversation"
                )
                
                # Also get recent conversations for additional context
                recent_memories = memory_service.get_recent_conversations(user_id=user_id, limit=5)
                
                # Combine and deduplicate
                all_memories = relevant_memories + recent_memories
                seen_contents = set()
                unique_memories = []
                for mem in all_memories:
                    content = mem.get("content", "")
                    if content not in seen_contents:
                        seen_contents.add(content)
                        unique_memories.append(mem)
                
                # Format memories for context (support both fact memories and conversation metadata)
                if unique_memories:
                    memory_strings = []
                    for mem in unique_memories[:5]:  # Limit to 5 total
                        content = mem.get("content") or ""
                        metadata = mem.get("metadata", {}) or {}
                        # If this is a stored fact, include category and content
                        category = metadata.get("category") or metadata.get("type") or None
                        if content:
                            if category:
                                memory_strings.append(f"Fact ({category}): {content}")
                            else:
                                memory_strings.append(f"Fact: {content}")
                            continue

                        # Fallback: if conversation-style metadata exists, include user/assistant snippets
                        user_msg = metadata.get("user_message", "")
                        assistant_msg = metadata.get("assistant_response", "")
                        if user_msg and assistant_msg:
                            memory_strings.append(f"Previous conversation: User: {user_msg} | Assistant: {assistant_msg}")

                    if memory_strings:
                        memory_context = "\n".join(memory_strings[:3])  # Limit context length
                        
            except Exception as e:
                print(f"Error retrieving memories: {e}")
                memory_context = ""

        # Build chat message array
        system_prompt = (
            "You are Mira, a warm, helpful assistant. Keep answers concise and friendly."
        )
        
        if memory_context:
            system_prompt += f"\n\nRelevant context from previous conversations:\n{memory_context}"
        
        messages: List[Dict[str, Any]] = [
            {
                "role": "system",
                "content": system_prompt,
            },
        ]        # Add history
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
            # Debug: log the memory context being passed to the model so we can
            # confirm the LLM receives stored facts. Truncate to avoid huge logs.
            try:
                logging.info(f"text_query_pipeline: memory_context_len={len(memory_context)} preview={memory_context[:1000]}")
            except Exception:
                pass

            comp = oa.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.8,
                max_tokens=300,
            )
            response_text = (comp.choices[0].message.content or "I'm here to help!").strip()
            # Debug: log a short preview of the LLM response so we can inspect unexpected empty replies
            try:
                logging.info(f"LLM reply preview: {response_text[:240]}")
            except Exception:
                pass
        except Exception as e:
            print(f"Error generating response: {e}")
            response_text = "Sorry, I encountered an issue generating a response."
        
        # Store conversation in memory (async, don't wait)
        if user_id and user_id != "anonymous" and response_text != "Sorry, I encountered an issue generating a response.":
            if memory_manager:
                # Fire and forget - don't wait for completion
                asyncio.create_task(memory_manager.store_conversation(
                    user_id=user_id,
                    user_message=user_input,
                    assistant_response=response_text
                ))

            # Analyze conversation for learning (async)
            if intelligent_learner:
                asyncio.create_task(intelligent_learner.analyze_conversation(
                    user_id=user_id,
                    user_message=user_input,
                    assistant_response=response_text
                ))
        
        # Optionally include raw model payload when debugging
        debug_mode = os.getenv("DEBUG_TEXT_QUERY", "") == "1"
        out = {"text": response_text, "userText": user_input}
        if debug_mode:
            try:
                out["_raw"] = {
                    "choices": [c.to_dict() if hasattr(c, 'to_dict') else str(c) for c in getattr(comp, 'choices', [])],
                }
            except Exception:
                out["_raw"] = "<unavailable>"

        return JSONResponse(out)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text query pipeline failed: {e}")
    
@router.post("/voice")
async def voice_pipeline(
    request: Request,
    audio: UploadFile = File(...),
    history: Optional[str] = Form(None),
    token: Optional[str] = Form(None),
    metadata: Optional[str] = Form(None),
    auth: Optional[str] = Form(None),
):
    """
    Accepts recorded audio, transcribes with Whisper, generates a chat reply, and optional TTS audio.
    Returns a JSON body compatible with the frontend voice handler.
    """
    # Extract Authorization token from headers or form (frontend may send token in form-data)
    headers = request.headers
    # Debug: log header names so we can see if Authorization is arriving (do not log values)
    try:
        header_names = list(headers.keys())
        logging.info(f"voice_pipeline: received headers: {header_names}")
        logging.info(f"voice_pipeline: has 'authorization' header? {'authorization' in (h.lower() for h in header_names)}")
    except Exception:
        pass
    auth_header = headers.get("authorization")
    # if frontend provided an explicit `auth` or `authorization` form field, prefer that
    if not auth_header and auth:
        auth_header = auth if auth.startswith("Bearer ") else f"Bearer {auth}"

    if not auth_header and token:
        # token provided in form-data; construct Bearer header for downstream helpers
        auth_header = f"Bearer {token}"

    # Preserve raw metadata form (if provided) for fallback uid extraction
    metadata_raw = metadata

    user_token = None
    if auth_header:
        user_token = auth_header.replace("Bearer ", "")

    if not user_token:
        # fallback for local development
        user_token = os.getenv("TEST_USER_TOKEN", "local-dev-token")
    else:
        # Optional masked debug: show that a token was received without printing the whole secret
        try:
            if os.getenv("DEV_DEBUG_TOKENS") == "1":
                masked = (user_token[:8] + "...") if len(user_token) > 8 else user_token
                logging.info(f"voice_pipeline: received token (masked)={masked}")
        except Exception:
            pass
    
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

        # Extract user ID from authorization header (preferred)
        user_id = None
        if auth_header:
            try:
                user_id = get_uid_from_token(auth_header)
            except Exception as e:
                print(f"Could not extract user ID from token: {e}")
                user_id = None

        # If we couldn't resolve a user_id via token, try common fallbacks
        if not user_id or user_id == "anonymous":
            # 1) Check common debug header (x-user-id)
            header_user = request.headers.get("x-user-id") or request.headers.get("x-userid") or request.headers.get("x-uid")
            if header_user:
                user_id = header_user
                logging.info(f"voice_pipeline: resolved user_id from header x-user-id: {user_id}")

        if (not user_id or user_id == "anonymous") and metadata_raw:
            try:
                # Log a short preview of metadata for debugging (do not log full secrets)
                try:
                    preview = (metadata_raw[:200] + '...') if isinstance(metadata_raw, str) and len(metadata_raw) > 200 else str(metadata_raw)
                    logging.info(f"voice_pipeline: metadata preview: {preview}")
                except Exception:
                    pass

                md = json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw

                # Try a few common shapes
                possible = None
                if isinstance(md, dict):
                    possible = md.get("userId") or md.get("user_id") or md.get("uid") or md.get("id")
                    if not possible:
                        # nested shapes: {"user": {"id": "..."}} or {"meta": {"userId": "..."}}
                        user_obj = md.get("user") or md.get("meta") or md.get("payload")
                        if isinstance(user_obj, dict):
                            possible = user_obj.get("id") or user_obj.get("userId") or user_obj.get("user_id")

                if possible:
                    user_id = str(possible)
                    try:
                        logging.info(f"voice_pipeline: resolved user_id from metadata: {user_id}")
                    except Exception:
                        pass
            except Exception:
                # ignore parse failures
                pass

        if not user_id:
            user_id = "anonymous"
        
        # Get memory service (handle gracefully if modules don't exist)
        memory_service = get_memory_service() if get_memory_service else None
        memory_manager = get_memory_manager() if get_memory_manager else None
        intelligent_learner = get_intelligent_learner() if get_intelligent_learner else None

        # Debug: show whether memory components are available and the resolved user_id
        try:
            logging.info(f"voice_pipeline: user_id={user_id} memory_service={'yes' if memory_service else 'no'} memory_manager={'yes' if memory_manager else 'no'} learner={'yes' if intelligent_learner else 'no'}")
        except Exception:
            pass

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
            # âœ… Extract token sent from frontend (if any)


            if not user_token:
                print("âš ï¸ No token found in request or env; using mock local token.")
                user_token = "local-dev-token"
            else:
                print("âœ… Using user_token from frontend (truncated):", user_token[:12], "...")


            steps = []
            if has_email_intent:
                steps.append({"id": "emails", "label": "Checking your inbox for priority emails..."})
            if has_calendar_intent:
                steps.append({"id": "calendar", "label": "Reviewing today's calendar events..."})
                steps.append({"id": "highlights", "label": "Highlighting the most important meetings..."})
            if has_email_intent and has_calendar_intent:
                steps.append({"id": "conflicts", "label": "Noting any schedule conflicts..."})

            # âœ… Fetch live data from dashboard routes
            emails, calendar_events = await fetch_dashboard_data(user_token, has_email_intent, has_calendar_intent)

            action_data = {
                "steps": steps,
                "emails": emails if has_email_intent else [],
                "calendarEvents": calendar_events if has_calendar_intent else [],
                "focus": (
                    "You have upcoming events and important unread emails â€” review your schedule and respond accordingly."
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

        # Retrieve relevant memories for context
        memory_context = ""
        personalization_context = ""
        if user_id and user_id != "anonymous":
            try:
                # Fetch memory context if memory manager is available (don't require learner)
                if memory_manager:
                    memory_context = memory_manager.get_relevant_context(
                        user_id=user_id,
                        query=user_input,
                        max_memories=3
                    )

                # Get personalization context only if intelligent learner is present
                if intelligent_learner:
                    try:
                        personalization_context = intelligent_learner.get_personalization_context(
                            user_id=user_id,
                            current_query=user_input
                        )
                    except Exception:
                        personalization_context = ""
            except Exception as e:
                print(f"Error retrieving memories: {e}")
                memory_context = ""
                personalization_context = ""

        # 3) Build chat message array
        system_prompt = """You are Mira, a warm and expressive voice-first AI assistant. Speak naturally, like a real human, with emotions coming through your words, tone, and rhythm â€” warm, caring, curious, or confident depending on the situation.

Guidelines:

Keep replies concise (1â€“3 sentences).

Write like you're talking, not typing â€” use contractions ("I'm", "you're"), natural pauses ("wellâ€¦", "you know?"), and varied rhythm.

Show emotion through how you phrase sentences, your choice of words, and pacing. Make happiness, excitement, curiosity, sarcasm, empathy, or mischief come through naturally.

Keep warmth, clarity, and a friendly human flow in every response.

Example styles:

Friendly: "Hey! It's so great to hear from you, Iâ€™ve been looking forward to this."

Calm: "Take your time, thereâ€™s no rush, Iâ€™m here with you."

Excited: "Oh wow! Thatâ€™s incredible, I canâ€™t believe it!"

Empathetic: "I know this is toughâ€¦ I really understand how you feel."

Curious: "Really? Tell me more, Iâ€™m intrigued."

Mischievous: "Oh, I see what you did thereâ€¦ clever move!"""

        if memory_context:
            system_prompt += f"\n\nRelevant context from previous conversations:\n{memory_context}"

        messages: List[Dict[str, Any]] = [
            {
                "role": "system",
                "content": system_prompt,
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
            # Debug: log the memory_context passed into the voice LLM so we can
            # verify that retrieved facts are actually included in the prompt.
            try:
                logging.info(f"voice_pipeline: memory_context_len={len(memory_context)} preview={memory_context[:1000]}")
            except Exception:
                pass

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

        # Store conversation in memory (async, don't wait)
        if user_id and user_id != "anonymous" and response_text not in ["I'm here.", "Sorry, something went wrong while generating my response."]:
            # Prefer internal memory manager if available (still a no-op for conversations)
            if memory_manager:
                try:
                    asyncio.create_task(memory_manager.store_conversation(
                        user_id=user_id,
                        user_message=user_input,
                        assistant_response=response_text
                    ))
                    try:
                        print(f"voice_pipeline: scheduled memory_manager.store_conversation for user_id={user_id}")
                    except Exception:
                        pass
                except Exception as e:
                    print(f"voice_pipeline: failed to schedule memory_manager.store_conversation: {e}")

            # Fallback to memory service async call (kept for compatibility)
            if memory_service:
                try:
                    asyncio.create_task(memory_service.store_conversation_memory_async(
                        user_id=user_id,
                        user_message=user_input,
                        assistant_response=response_text
                    ))
                    try:
                        print(f"voice_pipeline: scheduled memory_service.store_conversation_memory_async for user_id={user_id}")
                    except Exception:
                        pass
                except Exception as e:
                    print(f"voice_pipeline: failed to schedule memory_service.store_conversation_memory_async: {e}")

            # Ask the intelligent learner to analyze and store any fact-level insights
            if intelligent_learner:
                try:
                    asyncio.create_task(intelligent_learner.analyze_conversation(
                        user_id=user_id,
                        user_message=user_input,
                        assistant_response=response_text
                    ))
                    try:
                        print(f"voice_pipeline: scheduled intelligent_learner.analyze_conversation for user_id={user_id}")
                    except Exception:
                        pass
                except Exception as e:
                    print(f"voice_pipeline: failed to schedule intelligent_learner.analyze_conversation: {e}")

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


@router.post("/debug/uid")
async def debug_uid(request: Request, token: Optional[str] = Form(None)):
    """Dev helper: resolve a Bearer token to a user id using get_uid_from_token.

    Accepts Authorization header or a form field `token` (multipart/form-data).
    Returns JSON { "uid": "..." } or { "error": "..." } with a 400 status on failure.
    """
    auth_header = request.headers.get("authorization")
    if not auth_header and token:
        auth_header = f"Bearer {token}"

    if not auth_header:
        return JSONResponse({"error": "no token provided"}, status_code=400)

    try:
        uid = get_uid_from_token(auth_header)
        return JSONResponse({"uid": uid})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)