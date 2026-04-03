import os
from functools import lru_cache
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError, OperationFailure


class MongoManager:
    def __init__(self) -> None:
        self._client: Optional[AsyncIOMotorClient] = None
        self._db: Optional[AsyncIOMotorDatabase] = None

    def connect(self) -> None:
        if self._db is not None:
            return

        mongo_uri = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
        mongo_db = os.getenv("MONGODB_DB", "pitchroom")
        self._client = AsyncIOMotorClient(mongo_uri)
        self._db = self._client[mongo_db]

    def disconnect(self) -> None:
        if self._client is not None:
            self._client.close()
        self._client = None
        self._db = None

    @property
    def db(self) -> AsyncIOMotorDatabase:
        if self._db is None:
            raise RuntimeError("MongoDB is not connected")
        return self._db


mongo_manager = MongoManager()


@lru_cache(maxsize=1)
def get_db() -> AsyncIOMotorDatabase:
    return mongo_manager.db


async def ensure_indexes() -> None:
    db = mongo_manager.db

    try:
        await db.conversations.create_index(
            "conversation_id",
            unique=True,
            name="conversations_conversation_id_unique",
            partialFilterExpression={"conversation_id": {"$type": "string"}},
        )
    except (DuplicateKeyError, OperationFailure) as exc:
        # Existing data can contain null/duplicate conversation_id values; skip in place.
        print("Warning: conversations_conversation_id_unique index could not be built:", exc)

    await db.conversations.create_index("participants", name="conversations_participants")

    try:
        await db.conversations.create_index(
            "participants_key",
            unique=True,
            name="conversations_participants_key_unique",
            partialFilterExpression={"participants_key": {"$type": "string"}},
        )
    except (DuplicateKeyError, OperationFailure) as exc:
        # Existing data may have null participants_key duplicates; skip strict unique indexing.
        print("Warning: conversations_participants_key_unique index could not be built:", exc)
    await db.conversations.create_index([("updated_at", -1)], name="conversations_updated_at_desc")
    await db.conversations.create_index([("created_at", -1)], name="conversations_created_at_desc")

    await db.messages.create_index("message_id", unique=True, name="messages_message_id_unique")
    await db.messages.create_index("conversation_id", name="messages_conversation_id")
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)], name="messages_conversation_created_at")
    await db.messages.create_index([("created_at", -1)], name="messages_created_at_desc")
    await db.messages.create_index([("conversation_id", 1), ("seen", 1)], name="messages_conversation_seen")
