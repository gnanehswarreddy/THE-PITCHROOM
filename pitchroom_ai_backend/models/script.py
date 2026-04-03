from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ScriptUploadRequest(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    description: str = Field(min_length=1, max_length=4000)
    full_script_text: str = Field(min_length=50)
    language: str = Field(min_length=1, max_length=64)


class ScriptOut(BaseModel):
    id: str
    title: str
    description: str
    genre: str
    tone: str
    language: str
    keywords: List[str]
    summary: str
    created_by: str
    created_at: datetime
    views: int
    likes: int
    shares: int
    messages_count: int
    ranking_score: Optional[float] = None
    similarity_score: Optional[float] = None


class ScriptSearchResponse(BaseModel):
    items: List[ScriptOut]
