# Messaging System - Database Design & Optimization

Complete guide to database schema, indexes, and query optimization for the messaging system.

---

## Database Schema

### Collections Overview

| Collection | Purpose | Documents | Volatility |
|-----------|---------|-----------|-----------|
| `conversations` | Chat lookup & metadata | Low | Medium |
| `messages` | Message storage | Very High | Append-only |
| `typing_indicators` | Real-time typing status | Medium | High |
| `user_presence` | Online status | Low | High |
| `conversation_settings` | Per-user preferences | Low | Low |

---

## Conversations Collection

### Schema

```javascript
{
  _id: ObjectId,                    // Unique document ID
  
  // Key fields
  participant_key: "user1:user2",   // Sorted participants (for deduplication)
  participants: ["user1", "user2"], // Array of participant user IDs
  
  // Message metadata
  last_message_id: ObjectId,        // ID of last message (for quick access)
  last_message_text: "...",         // Preview text (max 100 chars)
  last_message_sender_id: "user_id",
  
  // Timestamps
  created_at: ISODate,              // When conversation was created
  updated_at: ISODate,              // When last updated (sorted by this)
  
  // Statistics
  message_count: 524                // Total messages in conversation
}
```

### Indexes

```javascript
// Unique index - prevent duplicate conversations
db.conversations.createIndex(
  { participant_key: 1 },
  { unique: true, name: "conversations_participant_key_unique" }
);

// Composite index - inbox query (find user's conversations sorted by recent)
db.conversations.createIndex(
  { participants: 1, updated_at: -1 },
  { name: "conversations_participants_updated_at" }
);

// Single index - sorting by timestamp
db.conversations.createIndex(
  { updated_at: -1 },
  { name: "conversations_updated_at" }
);
```

### Example Queries

**Get user's inbox (sorted by most recent)**:
```javascript
db.conversations.find({
  participants: userId
})
.sort({ updated_at: -1 })
.limit(20);

// Query plan with index:
// "stage": "COLLSCAN" → "IXSCAN" (conversations_participants_updated_at)
// Indexed sort: very fast
```

**Find conversation between two users**:
```javascript
db.conversations.findOne({
  participant_key: "user1:user2"  // Already sorted, prevents duplicates
});

// Query plan:
// "stage": "IDHACK" → "IXSCAN" (conversations_participant_key_unique)
// Unique index: instant lookup
```

---

## Messages Collection

### Schema

```javascript
{
  _id: ObjectId,               // Unique message ID
  
  // References
  conversation_id: "conv_id",  // Parent conversation ID
  sender_id: "user_id",        // Who sent the message
  
  // Content
  text: "Message content",     // 1-5000 characters
  
  // Status
  seen: false,                 // Whether message was seen
  seen_by: ["user_id"],        // Array of users who saw it
  seen_at: ISODate,            // When first user saw it
  
  // Timestamps
  created_at: ISODate          // When message was sent
}
```

### Indexes

```javascript
// Composite index - fetch messages for conversation sorted by time
db.messages.createIndex(
  { conversation_id: 1, created_at: -1 },
  { name: "messages_conversation_created_at" }
);

// Composite index - filter by sender in conversation
db.messages.createIndex(
  { conversation_id: 1, sender_id: 1, created_at: -1 },
  { name: "messages_conversation_sender_created_at" }
);

// Composite index - count unread messages
db.messages.createIndex(
  { conversation_id: 1, seen: 1 },
  { name: "messages_conversation_seen" }
);

// Composite index - sender's messages in conversation
db.messages.createIndex(
  { sender_id: 1, conversation_id: 1 },
  { name: "messages_sender_conversation" }
);

// Single index - cleanup old messages
db.messages.createIndex(
  { created_at: 1 },
  { 
    name: "messages_created_at",
    expireAfterSeconds: 2592000  // Auto-delete after 30 days (optional)
  }
);
```

### Example Queries

**Get messages in conversation (pagination)**:
```javascript
// Page 1 (most recent 50 messages)
db.messages.find({
  conversation_id: "conv_id"
})
.sort({ created_at: -1 })
.skip(0)
.limit(50);

// Query plan:
// "stage": "IXSCAN" (messages_conversation_created_at)
// "direction": "backward"  // Sorted index used
// Very efficient pagination

// Page 2 (next 50)
db.messages.find({
  conversation_id: "conv_id"
})
.sort({ created_at: -1 })
.skip(50)
.limit(50);
```

