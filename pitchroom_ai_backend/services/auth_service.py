from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.utils.security import create_access_token, hash_password, verify_password


class AuthService:
    async def register(self, db: AsyncIOMotorDatabase, payload: dict[str, Any]) -> str:
        existing = await db.users.find_one({"email": payload["email"].lower()})
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        doc = {
            "name": payload["name"].strip(),
            "email": payload["email"].lower(),
            "password": hash_password(payload["password"]),
            "role": payload["role"],
            "preferences": {
                "genres": [],
                "budget": None,
                "language": None,
                "keywords": [],
            },
            "activity_history": [],
        }

        result = await db.users.insert_one(doc)
        token = create_access_token(str(result.inserted_id), {"role": payload["role"]})
        return token

    async def login(self, db: AsyncIOMotorDatabase, email: str, password: str) -> str:
        user = await db.users.find_one({"email": email.lower()})
        if not user or not verify_password(password, user.get("password", "")):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        return create_access_token(str(user["_id"]), {"role": user.get("role")})

    async def get_user(self, db: AsyncIOMotorDatabase, user_id: str) -> dict[str, Any]:
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user token")

        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user


auth_service = AuthService()
