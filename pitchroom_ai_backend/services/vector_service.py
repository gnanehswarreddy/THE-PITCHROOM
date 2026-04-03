from __future__ import annotations

import asyncio
from typing import Any

import faiss
import numpy as np
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.config import settings


class VectorService:
    def __init__(self) -> None:
        self.dimension = settings.vector_dim
        self.index = faiss.IndexFlatIP(self.dimension)
        self.script_ids: list[str] = []
        self._lock = asyncio.Lock()

    def _normalize(self, vector: list[float]) -> np.ndarray:
        arr = np.array(vector, dtype=np.float32)
        if arr.shape[0] != self.dimension:
            if arr.shape[0] > self.dimension:
                arr = arr[: self.dimension]
            else:
                arr = np.pad(arr, (0, self.dimension - arr.shape[0]))
        norm = np.linalg.norm(arr)
        if norm > 0:
            arr = arr / norm
        return arr

    async def rebuild(self, db: AsyncIOMotorDatabase) -> None:
        async with self._lock:
            self.index = faiss.IndexFlatIP(self.dimension)
            self.script_ids = []

            scripts = await db.scripts.find({"embedding_vector": {"$exists": True, "$ne": []}}, {"_id": 1, "embedding_vector": 1}).to_list(length=None)
            if not scripts:
                return

            matrix = []
            ids = []
            for row in scripts:
                matrix.append(self._normalize(row.get("embedding_vector", [])))
                ids.append(str(row["_id"]))

            vectors = np.vstack(matrix).astype(np.float32)
            self.index.add(vectors)
            self.script_ids = ids

    async def add_or_update_script(self, script_id: str, vector: list[float], db: AsyncIOMotorDatabase) -> None:
        # Simpler and safe for consistency.
        await self.rebuild(db)

    async def search(self, query_vector: list[float], top_k: int = 10) -> list[tuple[str, float]]:
        async with self._lock:
            if self.index.ntotal == 0:
                return []

            q = self._normalize(query_vector).reshape(1, -1).astype(np.float32)
            scores, indices = self.index.search(q, top_k)

            results: list[tuple[str, float]] = []
            for idx, score in zip(indices[0], scores[0]):
                if idx < 0 or idx >= len(self.script_ids):
                    continue
                results.append((self.script_ids[idx], float(score)))

            return results


vector_service = VectorService()
