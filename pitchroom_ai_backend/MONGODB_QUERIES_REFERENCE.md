"""
Example MongoDB Aggregation Queries for User Aggregation System

These are the actual pipelines used in production.
Adjust field names based on your actual schema.
"""

# =============================================================================
# 1. GET USER SCRIPTS WITH PAGINATION
# =============================================================================

db.scripts.aggregate([
    {
        "$match": {
            "created_by": "507f1f77bcf86cd799439011"
        }
    },
    {
        "$sort": {
            "created_at": -1
        }
    },
    {
        "$skip": 0  # (page - 1) * limit
    },
    {
        "$limit": 20
    },
    {
        "$project": {
            "_id": 1,
            "title": 1,
            "description": 1,
            "language": 1,
            "genre": 1,
            "created_at": 1,
            "views": 1,
            "likes": 1,
            "shares": 1
        }
    }
])


# =============================================================================
# 2. GET SCRIPT ENGAGEMENT METRICS
# =============================================================================

db.script_engagement.aggregate([
    {
        "$match": {
            "user_id": "507f1f77bcf86cd799439011"
        }
    },
    {
        "$sort": {
            "last_engagement_at": -1
        }
    },
    {
        "$limit": 20
    },
    {
        "$project": {
            "_id": 1,
            "script_id": 1,
            "views_count": 1,
            "likes_count": 1,
            "shares_count": 1,
            "comments_count": 1,
            "last_engagement_at": 1
        }
    }
])


# =============================================================================
# 3. GET MESSAGES (SENT & RECEIVED) - COMPLEX OR CONDITION
# =============================================================================

db.messages.aggregate([
    {
        "$match": {
            "$or": [
                {
                    "sender_id": "507f1f77bcf86cd799439011"
                },
                {
                    "receiver_id": "507f1f77bcf86cd799439011"
                }
            ]
        }
    },
    {
        "$sort": {
            "created_at": -1
        }
    },
    {
        "$skip": 0
    },
    {
        "$limit": 20
    },
    {
        "$project": {
            "_id": 1,
            "conversation_id": 1,
            "sender_id": 1,
            "receiver_id": 1,
            "content": 1,
            "is_read": 1,
            "created_at": 1
        }
    }
])


# =============================================================================
# 4. GET USER CONVERSATIONS WITH ARRAY QUERY
# =============================================================================

db.conversations.aggregate([
    {
        "$match": {
            "participants": "507f1f77bcf86cd799439011"
        }
    },
    {
        "$sort": {
            "last_message_at": -1
        }
    },
    {
        "$skip": 0
    },
    {
        "$limit": 20
    },
    {
        "$project": {
            "_id": 1,
            "participants": 1,
            "last_message": 1,
            "last_message_at": 1,
            "created_at": 1
        }
    }
])


# =============================================================================
# 5. GET UNREAD NOTIFICATIONS
# =============================================================================

db.notifications.aggregate([
    {
        "$match": {
            "user_id": "507f1f77bcf86cd799439011"
        }
    },
    {
        "$sort": {
            "created_at": -1
        }
    },
    {
        "$skip": 0
    },
    {
        "$limit": 20
    },
    {
        "$project": {
            "_id": 1,
            "type": 1,
            "title": 1,
            "message": 1,
            "is_read": 1,
            "data": 1,
            "created_at": 1
        }
    }
])


# =============================================================================
# 6. GET USER POSTS WITH OPTIONAL FIELDS
# =============================================================================

db.posts.aggregate([
    {
        "$match": {
            "user_id": "507f1f77bcf86cd799439011"
        }
    },
    {
        "$sort": {
            "created_at": -1
        }
    },
    {
        "$skip": 0
    },
    {
        "$limit": 20
    },
    {
        "$project": {
            "_id": 1,
            "content": 1,
            "likes_count": {
                "$ifNull": [
                    "$likes_count",
                    0
                ]
            },
            "comments_count": {
                "$ifNull": [
                    "$comments_count",
                    0
                ]
            },
            "created_at": 1
        }
    }
])


# =============================================================================
# 7. GET USER POST LIKES
# =============================================================================

db.post_likes.aggregate([
    {
        "$match": {
            "user_id": "507f1f77bcf86cd799439011"
        }
    },
    {
        "$sort": {
            "created_at": -1
        }
    },
    {
        "$skip": 0
    },
    {
        "$limit": 20
    },
    {
        "$project": {
            "_id": 1,
            "post_id": 1,
            "created_at": 1
        }
    }
])


# =============================================================================
# 8. GET USER FILE UPLOADS
# =============================================================================

db.file_uploads.aggregate([
    {
        "$match": {
            "user_id": "507f1f77bcf86cd799439011"
        }
    },
    {
        "$sort": {
            "created_at": -1
        }
    },
    {
        "$skip": 0
    },
    {
        "$limit": 20
    },
    {
        "$project": {
            "_id": 1,
            "filename": 1,
            "file_type": 1,
            "file_size": 1,
            "url": 1,
            "created_at": 1
        }
    }
])


# =============================================================================
# 9. GET USER COLLECTIONS
# =============================================================================

db.collections.aggregate([
    {
        "$match": {
            "user_id": "507f1f77bcf86cd799439011"
        }
    },
    {
        "$sort": {
            "created_at": -1
        }
    },
    {
        "$skip": 0
    },
    {
        "$limit": 20
    },
    {
        "$project": {
            "_id": 1,
            "name": 1,
            "description": 1,
            "script_count": {
                "$ifNull": [
                    "$script_count",
                    0
                ]
            },
            "created_at": 1
        }
    }
])


