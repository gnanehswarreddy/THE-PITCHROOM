"""
WebSocket Endpoint Handler

Implements the WebSocket endpoint for real-time messaging features
including message delivery, typing indicators, and presence updates.
"""

from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.services.messaging_service import messaging_service
from pitchroom_ai_backend.websocket.manager import (
    WebSocketMessageHandler,
    WebSocketSession,
    ws_manager,
)
from pitchroom_ai_backend.utils.logger import get_logger

logger = get_logger(__name__)


async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    conversation_id: str,
    db: AsyncIOMotorDatabase,
) -> None:
    """
    WebSocket endpoint for real-time messaging.

    Handles both direct messages and messages in conversations.
    Broadcasts messages to all connected users in the conversation.

    **Connection Flow**:
    1. Client connects with user_id and conversation_id
    2. User presence is marked as online
    3. Join notification sent to other users
    4. Messages are received, processed, and broadcasted in real-time
    5. Typing indicators are broadcast as user types
    6. On disconnect, user marked offline and notification sent

    **URL**: `/ws/{user_id}/{conversation_id}`
    """

    # Validate conversation access
    try:
        from bson import ObjectId
        conv_id = ObjectId(conversation_id)
        conversation = await db.conversations.find_one({"_id": conv_id})

        if not conversation:
            await websocket.close(code=4004, reason="Conversation not found")
            return

        if user_id not in conversation["participants"]:
            await websocket.close(code=4003, reason="Not a participant")
            return
    except Exception as e:
        logger.error(f"Error validating conversation: {e}")
        await websocket.close(code=4000, reason="Invalid conversation ID")
        return

    # Accept connection
    await ws_manager.connect(websocket, user_id, conversation_id)

    # Update user presence
    await messaging_service.update_user_presence(
        db, user_id, online=True, active_conversation_id=conversation_id
    )

    # Get user info for broadcasts
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    user_name = user.get("name", user_id) if user else user_id

    # Notify other users that this user joined
    join_event = WebSocketMessageHandler.create_message(
        WebSocketMessageHandler.MESSAGE_TYPE_USER_JOINED,
        {
            "user_id": user_id,
            "user_name": user_name,
        },
        conversation_id,
    )
    await ws_manager.broadcast_to_conversation(
        conversation_id, join_event, exclude_user_id=user_id
    )

    # Create session and register handlers
    session = WebSocketSession(websocket, user_id, conversation_id, ws_manager, db)

    # Handler for new messages
    async def handle_new_message(payload: dict) -> None:
        """Handle incoming message."""
        text = payload.get("text", "").strip()

        if not text:
            error = WebSocketMessageHandler.create_error_event(
                "EMPTY_MESSAGE",
                "Message cannot be empty",
                conversation_id,
            )
            await session.send_message(error)
            return

        if len(text) > 5000:
            error = WebSocketMessageHandler.create_error_event(
                "MESSAGE_TOO_LONG",
                "Message cannot exceed 5000 characters",
                conversation_id,
            )
            await session.send_message(error)
            return

        try:
            # Save message to database
            message = await messaging_service.send_message(
                db, conversation_id, user_id, text
            )

            # Broadcast to all users in conversation
            broadcast_msg = WebSocketMessageHandler.create_new_message_event(
                message["message_id"],
                conversation_id,
                user_id,
                user_name,
                text,
                message["created_at"],
            )
            await ws_manager.broadcast_to_conversation(
                conversation_id, broadcast_msg
            )

            logger.debug(f"Message {message['message_id']} broadcasted")

        except Exception as e:
            logger.error(f"Error sending message: {e}")
            error = WebSocketMessageHandler.create_error_event(
                "MESSAGE_SEND_ERROR",
                "Failed to send message",
                conversation_id,
            )
            await session.send_message(error)

    # Handler for typing indicators
    async def handle_typing(payload: dict) -> None:
        """Handle typing indicator."""
        is_typing = payload.get("is_typing", False)

        try:
            await messaging_service.record_typing(
                db, conversation_id, user_id, is_typing
            )

            # Broadcast typing status to other users
            typing_event = WebSocketMessageHandler.create_typing_event(
                user_id, user_name, conversation_id, is_typing
            )
            await ws_manager.broadcast_to_conversation(
                conversation_id, typing_event, exclude_user_id=user_id
            )

        except Exception as e:
            logger.error(f"Error recording typing: {e}")

    # Handler for marking messages as seen
    async def handle_message_seen(payload: dict) -> None:
        """Handle message seen updates."""
        message_ids = payload.get("message_ids", [])

        if not message_ids:
            return

        try:
            result = await messaging_service.mark_messages_seen(
                db, conversation_id, user_id, message_ids
            )

            # Broadcast seen status to other users
            seen_event = WebSocketMessageHandler.create_message_seen_event(
                message_ids, conversation_id, user_id
            )
            await ws_manager.broadcast_to_conversation(
                conversation_id, seen_event, exclude_user_id=user_id
            )

        except Exception as e:
            logger.error(f"Error marking messages seen: {e}")

    # Handler for ping (keep-alive)
    async def handle_ping(payload: dict) -> None:
        """Handle ping message (for keep-alive)."""
        pong = WebSocketMessageHandler.create_pong()
        await session.send_message(pong)

    # Register handlers
    session.register_handler(
        WebSocketMessageHandler.MESSAGE_TYPE_NEW_MESSAGE, handle_new_message
    )
    session.register_handler(
        WebSocketMessageHandler.MESSAGE_TYPE_TYPING, handle_typing
    )
    session.register_handler(
        WebSocketMessageHandler.MESSAGE_TYPE_MESSAGE_SEEN, handle_message_seen
    )
    session.register_handler(
        WebSocketMessageHandler.MESSAGE_TYPE_PING, handle_ping
    )

    # Start message handling loop
    try:
        await session.handle_messages()
    except WebSocketDisconnect:
        pass
    finally:
        # Mark user offline
        await messaging_service.update_user_presence(db, user_id, online=False)

        # Notify others that user left
        leave_event = WebSocketMessageHandler.create_message(
            WebSocketMessageHandler.MESSAGE_TYPE_USER_LEFT,
            {
                "user_id": user_id,
                "user_name": user_name,
            },
            conversation_id,
        )
        await ws_manager.broadcast_to_conversation(
            conversation_id, leave_event, exclude_user_id=user_id
        )

        logger.info(f"User {user_id} left conversation {conversation_id}")
