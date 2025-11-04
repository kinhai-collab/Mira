from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from auth import router as auth_router 
from greetings import router as greetings_router
from tts_server import router as tts_router
from gmail_events import router as gmail_events
from outlook_events import router as outlook_events
from voice.voice_generation import router as voice_router
from settings import router as settings
from morning_brief_api import router as morning_brief_router
from Google_Calendar_API import register_google_calendar
app = FastAPI()

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://main.dd480r9y8ima.amplifyapp.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routes
app.include_router(auth_router)
app.include_router(greetings_router)
app.include_router(tts_router)
app.include_router(gmail_events)
app.include_router(voice_router, prefix="/api")
app.include_router(settings)
register_google_calendar(app)
app.include_router(outlook_events)
app.include_router(morning_brief_router)


@app.get("/envcheck")
async def env_check():
    import os
    return {
        "ELEVENLABS_API_KEY": bool(os.getenv("ELEVENLABS_API_KEY")),
        "ELEVENLABS_VOICE_ID": os.getenv("ELEVENLABS_VOICE_ID")
    }
