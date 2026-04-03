from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import OperationFailure


async def _create_index_resilient(collection, keys, **kwargs) -> None:
    """Create index and recreate it when options conflict with an existing name."""
    name = kwargs.get("name")
    try:
        await collection.create_index(keys, **kwargs)
    except OperationFailure as exc:
        # MongoDB uses code 85 for index option conflicts (same name, different options).
        if getattr(exc, "code", None) == 85 and name:
            await collection.drop_index(name)
            await collection.create_index(keys, **kwargs)
        else:
            raise


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await _create_index_resilient(db.users, "email", unique=True, name="users_email_unique")
    await _create_index_resilient(db.users, "role", name="users_role")

    # Scripts indexes
    await _create_index_resilient(db.scripts, "created_by", name="scripts_created_by")
    await _create_index_resilient(db.scripts, "created_at", name="scripts_created_at_desc")
    await _create_index_resilient(db.scripts, "genre", name="scripts_genre")
    await _create_index_resilient(db.scripts, "language", name="scripts_language")
    await _create_index_resilient(db.scripts, "keywords", name="scripts_keywords")
    await _create_index_resilient(
        db.scripts,
        "hash_signature",
        unique=True,
        name="scripts_hash_signature_unique",
        partialFilterExpression={"hash_signature": {"$type": "string"}},
    )

    # Script engagement indexes
    await _create_index_resilient(db.script_engagement, "user_id", name="script_engagement_user_id")
    await _create_index_resilient(db.script_engagement, "script_id", name="script_engagement_script_id")
    await _create_index_resilient(
        db.script_engagement, "last_engagement_at", name="script_engagement_last_engagement_at"
    )

    # Script views indexes
    await _create_index_resilient(db.script_views, "user_id", name="script_views_user_id")
    await _create_index_resilient(db.script_views, "script_id", name="script_views_script_id")

    # Messages indexes
    await _create_index_resilient(db.messages, "sender_id", name="messages_sender_id")
    await _create_index_resilient(db.messages, "receiver_id", name="messages_receiver_id")
    await _create_index_resilient(db.messages, "conversation_id", name="messages_conversation_id")
    await _create_index_resilient(
        db.messages,
        [("sender_id", 1), ("created_at", -1)],
        name="messages_sender_created_at",
    )
    await _create_index_resilient(
        db.messages,
        [("receiver_id", 1), ("created_at", -1)],
        name="messages_receiver_created_at",
    )

    # Conversations indexes
    await _create_index_resilient(db.conversations, "participants", name="conversations_participants")
    await _create_index_resilient(db.conversations, "last_message_at", name="conversations_last_message_at")

    # Notifications indexes
    await _create_index_resilient(db.notifications, "user_id", name="notifications_user_id")
    await _create_index_resilient(db.notifications, [("user_id", 1), ("created_at", -1)], name="notifications_user_created_at")
    await _create_index_resilient(db.notifications, [("user_id", 1), ("is_read", 1)], name="notifications_user_is_read")

    # Posts indexes
    await _create_index_resilient(db.posts, "user_id", name="posts_user_id")
    await _create_index_resilient(db.posts, "created_at", name="posts_created_at")

    # Post likes indexes
    await _create_index_resilient(db.post_likes, "user_id", name="post_likes_user_id")
    await _create_index_resilient(db.post_likes, "post_id", name="post_likes_post_id")
    await _create_index_resilient(
        db.post_likes,
        [("post_id", 1), ("user_id", 1)],
        unique=True,
        name="post_likes_post_user_unique",
    )

    # Post comments indexes
    await _create_index_resilient(db.post_comments, "user_id", name="post_comments_user_id")
    await _create_index_resilient(db.post_comments, "post_id", name="post_comments_post_id")

    # File uploads indexes
    await _create_index_resilient(db.file_uploads, "user_id", name="file_uploads_user_id")
    await _create_index_resilient(db.file_uploads, "created_at", name="file_uploads_created_at")

    # Collections indexes
    await _create_index_resilient(db.collections, "user_id", name="collections_user_id")
    await _create_index_resilient(db.collections, "created_at", name="collections_created_at")

    # Collection shares indexes
    await _create_index_resilient(db.collection_shares, "collection_id", name="collection_shares_collection_id")
    await _create_index_resilient(db.collection_shares, "shared_with_user_id", name="collection_shares_shared_with_user_id")

    # Character profiles indexes
    await _create_index_resilient(db.character_profiles, "user_id", name="character_profiles_user_id")
    await _create_index_resilient(db.character_profiles, "created_at", name="character_profiles_created_at")

    # Stories indexes
    await _create_index_resilient(db.stories, "user_id", name="stories_user_id")
    await _create_index_resilient(db.stories, "created_at", name="stories_created_at")

    # Interactions indexes (existing)
    await _create_index_resilient(
        db.interactions,
        [("user_id", 1), ("timestamp", -1)],
        name="interactions_user_timestamp",
    )
    await _create_index_resilient(
        db.interactions,
        [("script_id", 1), ("timestamp", -1)],
        name="interactions_script_timestamp",
    )

    # =====================================================================
    # Messaging System Indexes - Instagram-style Real-time Messaging
    # =====================================================================

    # Conversations indexes - optimized for inbox queries
    await _create_index_resilient(
        db.conversations,
        "participant_key",
        unique=True,
        name="conversations_participant_key_unique",
    )
    await _create_index_resilient(
        db.conversations,
        [("participants", 1), ("updated_at", -1)],
        name="conversations_participants_updated_at",
    )
    await _create_index_resilient(
        db.conversations,
        "updated_at",
        name="conversations_updated_at",
    )

    # Messages indexes - optimized for message fetching and filtering
    await _create_index_resilient(
        db.messages,
        [("conversation_id", 1), ("created_at", -1)],
        name="messages_conversation_created_at",
    )
    await _create_index_resilient(
        db.messages,
        [("conversation_id", 1), ("sender_id", 1), ("created_at", -1)],
        name="messages_conversation_sender_created_at",
    )
    await _create_index_resilient(
        db.messages,
        [("conversation_id", 1), ("seen", 1)],
        name="messages_conversation_seen",
    )
    await _create_index_resilient(
        db.messages,
        [("sender_id", 1), ("conversation_id", 1)],
        name="messages_sender_conversation",
    )
    await _create_index_resilient(
        db.messages,
        "created_at",
        name="messages_created_at",
    )

    # Typing indicators - real-time
    await _create_index_resilient(
        db.typing_indicators,
        [("conversation_id", 1), ("user_id", 1)],
        name="typing_indicators_conversation_user",
    )
    await _create_index_resilient(
        db.typing_indicators,
        "timestamp",
        name="typing_indicators_timestamp",
    )

    # User presence - real-time status
    await _create_index_resilient(
        db.user_presence,
        "user_id",
        unique=True,
        name="user_presence_user_id",
    )
    await _create_index_resilient(
        db.user_presence,
        "last_seen",
        name="user_presence_last_seen",
    )

    # Conversation settings - per-user preferences
    await _create_index_resilient(
        db.conversation_settings,
        [("conversation_id", 1), ("user_id", 1)],
        unique=True,
        name="conversation_settings_conversation_user",
    )
    await _create_index_resilient(
        db.conversation_settings,
        [("user_id", 1), ("archived", 1)],
        name="conversation_settings_user_archived",
    )
    await _create_index_resilient(
        db.interactions,
        [("user_id", 1), ("script_id", 1), ("type", 1)],
        name="interactions_user_script_type",
    )
