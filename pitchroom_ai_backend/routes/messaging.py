"""
Messaging API Routes

RESTful API endpoints for managing conversations and messages.
Includes inbox, message sending, pagination, and metadata endpoints.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.database.mongo import get_db
from pitchroom_ai_backend.models.messaging import (
    ConversationOut,
    ConversationStatsResponse,
    CreateConversationRequest,
    InboxResponse,
    MarkMessagesSeenRequest,
    MarkSeenResponse,
    MessageListResponse,
    MessageOut,
    SearchConversationsResponse,
    SendMessageRequest,
    TypingIndicatorRequest,
)
from pitchroom_ai_backend.services.messaging_service import messaging_service
from pitchroom_ai_backend.utils.deps import get_current_user
from pitchroom_ai_backend.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/messaging", tags=["messaging"])


# ============================================================================
# Conversation Endpoints
# ============================================================================


@router.post("/conversation", response_model=ConversationOut)
async def create_or_get_conversation(
    payload: CreateConversationRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ConversationOut:
    """
    Create a new conversation with another user or get existing one.

    If a conversation between the two users already exists, returns that conversation.
    Otherwise, creates a new conversation and returns it.

    **Benefits**: Prevents duplicate conversations and ensures consistent conversation IDs.
    """
    conversation = await messaging_service.create_or_get_conversation(
        db, str(current_user["_id"]), payload.other_user_id
    )

    return ConversationOut(**conversation)


@router.get("/inbox", response_model=InboxResponse)
async def get_inbox(
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> InboxResponse:
    """
    Get user's inbox with all conversations.

    Returns paginated list of conversations sorted by most recent first.
    Includes last message preview and unread count for each conversation.

    **Features**:
    - Shows online status of other participants
    - Displays unread message counts
    - Sorted by most recent activity
    - Includes message preview in last_message_text
    """
    inbox = await messaging_service.get_inbox(
        db, str(current_user["_id"]), limit=limit, page=page
    )

    return InboxResponse(**inbox)


@router.get("/search", response_model=SearchConversationsResponse)
async def search_conversations(
    q: str = Query(min_length=1, description="Search query"),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> SearchConversationsResponse:
    """
    Search conversations by participant name.

    Useful for finding a specific conversation when inbox gets large.

    **Search Fields**:
    - Participant names (case-insensitive)
    """
    search_result = await messaging_service.search_conversations(
        db, str(current_user["_id"]), q, limit=limit
    )

    return SearchConversationsResponse(**search_result)


@router.get("/conversation/{conversation_id}/stats", response_model=ConversationStatsResponse)
async def get_conversation_stats(
    conversation_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ConversationStatsResponse:
    """
    Get statistics for a conversation.

    Returns message count, unread count, and participant information.
    """
    stats = await messaging_service.get_conversation_stats(db, conversation_id)

    return ConversationStatsResponse(**stats)


@router.post("/conversation/{conversation_id}/archive")
async def archive_conversation(
    conversation_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Archive a conversation.

    Archived conversations are hidden from inbox but not deleted.
    """
    result = await messaging_service.archive_conversation(
        db, conversation_id, str(current_user["_id"]), archive=True
    )

    return result


