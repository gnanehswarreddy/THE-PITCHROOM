# Instagram-Style Messaging System - API Documentation

## Overview

A production-ready messaging system with real-time delivery, typing indicators, presence updates, and seen status tracking. Designed for modern web applications requiring Instagram-style direct messaging capabilities.

**Key Features**:
- ✅ Real-time message delivery via WebSocket
- ✅ Typing indicators showing who's typing
- ✅ Double-checkmark "seen" indicators
- ✅ Online presence with last-seen timestamps
- ✅ Paginated message history
- ✅ Unread message counts
- ✅ Conversation archiving and muting
- ✅ Search conversations by participant name
- ✅ Optimized MongoDB queries with indexes

---

## REST API Endpoints

### Base URL
```
http://localhost:8002/messaging
```

All endpoints require `Authorization: Bearer {jwt_token}` header except where noted.

---

## Conversation Management

### 1. Create or Get Conversation

**Endpoint**: `POST /conversation`

Creates a new conversation between two users or returns existing one if already talking.

**Request**:
```json
{
  "other_user_id": "507f1f77bcf86cd799439011"
}
```

**Response**: `ConversationOut`
```json
{
  "conversation_id": "507f1f77bcf86cd799439012",
  "participants": [
    {
      "user_id": "507f1f77bcf86cd799439011",
      "name": "Jane Doe",
      "avatar": "https://example.com/avatars/jane.jpg",
      "online": true
    }
  ],
  "last_message": {
    "message_id": "507f1f77bcf86cd799439013",
    "conversation_id": "507f1f77bcf86cd799439012",
    "sender_id": "507f1f77bcf86cd799439011",
    "sender": { ... },
    "text": "See you later!",
    "created_at": "2024-03-24T10:30:00Z",
    "seen": true,
    "seen_at": "2024-03-24T10:31:00Z"
  },
  "last_message_text": "See you later!",
  "unread_count": 0,
  "updated_at": "2024-03-24T10:30:00Z",
  "archived": false,
  "muted": false
}
```

**Status Codes**:
- `200`: Conversation found or created
- `400`: Cannot create conversation with yourself
- `401`: Unauthorized
- `404`: One or both users not found

---

### 2. Get Inbox

**Endpoint**: `GET /inbox`

Get all conversations for current user sorted by most recent first.

**Query Parameters**:
- `limit` (int, default=20, max=100): Conversations per page
- `page` (int, default=1, min=1): Page number

**Response**: `InboxResponse`
```json
{
  "total": 15,
  "unread_total": 3,
  "conversations": [
    {
      "conversation_id": "507f1f77bcf86cd799439012",
      "participants": [ ... ],
      "last_message": { ... },
      "last_message_text": "See you later!",
      "unread_count": 2,
      "updated_at": "2024-03-24T10:30:00Z",
      "archived": false,
      "muted": false
    }
  ]
}
```

**Example**:
```bash
curl -X GET "http://localhost:8002/messaging/inbox?limit=20&page=1" \
  -H "Authorization: Bearer {token}"
```

---

### 3. Search Conversations

**Endpoint**: `GET /search`

Search conversations by participant name.

**Query Parameters**:
- `q` (string, required, min=1): Search query
- `limit` (int, default=20, max=100): Results to return

**Response**: `SearchConversationsResponse`
```json
{
  "query": "jane",
  "total": 2,
  "conversations": [ ... ]
}
```

**Example**:
```bash
curl -X GET "http://localhost:8002/messaging/search?q=jane&limit=20" \
  -H "Authorization: Bearer {token}"
```

---

### 4. Get Conversation Statistics

**Endpoint**: `GET /conversation/{conversation_id}/stats`

Get metadata and statistics for a conversation.

**Response**: `ConversationStatsResponse`
```json
{
  "conversation_id": "507f1f77bcf86cd799439012",
  "total_messages": 524,
  "unread_count": 0,
  "last_activity": "2024-03-24T10:30:00Z",
  "participants_count": 2
}
```

---

### 5. Archive Conversation

**Endpoint**: `POST /conversation/{conversation_id}/archive`

Hide a conversation from inbox (not deleted).

