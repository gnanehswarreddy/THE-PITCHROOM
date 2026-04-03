import hashlib
import re


def normalize_script_text(text: str) -> str:
    collapsed = re.sub(r"\s+", " ", text or "")
    return collapsed.strip().lower()


def script_hash_signature(text: str) -> str:
    normalized = normalize_script_text(text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
