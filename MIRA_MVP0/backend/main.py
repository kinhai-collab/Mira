from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

# Project routers
from auth import router as auth_router
from greetings import router as greetings_router
from tts_server import router as tts_router
from gmail_events import router as gmail_events
from voice.voice_generation import router as voice_router
from settings import router as settings
from gmail_reader import router as gmail_reader
from payments import router as stripe_router
from morning_brief_api import router as morning_brief_router
from temp import router as weather_router
from Google_Calendar_API import register_google_calendar
from dashboard_api import router as dashboard_router
import memory_router
from memory_test import router as memory_test_router


app = FastAPI()

# CORS configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = list(set(["http://localhost:3000", FRONTEND_URL]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(greetings_router)
app.include_router(tts_router)
app.include_router(gmail_events)
app.include_router(voice_router, prefix="/api")
app.include_router(settings)
app.include_router(memory_router.router, prefix="/api/memory")

# Debug-only router is opt-in via MEMORY_DEBUG_ENABLED
if os.getenv("MEMORY_DEBUG_ENABLED", "").lower() in ("1", "true", "yes"):
    app.include_router(memory_router.debug_router)

app.include_router(memory_test_router)
app.include_router(stripe_router, prefix="/api")
app.include_router(weather_router)
register_google_calendar(app)
app.include_router(gmail_reader)
app.include_router(morning_brief_router)
app.include_router(dashboard_router)


@app.get("/envcheck")
async def env_check():
    return {
        "ELEVENLABS_API_KEY": bool(os.getenv("ELEVENLABS_API_KEY")),
        "ELEVENLABS_VOICE_ID": os.getenv("ELEVENLABS_VOICE_ID"),
    }


@app.get("/memory-debug", response_class=HTMLResponse)
async def memory_debug_page():
    # Gate this page so it cannot be used in production unless explicitly enabled
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
from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

# Project routers
from auth import router as auth_router
from greetings import router as greetings_router
from tts_server import router as tts_router
from gmail_events import router as gmail_events
from voice.voice_generation import router as voice_router
from settings import router as settings
from gmail_reader import router as gmail_reader
from payments import router as stripe_router
from morning_brief_api import router as morning_brief_router
from temp import router as weather_router
from Google_Calendar_API import register_google_calendar
from dashboard_api import router as dashboard_router
import memory_router
from memory_test import router as memory_test_router


app = FastAPI()

# CORS configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = list(set(["http://localhost:3000", FRONTEND_URL]))
app.add_middleware(
  CORSMiddleware,
  allow_origins=allowed_origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(greetings_router)
app.include_router(tts_router)
app.include_router(gmail_events)
app.include_router(voice_router, prefix="/api")
app.include_router(settings)
app.include_router(memory_router.router, prefix="/api/memory")

# Debug-only router is opt-in via MEMORY_DEBUG_ENABLED
if os.getenv("MEMORY_DEBUG_ENABLED", "").lower() in ("1", "true", "yes"):
  app.include_router(memory_router.debug_router)

app.include_router(memory_test_router)
app.include_router(stripe_router, prefix="/api")
app.include_router(weather_router)
register_google_calendar(app)
app.include_router(gmail_reader)
app.include_router(morning_brief_router)
app.include_router(dashboard_router)


@app.get("/envcheck")
async def env_check():
  return {
    "ELEVENLABS_API_KEY": bool(os.getenv("ELEVENLABS_API_KEY")),
    "ELEVENLABS_VOICE_ID": os.getenv("ELEVENLABS_VOICE_ID"),
  }


@app.get("/memory-debug", response_class=HTMLResponse)
async def memory_debug_page():
  # Gate this page so it cannot be used in production unless explicitly enabled
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
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from auth import router as auth_router 
from greetings import router as greetings_router
from tts_server import router as tts_router
from gmail_events import router as gmail_events
# DISABLED: Outlook integration temporarily disabled due to authentication issues
# from outlook_events import router as outlook_events
from voice.voice_generation import router as voice_router
from settings import router as settings
from gmail_reader import router as gmail_reader
from payments import router as stripe_router
from morning_brief_api import router as morning_brief_router
from temp import router as weather_router
from Google_Calendar_API import register_google_calendar
from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

# Project routers
from auth import router as auth_router
from greetings import router as greetings_router
from tts_server import router as tts_router
from gmail_events import router as gmail_events
from voice.voice_generation import router as voice_router
from settings import router as settings
from gmail_reader import router as gmail_reader
from payments import router as stripe_router
from morning_brief_api import router as morning_brief_router
from temp import router as weather_router
from Google_Calendar_API import register_google_calendar
from dashboard_api import router as dashboard_router
import memory_router
from memory_test import router as memory_test_router


app = FastAPI()

# CORS configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = list(set(["http://localhost:3000", FRONTEND_URL]))
app.add_middleware(
  CORSMiddleware,
  allow_origins=allowed_origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(greetings_router)
app.include_router(tts_router)
app.include_router(gmail_events)
app.include_router(voice_router, prefix="/api")
app.include_router(settings)
app.include_router(memory_router.router, prefix="/api/memory")

# Debug-only router is opt-in via MEMORY_DEBUG_ENABLED
if os.getenv("MEMORY_DEBUG_ENABLED", "").lower() in ("1", "true", "yes"):
  app.include_router(memory_router.debug_router)

app.include_router(memory_test_router)
app.include_router(stripe_router, prefix="/api")
app.include_router(weather_router)
register_google_calendar(app)
app.include_router(gmail_reader)
app.include_router(morning_brief_router)
app.include_router(dashboard_router)


@app.get("/envcheck")
async def env_check():
  return {
    "ELEVENLABS_API_KEY": bool(os.getenv("ELEVENLABS_API_KEY")),
    "ELEVENLABS_VOICE_ID": os.getenv("ELEVENLABS_VOICE_ID"),
  }


@app.get("/memory-debug", response_class=HTMLResponse)
async def memory_debug_page():
  # Gate this page so it cannot be used in production unless explicitly enabled
  if os.getenv("MEMORY_DEBUG_ENABLED", "").lower() not in ("1", "true", "yes"):
    return HTMLResponse(content="<html><body><h1>Not found</h1></body></html>", status_code=404)

  html = "\n".join([
    "<!doctype html>",
    "<html>",
    "  <head>",
    "    <meta charset=\"utf-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "    <title>MIRA Memory Debug</title>",
    "  </head>",
    "  <body>",
    "    <h1>MIRA Memory Debug</h1>",
    "    <p>Debug UI enabled. Use the API endpoints to exercise memory flows.</p>",
    "    <label for=\"debug_uid\">Debug User ID (optional)</label>",
    "    <input id=\"debug_uid\" placeholder=\"user id (e.g. 8a1b2c3d-...)\" />",
    "  </body>",
    "</html>",
  ])

  return HTMLResponse(content=html)
    
