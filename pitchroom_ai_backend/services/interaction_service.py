from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase


class InteractionService:
    FIELD_BY_TYPE = {
        "view": "views",
        "like": "likes",
        "share": "shares",
        "message": "messages_count",
    }

    async def create_interaction(self, db: AsyncIOMotorDatabase, user_id: str, script_id: str, interaction_type: str) -> None:
        if not ObjectId.is_valid(script_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid script_id")

        script_object_id = ObjectId(script_id)
        exists = await db.scripts.find_one({"_id": script_object_id}, {"_id": 1})
        if not exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Script not found")

        now = datetime.now(timezone.utc)
        await db.interactions.insert_one(
            {
                "user_id": user_id,
                "script_id": script_id,
                "type": interaction_type,
                "timestamp": now,
            }
        )

        field = self.FIELD_BY_TYPE[interaction_type]
        await db.scripts.update_one({"_id": script_object_id}, {"$inc": {field: 1}})

        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$push": {
                    "activity_history": {
                        "$each": [{"script_id": script_id, "type": interaction_type, "timestamp": now}],
                        "$slice": -500,
                    }
                }
            },
        )


interaction_service = InteractionService()