# =============================================================================
# 10. COMPUTE TOTAL VIEWS ACROSS ALL USER'S SCRIPTS
# =============================================================================

db.scripts.aggregate([
    {
        "$match": {
            "created_by": "507f1f77bcf86cd799439011"
        }
    },
    {
        "$group": {
            "_id": null,
            "total_views": {
                "$sum": "$views"
            }
        }
    }
])


# =============================================================================
# 11. COMPUTE TOTAL ENGAGEMENT ACROSS ALL METRICS
# =============================================================================

db.script_engagement.aggregate([
    {
        "$match": {
            "user_id": "507f1f77bcf86cd799439011"
        }
    },
    {
        "$group": {
            "_id": null,
            "total": {
                "$sum": {
                    "$add": [
                        "$views_count",
                        "$likes_count",
                        "$shares_count",
                        "$comments_count"
                    ]
                }
            }
        }
    }
])


# =============================================================================
# 12. INDEX QUERIES (RUN THESE ONCE FOR OPTIMAL PERFORMANCE)
# =============================================================================

# Scripts Collection - Created by index
db.scripts.createIndex({ "created_by": 1 }, { name: "scripts_created_by" })

# Scripts Collection - Sorted by date
db.scripts.createIndex({ "created_at": -1 }, { name: "scripts_created_at_desc" })

# Messages Collection - Compound index for sender queries
db.messages.createIndex(
    { "sender_id": 1, "created_at": -1 },
    { name: "messages_sender_created_at" }
)

# Messages Collection - Compound index for receiver queries
db.messages.createIndex(
    { "receiver_id": 1, "created_at": -1 },
    { name: "messages_receiver_created_at" }
)

# Conversations Collection - Array field index
db.conversations.createIndex({ "participants": 1 }, { name: "conversations_participants" })

# Notifications Collection - User and unread index
db.notifications.createIndex(
    { "user_id": 1, "is_read": 1 },
    { name: "notifications_user_is_read" }
)

# Posts Collection - User and date index
db.posts.createIndex(
    { "user_id": 1, "created_at": -1 },
    { name: "posts_user_created_at" }
)

# Post Likes Collection - Unique compound index
db.post_likes.createIndex(
    { "post_id": 1, "user_id": 1 },
    { unique: true, name: "post_likes_post_user_unique" }
)

# Collections Collection - User index
db.collections.createIndex({ "user_id": 1 }, { name: "collections_user_id" })

# Character Profiles - User index
db.character_profiles.createIndex({ "user_id": 1 }, { name: "character_profiles_user_id" })

# Stories - User index
db.stories.createIndex({ "user_id": 1 }, { name: "stories_user_id" })

# File Uploads - User index
db.file_uploads.createIndex({ "user_id": 1 }, { name: "file_uploads_user_id" })


# =============================================================================
# 13. EXAMPLE TEST DATA CREATION
# =============================================================================

# Create test user
db.users.insertOne({
    "_id": ObjectId("507f1f77bcf86cd799439011"),
    "email": "john@example.com",
    "name": "John Doe",
    "role": "writer",
    "created_at": new Date(),
    "updated_at": new Date()
})

# Create user profile
db.profiles.insertOne({
    "_id": ObjectId("507f191e810c19729de860ea"),
    "user_id": "507f1f77bcf86cd799439011",
    "bio": "Screenwriter and storyteller",
    "avatar_url": "https://cdn.example.com/avatar.jpg",
    "followers_count": 245,
    "following_count": 89,
    "created_at": new Date()
})

# Create test script
db.scripts.insertOne({
    "_id": ObjectId("507f191e810c19729de860eb"),
    "created_by": "507f1f77bcf86cd799439011",
    "title": "The Last Window",
    "description": "A tense drama",
    "language": "English",
    "genre": "Drama",
    "created_at": new Date(),
    "views": 245,
    "likes": 18,
    "shares": 5
})

# Create engagement record
db.script_engagement.insertOne({
    "_id": ObjectId("507f191e810c19729de860ec"),
    "user_id": "507f1f77bcf86cd799439011",
    "script_id": "507f191e810c19729de860eb",
    "views_count": 245,
    "likes_count": 18,
    "shares_count": 5,
    "comments_count": 12,
    "last_engagement_at": new Date()
})


# =============================================================================
# 14. QUERY PERFORMANCE ANALYSIS
# =============================================================================

# Explain execution plan (shows index usage)
db.scripts.aggregate([{ "$match": { "created_by": "507f1f77bcf86cd799439011" } }]).explain("executionStats")

# Enable profiling to see slow queries
db.setProfilingLevel(1)

# View recent slow queries
db.system.profile.find({ "millis": { "$gt": 100 } }).sort({ ts: -1 }).limit(5)

# Check index sizes
db.scripts.aggregate([{ "$indexStats": {} }])

# Monitor current operations
db.currentOp()


# =============================================================================
# 15. PAGINATION EXAMPLES
# =============================================================================

# Page 1 (limit 20, skip 0)
db.scripts.find({ "created_by": "user_id" }).sort({ "created_at": -1 }).skip(0).limit(20)

# Page 2 (limit 20, skip 20)
db.scripts.find({ "created_by": "user_id" }).sort({ "created_at": -1 }).skip(20).limit(20)

# Page 3 (limit 20, skip 40)
db.scripts.find({ "created_by": "user_id" }).sort({ "created_at": -1 }).skip(40).limit(20)

# Calculate skip: skip = (page - 1) * limit
# For page 5 with limit 30: skip = (5 - 1) * 30 = 120
