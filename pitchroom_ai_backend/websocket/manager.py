"""
WebSocket Connection Manager

Manages real-time connections for Instagram-style messaging features:
- Live message delivery
- Typing indicators
- Online presence
- Seen status updates
"""

import json
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from fastapi import WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.utils.logger import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time messaging.

    Tracks active connections per user and conversation, enabling
    broadcast of messages, typing indicators, and presence updates.
    """

    def __init__(self):
        # user_id -> set of WebSocket connections
        self.active_connections: dict[str, set[WebSocket]] = {}
        # (user_id, conversation_id) -> set of WebSocket connections
        self.conversation_connections: dict[tuple[str, str], set[WebSocket]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        conversation_id: Optional[str] = None,
    ) -> None:
        """
        Register a new WebSocket connection.

        **Parameters**:
        - websocket: The WebSocket connection
        - user_id: ID of connected user
        - conversation_id: Optional specific conversation to observe
        """
        await websocket.accept()

        # Track user connection
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

        # Track conversation connection if specified
        if conversation_id:
            key = (user_id, conversation_id)
            if key not in self.conversation_connections:
                self.conversation_connections[key] = set()
            self.conversation_connections[key].add(websocket)

        logger.info(
            f"User {user_id} connected to WebSocket"
            + (f" (conversation {conversation_id})" if conversation_id else "")
        )

    def disconnect(
        self,
        websocket: WebSocket,
        user_id: str,
        conversation_id: Optional[str] = None,
    ) -> None:
        """
        Unregister a WebSocket connection.
        """
        # Remove from user connections
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        # Remove from conversation connections
        if conversation_id:
            key = (user_id, conversation_id)
            if key in self.conversation_connections:
                self.conversation_connections[key].discard(websocket)
                if not self.conversation_connections[key]:
                    del self.conversation_connections[key]

        logger.info(
            f"User {user_id} disconnected from WebSocket"
            + (f" (conversation {conversation_id})" if conversation_id else "")
        )

    async def broadcast_to_conversation(
        self,
        conversation_id: str,
        message: dict[str, Any],
        exclude_user_id: Optional[str] = None,
    ) -> int:
        """
        Broadcast a message to all users in a conversation.

        **Use for**:
        - New messages
        - Seen status updates
        - Typing indicators
        - User joined/left

        **Returns**: Number of users message was sent to
        """
        sent_count = 0
        dead_connections = []

        for (uid, cid), connections in list(
            self.conversation_connections.items()
        ):
            if cid == conversation_id and (
                exclude_user_id is None or uid != exclude_user_id
            ):
                for connection in list(connections):
                    try:
                        await connection.send_json(message)
                        sent_count += 1
                    except Exception as e:
                        logger.warning(f"Failed to send message to {uid}: {e}")
                        dead_connections.append((connection, uid, cid))

        # Clean up dead connections
        for connection, uid, cid in dead_connections:
            self.disconnect(connection, uid, cid)

        return sent_count

    async def broadcast_to_user(
        self,
        user_id: str,
        message: dict[str, Any],
    ) -> int:
        """
        Broadcast a message to all connections of a specific user.

        **Use for**:
        - User mentions/notifications
        - Inbox updates
        - System messages

        **Returns**: Number of connections message was sent to
        """
        sent_count = 0
        dead_connections = []

        if user_id in self.active_connections:
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_json(message)
                    sent_count += 1
                except Exception as e:
                    logger.warning(f"Failed to send message to {user_id}: {e}")
                    dead_connections.append(connection)

        # Clean up dead connections
        for connection in dead_connections:
            self.disconnect(connection, user_id)

        return sent_count

    async def send_to_user(
        self,
        user_id: str,
        message: dict[str, Any],
    ) -> bool:
        """
        Send a message to a user's first active connection.

        Returns True if message was sent to at least one connection.
        """
        if user_id in self.active_connections:
            connections = list(self.active_connections[user_id])
            if connections:
                try:
                    await connections[0].send_json(message)
                    return True
                except Exception as e:
                    logger.error(f"Failed to send message to {user_id}: {e}")
                    self.disconnect(connections[0], user_id)

        return False

    def get_active_users(self) -> list[str]:
        """Get list of users with active WebSocket connections."""
        return list(self.active_connections.keys())

    def get_active_user_count(self) -> int:
        """Get count of users with active connections."""
        return len(self.active_connections)

    def is_user_online(self, user_id: str) -> bool:
        """Check if a user has any active connections."""
        return user_id in self.active_connections and len(
            self.active_connections[user_id]
        ) > 0

    def get_conversation_user_count(self, conversation_id: str) -> int:
        """Get count of unique users connected to a conversation."""
        users = set()
        for (uid, cid), connections in self.conversation_connections.items():
            if cid == conversation_id and connections:
                users.add(uid)
        return len(users)


class WebSocketMessageHandler:
    """
    Handler for WebSocket messages with typed message structure.

    Defines message types and provides utilities for message creation
    and parsing.
    """

    # Message types
    MESSAGE_TYPE_NEW_MESSAGE = "message"
    MESSAGE_TYPE_TYPING = "typing"
    MESSAGE_TYPE_MESSAGE_SEEN = "message_seen"
    MESSAGE_TYPE_PRESENCE = "presence"
    MESSAGE_TYPE_USER_JOINED = "user_joined"
    MESSAGE_TYPE_USER_LEFT = "user_left"
    MESSAGE_TYPE_CONVERSATION_UPDATED = "conversation_updated"
    MESSAGE_TYPE_ERROR = "error"
    MESSAGE_TYPE_PING = "ping"
    MESSAGE_TYPE_PONG = "pong"

    @staticmethod
    def create_message(
        message_type: str,
        payload: dict[str, Any],
        conversation_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create a typed WebSocket message."""
        msg = {
            "type": message_type,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if conversation_id:
            msg["conversation_id"] = conversation_id

        return msg

    @staticmethod
    def create_new_message_event(
        message_id: str,
        conversation_id: str,
        sender_id: str,
        sender_name: str,
        text: str,
        created_at: datetime,
    ) -> dict[str, Any]:
        """Create a new message event."""
        return WebSocketMessageHandler.create_message(
            WebSocketMessageHandler.MESSAGE_TYPE_NEW_MESSAGE,
            {
                "message_id": message_id,
                "sender_id": sender_id,
                "sender_name": sender_name,
                "text": text,
                "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
            },
            conversation_id,
        )

    @staticmethod
    def create_typing_event(
        user_id: str,
        user_name: str,
        conversation_id: str,
        is_typing: bool,
    ) -> dict[str, Any]:
        """Create a typing indicator event."""
        return WebSocketMessageHandler.create_message(
            WebSocketMessageHandler.MESSAGE_TYPE_TYPING,
            {
                "user_id": user_id,
                "user_name": user_name,
                "is_typing": is_typing,
            },
            conversation_id,
        )

    @staticmethod
    def create_message_seen_event(
        message_ids: list[str],
        conversation_id: str,
        seen_by_user_id: str,
    ) -> dict[str, Any]:
        """Create a message seen event."""
        return WebSocketMessageHandler.create_message(
            WebSocketMessageHandler.MESSAGE_TYPE_MESSAGE_SEEN,
            {
                "message_ids": message_ids,
                "seen_by": seen_by_user_id,
            },
            conversation_id,
        )

    @staticmethod
    def create_presence_event(
        user_id: str,
        online: bool,
        active_conversation_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create a presence update event."""
        return WebSocketMessageHandler.create_message(
            WebSocketMessageHandler.MESSAGE_TYPE_PRESENCE,
            {
                "user_id": user_id,
                "online": online,
                "active_conversation_id": active_conversation_id,
            },
        )

    @staticmethod
    def create_error_event(
        error_code: str,
        error_message: str,
        conversation_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create an error event."""
        return WebSocketMessageHandler.create_message(
            WebSocketMessageHandler.MESSAGE_TYPE_ERROR,
            {
                "code": error_code,
                "message": error_message,
            },
            conversation_id,
        )

    @staticmethod
    def create_ping() -> dict[str, Any]:
        """Create a ping message."""
        return WebSocketMessageHandler.create_message(
            WebSocketMessageHandler.MESSAGE_TYPE_PING,
            {},
        )

    @staticmethod
    def create_pong() -> dict[str, Any]:
        """Create a pong message."""
        return WebSocketMessageHandler.create_message(
            WebSocketMessageHandler.MESSAGE_TYPE_PONG,
            {},
        )


class WebSocketSession:
    """
    Represents a single user's WebSocket session.

    Manages message routing, error handling, and connection lifecycle
    for a WebSocket client.
    """

    def __init__(
        self,
        websocket: WebSocket,
        user_id: str,
        conversation_id: Optional[str],
        connection_manager: ConnectionManager,
        db: AsyncIOMotorDatabase,
    ):
        self.websocket = websocket
        self.user_id = user_id
        self.conversation_id = conversation_id
        self.connection_manager = connection_manager
        self.db = db
        self.message_handlers: dict[str, Callable] = {}

    async def handle_messages(self) -> None:
        """
        Main message handling loop.

        Receives messages from client and routes to appropriate handlers
        based on message type.
        """
        try:
            while True:
                data = await self.websocket.receive_json()

                message_type = data.get("type")
                payload = data.get("payload", {})

                logger.debug(f"Received {message_type} from {self.user_id}")

                # Route to handler if registered
                if message_type in self.message_handlers:
                    handler = self.message_handlers[message_type]
                    await handler(payload)
                else:
                    # Send unknown type error
                    error_msg = WebSocketMessageHandler.create_error_event(
                        "UNKNOWN_MESSAGE_TYPE",
                        f"Message type '{message_type}' is not recognized",
                        self.conversation_id,
                    )
                    await self.websocket.send_json(error_msg)

        except WebSocketDisconnect:
            logger.info(f"User {self.user_id} WebSocket disconnected")
        except Exception as e:
            logger.error(f"WebSocket error for user {self.user_id}: {e}")
            try:
                error_msg = WebSocketMessageHandler.create_error_event(
                    "SERVER_ERROR",
                    "An unexpected error occurred",
                    self.conversation_id,
                )
                await self.websocket.send_json(error_msg)
            except Exception:
                pass
        finally:
            self.connection_manager.disconnect(
                self.websocket, self.user_id, self.conversation_id
            )

    def register_handler(
        self,
        message_type: str,
        handler: Callable[[dict[str, Any]], None],
    ) -> None:
        """Register a handler for a specific message type."""
        self.message_handlers[message_type] = handler

    async def send_message(self, message: dict[str, Any]) -> None:
        """Send a message to the client."""
        try:
            await self.websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send message to {self.user_id}: {e}")
            self.connection_manager.disconnect(
                self.websocket, self.user_id, self.conversation_id
            )


# Global connection manager instance
ws_manager = ConnectionManager()
