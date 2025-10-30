from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
import httpx
import base64

load_dotenv()
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID",)

router = APIRouter(prefix="/tts", tags=["Text-to-Speech"])

class TextToSpeechRequest(BaseModel):
    text: str
    mood: Optional[str] = None
    use_ssml: Optional[bool] = True

@router.post("/tts")
async def generate_speech(request: TextToSpeechRequest):
    """
    Generate speech with mood-based voice modulation
    
    Parameters:
    - text: The text or SSML to speak
    - mood: Optional mood - auto-adjusts voice settings
      Options: excited, calm, sad, angry, neutral, happy, serious, whisper
    - use_ssml: Enable SSML tags for prosody control
    
    Examples:
    
    1. Simple text (neutral mood):
    {"text": "Hello, how are you today?"}
    
    2. With mood:
    {"text": "I'm so excited to see you!", "mood": "excited"}
    
    3. With SSML:
    {"text": "Hello! <break time='500ms'/> How are you?", "use_ssml": true}
    
    4. Combined:
    {"text": "That's <emphasis>amazing</emphasis>!", "mood": "excited", "use_ssml": true}
    """
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")
    
    # Enhanced mood-based parameter mapping
    mood_settings = {
        "excited": {
            "stability": 0.25,  # Lower for more variation
            "style": 0.75,
            "similarity_boost": 0.80,  # Higher for more character
            "speed": 1.1  # Slightly faster
        },
        "calm": {
            "stability": 0.85,  # Higher for smoother delivery
            "style": 0.15,
            "similarity_boost": 0.70,
            "speed": 0.9  # Slightly slower
        },
        "sad": {
            "stability": 0.70,
            "style": 0.25,
            "similarity_boost": 0.65,
            "speed": 0.85  # Slower, more contemplative
        },
        "angry": {
            "stability": 0.30,  # More variation for intensity
            "style": 0.85,
            "similarity_boost": 0.85,
            "speed": 1.15  # Faster, more aggressive
        },
        "neutral": {
            "stability": 0.55,  # Balanced
            "style": 0.35,
            "similarity_boost": 0.75,
            "speed": 1.0
        },
        "happy": {
            "stability": 0.35,
            "style": 0.65,
            "similarity_boost": 0.80,
            "speed": 1.05  # Slightly upbeat
        },
        "serious": {
            "stability": 0.75,
            "style": 0.20,
            "similarity_boost": 0.70,
            "speed": 0.95  # Deliberate pace
        },
        "whisper": {
            "stability": 0.85,  # Very stable for intimacy
            "style": 0.05,
            "similarity_boost": 0.60,
            "speed": 0.9
        },
        "energetic": {
            "stability": 0.20,
            "style": 0.80,
            "similarity_boost": 0.85,
            "speed": 1.2
        },
        "thoughtful": {
            "stability": 0.80,
            "style": 0.30,
            "similarity_boost": 0.70,
            "speed": 0.88
        }
    }
    
    # Use mood settings or default to neutral
    if request.mood and request.mood.lower() in mood_settings:
        settings = mood_settings[request.mood.lower()]
        final_stability = settings["stability"]
        final_style = settings["style"]
        final_similarity = settings["similarity_boost"]
        final_speed = settings.get("speed", 1.0)
    else:
        # Default to neutral
        final_stability = 0.55
        final_style = 0.35
        final_similarity = 0.75
        final_speed = 1.0
    
    # Add natural pauses and breathing if not using custom SSML
    processed_text = request.text
    if not request.use_ssml or '<break' not in request.text.lower():
        # Add subtle pauses after punctuation for more natural speech
        import re
        processed_text = re.sub(r'([.!?])\s+', r'\1 <break time="300ms"/> ', processed_text)
        processed_text = re.sub(r'([,;:])\s+', r'\1 <break time="150ms"/> ', processed_text)
    
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    data = {
        "text": processed_text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": final_stability,
            "similarity_boost": final_similarity,
            "style": final_style,
            "use_speaker_boost": True
        },
        "apply_text_normalization": "on",
        "pronunciation_dictionary_locators": []  # Can add custom pronunciations
    }

    # Add speed adjustment if supported by ElevenLabs plan
    if final_speed != 1.0:
        # Wrap text with prosody for speed control
        data["text"] = f'<prosody rate="{int(final_speed * 100)}%">{data["text"]}</prosody>'

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to generate speech")
        
        # Encode audio to base64
        audio_base64 = base64.b64encode(response.content).decode('utf-8')
        
        return {
            "audio": audio_base64,
            "format": "mp3",
            "encoding": "base64"
        }

