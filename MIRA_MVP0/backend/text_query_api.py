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


@router.post("/text-query")
async def text_query(request: Request):
    data = await request.json()
    print("📩 Incoming text-query data:", data)

    user_input = data.get("query", "").strip()
    history = data.get("history", [])

    # Resolve token preferring body token then Authorization header
    user_id = None
    token = data.get("token") or data.get("auth")
    if token:
        try:
            user_id = get_uid_from_token(f"Bearer {token}")
            print("DEBUG: resolved user_id from request body token", user_id)
        except Exception as e:
            print(f"Could not extract user ID from body token: {e}")
            user_id = None

    if not user_id:
        auth_header = request.headers.get("authorization")
        if auth_header:
            try:
                user_id = get_uid_from_token(auth_header)
            except Exception as e:
                print(f"Could not extract user ID from header token: {e}")
                user_id = "anonymous"

    memory_manager = get_memory_manager() if get_memory_manager else None
    intelligent_learner = get_intelligent_learner() if get_intelligent_learner else None

    try:
        print(f"DEBUG: about to call respond_with_memory user_id={user_id} input={user_input[:80]}")
        result = respond_with_memory(
            user_id=user_id,
            user_input=user_input,
            history=history if isinstance(history, list) else None,
            memory_manager=memory_manager,
            intelligent_learner=intelligent_learner,
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            max_memories=3,
        )
        print(f"DEBUG: respond_with_memory returned keys={list(result.keys())}")
        return JSONResponse({"text": result.get("response_text"), "userText": user_input})
    except Exception as e:
        print(f"Error in text-query handler: {e}")
        raise HTTPException(status_code=500, detail=str(e))
