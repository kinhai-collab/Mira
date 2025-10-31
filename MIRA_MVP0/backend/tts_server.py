# tts_server.py — Safe multilingual long-form TTS for Mira

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import os, re, base64, unicodedata
from dotenv import load_dotenv
import httpx

load_dotenv()
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")

router = APIRouter(prefix="/tts", tags=["Text-to-Speech"])

class TextToSpeechRequest(BaseModel):
    text: str
    mood: Optional[str] = "neutral"

@router.post("/tts")
async def generate_speech(req: TextToSpeechRequest):
    """Robust TTS with Unicode, markdown, and list cleaning."""
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="Missing ElevenLabs API key")

    # ---------------- Mood setup ----------------
    moods = {
        "excited": (0.25, 0.85, 0.7, 1.1),
        "calm": (0.9, 0.7, 0.2, 0.9),
        "neutral": (0.65, 0.8, 0.3, 1.0),
        "happy": (0.5, 0.85, 0.5, 1.05),
        "serious": (0.8, 0.75, 0.2, 0.95),
        "whisper": (0.9, 0.6, 0.05, 0.9),
    }
    st, sim, style, speed = moods.get(req.mood.lower(), moods["neutral"])

    # ---------------- Text normalization ----------------
    text = req.text.strip()
    # 1. Normalize unicode (convert á -> a, ñ -> n, etc.)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    # 2. Remove markdown, bullets, numbering
    text = re.sub(r"[*_#>`~]", "", text)
    text = re.sub(r"(?m)^\s*[-•]\s*", "", text)
    text = re.sub(r"(?m)^\s*\d+\.\s*", "", text)
    # 3. Collapse whitespace / newlines
    text = re.sub(r"\s+", " ", text)
    # 4. Replace section keywords
    text = re.sub(r"\bIngredients\b", "The ingredients are", text, flags=re.I)
    text = re.sub(r"\bInstructions\b", "The steps are as follows", text, flags=re.I)
    text = re.sub(r"\bEnjoy\b", "Enjoy your result", text, flags=re.I)
    # 5. Add mild pacing pauses
    text = re.sub(r"([.!?])\s+", r"\1 <break time='400ms'/> ", text)
    text = re.sub(r"([,;])\s+", r"\1 <break time='200ms'/> ", text)

    # ---------------- Split into safe chunks ----------------
    MAX_LEN = 800
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks, buf = [], ""
    for s in sentences:
        if len(buf) + len(s) < MAX_LEN:
            buf += " " + s
        else:
            chunks.append(buf.strip())
            buf = s
    if buf:
        chunks.append(buf.strip())

    if not chunks:
        raise HTTPException(status_code=400, detail="Empty text after cleaning")

    # ---------------- ElevenLabs call ----------------
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
    }

    combined = bytearray()
    async with httpx.AsyncClient(timeout=None) as client:
        for i, c in enumerate(chunks):
            payload = {
                "text": f"<prosody rate='{int(speed*100)}%'>{c}</prosody>",
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": st,
                    "similarity_boost": sim,
                    "style": style,
                    "use_speaker_boost": True,
                },
            }
            print(f"[TTS] Chunk {i+1}/{len(chunks)} - {len(c)} chars")
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code == 200:
                combined.extend(r.content)
                print(f"[TTS] ✅ Chunk {i+1} ok ({len(r.content)} bytes)")
            else:
                print(f"[TTS] ❌ Chunk {i+1} failed ({r.status_code}) {r.text[:100]}")

    if not combined:
        raise HTTPException(status_code=500, detail="TTS failed for all chunks")

    return {
        "audio": base64.b64encode(combined).decode(),
        "format": "mp3",
        "encoding": "base64",
    }


# ------------- Browser GET test -------------
@router.get("/tts")
async def test_tts(text: str = "Hello world"):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="Missing API key")

    clean = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    clean = re.sub(r"[*_#>`~]", "", clean)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    headers = {"Accept": "audio/mpeg", "Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY}
    data = {"text": clean, "model_id": "eleven_multilingual_v2", "voice_settings": {"stability": 0.6, "similarity_boost": 0.8, "style": 0.3}}

    async with httpx.AsyncClient() as c:
        r = await c.post(url, json=data, headers=headers)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        return StreamingResponse(iter([r.content]), media_type="audio/mpeg")