@router.get("/tts")
async def generate_speech_get(
    text: str, 
    mood: str = None,
    use_ssml: bool = True
):
    """
    Generate speech with mood-based voice modulation (GET method for browser testing)
    
    Returns streaming audio that plays directly in browser.
    
    Example: /tts/tts?text=Hello%20world&mood=excited
    
    Available moods: excited, calm, sad, angry, neutral, happy, serious, whisper, energetic, thoughtful
    """
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")
    
    # Enhanced mood-based parameter mapping
    mood_settings = {
        "excited": {
            "stability": 0.25,
            "style": 0.75,
            "similarity_boost": 0.80,
            "speed": 1.1
        },
        "calm": {
            "stability": 0.85,
            "style": 0.15,
            "similarity_boost": 0.70,
            "speed": 0.9
        },
        "sad": {
            "stability": 0.70,
            "style": 0.25,
            "similarity_boost": 0.65,
            "speed": 0.85
        },
        "angry": {
            "stability": 0.30,
            "style": 0.85,
            "similarity_boost": 0.85,
            "speed": 1.15
        },
        "neutral": {
            "stability": 0.55,
            "style": 0.35,
            "similarity_boost": 0.75,
            "speed": 1.0
        },
        "happy": {
            "stability": 0.35,
            "style": 0.65,
            "similarity_boost": 0.80,
            "speed": 1.05
        },
        "serious": {
            "stability": 0.75,
            "style": 0.20,
            "similarity_boost": 0.70,
            "speed": 0.95
        },
        "whisper": {
            "stability": 0.85,
            "style": 0.05,
            "similarity_boost": 0.60,
            "speed": 0.9
        },
        "energetic": {
            "stability": 0.20,
            "style": 0.80,
            "similarity_boost": 0.85,
            "speed": 1.2
        },
        "thoughtful": {
            "stability": 0.80,
            "style": 0.30,
            "similarity_boost": 0.70,
            "speed": 0.88
        }
    }
    
    # Use mood settings or default to neutral
    if mood and mood.lower() in mood_settings:
        settings = mood_settings[mood.lower()]
        final_stability = settings["stability"]
        final_style = settings["style"]
        final_similarity = settings["similarity_boost"]
        final_speed = settings.get("speed", 1.0)
    else:
        # Default to neutral
        final_stability = 0.55
        final_style = 0.35
        final_similarity = 0.75
        final_speed = 1.0
    
    # Add natural pauses and breathing if not using custom SSML
    processed_text = text
    if not use_ssml or '<break' not in text.lower():
        # Add subtle pauses after punctuation for more natural speech
        import re
        processed_text = re.sub(r'([.!?])\s+', r'\1 <break time="300ms"/> ', processed_text)
        processed_text = re.sub(r'([,;:])\s+', r'\1 <break time="150ms"/> ', processed_text)
    
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    data = {
        "text": processed_text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": final_stability,
            "similarity_boost": final_similarity,
            "style": final_style,
            "use_speaker_boost": True
        },
        "apply_text_normalization": "on",
        "pronunciation_dictionary_locators": []
    }
    
    # Add speed adjustment if supported
    if final_speed != 1.0:
        # Wrap text with prosody for speed control
        data["text"] = f'<prosody rate="{int(final_speed * 100)}%">{data["text"]}</prosody>'
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to generate speech")
        
        # Return streaming audio for direct playback
        return StreamingResponse(
            iter([response.content]),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3"
            }
        )