import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

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
                print("✅ Audio data appears to be valid MP3")
            else:
                print("❌ Audio data does not appear to be valid MP3")
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
                                print("✅ Decoded audio data appears to be valid MP3")
                                audio_bytes = decoded_bytes
                            else:
                                print("❌ Decoded data still doesn't look like MP3")
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
