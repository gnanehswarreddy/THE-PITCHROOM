from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.database.mongo import get_db
from pitchroom_ai_backend.models.auth import AuthResponse, LoginRequest, RegisterRequest
from pitchroom_ai_backend.services.auth_service import auth_service


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> AuthResponse:
    token = await auth_service.register(db, payload.model_dump())
    return AuthResponse(access_token=token)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> AuthResponse:
    token = await auth_service.login(db, payload.email, payload.password)
    return AuthResponse(access_token=token)
