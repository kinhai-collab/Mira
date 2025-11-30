"""
WebSocket-only FastAPI app for AWS App Runner
Handles real-time voice pipeline with ElevenLabs
"""
from dotenv import load_dotenv
load_dotenv()

import os
import asyncio
if os.name == "nt":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import only the voice router
from voice.voice_generation import router as voice_router

app = FastAPI(title="MIRA Voice WebSocket Service")

# CORS configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = list(set([
    "http://localhost:3000",
    FRONTEND_URL,
    "https://main.dd480r9y8ima.amplifyapp.com"  # Your Amplify frontend
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include ONLY the voice router
app.include_router(voice_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "service": "MIRA Voice WebSocket Service",
        "status": "running",
        "endpoints": {
            "websocket": "/api/ws/voice-stt"
        }
    }

@app.get("/health")
async def health():
    """Health check endpoint for App Runner"""
    return {"status": "healthy"}

