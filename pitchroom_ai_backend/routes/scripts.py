from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.database.mongo import get_db
from pitchroom_ai_backend.models.script import ScriptOut, ScriptSearchResponse, ScriptUploadRequest
from pitchroom_ai_backend.services.recommendation_service import recommendation_service
from pitchroom_ai_backend.services.script_service import script_service
from pitchroom_ai_backend.utils.deps import get_current_user
from pitchroom_ai_backend.utils.serializers import script_to_output


router = APIRouter(tags=["scripts"])


@router.post("/upload_script", response_model=ScriptOut)
async def upload_script(
    payload: ScriptUploadRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ScriptOut:
    script = await script_service.upload_script(db, current_user, payload.model_dump())
    return ScriptOut(**script_to_output(script))


@router.get("/trending", response_model=ScriptSearchResponse)
async def trending(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ScriptSearchResponse:
    rows = await script_service.trending(db, limit)
    return ScriptSearchResponse(items=[ScriptOut(**script_to_output(row)) for row in rows])


@router.get("/recommendations", response_model=ScriptSearchResponse)
async def recommendations(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ScriptSearchResponse:
    rows = await recommendation_service.recommend_for_user(db, str(current_user["_id"]), limit)
    return ScriptSearchResponse(items=[ScriptOut(**script_to_output(row)) for row in rows])


@router.get("/search", response_model=ScriptSearchResponse)
async def search(
    query: str = Query(min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ScriptSearchResponse:
    rows = await script_service.semantic_search(db, query, limit)
    return ScriptSearchResponse(items=[ScriptOut(**script_to_output(row)) for row in rows])
