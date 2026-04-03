from __future__ import annotations

from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.ai.gemini_client import GeminiClient
from pitchroom_ai_backend.services.vector_service import vector_service


class MatchingService:
    def __init__(self, gemini_client: GeminiClient) -> None:
        self.gemini = gemini_client

    async def scripts_for_producer(self, db: AsyncIOMotorDatabase, producer_id: str, limit: int = 20) -> list[dict[str, Any]]:
        if not ObjectId.is_valid(producer_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid producer_id")

        producer = await db.users.find_one({"_id": ObjectId(producer_id), "role": "producer"})
        if not producer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producer not found")

        prefs = producer.get("preferences", {})
        pref_genres = [str(g).lower() for g in prefs.get("genres", [])]
        pref_language = str(prefs.get("language") or "").lower()
        pref_budget = prefs.get("budget")
        pref_keywords = [str(k).lower() for k in prefs.get("keywords", [])]

        profile_text = (
            f"Preferred genres: {', '.join(pref_genres)}\n"
            f"Preferred language: {pref_language}\n"
            f"Preferred budget: {pref_budget}\n"
            f"Keywords: {', '.join(pref_keywords)}"
        )

        profile_vector = await self.gemini.embed_text(profile_text)
        nearest = await vector_service.search(profile_vector, top_k=max(limit * 4, 60))

        object_ids = [ObjectId(script_id) for script_id, _ in nearest if ObjectId.is_valid(script_id)]
        scripts = await db.scripts.find({"_id": {"$in": object_ids}}).to_list(length=len(object_ids))
        by_id = {str(script["_id"]): script for script in scripts}

        ranked = []
        for script_id, similarity in nearest:
            script = by_id.get(script_id)
            if not script:
                continue

            genre_score = 1.0 if str(script.get("genre", "")).lower() in pref_genres else 0.0
            language_score = 1.0 if pref_language and str(script.get("language", "")).lower() == pref_language else 0.0
            keyword_overlap = len(set(pref_keywords).intersection(set([str(k).lower() for k in script.get("keywords", [])])))
            keyword_score = min(keyword_overlap / max(len(pref_keywords), 1), 1.0)
            budget_score = 0.5 if pref_budget else 0.0

            match_score = (0.55 * similarity) + (0.2 * genre_score) + (0.1 * keyword_score) + (0.1 * language_score) + (0.05 * budget_score)
            script["match_score"] = round(float(match_score), 6)
            ranked.append(script)

        ranked.sort(key=lambda item: item.get("match_score", 0.0), reverse=True)
        return ranked[:limit]