**Count unread messages in conversation**:
```javascript
db.messages.countDocuments({
  conversation_id: "conv_id",
  sender_id: { $ne: userId },
  seen: false
});

// Query plan:
// "stage": "IXSCAN" (messages_conversation_seen)
// Fast count operation
```

**Mark messages as seen**:
```javascript
db.messages.updateMany(
  {
    conversation_id: "conv_id",
    sender_id: { $ne: userId },
    seen: false
  },
  {
    $set: { seen: true, seen_at: new Date() },
    $addToSet: { seen_by: userId }
  }
);

// Batch update uses index for filtering
// All matching documents updated efficiently
```

**Get user's recent conversations with unread counts**:
```javascript
db.conversations.aggregate([
  {
    $match: {
      participants: userId
    }
  },
  {
    $sort: { updated_at: -1 }
  },
  {
    $limit: 20
  },
  {
    $lookup: {
      from: "messages",
      localField: "_id",
      foreignField: "conversation_id",
      as: "unread_messages",
      pipeline: [
        {
          $match: {
            sender_id: { $ne: userId },
            seen: false
          }
        },
        {
          $count: "count"
        }
      ]
    }
  },
  {
    $project: {
      conversation_id: "$_id",
      participants: 1,
      last_message: 1,
      unread_count: {
        $arrayElemAt: ["$unread_messages.count", 0]
      }
    }
  }
]);

// Execution plan:
// 1. IXSCAN: conversations_participants_updated_at (fast)
// 2. LIMIT: 20 conversations
// 3. LOOKUP: for each conversation, count unread (nested queries)
// Total: ~20 database operations
```

---

## Typing Indicators Collection

### Schema

```javascript
{
  _id: ObjectId,
  conversation_id: "conv_id",
  user_id: "user_id",
  is_typing: true,           // Current status
  timestamp: ISODate         // Last update time
}
```

### Indexes

```javascript
// Unique composite index - one entry per (conversation, user)
db.typing_indicators.createIndex(
  { conversation_id: 1, user_id: 1 },
  { unique: true, name: "typing_indicators_conversation_user" }
);

// Index for cleanup - remove old records
db.typing_indicators.createIndex(
  { timestamp: 1 },
  { 
    expireAfterSeconds: 5,  // Auto-delete after 5 seconds
    name: "typing_indicators_timestamp"
  }
);
```

### Example Queries

**Get users currently typing in conversation**:
```javascript
const now = new Date();
const fiveSecondsAgo = new Date(now.getTime() - 5000);

db.typing_indicators.find({
  conversation_id: "conv_id",
  is_typing: true,
  timestamp: { $gt: fiveSecondsAgo }
});

// Query plan:
// "stage": "IXSCAN" (typing_indicators_conversation_user + timestamp)
// Instant lookup, TTL index auto-cleans old records
```

**Record typing status**:
```javascript
db.typing_indicators.updateOne(
  {
    conversation_id: "conv_id",
    user_id: "user_id"
  },
  {
    $set: {
      is_typing: true,
      timestamp: new Date()
    }
  },
  { upsert: true }
);

// Upsert: insert if not exists, update if does
// Unique index: prevents duplicates
```

---

## User Presence Collection

### Schema

```javascript
{
  _id: ObjectId,
  user_id: "user_id",                    // Who
  online: true,                          // Current status
  last_seen: ISODate,                    // When they were last active
  active_conversation_id: "conv_id"  // Optional: what they're viewing
}
```

### Indexes

```javascript
// Unique index - one entry per user
db.user_presence.createIndex(
  { user_id: 1 },
  { unique: true, name: "user_presence_user_id" }
);

// Index for cleanup queries
db.user_presence.createIndex(
  { last_seen: 1 },
  { name: "user_presence_last_seen" }
);
```

### Example Queries