@router.post("/conversation/{conversation_id}/unarchive")
async def unarchive_conversation(
    conversation_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Unarchive a conversation."""
    result = await messaging_service.archive_conversation(
        db, conversation_id, str(current_user["_id"]), archive=False
    )

    return result


@router.post("/conversation/{conversation_id}/mute")
async def mute_conversation(
    conversation_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Mute notifications for a conversation.

    User will still receive messages but notifications won't be shown.
    """
    result = await messaging_service.mute_conversation(
        db, conversation_id, str(current_user["_id"]), mute=True
    )

    return result


@router.post("/conversation/{conversation_id}/unmute")
async def unmute_conversation(
    conversation_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Unmute a conversation."""
    result = await messaging_service.mute_conversation(
        db, conversation_id, str(current_user["_id"]), mute=False
    )

    return result


# ============================================================================
# Message Endpoints
# ============================================================================


@router.post("/send", response_model=MessageOut)
async def send_message(
    payload: SendMessageRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> MessageOut:
    """
    Send a message in a conversation.

    Creates a new message and broadcasts it to the recipient via WebSocket
    if they're online. Updates conversation's last message metadata.

    **Real-time**:
    - Message appears instantly in recipient's inbox
    - Optimized for Instagram-style UX
    """
    message = await messaging_service.send_message(
        db, payload.conversation_id, str(current_user["_id"]), payload.text
    )

    return MessageOut(**message)


@router.get(
    "/conversation/{conversation_id}/messages", response_model=MessageListResponse
)
async def get_messages(
    conversation_id: str,
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=50, ge=1, le=100, description="Messages per page"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> MessageListResponse:
    """
    Get messages in a conversation with pagination.

    Returns messages sorted by most recent first. Older messages require
    loading more pages.

    **Pagination**:
    - Page 1 = most recent messages
    - Infinite scroll supported
    - Max 100 messages per request
    """
    messages = await messaging_service.get_messages(
        db, conversation_id, str(current_user["_id"]), page=page, page_size=page_size
    )

    return MessageListResponse(**messages)


@router.post("/mark-seen", response_model=MarkSeenResponse)
async def mark_messages_seen(
    payload: MarkMessagesSeenRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> MarkSeenResponse:
    """
    Mark messages as seen by the current user.

    Pass message_ids to mark specific messages, or omit to mark all unseen
    messages from other participants in the conversation.

    **Seen Indicators**:
    - Single checkmark = sent
    - Double checkmark = seen by recipient
    - Updates in real-time via WebSocket
    """
    result = await messaging_service.mark_messages_seen(
        db, payload.conversation_id, str(current_user["_id"]), payload.message_ids
    )

    return MarkSeenResponse(**result)


# ============================================================================
# Real-time Indicators
# ============================================================================


@router.post("/typing")
async def typing_indicator(
    payload: TypingIndicatorRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Send typing indicator to other participants.

    Call with is_typing=true when user starts typing.
    Call with is_typing=false when user finishes or deletes content.

    **Real-time**:
    - Broadcasts to other users in conversation via WebSocket
    - Shows "User is typing..." indicator
    - Auto-clears after 5 seconds of inactivity
    """
    result = await messaging_service.record_typing(
        db, payload.conversation_id, str(current_user["_id"]), payload.is_typing
    )

    return result


@router.get("/typing/{conversation_id}")
async def get_typing_users(
    conversation_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Get list of users currently typing in a conversation.

    Used by polling clients (optional, WebSocket preferred for real-time).
    """
    typing_users = await messaging_service.get_typing_users(
        db, conversation_id, str(current_user["_id"])
    )

    return {
        "conversation_id": conversation_id,
        "typing_users": typing_users,
    }


@router.post("/presence")
async def update_presence(
    online: bool,
    active_conversation_id: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Update user's presence status.

    Call when user goes online/offline or switches conversations.
    Enables "seen" status and online indicators.

    **Parameters**:
    - online: Whether user is currently online
    - active_conversation_id: Which conversation user is currently viewing
    """
    result = await messaging_service.update_user_presence(
        db, str(current_user["_id"]), online, active_conversation_id
    )

    return result


@router.get("/presence/{user_id}")
async def get_presence(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Get another user's presence status.

    Returns online status and when they were last seen.
    Useful for showing presence indicators next to names.
    """
    presence = await messaging_service.get_user_presence(db, user_id)

    return presence


# ============================================================================
# Health Check
# ============================================================================


@router.get("/health")
async def messaging_health() -> dict:
    """Check messaging service health."""
    return {
        "status": "ok",
        "service": "messaging",
    }
