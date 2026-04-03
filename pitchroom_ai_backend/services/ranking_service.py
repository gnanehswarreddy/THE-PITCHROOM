from datetime import datetime, timezone
from typing import Any


def compute_script_score(script: dict[str, Any]) -> float:
    views = int(script.get("views", 0))
    likes = int(script.get("likes", 0))
    shares = int(script.get("shares", 0))
    messages_count = int(script.get("messages_count", 0))

    score = (views * 1.0) + (likes * 2.0) + (shares * 3.0) + (messages_count * 4.0)

    created_at = script.get("created_at")
    if not isinstance(created_at, datetime):
        return score

    now = datetime.now(timezone.utc)
    hours_since_posted = max((now - created_at).total_seconds() / 3600.0, 0.0)
    final_score = score / (1.0 + hours_since_posted)
    return round(final_score, 6)


def rank_scripts(scripts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched = []
    for script in scripts:
        item = dict(script)
        item["ranking_score"] = compute_script_score(item)
        enriched.append(item)

    enriched.sort(key=lambda row: row.get("ranking_score", 0.0), reverse=True)
    return enriched
