from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import os, json, asyncio
from conversation_manager import respond_with_memory
from settings import get_uid_from_token

# Optional imports
try:
    from memory_manager import get_memory_manager
except Exception:
    get_memory_manager = None

try:
    from intelligent_learner import get_intelligent_learner
except Exception:
    get_intelligent_learner = None

router = APIRouter()


# NOTE: This endpoint has been moved to voice/voice_generation.py to support email/calendar summaries
# The /api/text-query route is now handled by voice_router which includes:
# - Email and calendar intent detection
# - Dynamic fetching from both Gmail/Outlook and Google Calendar/Outlook Calendar
# - Full dashboard integration
#
# @router.post("/text-query")
# async def text_query(request: Request):
#     ... (removed - use voice_generation.py endpoint instead)