**Update user's presence**:
```javascript
db.user_presence.updateOne(
  { user_id: "user_id" },
  {
    $set: {
      online: true,
      last_seen: new Date(),
      active_conversation_id: "conv_id"
    }
  },
  { upsert: true }
);
```

**Get user's presence status**:
```javascript
db.user_presence.findOne({ user_id: "user_id" });

// Query plan:
// "stage": "IDHACK"
// Instant lookup with unique index
```

---

## Conversation Settings Collection

### Schema

```javascript
{
  _id: ObjectId,
  conversation_id: "conv_id",
  user_id: "user_id",
  archived: false,           // Per-user archive status
  muted: false,              // Per-user mute status
  updated_at: ISODate
}
```

### Indexes

```javascript
// Composite unique index - one setting per (conversation, user)
db.conversation_settings.createIndex(
  { conversation_id: 1, user_id: 1 },
  { unique: true, name: "conversation_settings_conversation_user" }
);

// Index for finding archived conversations
db.conversation_settings.createIndex(
  { user_id: 1, archived: 1 },
  { name: "conversation_settings_user_archived" }
);
```

### Example Queries

**Get user's archived conversations**:
```javascript
db.conversation_settings.find({
  user_id: "user_id",
  archived: true
});
```

---

## Query Patterns

### Pattern 1: Fetch Inbox (Most Common)

**Operation**: User opens messaging app, sees list of conversations

```javascript
db.conversations.aggregate([
  {
    $match: { participants: userId }
  },
  {
    $sort: { updated_at: -1 }
  },
  {
    $skip: (page - 1) * 20
  },
  {
    $limit: 20
  },
  {
    $lookup: {
      from: "messages",
      let: { convId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$conversation_id", "$$convId"] } } },
        { $sort: { created_at: -1 } },
        { $limit: 1 },
        { $project: { text: 1, sender_id: 1, created_at: 1 } }
      ],
      as: "last_message"
    }
  }
]);

// Performance: ~50-100ms for 20 conversations
// Indexes used: conversations_participants_updated_at
```

### Pattern 2: Fetch Messages (Very Common)

**Operation**: User opens a conversation

```javascript
db.messages.aggregate([
  {
    $match: { 
      conversation_id: ObjectId(convId),
      created_at: { $gt: ISODate(startDate) }
    }
  },
  {
    $sort: { created_at: -1 }
  },
  {
    $limit: 50
  },
  {
    $lookup: {
      from: "users",
      localField: "sender_id",
      foreignField: "_id",
      as: "sender"
    }
  },
  {
    $project: {
      _id: 1,
      text: 1,
      sender_id: 1,
      "sender.name": 1,
      "sender.avatar": 1,
      created_at: 1,
      seen: 1
    }
  }
]);

// Performance: ~30-50ms for 50 messages
// Indexes used: messages_conversation_created_at, users index
```

### Pattern 3: Mark as Seen (Common)

**Operation**: User reads a message

```javascript
db.messages.updateMany(
  {
    conversation_id: ObjectId(convId),
    sender_id: { $ne: userId },
    seen: false
  },
  {
    $set: { seen: true, seen_at: new Date() },
    $addToSet: { seen_by: userId }
  }
);

// Performance: ~10-20ms
// Indexes used: messages_conversation_seen
```

### Pattern 4: Search Conversations (Less Common)

**Operation**: User searches for person in messaging

```javascript
db.conversations.aggregate([
  {
    $match: {
      participants: userId,
      "participants": {
        $in: [ObjectId("searched_user_id")]
      }
    }
  },
  {
    $sort: { updated_at: -1 }
  }
]);

// Note: Consider searching users instead, then finding conversations
db.users.find({
  name: { $regex: "query", $options: "i" },
  _id: { $ne: ObjectId(userId) }
}).limit(10);

// Then find conversations with matched users
```

---

## Performance Optimization

### 1. Query Optimization

**Before** (Slow - no index):
```javascript
db.messages.find({ conversation_id: id }).sort({ created_at: -1 });
// Collscan + in-memory sort
// 1000ms for 100k messages
```

**After** (Fast - with index):
```javascript
db.messages.createIndex({ conversation_id: 1, created_at: -1 });
db.messages.find({ conversation_id: id }).sort({ created_at: -1 });
// IXSCAN + sorted index
// 10ms for 100k messages
```