**Response**:
```json
{
  "success": true,
  "conversation_id": "507f1f77bcf86cd799439012",
  "archived": true
}
```

---

### 6. Unarchive Conversation

**Endpoint**: `POST /conversation/{conversation_id}/unarchive`

Restore an archived conversation to inbox.

---

### 7. Mute Conversation

**Endpoint**: `POST /conversation/{conversation_id}/mute`

Disable notifications for a conversation (messages still received).

**Response**:
```json
{
  "success": true,
  "conversation_id": "507f1f77bcf86cd799439012",
  "muted": true
}
```

---

### 8. Unmute Conversation

**Endpoint**: `POST /conversation/{conversation_id}/unmute`

Re-enable notifications for a conversation.

---

## Messaging

### 1. Send Message

**Endpoint**: `POST /send`

Send a message in a conversation.

**Request**: `SendMessageRequest`
```json
{
  "conversation_id": "507f1f77bcf86cd799439012",
  "text": "Hey, how are you?"
}
```

**Response**: `MessageOut`
```json
{
  "message_id": "507f1f77bcf86cd799439013",
  "conversation_id": "507f1f77bcf86cd799439012",
  "sender_id": "507f1f77bcf86cd799439010",
  "sender": {
    "user_id": "507f1f77bcf86cd799439010",
    "name": "John Smith",
    "avatar": "https://example.com/avatars/john.jpg",
    "online": true
  },
  "text": "Hey, how are you?",
  "created_at": "2024-03-24T10:30:00Z",
  "seen": false,
  "seen_at": null
}
```

**Features**:
- Message is immediately broadcast to recipient via WebSocket
- Conversation's last_message is updated
- Inbox is refreshed for both users

**Validation**:
- Text required (1-5000 characters)
- User must be conversation participant

**Status Codes**:
- `200`: Message sent successfully
- `400`: Invalid message text
- `401`: Unauthorized
- `403`: Not a participant
- `404`: Conversation not found

---

### 2. Get Messages

**Endpoint**: `GET /conversation/{conversation_id}/messages`

Get paginated message history for a conversation.

**Query Parameters**:
- `page` (int, default=1, min=1): Page number
- `page_size` (int, default=50, ge=1, le=100): Messages per page

**Response**: `MessageListResponse`
```json
{
  "conversation_id": "507f1f77bcf86cd799439012",
  "total": 150,
  "page": 1,
  "page_size": 50,
  "has_more": true,
  "messages": [
    {
      "message_id": "...",
      "conversation_id": "...",
      "sender_id": "...",
      "sender": { ... },
      "text": "...",
      "created_at": "...",
      "seen": true,
      "seen_at": "..."
    }
  ]
}
```

**Pagination**:
- Page 1 returns 50 most recent messages
- Page 2 returns next 50, etc.
- Oldest messages require loading higher page numbers
- Perfect for infinite scroll: when has_more=true, load next page

**Example** (infinite scroll):
```bash
# Load most recent messages
curl "http://localhost:8002/messaging/conversation/507f1f77bcf86cd799439012/messages?page=1&page_size=50" \
  -H "Authorization: Bearer {token}"

# Load older messages
curl "http://localhost:8002/messaging/conversation/507f1f77bcf86cd799439012/messages?page=2&page_size=50" \
  -H "Authorization: Bearer {token}"
```

---

### 3. Mark Messages as Seen

**Endpoint**: `POST /mark-seen`

Mark specific messages or all unseen messages in conversation as seen.

**Request**: `MarkMessagesSeenRequest`
```json
{
  "conversation_id": "507f1f77bcf86cd799439012",
  "message_ids": [
    "507f1f77bcf86cd799439013",
    "507f1f77bcf86cd799439014"
  ]
}
```

Or omit `message_ids` to mark all unseen from others:
```json
{
  "conversation_id": "507f1f77bcf86cd799439012"
}
```

**Response**: `MarkSeenResponse`
```json
{
  "success": true,
  "updated_count": 5
}
```

**Features**:
- Updates seen status for marked messages
- Broadcasts to other participants via WebSocket
- Shows double-checkmark in UI

