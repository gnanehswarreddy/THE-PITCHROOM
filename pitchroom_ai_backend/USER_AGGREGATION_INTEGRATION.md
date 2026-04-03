# User Aggregation API - Integration Guide

## Quick Start

### Step 1: Ensure Indexes Are Created

On application startup, all required indexes are automatically created via `ensure_indexes()` in `database/schemas.py`.

### Step 2: Register & Create Test Data

```bash
# Register user
curl -X POST "http://localhost:8002/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Writer",
    "email": "john@example.com",
    "password": "SecurePass123",
    "role": "writer"
  }'

# Response:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }
```

### Step 3: Extract User ID from Token (Backend Only)

```python
# The JWT token contains the user_id in the 'sub' claim
# Decode it to get: user_id = jwt.decode(token, secret)['sub']
```

### Step 4: Fetch Full User Profile

```bash
export TOKEN="<jwt_token>"
export USER_ID="<extracted_user_id>"

curl -X GET "http://localhost:8002/user/full-profile/$USER_ID?limit=20&page=1" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 5: Fetch Profile Summary (Lightweight)

```bash
curl -X GET "http://localhost:8002/user/profile-summary/$USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Implementation Details

### Collections Queried

The aggregation system touches these MongoDB collections:

| Collection | Query Type | Purpose |
|---|---|---|
| `users` | Direct fetch | Basic user info |
| `profiles` | Direct fetch | Profile data, bio, avatar |
| `scripts` | Aggregation pipeline | User's scripts |
| `script_engagement` | Aggregation pipeline | Engagement metrics |
| `script_views` | Aggregation pipeline | View tracking |
| `messages` | Aggregation pipeline | Messages sent/received |
| `conversations` | Aggregation pipeline | Conversation metadata |
| `notifications` | Aggregation pipeline | User notifications |
| `posts` | Aggregation pipeline | Posts by user |
| `post_likes` | Aggregation pipeline | Likes by user |
| `post_comments` | Aggregation pipeline | Comments by user |
| `file_uploads` | Aggregation pipeline | Uploaded files |
| `collections` | Aggregation pipeline | Script collections |
| `collection_shares` | Aggregation pipeline | Shared collections |
| `character_profiles` | Aggregation pipeline | Character data |
| `stories` | Aggregation pipeline | Stories by user |

### Aggregation Pipeline Stages

All pipelines follow this pattern:

```
1. $match      → Filter by user_id or conditions
2. $sort       → Sort by created_at (descending) or engagement metrics
3. $skip       → Skip to page start
4. $limit      → Limit results per page
5. $project    → Select only needed fields
```

### Field Projections

Clean output by removing:
- `__v` (version field)
- Sensitive fields (passwords, tokens)
- Large text fields (full_script_text stored separately)

---

## Performance Optimization Tips

### 1. Use Pagination
Always use `?limit=` and `?page=` to paginate large results:

```bash
# Page 1
?limit=20&page=1

# Page 2
?limit=20&page=2

# Page 3
?limit=20&page=3
```

### 2. Use Profile Summary for Lists
For user cards in lists, use the lightweight summary endpoint:

```bash
GET /user/profile-summary/{user_id}
```

Instead of full profile which fetches all data.

### 3. Parallel Async Fetching
The service uses `asyncio.gather()` to fetch all data in parallel, not sequentially.

```python
# All 14 queries run in parallel, not one-by-one
results = await asyncio.gather(
    get_user_profile(db, user_id),
    get_user_scripts(db, user_id),
    get_script_engagement(db, user_id),
    # ... etc
)
```

### 4. Enable MongoDB Compression
In production, compress data between app and MongoDB:

```python
client = AsyncIOMotorClient(
    uri,
    compressors=['snappy', 'zlib']
)
```

### 5. Use Connection Pooling
MongoDB driver automatically pools connections. Tune with:

```python
client = AsyncIOMotorClient(
    uri,
    maxPoolSize=100,
    minPoolSize=10
)
```

---

## Security Checklist

- ✅ JWT authentication required on all endpoints
- ✅ Authorization check: users can only access their own data
- ✅ Admin role can access any user's data
- ✅ Input validation on user_id (ObjectId check)
- ✅ Sensitive fields removed from responses (passwords, tokens)
- ✅ Rate limiting on view endpoint (implemented in main backend)