### 2. Batch Operations

**Before** (Slow - multiple updates):
```javascript
for (const msgId of messageIds) {
  await db.messages.updateOne(
    { _id: ObjectId(msgId) },
    { $set: { seen: true } }
  );
}
// N database operations
```

**After** (Fast - single batch):
```javascript
await db.messages.updateMany(
  { _id: { $in: messageIds.map(id => ObjectId(id)) } },
  { $set: { seen: true } }
);
// 1 database operation
```

### 3. Projection (Only retrieve needed fields)

**Before** (Over-fetching):
```javascript
const messages = await db.messages.find({ conversation_id: id });
// Returns all fields: _id, text, sender_id, created_at, seen, seen_by, etc.
```

**After** (Optimized):
```javascript
const messages = await db.messages.find(
  { conversation_id: id },
  { projection: { text: 1, sender_id: 1, created_at: 1, seen: 1 } }
);
// Only fields needed by UI
// Network bandwidth: reduced by ~60%
```

### 4. Pagination (Avoid Skip)

**Before** (Slow - skip N documents):
```javascript
db.messages.find({ conversation_id: id })
  .sort({ created_at: -1 })
  .skip(50000)
  .limit(50);
// Skip 50,000 documents = expensive scan
```

**After** (Fast - range query):
```javascript
const lastSeenId = ObjectId("50000th_message_id");
db.messages.find({
  conversation_id: id,
  _id: { $lt: lastSeenId }  // Get newer messages
})
.sort({ created_at: -1 })
.limit(50);
// Seek directly to position with index
```

---

## Monitoring & Diagnostics

### Check Index Usage

```javascript
// See which indexes exist
db.messages.getIndexes();

// Analyze query execution plan
db.messages.find({ conversation_id: id }).explain("executionStats");

// Look for:
// - "stage": "IXSCAN" (good - using index)
// - "executionStages.executionStages": "COLLSCAN" (bad - full scan)
// - "executioStages.nReturned" vs "totalDocsExamined" (should be close)
```

### Profile Slow Queries

```javascript
// Enable profiling
db.setProfilingLevel(1, { slowms: 100 });  // Profile > 100ms queries

// Find slow queries
db.system.profile.find({ millis: { $gt: 100 } }).pretty();

// Disable profiling
db.setProfilingLevel(0);
```

### Monitor Collection Sizes

```javascript
// Get messages collection stats
db.messages.stats();

// Output includes:
// - "size": 1024000 (bytes)
// - "count": 100000 (documents)
// - "avgObjSize": 10240 (average doc size)

// Get index sizes
db.messages.aggregate([{ $indexStats: {} }]);
```

---

## Archival & Cleanup

### Archive Old Messages (Optional)

```javascript
// Move messages > 1 year old to archive collection
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

// Find and archive
const oldMessages = await db.messages.find({
  created_at: { $lt: oneYearAgo }
}).toArray();

if (oldMessages.length > 0) {
  await db.messages_archive.insertMany(oldMessages);
  await db.messages.deleteMany({
    created_at: { $lt: oneYearAgo }
  });
}

// Benefits:
// - Keeps messages collection fast
// - Archive can be on different storage
// - Spring setup with TTL index on archived
```

### Clean Stale Typing Indicators

```javascript
// Already handled by TTL index, but manual cleanup:
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

await db.typing_indicators.deleteMany({
  timestamp: { $lt: fiveMinutesAgo }
});
```

---

## Summary

| Operation | Pattern | Index | Time |
|-----------|---------|-------|------|
| Get inbox | participants + sort | conversations_participants_updated_at | ~50ms |
| Get messages | conversation + sort | messages_conversation_created_at | ~30ms |
| Search | by name or ID | users name, _id | ~20ms |
| Mark seen | by ID list | messages_id | ~10ms |
| Count unread | conversation + seen | messages_conversation_seen | ~5ms |
| Typing status | upsert unique | typing_indicators unique | ~2ms |

**Total inbox load**: ~50-100ms for full session
**Message send**: ~30ms (save + broadcast)
**Best practices**: Use composite indexes, batch operations, projection, TTL indexes
