"""
REST API FastAPI app for AWS Lambda
All endpoints EXCEPT WebSocket voice
"""
from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

# Import all routers EXCEPT voice
from auth import router as auth_router
from greetings import router as greetings_router
from tts_server import router as tts_router
from gmail_events import router as gmail_events
from settings import router as settings_router
from text_query_api import router as text_query_router
from gmail_reader import router as gmail_reader
from payments import router as stripe_router
from morning_brief_api import router as morning_brief_router
from temp import router as weather_router
from Google_Calendar_API import register_google_calendar
from dashboard_api import router as dashboard_router
from memory_test import router as memory_test_router

# Optional routers
try:
    from memory_router import router as memory_router, debug_router as memory_debug_router
except Exception:
    memory_router = None
    memory_debug_router = None

try:
    from calendar_actions import router as calendar_actions_router
except Exception:
    calendar_actions_router = None

app = FastAPI(title="MIRA Backend API (Lambda)")

# CORS configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
WEBSOCKET_URL = os.getenv("WEBSOCKET_URL", "http://localhost:8001")  # App Runner URL

allowed_origins = list(set([
    "http://localhost:3000",
    FRONTEND_URL,
    WEBSOCKET_URL,
    "https://main.dd480r9y8ima.amplifyapp.com"
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers EXCEPT voice_router
app.include_router(auth_router)
app.include_router(greetings_router)
app.include_router(tts_router)
app.include_router(gmail_events)
app.include_router(text_query_router, prefix="/api")
app.include_router(settings_router)

if memory_router is not None:
    app.include_router(memory_router, prefix="/api/memory")

if memory_debug_router is not None and os.getenv("MEMORY_DEBUG_ENABLED", "").lower() in ("1", "true", "yes"):
    app.include_router(memory_debug_router)

app.include_router(memory_test_router)
app.include_router(stripe_router, prefix="/api")
app.include_router(weather_router)
register_google_calendar(app)
app.include_router(gmail_reader)
app.include_router(morning_brief_router)
app.include_router(dashboard_router)

if calendar_actions_router is not None:
    app.include_router(calendar_actions_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "service": "MIRA Backend API",
        "status": "running",
        "deployment": "AWS Lambda",
        "websocket_service": os.getenv("WEBSOCKET_URL", "not-configured")
    }

@app.get("/envcheck")
async def env_check():
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    return {
        "ELEVENLABS_API_KEY": bool(api_key),
        "ELEVENLABS_API_KEY_length": len(api_key) if api_key else 0,
        "ELEVENLABS_API_KEY_preview": f"{api_key[:10]}...{api_key[-4:]}" if len(api_key) > 14 else "***",
        "ELEVENLABS_API_KEY_starts_with_sk": api_key.startswith("sk_") if api_key else False,
        "ELEVENLABS_VOICE_ID": os.getenv("ELEVENLABS_VOICE_ID"),
        "WEBSOCKET_URL": os.getenv("WEBSOCKET_URL", "not-configured"),
    }

@app.get("/memory-debug", response_class=HTMLResponse)
async def memory_debug_page():
    if os.getenv("MEMORY_DEBUG_ENABLED", "").lower() not in ("1", "true", "yes"):
        return HTMLResponse(content="<html><body><h1>Not found</h1></body></html>", status_code=404)

    html = "\n".join([
        "<!doctype html>",
        "<html>",
        "  <head>",
        "    <meta charset=\"utf-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
        "    <title>MIRA Memory Debug</title>",
        "    <style>body{font-family:Arial,Helvetica,sans-serif;max-width:900px;margin:18px auto;padding:12px}</style>",
        "  </head>",
        "  <body>",
        "    <h1>MIRA Memory Debug</h1>",
        "    <p>Debug UI enabled. This page is gated and intended for developer testing only.</p>",
        "    <label for=\"debug_uid\">Debug User ID (optional)</label>",
        "    <input id=\"debug_uid\" placeholder=\"user id (e.g. 8a1b2c3d-...)\" />",
        "    <p>Use the ordinary API endpoints (e.g. POST /api/memory/add_fact) with the optional debug UID to exercise memory flows.</p>",
        "  </body>",
        "</html>",
    ])

    return HTMLResponse(content=html)

