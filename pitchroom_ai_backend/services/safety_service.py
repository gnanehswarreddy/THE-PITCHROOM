from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.config import settings
from pitchroom_ai_backend.utils.hashing import script_hash_signature


class SafetyService:
    async def detect_exact_duplicate(self, db: AsyncIOMotorDatabase, full_script_text: str) -> dict[str, Any] | None:
        signature = script_hash_signature(full_script_text)
        existing = await db.scripts.find_one({"hash_signature": signature}, {"_id": 1, "title": 1, "created_by": 1})
        if existing:
            return {
                "type": "exact_duplicate",
                "script_id": str(existing["_id"]),
                "title": existing.get("title", ""),
            }
        return None

    async def detect_near_duplicate(self, semantic_results: list[tuple[str, float]]) -> dict[str, Any] | None:
        if not semantic_results:
            return None
        script_id, score = semantic_results[0]
        if score >= settings.near_duplicate_threshold:
            return {
                "type": "near_duplicate",
                "script_id": script_id,
                "similarity_score": score,
            }
        return None


safety_service = SafetyService()
