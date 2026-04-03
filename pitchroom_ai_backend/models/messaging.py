"""
Messaging and Conversation Models

Defines Pydantic schemas for messaging system with conversations, messages,
typing indicators, and real-time updates.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ============================================================================
# Request Models
# ============================================================================


class CreateConversationRequest(BaseModel):
    """Request to create or get a conversation between two users."""

    other_user_id: str = Field(min_length=1, description="Other participant's user ID")

    class Config:
        json_schema_extra = {
            "example": {"other_user_id": "507f1f77bcf86cd799439011"}
        }


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""

    conversation_id: str = Field(min_length=1, description="Target conversation ID")
    text: str = Field(
        min_length=1, max_length=5000, description="Message content"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": "507f1f77bcf86cd799439012",
                "text": "Hey, how are you?",
            }
        }


class MarkMessagesSeenRequest(BaseModel):
    """Request to mark messages as seen."""

    conversation_id: str = Field(
        min_length=1, description="Conversation containing messages"
    )
    message_ids: list[str] = Field(
        min_length=1, description="List of message IDs to mark as seen"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": "507f1f77bcf86cd799439012",
                "message_ids": [
                    "507f1f77bcf86cd799439013",
                    "507f1f77bcf86cd799439014",
                ],
            }
        }


class TypingIndicatorRequest(BaseModel):
    """Request for typing indicator update."""

    conversation_id: str = Field(min_length=1, description="Conversation ID")
    is_typing: bool = Field(description="Whether user is currently typing")

    class Config:
        json_schema_extra = {
            "example": {"conversation_id": "507f1f77bcf86cd799439012", "is_typing": True}
        }


# ============================================================================
# Response Models
# ============================================================================


class UserBasicInfo(BaseModel):
    """Basic user information for messaging UI."""

    user_id: str = Field(description="User's unique ID")
    name: str = Field(description="User's name")
    avatar: Optional[str] = Field(
        default=None, description="User's avatar URL"
    )
    online: bool = Field(default=False, description="Whether user is currently online")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "name": "Jane Doe",
                "avatar": "https://example.com/avatars/jane.jpg",
                "online": True,
            }
        }


class MessageOut(BaseModel):
    """Single message in a conversation."""

    message_id: str = Field(description="Unique message ID")
    conversation_id: str = Field(description="Parent conversation ID")
    sender_id: str = Field(description="Sender's user ID")
    sender: UserBasicInfo = Field(description="Sender's basic info")
    text: str = Field(description="Message content")
    created_at: datetime = Field(description="When message was sent")
    seen: bool = Field(default=False, description="Whether message was seen")
    seen_at: Optional[datetime] = Field(
        default=None, description="When message was marked as seen"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message_id": "507f1f77bcf86cd799439013",
                "conversation_id": "507f1f77bcf86cd799439012",
                "sender_id": "507f1f77bcf86cd799439011",
                "sender": {
                    "user_id": "507f1f77bcf86cd799439011",
                    "name": "Jane Doe",
                    "avatar": "https://example.com/avatars/jane.jpg",
                    "online": True,
                },
                "text": "Hello!",
                "created_at": "2024-03-24T10:30:00Z",
                "seen": True,
                "seen_at": "2024-03-24T10:31:00Z",
            }
        }


class ConversationOut(BaseModel):
    """Conversation for inbox list."""

    conversation_id: str = Field(description="Unique conversation ID")
    participants: list[UserBasicInfo] = Field(description="List of participants")
    last_message: Optional[MessageOut] = Field(
        default=None, description="Most recent message"
    )
    last_message_text: Optional[str] = Field(
        default=None, description="Preview of last message text"
    )
    unread_count: int = Field(default=0, description="Unread message count for user")
    updated_at: datetime = Field(description="When conversation was last updated")
    archived: bool = Field(default=False, description="Whether conversation is archived")
    muted: bool = Field(default=False, description="Whether notifications are muted")

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": "507f1f77bcf86cd799439012",
                "participants": [
                    {
                        "user_id": "507f1f77bcf86cd799439011",
                        "name": "Jane Doe",
                        "avatar": "https://example.com/avatars/jane.jpg",
                        "online": True,
                    },
                    {
                        "user_id": "507f1f77bcf86cd799439010",
                        "name": "John Smith",
                        "avatar": "https://example.com/avatars/john.jpg",
                        "online": False,
                    },
                ],
                "last_message": {
                    "message_id": "507f1f77bcf86cd799439013",
                    "conversation_id": "507f1f77bcf86cd799439012",
                    "sender_id": "507f1f77bcf86cd799439011",
                    "sender": {
                        "user_id": "507f1f77bcf86cd799439011",
                        "name": "Jane Doe",
                        "online": True,
                    },
                    "text": "See you soon!",
                    "created_at": "2024-03-24T10:30:00Z",
                    "seen": True,
                    "seen_at": "2024-03-24T10:31:00Z",
                },
                "last_message_text": "See you soon!",
                "unread_count": 0,
                "updated_at": "2024-03-24T10:30:00Z",
                "archived": False,
                "muted": False,
            }
        }


class InboxResponse(BaseModel):
    """User's inbox with all conversations."""

    total: int = Field(description="Total number of conversations")
    unread_total: int = Field(description="Total unread messages across all conversations")
    conversations: list[ConversationOut] = Field(
        description="List of conversations for this user"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "total": 15,
                "unread_total": 3,
                "conversations": [
                    {
                        "conversation_id": "507f1f77bcf86cd799439012",
                        "participants": [],
                        "last_message": None,
                        "unread_count": 0,
                        "updated_at": "2024-03-24T10:30:00Z",
                    }
                ],
            }
        }


