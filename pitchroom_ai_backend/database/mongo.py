from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from pitchroom_ai_backend.config import settings


class Mongo:
    def __init__(self) -> None:
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None

    async def connect(self) -> None:
        if self.db is not None:
            return
        self.client = AsyncIOMotorClient(settings.mongodb_uri)
        self.db = self.client[settings.mongodb_db]

    async def disconnect(self) -> None:
        if self.client is not None:
            self.client.close()
        self.client = None
        self.db = None


mongo = Mongo()


def get_db() -> AsyncIOMotorDatabase:
    if mongo.db is None:
        raise RuntimeError("Database not initialized")
    return mongo.db
