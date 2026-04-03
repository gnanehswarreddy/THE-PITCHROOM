# User Aggregation API - Production Implementation

## Overview

The User Aggregation System fetches comprehensive user data across all PitchRoom collections and returns it in a single structured API response.

## Endpoints

### 1. Full User Profile
**GET** `/user/full-profile/{user_id}`

Aggregates all user data across collections.

**Query Parameters:**
- `limit` (int, default=20, max=100): Items per page
- `page` (int, default=1): Page number

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Example Request:**
```bash
curl -X GET "http://localhost:8002/user/full-profile/507f1f77bcf86cd799439011?limit=20&page=1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "writer",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-03-24T09:15:00Z"
    },
    "profile": {
      "id": "507f191e810c19729de860ea",
      "user_id": "507f1f77bcf86cd799439011",
      "bio": "Screenwriter and storyteller",
      "avatar_url": "https://cdn.example.com/avatars/user1.jpg",
      "cover_url": "https://cdn.example.com/covers/user1.jpg",
      "location": "Los Angeles, CA",
      "website": "https://johndoe.com",
      "followers_count": 245,
      "following_count": 89,
      "created_at": "2024-01-15T10:30:00Z"
    },
    "scripts": [
      {
        "id": "507f191e810c19729de860eb",
        "title": "The Last Window",
        "description": "A tense chamber drama",
        "language": "English",
        "genre": "Drama",
        "created_at": "2024-03-20T14:30:00Z",
        "views": 245,
        "likes": 18,
        "shares": 5
      }
    ],
    "engagement": [
      {
        "id": "507f191e810c19729de860ec",
        "script_id": "507f191e810c19729de860eb",
        "views_count": 245,
        "likes_count": 18,
        "shares_count": 5,
        "comments_count": 12,
        "last_engagement_at": "2024-03-24T08:45:00Z"
      }
    ],
    "messages": [
      {
        "id": "507f191e810c19729de860ed",
        "conversation_id": "507f191e810c19729de860ee",
        "sender_id": "507f1f77bcf86cd799439011",
        "receiver_id": "507f1f77bcf86cd799439012",
        "content": "Great work on the script!",
        "is_read": true,
        "created_at": "2024-03-23T10:20:00Z"
      }
    ],
    "conversations": [
      {
        "id": "507f191e810c19729de860ee",
        "participants": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
        "last_message": "Looking forward to the next version",
        "last_message_at": "2024-03-24T09:00:00Z",
        "created_at": "2024-03-10T15:30:00Z"
      }
    ],
    "notifications": [
      {
        "id": "507f191e810c19729de860ef",
        "user_id": "507f1f77bcf86cd799439011",
        "type": "script_like",
        "title": "New Like",
        "message": "Someone liked your script",
        "is_read": false,
        "data": {
          "script_id": "507f191e810c19729de860eb"
        },
        "created_at": "2024-03-24T08:30:00Z"
      }
    ],
    "posts": [
      {
        "id": "507f191e810c19729de860f0",
        "user_id": "507f1f77bcf86cd799439011",
        "content": "Excited to announce my new script is available!",
        "likes_count": 34,
        "comments_count": 8,
        "created_at": "2024-03-22T12:15:00Z"
      }
    ],
    "post_likes": [
      {
        "id": "507f191e810c19729de860f1",
        "post_id": "507f191e810c19729de860f0",
        "user_id": "507f1f77bcf86cd799439011",
        "created_at": "2024-03-24T07:45:00Z"
      }
    ],
    "post_comments": [
      {
        "id": "507f191e810c19729de860f2",
        "post_id": "507f191e810c19729de860f0",
        "user_id": "507f1f77bcf86cd799439011",
        "content": "Thanks everyone for the support!",
        "created_at": "2024-03-23T14:20:00Z"
      }
    ],
    "uploads": [
      {
        "id": "507f191e810c19729de860f3",
        "user_id": "507f1f77bcf86cd799439011",
        "filename": "script_draft_v2.pdf",
        "file_type": "application/pdf",
        "file_size": 245678,
        "url": "https://cdn.example.com/uploads/user1/script_draft_v2.pdf",
        "created_at": "2024-03-20T10:30:00Z"
      }
    ],
    "collections": [
      {
        "id": "507f191e810c19729de860f4",
        "user_id": "507f1f77bcf86cd799439011",
        "name": "Drama Masterpieces",
        "description": "My favorite drama scripts",
        "script_count": 12,
        "created_at": "2024-02-01T09:00:00Z"
      }
    ],
    "characters": [
      {
        "id": "507f191e810c19729de860f5",
        "user_id": "507f1f77bcf86cd799439011",
        "name": "Sarah Mitchell",
        "description": "Protagonist - a divorced architect seeking redemption",
        "created_at": "2024-03-15T11:20:00Z"
      }
    ],
    "stories": [
      {
        "id": "507f191e810c19729de860f6",
        "user_id": "507f1f77bcf86cd799439011",
        "title": "Journey to the Fifth Act",
        "content": "A behind-the-scenes look at script writing...",
        "created_at": "2024-03-18T16:45:00Z"
      }
    ],
    "stats": {
      "total_scripts": 8,
      "total_views": 2456,
      "total_engagement": 3421,
      "total_messages": 145,
      "total_conversations": 23,
      "total_notifications_unread": 5,
      "total_posts": 34,
      "total_uploads": 12,
      "total_collections": 3
    }
  },
  "message": "User profile aggregated successfully"
}
```