---

## Error Handling

### 401 Unauthorized
Missing or invalid JWT token:
```json
{"detail": "Not authenticated"}
```

### 403 Forbidden
User trying to access another user's profile (non-admin):
```json
{"detail": "You can only access your own profile"}
```

### 404 Not Found
User doesn't exist:
```json
{
  "success": false,
  "data": null,
  "message": "User not found"
}
```

### 500 Internal Server Error
Database or processing error:
```json
{
  "detail": "Error fetching user profile: <error_details>"
}
```

---

## Database Schema Assumptions

The implementation assumes these MongoDB document structures:

### Users Collection
```javascript
{
  _id: ObjectId,
  email: String,
  name: String,
  role: String,
  created_at: Date,
  updated_at: Date
}
```

### Profiles Collection
```javascript
{
  _id: ObjectId,
  user_id: String,
  bio: String,
  avatar_url: String,
  followers_count: Number,
  created_at: Date
}
```

### Scripts Collection
```javascript
{
  _id: ObjectId,
  created_by: String,
  title: String,
  description: String,
  genre: String,
  language: String,
  views: Number,
  likes: Number,
  shares: Number,
  created_at: Date
}
```

### Messages Collection
```javascript
{
  _id: ObjectId,
  conversation_id: String,
  sender_id: String,
  receiver_id: String,
  content: String,
  is_read: Boolean,
  created_at: Date
}
```

### Notifications Collection
```javascript
{
  _id: ObjectId,
  user_id: String,
  type: String,
  title: String,
  message: String,
  is_read: Boolean,
  data: Object,
  created_at: Date
}
```

---

## Monitoring & Debugging

### Enable Logging
```python
# In config.py
DEBUG=true
```

### View Aggregation Queries
```python
# In service layer, enable logging:
logger.info(f"Executing pipeline: {pipeline}")
```

### Monitor Query Performance
```javascript
// In MongoDB

// Check query execution time
db.setProfilingLevel(1)
db.system.profile.find().sort({ ts: -1 }).limit(5)

// Check index usage
db.scripts.aggregate([...]).explain("executionStats")
```

---

## Migration from Simple Queries to Aggregation

### Before (Old Pattern)
```python
# Multiple database calls
user = await db.users.find_one({"_id": user_id})
scripts = await db.scripts.find({"created_by": user_id}).to_list(20)
messages = await db.messages.find({...}).to_list(20)
# 3+ round trips to database
```

### After (New Aggregation Pattern)
```python
# Single service call
profile = await user_aggregation_service.get_full_user_profile(db, user_id)
# Internally fetches all data in parallel
# Still single service call from route handler
```

---

## Testing User Aggregation

### Unit Test Example
```python
# test_user_aggregation.py
async def test_get_user_scripts(db):
    scripts = await user_aggregation_service.get_user_scripts(
        db, user_id="507f1f77bcf86cd799439011", limit=10
    )
    assert len(scripts) <= 10
    assert all("title" in s for s in scripts)
```

### Integration Test Example
```python
# See test_user_aggregation.py for full example
# Tests entire flow: register → get profile → verify structure
```

---

## Production Deployment Checklist

- [ ] Enable JWT secret rotation
- [ ] Enable MongoDB authentication
- [ ] Add rate limiting
- [ ] Enable CORS only for trusted domains
- [ ] Implement caching layer (Redis)
- [ ] Add comprehensive logging
- [ ] Set up monitoring/alerting
- [ ] Database backups configured
- [ ] Indexes built on all production collections
- [ ] Performance tuning completed
- [ ] Load testing done
- [ ] Security audit completed

---

## Support & Maintenance

### Add New Collection to Aggregation

1. Add `get_collection_name()` method to `UserAggregationService`
2. Add corresponding Pydantic model to `user_profile.py`
3. Add field to `UserFullProfile` model
4. Add method call to `_aggregate_all()`
5. Create appropriate MongoDB indexes
6. Update documentation

### Update Response Structure

1. Modify Pydantic model in `models/user_profile.py`
2. Add/remove fields from aggregation pipeline
3. Update API documentation
4. Test with new structure

---

**Last Updated**: March 24, 2026  
**Maintainer**: Backend Engineering Team  
**Status**: Production Ready
