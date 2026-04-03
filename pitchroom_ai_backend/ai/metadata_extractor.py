import json
import re
from typing import Any

from pitchroom_ai_backend.ai.gemini_client import GeminiClient


def _extract_json_block(text: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise RuntimeError("No JSON metadata found in AI response")
    return json.loads(match.group(0))


class MetadataExtractor:
    def __init__(self, gemini_client: GeminiClient) -> None:
        self.gemini = gemini_client

    async def extract_script_metadata(self, title: str, description: str, full_script_text: str, language: str) -> dict[str, Any]:
        system_prompt = (
            "You are a screenplay metadata extraction engine. "
            "Return only valid JSON with keys: genre, tone, summary, keywords. "
            "keywords must be an array of 6-12 concise strings."
        )
        user_prompt = (
            f"Title: {title}\n"
            f"Description: {description}\n"
            f"Language: {language}\n"
            f"Script:\n{full_script_text[:15000]}"
        )

        raw = await self.gemini.generate_text(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.2, max_tokens=1200)
        parsed = _extract_json_block(raw)

        return {
            "genre": str(parsed.get("genre", "Unknown")).strip() or "Unknown",
            "tone": str(parsed.get("tone", "Neutral")).strip() or "Neutral",
            "summary": str(parsed.get("summary", "")).strip(),
            "keywords": [str(x).strip().lower() for x in parsed.get("keywords", []) if str(x).strip()],
        }
