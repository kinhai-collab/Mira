import os
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
            import base64
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

def generate_voice(text: str) -> str:
    """
    Generates audio from text and saves it to a file.
    Returns the file path to the generated audio.
    This is a synchronous utility function for use in non-async contexts.
    """
    try:
        # Get the ElevenLabs client (with lazy import)
        elevenlabs_client = get_elevenlabs_client()
        
        voice_id = os.getenv("ELEVENLABS_VOICE_ID")
        if not voice_id:
            print("Warning: ELEVENLABS_VOICE_ID not set, skipping audio generation")
            return ""
        
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
            return ""
        
        # Save to a file with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"morning_brief_{timestamp}.mp3"
        filepath = os.path.join(os.getcwd(), "speech", filename)
        
        # Create speech directory if it doesn't exist
        os.makedirs(os.path.join(os.getcwd(), "speech"), exist_ok=True)
        
        # Write audio to file
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        
        print(f"Audio saved to: {filepath}")
        return filepath
        
    except Exception as e:
        print(f"Error generating voice: {e}")
        import traceback
        traceback.print_exc()
        return ""
