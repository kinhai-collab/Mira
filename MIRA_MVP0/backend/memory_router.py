from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from typing import Any, Dict

from memory_service import get_memory_service

debug_router = APIRouter(prefix="/debug/memory", tags=["memory-debug"])


@debug_router.post("/add_fact")
async def add_fact(request: Request):
    """Add a fact for a user. JSON body: { user_id, fact, category (optional) }"""
    data: Dict[str, Any] = await request.json()
    user_id = data.get("user_id")
    fact = data.get("fact")
    category = data.get("category", "general")
    if not user_id or not fact:
        return JSONResponse({"error": "user_id and fact are required"}, status_code=400)

    ms = get_memory_service()
    try:
        mem_id = ms.upsert_fact_memory(user_id=user_id, fact=fact, category=category, importance=1)
    except Exception:
        mem_id = ms.store_fact_memory(user_id=user_id, fact=fact, category=category, importance=1)
    return JSONResponse({"memory_id": mem_id})


@debug_router.post("/get_context")
async def get_context(request: Request):
    """Get relevant context for a user/query. JSON body: { user_id, query, max (optional) }"""
    data: Dict[str, Any] = await request.json()
    user_id = data.get("user_id")
    query = data.get("query", "")
    max_memories = int(data.get("max", 3))
    if not user_id:
        return JSONResponse({"error": "user_id is required"}, status_code=400)

    ms = get_memory_service()
    ctx = ms.get_relevant_context(user_id=user_id, query=query, max_memories=max_memories)
    return JSONResponse({"context": ctx})


@debug_router.post("/get_user_memories")
async def get_user_memories(request: Request):
    """Return all memories for a user. JSON body: { user_id, memory_type (optional) }"""
    data: Dict[str, Any] = await request.json()
    user_id = data.get("user_id")
    memory_type = data.get("memory_type", "all")
    if not user_id:
        return JSONResponse({"error": "user_id is required"}, status_code=400)

    ms = get_memory_service()
    out = ms.get_user_memories(user_id=user_id, memory_type=memory_type)
    return JSONResponse({"memories": out})
from fastapi import APIRouter, HTTPException, Body, Header
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from memory_service import get_memory_service
from settings import get_uid_from_token
import os
import json

router = APIRouter()

