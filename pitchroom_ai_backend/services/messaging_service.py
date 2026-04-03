"""
Messaging Service Layer

Handles all messaging business logic: conversations, messages, typing indicators,
and real-time presence updates with MongoDB optimizations.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.utils.logger import get_logger

logger = get_logger(__name__)


class MessagingService:
    """Core messaging service with conversation and message management."""

    # ========================================================================
    # Conversation Management
    # ========================================================================

    async def create_or_get_conversation(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        other_user_id: str,
    ) -> dict:
        """
        Create a new conversation or get existing one between two users.

        Uses sorted participant IDs to ensure duplicate conversations aren't created.
        """
        if user_id == other_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create conversation with yourself",
            )

        # Verify both users exist
        user1_exists = await self._user_exists(db, user_id)
        user2_exists = await self._user_exists(db, other_user_id)

        if not user1_exists or not user2_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or both users do not exist",
            )

        # Create sorted participant key to prevent duplicates
        participants = sorted([user_id, other_user_id])
        participant_key = ":".join(participants)

        # Check if conversation exists
        existing = await db.conversations.find_one(
            {"participant_key": participant_key}
        )
        if existing:
            return self._serialize_conversation(existing, user_id)

        # Create new conversation
        now = datetime.now(timezone.utc)
        conversation = {
            "participant_key": participant_key,
            "participants": participants,
            "last_message_id": None,
            "last_message_text": None,
            "last_message_sender_id": None,
            "updated_at": now,
            "created_at": now,
            "message_count": 0,
        }

        result = await db.conversations.insert_one(conversation)
        conversation["_id"] = result.inserted_id

        logger.info(f"Created conversation {result.inserted_id} between {participants}")
        return self._serialize_conversation(conversation, user_id)

    async def get_inbox(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        limit: int = 20,
        page: int = 1,
    ) -> dict:
        """
        Get user's inbox with all conversations sorted by most recent.

        Returns paginated conversations with last message and unread counts.
        """
        skip = (page - 1) * limit

        # Find all conversations where user is a participant
        pipeline = [
            {
                "$match": {
                    "participants": user_id,
                }
            },
            {
                "$sort": {"updated_at": -1}
            },
            {
                "$facet": {
                    "conversations": [
                        {"$skip": skip},
                        {"$limit": limit},
                    ],
                    "total": [
                        {"$count": "count"}
                    ],
                }
            },
        ]

        result = await db.conversations.aggregate(pipeline).to_list(None)
        data = result[0] if result else {"conversations": [], "total": []}

        conversations = []
        for conv in data["conversations"]:
            conv_data = self._serialize_conversation(conv, user_id)
            # Count unread messages
            unread_count = await db.messages.count_documents({
                "conversation_id": str(conv["_id"]),
                "sender_id": {"$ne": user_id},
                "seen": False,
            })
            conv_data["unread_count"] = unread_count
            conversations.append(conv_data)

        total = data["total"][0]["count"] if data["total"] else 0

        # Calculate total unread across all conversations
        all_unread = await db.messages.count_documents({
            "sender_id": {"$ne": user_id},
            "seen": False,
        })

        return {
            "total": total,
            "unread_total": all_unread,
            "conversations": conversations,
        }

    async def search_conversations(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        query: str,
        limit: int = 20,
    ) -> dict:
        """
        Search conversations by participant name.
        """
        # Search in users collection for matching names
        matching_users = await db.users.find(
            {
                "name": {"$regex": query, "$options": "i"},
                "_id": {"$ne": ObjectId(user_id)},
            }
        ).to_list(100)

        if not matching_users:
            return {"query": query, "total": 0, "conversations": []}

        # Find conversations with these users
        matching_user_ids = [str(u["_id"]) for u in matching_users]

        conversations = await db.conversations.find(
            {
                "participants": user_id,
                "participants": {"$in": matching_user_ids},
            }
        ).sort("updated_at", -1).limit(limit).to_list(None)

        result_convs = [
            self._serialize_conversation(conv, user_id)
            for conv in conversations
        ]

        return {
            "query": query,
            "total": len(result_convs),
            "conversations": result_convs,
        }

    async def get_conversation_stats(
        self,
        db: AsyncIOMotorDatabase,
        conversation_id: str,
    ) -> dict:
        """Get statistics for a conversation."""
        conv_obj_id = ObjectId(conversation_id)
        conversation = await db.conversations.find_one({"_id": conv_obj_id})

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        total_messages = await db.messages.count_documents({
            "conversation_id": conversation_id
        })

        return {
            "conversation_id": conversation_id,
            "total_messages": total_messages,
            "participants_count": len(conversation.get("participants", [])),
            "last_activity": conversation.get("updated_at", datetime.now(timezone.utc)),
        }

    # ========================================================================
    # Message Management
    # ========================================================================

    async def send_message(
        self,
        db: AsyncIOMotorDatabase,
        conversation_id: str,
        sender_id: str,
        text: str,
    ) -> dict:
        """
        Send a message in a conversation.

        Updates conversation's last message metadata for inbox display.
        """
        conv_obj_id = ObjectId(conversation_id)

        # Verify conversation exists and user is participant
        conversation = await db.conversations.find_one({"_id": conv_obj_id})
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        if sender_id not in conversation["participants"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation",
            )

        # Verify sender exists
        sender = await self._get_user_for_message(db, sender_id)
        if not sender:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sender user not found",
            )

        now = datetime.now(timezone.utc)

        # Create message
        message = {
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "text": text,
            "created_at": now,
            "seen": False,
            "seen_by": [],
            "seen_at": None,
        }

        result = await db.messages.insert_one(message)
        message["_id"] = result.inserted_id

        # Update conversation with last message metadata
        await db.conversations.update_one(
            {"_id": conv_obj_id},
            {
                "$set": {
                    "last_message_id": str(result.inserted_id),
                    "last_message_text": text[:100],  # Preview
                    "last_message_sender_id": sender_id,
                    "updated_at": now,
                },
                "$inc": {"message_count": 1},
            },
        )

        logger.info(f"Message {result.inserted_id} sent in conversation {conversation_id}")

        return self._serialize_message(message, sender)

    async def get_messages(
        self,
        db: AsyncIOMotorDatabase,
        conversation_id: str,
        user_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        """
        Get messages in a conversation with pagination.

        Returns messages in chronological order (oldest first for pagination).
        """
        conv_obj_id = ObjectId(conversation_id)

        # Verify conversation exists and user is participant
        conversation = await db.conversations.find_one({"_id": conv_obj_id})
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        if user_id not in conversation["participants"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation",
            )

        skip = (page - 1) * page_size

        # Get messages with pagination
        pipeline = [
            {
                "$match": {"conversation_id": conversation_id}
            },
            {
                "$facet": {
                    "messages": [
                        {"$sort": {"created_at": -1}},
                        {"$skip": skip},
                        {"$limit": page_size},
                    ],
                    "total": [
                        {"$count": "count"}
                    ],
                }
            },
        ]

        result = await db.messages.aggregate(pipeline).to_list(None)
        data = result[0] if result else {"messages": [], "total": []}

        # Get sender info for each message
        messages = []
        for msg in data["messages"]:
            sender = await self._get_user_for_message(db, msg["sender_id"])
            messages.append(self._serialize_message(msg, sender))

        # Reverse to show newest first
        messages.reverse()

        total = data["total"][0]["count"] if data["total"] else 0

        return {
            "conversation_id": conversation_id,
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_more": (page * page_size) < total,
            "messages": messages,
        }

    async def mark_messages_seen(
        self,
        db: AsyncIOMotorDatabase,
        conversation_id: str,
        user_id: str,
        message_ids: Optional[list[str]] = None,
    ) -> dict:
        """
        Mark messages as seen by a user.

        If message_ids provided, mark only those. Otherwise mark all unseen messages
        from other participants in the conversation.
        """
        conv_obj_id = ObjectId(conversation_id)

        # Verify conversation exists and user is participant
        conversation = await db.conversations.find_one({"_id": conv_obj_id})
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        if user_id not in conversation["participants"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation",
            )

        now = datetime.now(timezone.utc)

        if message_ids:
            # Mark specific messages
            msg_obj_ids = [ObjectId(mid) for mid in message_ids]
            result = await db.messages.update_many(
                {
                    "_id": {"$in": msg_obj_ids},
                    "conversation_id": conversation_id,
                    "sender_id": {"$ne": user_id},
                },
                {
                    "$set": {
                        "seen": True,
                        "seen_at": now,
                    },
                    "$addToSet": {"seen_by": user_id},
                },
            )
        else:
            # Mark all unseen from others
            result = await db.messages.update_many(
                {
                    "conversation_id": conversation_id,
                    "sender_id": {"$ne": user_id},
                    "seen": False,
                },
                {
                    "$set": {
                        "seen": True,
                        "seen_at": now,
                    },
                    "$addToSet": {"seen_by": user_id},
                },
            )

        logger.info(
            f"Marked {result.modified_count} messages as seen by {user_id} "
            f"in conversation {conversation_id}"
        )

        return {
            "success": True,
            "updated_count": result.modified_count,
        }

    # ========================================================================
    # Typing Indicators and Presence
    # ========================================================================

    async def record_typing(
        self,
        db: AsyncIOMotorDatabase,
        conversation_id: str,
        user_id: str,
        is_typing: bool,
    ) -> dict:
        """Record typing status for real-time updates via WebSocket."""
        now = datetime.now(timezone.utc)

        await db.typing_indicators.update_one(
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
            },
            {
                "$set": {
                    "is_typing": is_typing,
                    "timestamp": now,
                }
            },
            upsert=True,
        )

        return {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "is_typing": is_typing,
            "timestamp": now,
        }

    async def get_typing_users(
        self,
        db: AsyncIOMotorDatabase,
        conversation_id: str,
        exclude_user_id: str,
    ) -> list[dict]:
        """
        Get users currently typing in a conversation.

        Filters out records older than 5 seconds (typing stopped).
        """
        now = datetime.now(timezone.utc)
        cutoff = datetime.fromtimestamp(now.timestamp() - 5, tz=timezone.utc)

        typing_users = await db.typing_indicators.find({
            "conversation_id": conversation_id,
            "user_id": {"$ne": exclude_user_id},
            "is_typing": True,
            "timestamp": {"$gt": cutoff},
        }).to_list(None)

        result = []
        for typing_user in typing_users:
            user = await self._get_user_basic(db, typing_user["user_id"])
            result.append({
                "user_id": typing_user["user_id"],
                "user": user,
                "is_typing": True,
            })

        return result

    async def update_user_presence(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        online: bool,
        active_conversation_id: Optional[str] = None,
    ) -> dict:
        """Update user's online status and active conversation."""
        now = datetime.now(timezone.utc)

        await db.user_presence.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "online": online,
                    "last_seen": now,
                    "active_conversation_id": active_conversation_id,
                }
            },
            upsert=True,
        )

        return {
            "user_id": user_id,
            "online": online,
            "last_seen": now,
            "active_conversation_id": active_conversation_id,
        }

    async def get_user_presence(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
    ) -> dict:
        """Get user's current presence status."""
        presence = await db.user_presence.find_one({"user_id": user_id})

        if presence:
            return {
                "user_id": user_id,
                "online": presence.get("online", False),
                "last_seen": presence.get("last_seen"),
                "active_conversation_id": presence.get("active_conversation_id"),
            }

        return {
            "user_id": user_id,
            "online": False,
            "last_seen": None,
            "active_conversation_id": None,
        }

    # ========================================================================
    # Conversation Settings
    # ========================================================================

    async def archive_conversation(
        self,
        db: AsyncIOMotorDatabase,
        conversation_id: str,
        user_id: str,
        archive: bool = True,
    ) -> dict:
        """Archive or unarchive a conversation for a user."""
        conv_obj_id = ObjectId(conversation_id)

        # This would require a per-user settings collection
        # For now, we'll return success
        await db.conversation_settings.update_one(
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
            },
            {
                "$set": {
                    "archived": archive,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

        return {
            "success": True,
            "conversation_id": conversation_id,
            "archived": archive,
        }

    async def mute_conversation(
        self,
        db: AsyncIOMotorDatabase,
        conversation_id: str,
        user_id: str,
        mute: bool = True,
    ) -> dict:
        """Mute or unmute notifications for a conversation."""
        await db.conversation_settings.update_one(
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
            },
            {
                "$set": {
                    "muted": mute,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

        return {
            "success": True,
            "conversation_id": conversation_id,
            "muted": mute,
        }

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    async def _user_exists(self, db: AsyncIOMotorDatabase, user_id: str) -> bool:
        """Check if a user exists."""
        try:
            user_obj_id = ObjectId(user_id)
            return await db.users.find_one({"_id": user_obj_id}) is not None
        except Exception:
            return False

    async def _get_user_basic(
        self, db: AsyncIOMotorDatabase, user_id: str
    ) -> Optional[dict]:
        """Get basic user info for messaging UI."""
        try:
            user_obj_id = ObjectId(user_id)
            user = await db.users.find_one({"_id": user_obj_id})
            if user:
                presence = await self.get_user_presence(db, user_id)
                return {
                    "user_id": str(user["_id"]),
                    "name": user.get("name", "Unknown"),
                    "avatar": user.get("avatar"),
                    "online": presence.get("online", False),
                }
        except Exception as e:
            logger.error(f"Error fetching user {user_id}: {e}")

        return {
            "user_id": user_id,
            "name": "Unknown",
            "avatar": None,
            "online": False,
        }

    async def _get_user_for_message(
        self, db: AsyncIOMotorDatabase, user_id: str
    ) -> dict:
        """Get user profile for message context."""
        user = await self._get_user_basic(db, user_id)
        return user or {
            "user_id": user_id,
            "name": user_id,
            "avatar": None,
            "online": False,
        }

    def _serialize_conversation(self, conversation: dict, user_id: str) -> dict:
        """Convert conversation document to API response."""
        return {
            "conversation_id": str(conversation["_id"]),
            "participants": [
                {
                    "user_id": pid,
                    "name": pid,  # Will be enriched with actual user data
                }
                for pid in conversation.get("participants", [])
                if pid != user_id
            ],
            "last_message_text": conversation.get("last_message_text"),
            "updated_at": conversation.get("updated_at", datetime.now(timezone.utc)),
            "archived": False,
            "muted": False,
        }

    def _serialize_message(self, message: dict, sender: dict) -> dict:
        """Convert message document to API response."""
        return {
            "message_id": str(message["_id"]),
            "conversation_id": message["conversation_id"],
            "sender_id": message["sender_id"],
            "sender": sender,
            "text": message["text"],
            "created_at": message.get("created_at", datetime.now(timezone.utc)),
            "seen": message.get("seen", False),
            "seen_at": message.get("seen_at"),
        }


# Singleton instance
messaging_service = MessagingService()