---

## Real-time Indicators

### 1. Typing Indicator

**Endpoint**: `POST /typing`

Send typing status to other participants. Call when user starts typing and when they finish.

**Request**: `TypingIndicatorRequest`
```json
{
  "conversation_id": "507f1f77bcf86cd799439012",
  "is_typing": true
}
```

When done typing:
```json
{
  "conversation_id": "507f1f77bcf86cd799439012",
  "is_typing": false
}
```

**Response**:
```json
{
  "conversation_id": "507f1f77bcf86cd799439012",
  "user_id": "507f1f77bcf86cd799439010",
  "is_typing": true,
  "timestamp": "2024-03-24T10:30:00Z"
}
```

**Features**:
- Auto-clears after 5 seconds of inactivity
- Broadcasts to all users in conversation
- Shows "User is typing..." indicator

---

### 2. Get Typing Users

**Endpoint**: `GET /typing/{conversation_id}`

Get list of users currently typing in a conversation.

**Response**:
```json
{
  "conversation_id": "507f1f77bcf86cd799439012",
  "typing_users": [
    {
      "user_id": "507f1f77bcf86cd799439011",
      "user": {
        "user_id": "507f1f77bcf86cd799439011",
        "name": "Jane Doe",
        "avatar": "...",
        "online": true
      },
      "is_typing": true
    }
  ]
}
```

---

### 3. Update Presence

**Endpoint**: `POST /presence`

Update user's online status and active conversation.

**Query Parameters**:
- `online` (bool, required): Whether user is online
- `active_conversation_id` (str, optional): Conversation user is viewing

**Response**:
```json
{
  "user_id": "507f1f77bcf86cd799439010",
  "online": true,
  "last_seen": "2024-03-24T10:30:00Z",
  "active_conversation_id": "507f1f77bcf86cd799439012"
}
```

**Usage**:
```bash
# Mark online
curl -X POST "http://localhost:8002/messaging/presence?online=true" \
  -H "Authorization: Bearer {token}"

# View specific conversation
curl -X POST "http://localhost:8002/messaging/presence?online=true&active_conversation_id=507f1f77bcf86cd799439012" \
  -H "Authorization: Bearer {token}"

# Mark offline
curl -X POST "http://localhost:8002/messaging/presence?online=false" \
  -H "Authorization: Bearer {token}"
```

---

### 4. Get User Presence

**Endpoint**: `GET /presence/{user_id}`

Get user's current online status and when they were last active.

**Response**:
```json
{
  "user_id": "507f1f77bcf86cd799439011",
  "online": true,
  "last_seen": "2024-03-24T10:30:00Z",
  "active_conversation_id": "507f1f77bcf86cd799439012"
}
```

---

## WebSocket API

### Connection

**URL**: `ws://localhost:8002/ws/{user_id}/{conversation_id}`

**Query Parameter Authentication** (if needed):
```
ws://localhost:8002/ws/{user_id}/{conversation_id}?token={jwt_token}
```

### Message Format

All WebSocket messages follow this format:

```json
{
  "type": "message_type",
  "payload": { /* type-specific data */ },
  "timestamp": "2024-03-24T10:30:00Z",
  "conversation_id": "507f1f77bcf86cd799439012"
}
```

### Client → Server Messages

#### Send Message
```json
{
  "type": "message",
  "payload": {
    "text": "Hello there!"
  }
}
```

#### Send Typing Indicator
```json
{
  "type": "typing",
  "payload": {
    "is_typing": true
  }
}
```

#### Mark Messages Seen
```json
{
  "type": "message_seen",
  "payload": {
    "message_ids": ["msg_id_1", "msg_id_2"]
  }
}
```

#### Keep-Alive Ping
```json
{
  "type": "ping",
  "payload": {}
}
```

### Server → Client Messages

#### New Message
```json
{
  "type": "message",
  "payload": {
    "message_id": "507f1f77bcf86cd799439013",
    "sender_id": "507f1f77bcf86cd799439011",
    "sender_name": "Jane Doe",
    "text": "Hello!",
    "created_at": "2024-03-24T10:30:00Z"
  },
  "conversation_id": "507f1f77bcf86cd799439012",
  "timestamp": "2024-03-24T10:30:00Z"
}
```

