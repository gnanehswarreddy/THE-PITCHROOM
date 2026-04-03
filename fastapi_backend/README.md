PitchRoom FastAPI Messaging Backend

This module provides an Instagram-style direct messaging backend with:
- Real-time delivery over WebSockets
- Inbox list with unread counts
- Seen status updates
- Typing indicators
- Duplicate conversation prevention
- Pagination and indexes for performance

Structure
- main.py: FastAPI entrypoint and WebSocket endpoint
- routes/messages.py: REST messaging APIs
- websocket.py: active connection manager
- models.py: request/response models
- db.py: Mongo connection and indexes

Run locally
1) Install dependencies:
   pip install -r fastapi_backend/requirements.txt
2) Set env vars:
   MONGODB_URI
   MONGODB_DB
3) Start server:
   uvicorn fastapi_backend.main:app --reload --host 0.0.0.0 --port 8000

REST Endpoints
- POST /conversation
  Body:
  {
    "user_id": "u1",
    "other_user_id": "u2"
  }

- GET /inbox/{user_id}

- POST /send-message
  Body:
  {
    "conversation_id": "<uuid>",
    "sender_id": "u1",
    "text": "Hello"
  }

- GET /messages/{conversation_id}?page=1&page_size=50

- POST /mark-seen
  Body:
  {
    "conversation_id": "<uuid>",
    "user_id": "u2"
  }

WebSocket
- WS /ws/{user_id}
- Supported client events:
  - typing:
    {
      "type": "typing",
      "to_user_id": "u2",
      "conversation_id": "<uuid>",
      "is_typing": true
    }
  - ping:
    {
      "type": "ping"
    }

Server push events
- new_message
- inbox_refresh
- seen_update
- typing

Notes
- /send-message persists the message and pushes it instantly to recipient sockets.
- Unique index on participants_key prevents duplicate one-to-one conversations.
- Indexes are automatically created on startup.