### 2. User Profile Summary
**GET** `/user/profile-summary/{user_id}`

Lightweight endpoint returning user stats and basic info (for user cards, lists).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Example Request:**
```bash
curl -X GET "http://localhost:8002/user/profile-summary/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "writer"
  },
  "profile": {
    "bio": "Screenwriter and storyteller",
    "avatar_url": "https://cdn.example.com/avatars/user1.jpg",
    "followers_count": 245
  },
  "stats": {
    "total_scripts": 8,
    "total_views": 2456,
    "total_engagement": 3421,
    "total_messages": 145,
    "total_conversations": 23,
    "total_notifications_unread": 5,
    "total_posts": 34,
    "total_uploads": 12,
    "total_collections": 3
  }
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "detail": "You can only access your own profile"
}
```

### 404 Not Found
```json
{
  "success": false,
  "data": null,
  "message": "User not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Error fetching user profile: [error details]"
}
```

## MongoDB Aggregation Pipelines

### User Scripts Pipeline
```javascript
db.scripts.aggregate([
  { $match: { created_by: user_id } },
  { $sort: { created_at: -1 } },
  { $skip: skip },
  { $limit: limit },
  {
    $project: {
      title: 1,
      description: 1,
      language: 1,
      genre: 1,
      created_at: 1,
      views: 1,
      likes: 1,
      shares: 1
    }
  }
])
```

### Script Engagement Pipeline
```javascript
db.script_engagement.aggregate([
  { $match: { user_id: user_id } },
  { $sort: { last_engagement_at: -1 } },
  { $limit: limit },
  {
    $project: {
      script_id: 1,
      views_count: 1,
      likes_count: 1,
      shares_count: 1,
      comments_count: 1,
      last_engagement_at: 1
    }
  }
])
```

### Messages with Multiple Conditions
```javascript
db.messages.aggregate([
  {
    $match: {
      $or: [
        { sender_id: user_id },
        { receiver_id: user_id }
      ]
    }
  },
  { $sort: { created_at: -1 } },
  { $skip: skip },
  { $limit: limit },
  {
    $project: {
      conversation_id: 1,
      sender_id: 1,
      receiver_id: 1,
      content: 1,
      is_read: 1,
      created_at: 1
    }
  }
])
```