#### Typing Indicator
```json
{
  "type": "typing",
  "payload": {
    "user_id": "507f1f77bcf86cd799439011",
    "user_name": "Jane Doe",
    "is_typing": true
  },
  "conversation_id": "507f1f77bcf86cd799439012",
  "timestamp": "2024-03-24T10:30:00Z"
}
```

#### Message Seen
```json
{
  "type": "message_seen",
  "payload": {
    "message_ids": ["msg_id_1", "msg_id_2"],
    "seen_by": "507f1f77bcf86cd799439011"
  },
  "conversation_id": "507f1f77bcf86cd799439012",
  "timestamp": "2024-03-24T10:30:00Z"
}
```

#### User Joined
```json
{
  "type": "user_joined",
  "payload": {
    "user_id": "507f1f77bcf86cd799439011",
    "user_name": "Jane Doe"
  },
  "conversation_id": "507f1f77bcf86cd799439012",
  "timestamp": "2024-03-24T10:30:00Z"
}
```

#### User Left
```json
{
  "type": "user_left",
  "payload": {
    "user_id": "507f1f77bcf86cd799439011",
    "user_name": "Jane Doe"
  },
  "conversation_id": "507f1f77bcf86cd799439012",
  "timestamp": "2024-03-24T10:30:00Z"
}
```

#### Error
```json
{
  "type": "error",
  "payload": {
    "code": "MESSAGE_TOO_LONG",
    "message": "Message cannot exceed 5000 characters"
  },
  "conversation_id": "507f1f77bcf86cd799439012",
  "timestamp": "2024-03-24T10:30:00Z"
}
```

#### Keep-Alive Pong
```json
{
  "type": "pong",
  "payload": {},
  "timestamp": "2024-03-24T10:30:00Z"
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "detail": "Error message"
}
```

Or with details:

```json
{
  "error": "ERROR_CODE",
  "message": "Descriptive error message",
  "details": {
    "field": "additional context"
  }
}
```

### Common Errors

| Status | Error | Message |
|--------|-------|---------|
| 400 | BAD_REQUEST | Invalid request parameters |
| 400 | EMPTY_MESSAGE | Message text is required |
| 400 | MESSAGE_TOO_LONG | Message exceeds 5000 character limit |
| 401 | UNAUTHORIZED | Missing or invalid authentication token |
| 403 | FORBIDDEN | You are not a participant in this conversation |
| 404 | NOT_FOUND | Conversation/message not found |
| 500 | SERVER_ERROR | Internal server error |

---

## Rate Limiting

Currently no rate limits. For production, consider:

```
- Messages: 100 per minute per user
- Typing indicators: 10 per second per user
- Seen status: 50 per minute per user
```

---

## Best Practices

### Client-Side

1. **Typing Indicators**:
   - Send is_typing=true on first keystroke after 100ms
   - Send is_typing=false when user stops for 1 second
   - Debounce to avoid flooding

2. **Seen Status**:
   - Mark messages seen when conversation becomes visible
   - Mark all unseen from others with single call
   - Update when user reads a message

3. **Presence**:
   - Update on_presence on page load
   - Update offline when user leaves page
   - Update active_conversation_id when switching conversations

4. **Pagination**:
   - Load initial 50 messages
   - Implement infinite scroll for older messages
   - Don't reload from page 1 unless necessary

5. **Connection Management**:
   - Implement automatic reconnect with exponential backoff
   - Send ping every 30 seconds to keep connection alive
   - Handle disconnects gracefully

### Server-Side

1. **Validation**:
   - Always verify user is conversation participant
   - Validate message length and content
   - Check conversation exists before operations

2. **Performance**:
   - Use indexes for fast lookups
   - Batch operations when possible
   - Archive old conversations periodically

3. **Reliability**:
   - Log all critical operations
   - Monitor WebSocket connection counts
   - Track message delivery success rates

---

## Examples

See `MESSAGING_INTEGRATION.md` for complete implementation examples in JavaScript/TypeScript and React.
