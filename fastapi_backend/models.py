from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    detail: str


class ConversationCreateRequest(BaseModel):
    user_id: str = Field(min_length=1)
    other_user_id: str = Field(min_length=1)


class ConversationOut(BaseModel):
    conversation_id: str
    participants: List[str]
    last_message: str
    updated_at: datetime
    unread_count: int = 0


class InboxResponse(BaseModel):
    conversations: List[ConversationOut]


class SendMessageRequest(BaseModel):
    conversation_id: str = Field(min_length=1)
    sender_id: str = Field(min_length=1)
    text: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    message_id: str
    conversation_id: str
    sender_id: str
    text: str
    created_at: datetime
    seen: bool


class MessagesResponse(BaseModel):
    conversation_id: str
    page: int
    page_size: int
    total: int
    messages: List[MessageOut]


class MarkSeenRequest(BaseModel):
    conversation_id: str = Field(min_length=1)
    user_id: str = Field(min_length=1)


class MarkSeenResponse(BaseModel):
    conversation_id: str
    updated_count: int


class TypingEvent(BaseModel):
    type: str
    conversation_id: str
    to_user_id: str
    is_typing: bool = True


class WebSocketEnvelope(BaseModel):
    type: str
    payload: dict
    sent_at: Optional[datetime] = None