class MessageListResponse(BaseModel):
    """Paginated list of messages in a conversation."""

    conversation_id: str = Field(description="Conversation ID")
    total: int = Field(description="Total message count")
    page: int = Field(description="Current page number")
    page_size: int = Field(description="Messages per page")
    has_more: bool = Field(description="Whether more messages exist")
    messages: list[MessageOut] = Field(description="List of messages")

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": "507f1f77bcf86cd799439012",
                "total": 150,
                "page": 1,
                "page_size": 50,
                "has_more": True,
                "messages": [],
            }
        }


class MarkSeenResponse(BaseModel):
    """Response after marking messages as seen."""

    success: bool = Field(description="Whether operation succeeded")
    updated_count: int = Field(description="Number of messages marked as seen")

    class Config:
        json_schema_extra = {
            "example": {"success": True, "updated_count": 5}
        }


class ConversationStatsResponse(BaseModel):
    """Statistics for a conversation."""

    conversation_id: str = Field(description="Conversation ID")
    total_messages: int = Field(description="Total message count")
    unread_count: int = Field(description="Unread message count")
    last_activity: datetime = Field(description="When conversation was last active")
    participants_count: int = Field(description="Number of participants")

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": "507f1f77bcf86cd799439012",
                "total_messages": 524,
                "unread_count": 0,
                "last_activity": "2024-03-24T10:30:00Z",
                "participants_count": 2,
            }
        }


class SearchConversationsResponse(BaseModel):
    """Search results for conversations."""

    query: str = Field(description="Search query used")
    total: int = Field(description="Total matches found")
    conversations: list[ConversationOut] = Field(description="Matching conversations")

    class Config:
        json_schema_extra = {
            "example": {
                "query": "jane",
                "total": 2,
                "conversations": [],
            }
        }


# ============================================================================
# WebSocket Models
# ============================================================================


class TypingIndicator(BaseModel):
    """Typing indicator event."""

    user_id: str = Field(description="User who is/was typing")
    conversation_id: str = Field(description="Conversation context")
    is_typing: bool = Field(description="True if currently typing, False if stopped")
    timestamp: datetime = Field(description="Event timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "conversation_id": "507f1f77bcf86cd799439012",
                "is_typing": True,
                "timestamp": "2024-03-24T10:30:00Z",
            }
        }


class WebSocketMessage(BaseModel):
    """Generic WebSocket message envelope."""

    type: str = Field(
        min_length=1, description="Message type: message, typing, presence, etc."
    )
    payload: dict = Field(description="Type-specific payload")
    timestamp: datetime = Field(description="When message was created")

    class Config:
        json_schema_extra = {
            "example": {
                "type": "message",
                "payload": {"message_id": "123", "text": "Hello!"},
                "timestamp": "2024-03-24T10:30:00Z",
            }
        }


class PresenceUpdate(BaseModel):
    """User presence update."""

    user_id: str = Field(description="User ID")
    online: bool = Field(description="Whether user is online")
    last_seen: datetime = Field(description="When user was last active")
    active_conversation_id: Optional[str] = Field(
        default=None, description="Conversation user is currently viewing"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "online": True,
                "last_seen": "2024-03-24T10:30:00Z",
                "active_conversation_id": "507f1f77bcf86cd799439012",
            }
        }


# ============================================================================
# Error Models
# ============================================================================


class ErrorDetail(BaseModel):
    """Detailed error information."""

    error: str = Field(description="Error code")
    message: str = Field(description="Error message")
    details: Optional[dict] = Field(
        default=None, description="Additional error context"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "error": "CONVERSATION_NOT_FOUND",
                "message": "Conversation does not exist",
                "details": {"conversation_id": "invalid_id"},
            }
        }
