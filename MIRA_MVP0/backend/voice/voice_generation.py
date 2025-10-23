import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from elevenlabs import ElevenLabs

router = APIRouter()

# Initialize ElevenLabs client with API key
client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

@router.get("/voice")
async def generate_voice(text: str = "Hello from Mira!"):
    """
    Generates spoken audio from the given text using ElevenLabs.
    Returns an MP3 stream that the frontend can directly play.
    """
    try:
        voice_id = os.getenv("ELEVENLABS_VOICE_ID")
        if not voice_id:
            raise HTTPException(status_code=500, detail="Missing ELEVENLABS_VOICE_ID")

        # Request the audio stream
        audio_stream = client.text_to_speech.convert(
            voice_id=voice_id,
            model_id="eleven_turbo_v2",
            text=text,
            output_format="mp3_44100_128",
        )

        # Combine all chunks into one binary MP3 blob
        audio_bytes = b"".join(list(audio_stream))

        # Return as stream response (works with frontend fetch)
        return StreamingResponse(iter([audio_bytes]), media_type="audio/mpeg")

    except Exception as e:
        print("Error generating voice:", e)
        raise HTTPException(status_code=500, detail=f"Voice generation failed: {e}")