@router.get("/memories")
async def get_user_memories(
    authorization: str = Header(None),
    memory_type: str = "fact",
    limit: int = 10
):
    """
    Get recent memories for the authenticated user.
    
    Query parameters:
    - memory_type: "conversation" or "fact" (default: "conversation")
    - limit: Maximum number of memories to return (default: 10)
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    try:
        user_id = get_uid_from_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    
    memory_service = get_memory_service()
    
    try:
        if memory_type != "fact":
            raise HTTPException(status_code=400, detail="Only 'fact' memory_type is supported")

        memories = memory_service.get_user_memories(user_id=user_id, memory_type="fact")

        # Format for API response
        formatted_memories = []
        for mem in memories:
            metadata = mem.get("metadata", {}) or {}
            formatted_memories.append({
                "id": metadata.get("id", ""),
                "content": mem.get("content", ""),
                "category": metadata.get("category", ""),
                "timestamp": metadata.get("timestamp", ""),
                "type": metadata.get("type", "fact")
            })

        return JSONResponse({
            "memories": formatted_memories,
            "count": len(formatted_memories)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving memories: {e}")

@router.post("/memories/search")
async def search_memories(
    query: str = Body(..., embed=True),
    memory_type: str = Body("fact", embed=True),
    limit: int = Body(5, embed=True),
    authorization: str = Header(None)
):
    """
    Search for relevant memories based on semantic similarity.
    
    Body parameters:
    - query: The search query
    - memory_type: "conversation" or "fact" (default: "conversation")
    - limit: Maximum number of results (default: 5)
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    try:
        user_id = get_uid_from_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    
    if not query or len(query.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")
    
    memory_service = get_memory_service()
    
    try:
        if memory_type != "fact":
            raise HTTPException(status_code=400, detail="Only 'fact' memory_type is supported for search")

        memories = memory_service.retrieve_relevant_memories(
            user_id=user_id,
            query=query.strip(),
            limit=limit,
            memory_type="fact"
        )

        # Format for API response
        formatted_memories = []
        for mem in memories:
            metadata = mem.get("metadata", {}) or {}
            formatted_memories.append({
                "content": mem.get("content", ""),
                "category": metadata.get("category", ""),
                "timestamp": metadata.get("timestamp", ""),
                "type": metadata.get("type", "fact"),
                "distance": mem.get("distance")
            })

        return JSONResponse({
            "query": query,
            "memories": formatted_memories,
            "count": len(formatted_memories)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching memories: {e}")

@router.post("/memories")
async def add_memory(
    content: str = Body(..., embed=True),
    memory_type: str = Body("fact", embed=True),
    category: str = Body("general", embed=True),
    importance: int = Body(1, embed=True),
    authorization: str = Header(None)
):
    """
    Add a new memory (fact or preference).
    
    Body parameters:
    - content: The memory content
    - memory_type: "fact" or "conversation" (default: "fact")
    - category: Category for facts (default: "general")
    - importance: Importance level 1-5 (default: 1)
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    try:
        user_id = get_uid_from_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    
    if not content or len(content.strip()) < 2:
        raise HTTPException(status_code=400, detail="Content must be at least 2 characters")
    
    if importance < 1 or importance > 5:
        raise HTTPException(status_code=400, detail="Importance must be between 1 and 5")
    
    memory_service = get_memory_service()
    
    try:
        if memory_type == "fact":
            memory_id = memory_service.store_fact_memory(
                user_id=user_id,
                fact=content.strip(),
                category=category,
                importance=importance
            )
        else:
            raise HTTPException(status_code=400, detail="Only 'fact' memory type is supported for manual addition. Conversation turns are not persisted.")
        
        return JSONResponse({
            "success": True,
            "memory_id": memory_id,
            "message": "Memory added successfully"
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding memory: {e}")


@router.post("/add_fact")
async def add_fact_debug(request: Request):
    """Compatibility debug endpoint: add a simple fact for a user.

    Body: { user_id, fact, category (optional) }
    This mirrors the older /debug/memory/add_fact used by the debug frontend; since
    `memory_router` is included under `/api/memory` in `main.py`, the full path is
    `/api/memory/add_fact`.
    """
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid json"}, status_code=400)

    user_id = data.get("user_id")
    fact = data.get("fact")
    category = data.get("category", "general")
    if not user_id or not fact:
        return JSONResponse({"error": "user_id and fact are required"}, status_code=400)

    ms = get_memory_service()
    try:
        mem_id = ms.store_fact_memory(user_id=user_id, fact=fact, category=category)
        return JSONResponse({"memory_id": mem_id})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.delete("/memories/{memory_id}")
async def delete_memory(
    memory_id: str,
    memory_type: str = "fact",
    authorization: str = Header(None)
):
    """
    Delete a specific memory.
    
    Path parameters:
    - memory_id: The ID of the memory to delete
    
    Query parameters:
    - memory_type: "conversation" or "fact" (default: "conversation")
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    try:
        user_id = get_uid_from_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    
    memory_service = get_memory_service()
    
    try:
        if memory_type != "fact":
            raise HTTPException(status_code=400, detail="Only 'fact' memory_type can be deleted")

        success = memory_service.delete_memory(
            memory_id=memory_id,
            memory_type="fact"
        )
        
        if success:
            return JSONResponse({
                "success": True,
                "message": "Memory deleted successfully"
            })
        else:
            raise HTTPException(status_code=404, detail="Memory not found")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting memory: {e}")

@router.delete("/memories")
async def clear_user_memories(
    authorization: str = Header(None)
):
    """
    Clear all memories for the authenticated user.
    This is a destructive operation and cannot be undone.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    try:
        user_id = get_uid_from_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    
    memory_service = get_memory_service()
    
    try:
        # Only clear facts per facts-only policy
        success = memory_service.clear_user_memories(user_id=user_id)

        if success:
            return JSONResponse({
                "success": True,
                "message": "All memories cleared successfully"
            })
        else:
            raise HTTPException(status_code=500, detail="Failed to clear memories")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing memories: {e}")


@router.post("/run_autopilot_debug")
async def run_autopilot_debug_endpoint(request: Request):
    """Debug endpoint to run the autopilot synchronously (dev only).

    Body: { user_id, user_message, assistant_response }
    """
    data: Dict[str, Any] = await request.json()
    user_id = data.get("user_id")
    user_message = data.get("user_message")
    assistant_response = data.get("assistant_response")
    if not user_id or not user_message or not assistant_response:
        return JSONResponse({"error": "user_id, user_message, assistant_response required"}, status_code=400)

    try:
        from memory_autopilot import run_autopilot_debug
    except Exception:
        return JSONResponse({"error": "Autopilot not available"}, status_code=404)

    try:
        res = run_autopilot_debug(user_id=user_id, user_message=user_message, assistant_response=assistant_response)
        return JSONResponse({"result": res})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@debug_router.post("/run_autopilot_debug")
async def run_autopilot_debug_endpoint_debug(request: Request):
    """Debug alias so the old /debug/memory/run_autopilot_debug path works (dev UI).

    Mirrors `/api/memory/run_autopilot_debug` behavior.
    """
    data: Dict[str, Any] = await request.json()
    user_id = data.get("user_id")
    user_message = data.get("user_message")
    assistant_response = data.get("assistant_response")
    if not user_id or not user_message or not assistant_response:
        return JSONResponse({"error": "user_id, user_message, assistant_response required"}, status_code=400)

    try:
        from memory_autopilot import run_autopilot_debug
    except Exception:
        return JSONResponse({"error": "Autopilot not available"}, status_code=404)

    try:
        res = run_autopilot_debug(user_id=user_id, user_message=user_message, assistant_response=assistant_response)
        return JSONResponse({"result": res})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/audit")
async def get_autopilot_audit():
    """Return the last 200 lines from the autopilot audit JSONL file for inspection."""
    audit_path = None
    try:
        base = os.path.join(os.getcwd(), "data", "autopilot")
        audit_path = os.path.join(base, "autopilot_audit.jsonl")
        if not os.path.exists(audit_path):
            return JSONResponse({"lines": []})

        # Read last N lines
        with open(audit_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        tail = lines[-200:]
        parsed = []
        for l in tail:
            try:
                parsed.append(json.loads(l))
            except Exception:
                parsed.append({"raw": l.strip()})
        return JSONResponse({"lines": parsed})
    except Exception as e:
        return JSONResponse({"error": str(e), "path": audit_path}, status_code=500)