from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.ai.gemini_client import GeminiClient
from pitchroom_ai_backend.ai.metadata_extractor import MetadataExtractor
from pitchroom_ai_backend.config import settings
from pitchroom_ai_backend.services.ranking_service import rank_scripts
from pitchroom_ai_backend.services.safety_service import safety_service
from pitchroom_ai_backend.services.vector_service import vector_service
from pitchroom_ai_backend.utils.hashing import script_hash_signature
from pitchroom_ai_backend.utils.rate_limit import SlidingWindowRateLimiter


class ScriptService:
    def __init__(self, gemini_client: GeminiClient) -> None:
        self.gemini = gemini_client
        self.extractor = MetadataExtractor(gemini_client)
        self.upload_limiter = SlidingWindowRateLimiter(
            limit=settings.upload_rate_limit_count,
            window_seconds=settings.upload_rate_limit_window_sec,
        )

    async def upload_script(self, db: AsyncIOMotorDatabase, user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        user_id = str(user["_id"])
        if user.get("role") != "writer":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only writers can upload scripts")

        if not self.upload_limiter.allow(user_id):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Upload rate limit exceeded")

        duplicate = await safety_service.detect_exact_duplicate(db, payload["full_script_text"])
        if duplicate:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Duplicate script detected: {duplicate['script_id']}")

        metadata = await self.extractor.extract_script_metadata(
            title=payload["title"],
            description=payload["description"],
            full_script_text=payload["full_script_text"],
            language=payload["language"],
        )

        embedding_source = "\n".join(
            [
                payload["title"],
                payload["description"],
                payload["full_script_text"][:4000],
                " ".join(metadata.get("keywords", [])),
            ]
        )
        embedding = await self.gemini.embed_text(embedding_source)

        near_dup = await safety_service.detect_near_duplicate(await vector_service.search(embedding, top_k=1))
        if near_dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Near-duplicate script detected: {near_dup['script_id']} (similarity={near_dup['similarity_score']:.3f})",
            )

        now = datetime.now(timezone.utc)
        doc = {
            "title": payload["title"],
            "description": payload["description"],
            "full_script_text": payload["full_script_text"],
            "genre": metadata["genre"],
            "keywords": metadata["keywords"],
            "tone": metadata["tone"],
            "summary": metadata["summary"],
            "language": payload["language"],
            "created_by": user_id,
            "created_at": now,
            "views": 0,
            "likes": 0,
            "shares": 0,
            "messages_count": 0,
            "embedding_vector": embedding,
            "hash_signature": script_hash_signature(payload["full_script_text"]),
        }

        result = await db.scripts.insert_one(doc)
        doc["_id"] = result.inserted_id

        await vector_service.add_or_update_script(str(result.inserted_id), embedding, db)
        return doc

    async def trending(self, db: AsyncIOMotorDatabase, limit: int = 20) -> list[dict[str, Any]]:
        scripts = await db.scripts.find({}).limit(max(limit * 5, 100)).to_list(length=max(limit * 5, 100))
        ranked = rank_scripts(scripts)
        return ranked[:limit]

    async def semantic_search(self, db: AsyncIOMotorDatabase, query: str, limit: int = 20) -> list[dict[str, Any]]:
        query_vector = await self.gemini.embed_text(query)
        nearest = await vector_service.search(query_vector, top_k=max(limit * 3, 60))
        object_ids = [ObjectId(script_id) for script_id, _ in nearest if ObjectId.is_valid(script_id)]
        scripts = await db.scripts.find({"_id": {"$in": object_ids}}).to_list(length=len(object_ids))
        by_id = {str(row["_id"]): row for row in scripts}

        items = []
        for script_id, similarity in nearest:
            row = by_id.get(script_id)
            if not row:
                continue
            row["similarity_score"] = round(similarity, 6)
            items.append(row)
            if len(items) >= limit:
                break

        return items


script_service = ScriptService(gemini_client=GeminiClient())
