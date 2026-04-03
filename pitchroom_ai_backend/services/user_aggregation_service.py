from __future__ import annotations

from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.models.user_profile import (
    UserFullProfile,
    UserBasic,
    UserProfileData,
    ScriptBasic,
    ScriptEngagement,
    Message,
    Conversation,
    Notification,
    Post,
    PostLike,
    PostComment,
    Upload,
    Collection,
    CharacterProfile,
    Story,
)


class UserAggregationService:
    """Service for aggregating user data across multiple MongoDB collections."""

    async def get_user_basic(self, db: AsyncIOMotorDatabase, user_id: str) -> dict[str, Any] | None:
        """Fetch basic user information."""
        if not ObjectId.is_valid(user_id):
            return None

        result = await db.users.find_one({"_id": ObjectId(user_id)})
        return result

    async def get_user_profile(self, db: AsyncIOMotorDatabase, user_id: str) -> dict[str, Any] | None:
        """Fetch user profile information."""
        if not ObjectId.is_valid(user_id):
            return None

        result = await db.profiles.find_one({"user_id": user_id})
        return result

    async def get_user_scripts(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch scripts created by the user."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {"$match": {"created_by": user_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "title": 1,
                    "description": 1,
                    "language": 1,
                    "genre": 1,
                    "created_at": 1,
                    "views": 1,
                    "likes": 1,
                    "shares": 1,
                }
            },
        ]

        results = await db.scripts.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_script_engagement(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20
    ) -> list[dict[str, Any]]:
        """Fetch script engagement for user's scripts."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$sort": {"last_engagement_at": -1}},
            {"$limit": limit},
            {
                "$project": {
                    "script_id": 1,
                    "views_count": 1,
                    "likes_count": 1,
                    "shares_count": 1,
                    "comments_count": 1,
                    "last_engagement_at": 1,
                }
            },
        ]

        results = await db.script_engagement.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_messages(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch messages for the user (sent and received)."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {
                "$match": {
                    "$or": [
                        {"sender_id": user_id},
                        {"receiver_id": user_id},
                    ]
                }
            },
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "conversation_id": 1,
                    "sender_id": 1,
                    "receiver_id": 1,
                    "content": 1,
                    "is_read": 1,
                    "created_at": 1,
                }
            },
        ]

        results = await db.messages.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_conversations(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch conversations for the user."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {
                "$match": {
                    "participants": user_id,
                }
            },
            {"$sort": {"last_message_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "participants": 1,
                    "last_message": 1,
                    "last_message_at": 1,
                    "created_at": 1,
                }
            },
        ]

        results = await db.conversations.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_notifications(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch notifications for the user."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "type": 1,
                    "title": 1,
                    "message": 1,
                    "is_read": 1,
                    "data": 1,
                    "created_at": 1,
                }
            },
        ]

        results = await db.notifications.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_posts(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch posts created by the user."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "content": 1,
                    "likes_count": {"$ifNull": ["$likes_count", 0]},
                    "comments_count": {"$ifNull": ["$comments_count", 0]},
                    "created_at": 1,
                }
            },
        ]

        results = await db.posts.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_post_likes(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch post likes by the user."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "post_id": 1,
                    "created_at": 1,
                }
            },
        ]

        results = await db.post_likes.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_post_comments(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch post comments by the user."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "post_id": 1,
                    "content": 1,
                    "created_at": 1,
                }
            },
        ]

        results = await db.post_comments.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_uploads(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch file uploads by the user."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "filename": 1,
                    "file_type": 1,
                    "file_size": 1,
                    "url": 1,
                    "created_at": 1,
                }
            },
        ]

        results = await db.file_uploads.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_collections(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch collections created/owned by the user."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "name": 1,
                    "description": 1,
                    "script_count": {"$ifNull": ["$script_count", 0]},
                    "created_at": 1,
                }
            },
        ]

        results = await db.collections.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_characters(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch character profiles created by the user."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "name": 1,
                    "description": 1,
                    "created_at": 1,
                }
            },
        ]

        results = await db.character_profiles.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_stories(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 20, skip: int = 0
    ) -> list[dict[str, Any]]:
        """Fetch stories created by the user."""
        if not ObjectId.is_valid(user_id):
            return []

        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "title": 1,
                    "content": 1,
                    "created_at": 1,
                }
            },
        ]

        results = await db.stories.aggregate(pipeline).to_list(length=limit)
        return results

    async def get_user_stats(self, db: AsyncIOMotorDatabase, user_id: str) -> dict[str, int]:
        """Calculate aggregated statistics for the user."""
        stats = {
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

        if not ObjectId.is_valid(user_id):
            return stats

        try:
            stats["total_scripts"] = await db.scripts.count_documents({"created_by": user_id})

            script_stats = await db.scripts.aggregate(
                [{"$match": {"created_by": user_id}}, {"$group": {"_id": None, "total_views": {"$sum": "$views"}}}]
            ).to_list(length=1)
            if script_stats:
                stats["total_views"] = script_stats[0].get("total_views", 0)

            engagement_stats = await db.script_engagement.aggregate(
                [
                    {"$match": {"user_id": user_id}},
                    {
                        "$group": {
                            "_id": None,
                            "total": {
                                "$sum": {
                                    "$add": ["$views_count", "$likes_count", "$shares_count", "$comments_count"]
                                }
                            },
                        }
                    },
                ]
            ).to_list(length=1)
            if engagement_stats:
                stats["total_engagement"] = engagement_stats[0].get("total", 0)

            stats["total_messages"] = await db.messages.count_documents(
                {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]}
            )

            stats["total_conversations"] = await db.conversations.count_documents({"participants": user_id})

            stats["total_notifications_unread"] = await db.notifications.count_documents(
                {"user_id": user_id, "is_read": False}
            )

            stats["total_posts"] = await db.posts.count_documents({"user_id": user_id})

            stats["total_uploads"] = await db.file_uploads.count_documents({"user_id": user_id})

            stats["total_collections"] = await db.collections.count_documents({"user_id": user_id})

        except Exception:
            pass

        return stats

    async def get_full_user_profile(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        limit: int = 20,
        page: int = 1,
    ) -> UserFullProfile | None:
        """Aggregate all user data into a single comprehensive profile."""
        skip = (page - 1) * limit

        user_basic = await self.get_user_basic(db, user_id)
        if not user_basic:
            return None

        # Fetch all data in parallel
        user_profile, scripts, engagement, messages, conversations, notifications, posts, post_likes, post_comments, uploads, collections, characters, stories, stats = await self._aggregate_all(
            db, user_id, limit, skip
        )

        return UserFullProfile(
            user=UserBasic(**self._prepare_doc(user_basic)),
            profile=UserProfileData(**self._prepare_doc(user_profile)) if user_profile else None,
            scripts=[ScriptBasic(**self._prepare_doc(s)) for s in scripts],
            engagement=[ScriptEngagement(**self._prepare_doc(e)) for e in engagement],
            messages=[Message(**self._prepare_doc(m)) for m in messages],
            conversations=[Conversation(**self._prepare_doc(c)) for c in conversations],
            notifications=[Notification(**self._prepare_doc(n)) for n in notifications],
            posts=[Post(**self._prepare_doc(p)) for p in posts],
            post_likes=[PostLike(**self._prepare_doc(pl)) for pl in post_likes],
            post_comments=[PostComment(**self._prepare_doc(pc)) for pc in post_comments],
            uploads=[Upload(**self._prepare_doc(u)) for u in uploads],
            collections=[Collection(**self._prepare_doc(c)) for c in collections],
            characters=[CharacterProfile(**self._prepare_doc(ch)) for ch in characters],
            stories=[Story(**self._prepare_doc(st)) for st in stories],
            stats=stats,
        )

    async def _aggregate_all(self, db: AsyncIOMotorDatabase, user_id: str, limit: int, skip: int) -> tuple:
        """Fetch all user data in parallel."""
        import asyncio

        results = await asyncio.gather(
            self.get_user_profile(db, user_id),
            self.get_user_scripts(db, user_id, limit, skip),
            self.get_script_engagement(db, user_id, limit),
            self.get_user_messages(db, user_id, limit, skip),
            self.get_user_conversations(db, user_id, limit, skip),
            self.get_user_notifications(db, user_id, limit, skip),
            self.get_user_posts(db, user_id, limit, skip),
            self.get_user_post_likes(db, user_id, limit, skip),
            self.get_user_post_comments(db, user_id, limit, skip),
            self.get_user_uploads(db, user_id, limit, skip),
            self.get_user_collections(db, user_id, limit, skip),
            self.get_user_characters(db, user_id, limit, skip),
            self.get_user_stories(db, user_id, limit, skip),
            self.get_user_stats(db, user_id),
        )

        return results

    @staticmethod
    def _prepare_doc(doc: dict[str, Any]) -> dict[str, Any]:
        """Convert MongoDB _id to id string for Pydantic."""
        if not doc:
            return {}

        prepared = dict(doc)
        if "_id" in prepared:
            prepared["_id"] = str(prepared["_id"])

        return prepared


user_aggregation_service = UserAggregationService()
