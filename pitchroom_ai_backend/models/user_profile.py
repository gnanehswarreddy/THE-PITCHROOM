from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class UserBasic(BaseModel):
    id: str = Field(alias="_id")
    email: str
    name: str
    role: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class UserProfileData(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    created_at: datetime

    class Config:
        populate_by_name = True


class ScriptBasic(BaseModel):
    id: str = Field(alias="_id")
    title: str
    description: Optional[str] = None
    language: Optional[str] = None
    genre: Optional[str] = None
    created_at: datetime
    views: int = 0
    likes: int = 0
    shares: int = 0


class ScriptEngagement(BaseModel):
    id: str = Field(alias="_id")
    script_id: str
    views_count: int = 0
    likes_count: int = 0
    shares_count: int = 0
    comments_count: int = 0
    last_engagement_at: Optional[datetime] = None


class Message(BaseModel):
    id: str = Field(alias="_id")
    conversation_id: str
    sender_id: str
    receiver_id: str
    content: str
    is_read: bool = False
    created_at: datetime


class Conversation(BaseModel):
    id: str = Field(alias="_id")
    participants: List[str]
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_at: datetime


class Notification(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    type: str
    title: str
    message: str
    is_read: bool = False
    data: Optional[dict] = None
    created_at: datetime


class Post(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    content: str
    likes_count: int = 0
    comments_count: int = 0
    created_at: datetime


class PostLike(BaseModel):
    id: str = Field(alias="_id")
    post_id: str
    user_id: str
    created_at: datetime


class PostComment(BaseModel):
    id: str = Field(alias="_id")
    post_id: str
    user_id: str
    content: str
    created_at: datetime


class Upload(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    filename: str
    file_type: str
    file_size: int
    url: Optional[str] = None
    created_at: datetime


class Collection(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    name: str
    description: Optional[str] = None
    script_count: int = 0
    created_at: datetime


class CharacterProfile(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    name: str
    description: Optional[str] = None
    created_at: datetime


class Story(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    title: str
    content: Optional[str] = None
    created_at: datetime


class PaginationParams(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    page: int = Field(default=1, ge=1)
    skip: int = Field(default=0, ge=0)

    @classmethod
    def from_query(cls, limit: int = 20, page: int = 1) -> "PaginationParams":
        skip = (page - 1) * limit
        return cls(limit=limit, page=page, skip=skip)


class UserFullProfile(BaseModel):
    user: UserBasic
    profile: Optional[UserProfileData] = None
    scripts: List[ScriptBasic] = []
    engagement: List[ScriptEngagement] = []
    messages: List[Message] = []
    conversations: List[Conversation] = []
    notifications: List[Notification] = []
    posts: List[Post] = []
    post_likes: List[PostLike] = []
    post_comments: List[PostComment] = []
    uploads: List[Upload] = []
    collections: List[Collection] = []
    characters: List[CharacterProfile] = []
    stories: List[Story] = []
    stats: dict = Field(
        default_factory=lambda: {
            "total_scripts": 0,
            "total_views": 0,
            "total_engagement": 0,
            "total_messages": 0,
            "total_conversations": 0,
            "total_notifications_unread": 0,
            "total_posts": 0,
            "total_uploads": 0,
            "total_collections": 0,
        }
    )


class UserAggregationResponse(BaseModel):
    success: bool
    data: Optional[UserFullProfile] = None
    message: Optional[str] = None
