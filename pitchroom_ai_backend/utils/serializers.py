from typing import Any


def script_to_output(script: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(script.get("_id")),
        "title": script.get("title", ""),
        "description": script.get("description", ""),
        "genre": script.get("genre", ""),
        "tone": script.get("tone", ""),
        "language": script.get("language", ""),
        "keywords": script.get("keywords", []),
        "summary": script.get("summary", ""),
        "created_by": script.get("created_by", ""),
        "created_at": script.get("created_at"),
        "views": int(script.get("views", 0)),
        "likes": int(script.get("likes", 0)),
        "shares": int(script.get("shares", 0)),
        "messages_count": int(script.get("messages_count", 0)),
        "ranking_score": script.get("ranking_score"),
        "similarity_score": script.get("similarity_score"),
    }
