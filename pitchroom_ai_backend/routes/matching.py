from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.database.mongo import get_db
from pitchroom_ai_backend.models.script import ScriptOut, ScriptSearchResponse
from pitchroom_ai_backend.services.matching_service import MatchingService
from pitchroom_ai_backend.ai.gemini_client import GeminiClient
from pitchroom_ai_backend.utils.deps import get_current_user
from pitchroom_ai_backend.utils.serializers import script_to_output


router = APIRouter(prefix="/match", tags=["matching"])
matching_service = MatchingService(gemini_client=GeminiClient())


@router.get("/scripts_for_producer", response_model=ScriptSearchResponse)
async def scripts_for_producer(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ScriptSearchResponse:
    rows = await matching_service.scripts_for_producer(db, str(current_user["_id"]), limit)
    return ScriptSearchResponse(items=[ScriptOut(**script_to_output(row)) for row in rows])
