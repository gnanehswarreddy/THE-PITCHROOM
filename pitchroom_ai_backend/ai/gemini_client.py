import json
from typing import Any, Dict

import httpx

from pitchroom_ai_backend.config import settings


class GeminiClient:
    def __init__(self) -> None:
        self.base_url = settings.gemini_base_url.rstrip("/")
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self.embedding_model = settings.gemini_embedding_model

    async def generate_text(self, system_prompt: str, user_prompt: str, temperature: float = 0.3, max_tokens: int = 2048) -> str:
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
        payload: Dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
        }

        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, json=payload)
            data = response.json()

        if response.status_code >= 400:
            raise RuntimeError(f"Gemini text generation failed: {json.dumps(data)}")

        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text = "\n".join(part.get("text", "") for part in parts).strip()
        if not text:
            raise RuntimeError("Gemini returned empty text")
        return text

    async def embed_text(self, text: str) -> list[float]:
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        url = f"{self.base_url}/models/{self.embedding_model}:embedContent?key={self.api_key}"
        payload = {
            "content": {
                "parts": [{"text": text}],
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload)
            data = response.json()

        if response.status_code >= 400:
            raise RuntimeError(f"Gemini embedding failed: {json.dumps(data)}")

        vector = data.get("embedding", {}).get("values", [])
        if not vector:
            raise RuntimeError("Gemini returned empty embedding")
        return [float(x) for x in vector]