### User Statistics Aggregation
```javascript
// Total Scripts
db.scripts.countDocuments({ created_by: user_id })

// Total Views
db.scripts.aggregate([
  { $match: { created_by: user_id } },
  { $group: { _id: null, total_views: { $sum: "$views" } } }
])

// Total Engagement
db.script_engagement.aggregate([
  { $match: { user_id: user_id } },
  {
    $group: {
      _id: null,
      total: {
        $sum: {
          $add: ["$views_count", "$likes_count", "$shares_count", "$comments_count"]
        }
      }
    }
  }
])

// Total Unread Notifications
db.notifications.countDocuments({ user_id: user_id, is_read: false })
```

## Required Indexes (Auto-Created on Startup)

```
### User Collection
- email (unique)
- role

### Scripts Collection
- created_by
- created_at
- genre
- language
- keywords
- hash_signature (unique, partial)

### Messages Collection
- sender_id
- receiver_id
- conversation_id
- [sender_id, created_at]
- [receiver_id, created_at]

### Conversations Collection
- participants
- last_message_at

### Notifications Collection
- user_id
- [user_id, created_at]
- [user_id, is_read]

### Posts Collection
- user_id
- created_at

### Post Likes Collection
- user_id
- post_id
- [post_id, user_id] (unique)

### Post Comments Collection
- user_id
- post_id

### File Uploads Collection
- user_id
- created_at

### Collections Collection
- user_id
- created_at

### Character Profiles Collection
- user_id
- created_at

### Stories Collection
- user_id
- created_at

### Script Engagement Collection
- user_id
- script_id
- last_engagement_at

### Script Views Collection
- user_id
- script_id

### Collection Shares Collection
- collection_id
- shared_with_user_id
```

## Performance Notes

1. **Pagination**: Results are paginated to avoid large payloads. Default limit=20, max=100.

2. **Parallel Async Operations**: All collection queries run in parallel for optimal performance.

3. **Projection**: Only required fields are fetched to minimize network transfer.

4. **Sorting**: Results sorted by `created_at` (most recent first) or `last_engagement_at`.

5. **Limits Applied**:
   - Scripts: 20 per page
   - Messages: 20 per page
   - Conversations: 20 per page
   - Notifications: 20 per page
   - Posts: 20 per page
   - Uploads: 20 per page
   - Collections: 20 per page
   - Characters: 20 per page
   - Stories: 20 per page

## Security

✅ **JWT Authentication Required**: All endpoints require valid JWT token in `Authorization` header.

✅ **Authorization Check**: Users can only access their own profile (or admins can access any).

✅ **Sensitive Fields Removed**: Passwords and sensitive data are not included in responses.

✅ **Input Validation**: user_id is validated as ObjectId before querying.

## Testing

### Register & Login
```bash
# Register
curl -X POST "http://localhost:8002/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123",
    "role": "writer"
  }'

# Login
curl -X POST "http://localhost:8002/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

### Get Full Profile
```bash
export TOKEN="<jwt_token_from_login>"
export USER_ID="<user_id_from_response>"

curl -X GET "http://localhost:8002/user/full-profile/$USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Profile Summary
```bash
curl -X GET "http://localhost:8002/user/profile-summary/$USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

## Database Requirements

Ensure the following collections exist in MongoDB:
- users
- profiles
- scripts
- script_engagement
- script_views
- messages
- conversations
- notifications
- posts
- post_likes
- post_comments
- file_uploads
- collections
- collection_shares
- character_profiles
- stories

All indexes are auto-created on application startup via `ensure_indexes()` in `schemas.py`.

## Scalability

For production deployments with millions of users:

1. **Add Caching**: Implement Redis caching for frequently accessed profiles.
2. **Database Sharding**: Shard by user_id for horizontal scaling.
3. **Read Replicas**: Use MongoDB replicas for read-heavy aggregation queries.
4. **Batch Operations**: Use bulk aggregation for bulk exports.
5. **Archive Old Data**: Archive notifications/messages older than X days to separate collection.

---

**Implementation Date**: March 24, 2026  
**Status**: Production Ready  
**API Version**: 1.0
