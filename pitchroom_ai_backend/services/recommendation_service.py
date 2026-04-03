from __future__ import annotations

from collections import Counter
from typing import Any

import numpy as np
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.services.vector_service import vector_service


class RecommendationService:
    WEIGHTS = {
        "view": 1.0,
        "like": 2.0,
        "share": 2.5,
        "message": 3.0,
    }

    async def _user_profile_vector(self, db: AsyncIOMotorDatabase, user_id: str) -> tuple[list[float] | None, set[str], Counter]:
        interactions = await db.interactions.find({"user_id": user_id}).sort("timestamp", -1).to_list(length=400)
        if not interactions:
            return None, set(), Counter()

        script_ids = [row["script_id"] for row in interactions if ObjectId.is_valid(row.get("script_id", ""))]
        object_ids = [ObjectId(sid) for sid in set(script_ids)]
        scripts = await db.scripts.find({"_id": {"$in": object_ids}}, {"embedding_vector": 1, "genre": 1, "keywords": 1}).to_list(length=None)

        by_id = {str(row["_id"]): row for row in scripts}
        vectors = []
        weights = []
        genres = Counter()
        keywords = Counter()

        for interaction in interactions:
            script_id = interaction.get("script_id")
            script = by_id.get(script_id)
            if not script:
                continue
            vector = script.get("embedding_vector") or []
            if not vector:
                continue
            weight = self.WEIGHTS.get(interaction.get("type"), 1.0)
            vectors.append(np.array(vector, dtype=np.float32))
            weights.append(weight)
            if script.get("genre"):
                genres[str(script["genre"]).lower()] += 1
            for kw in script.get("keywords", []) or []:
                keywords[str(kw).lower()] += 1

        if not vectors:
            return None, set(), Counter()

        matrix = np.vstack(vectors)
        weight_vec = np.array(weights, dtype=np.float32).reshape((-1, 1))
        profile = (matrix * weight_vec).sum(axis=0) / max(weight_vec.sum(), 1e-8)

        return profile.tolist(), set(script_ids), keywords + genres

    async def recommend_for_user(self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        profile_vector, seen_script_ids, _ = await self._user_profile_vector(db, user_id)

        if not profile_vector:
            rows = await db.scripts.find({}).sort("created_at", -1).limit(limit).to_list(length=limit)
            for row in rows:
                row["similarity_score"] = None
            return rows

        nearest = await vector_service.search(profile_vector, top_k=max(limit * 4, 50))
        ranked_ids = [script_id for script_id, _score in nearest if script_id not in seen_script_ids]

        if not ranked_ids:
            rows = await db.scripts.find({}).sort("created_at", -1).limit(limit).to_list(length=limit)
            for row in rows:
                row["similarity_score"] = None
            return rows

        object_ids = [ObjectId(script_id) for script_id in ranked_ids if ObjectId.is_valid(script_id)]
        docs = await db.scripts.find({"_id": {"$in": object_ids}}).to_list(length=len(object_ids))
        by_id = {str(doc["_id"]): doc for doc in docs}

        result = []
        for script_id, score in nearest:
            if script_id in seen_script_ids:
                continue
            row = by_id.get(script_id)
            if not row:
                continue
            row["similarity_score"] = score
            result.append(row)
            if len(result) >= limit:
                break

        return result


recommendation_service = RecommendationService()
