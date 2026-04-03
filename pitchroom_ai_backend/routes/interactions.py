from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.database.mongo import get_db
from pitchroom_ai_backend.models.interaction import InteractionRequest, InteractionResponse
from pitchroom_ai_backend.services.interaction_service import interaction_service
from pitchroom_ai_backend.utils.deps import get_current_user


router = APIRouter(prefix="/interact", tags=["interactions"])


@router.post("", response_model=InteractionResponse)
async def interact(
    payload: InteractionRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> InteractionResponse:
    await interaction_service.create_interaction(db, str(current_user["_id"]), payload.script_id, payload.type)
    return InteractionResponse(status="ok")
