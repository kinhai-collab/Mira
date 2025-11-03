from fastapi import APIRouter, Query
from .morning_brief import run_morning_brief

router = APIRouter(prefix="/api/scenarios/morning-brief", tags=["Morning Brief"])

@router.get("/")
async def morning_brief(user_id: str = "demo", user_name: str = "Anusha", tz: str = "America/New_York"):
    result = run_morning_brief(user_id, user_name, tz)
    return result
