# Messaging System - Integration Guide

Complete guide to integrating the real-time messaging system into your frontend application.

---

## Quick Start

### 1. Installation

```bash
npm install axios ws  # or your HTTP/WebSocket client
```

### 2. Create Messaging Service

```typescript
// services/messagingService.ts
import axios from 'axios';

const API_BASE = 'http://localhost:8002/messaging';
const WS_BASE = 'ws://localhost:8002/ws';

class MessagingService {
  private token: string = '';

  setToken(token: string) {
    this.token = token;
  }

  async createConversation(otherUserId: string) {
    const response = await axios.post(`${API_BASE}/conversation`, {
      other_user_id: otherUserId,
    }, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return response.data;
  }

  async getInbox(limit = 20, page = 1) {
    const response = await axios.get(`${API_BASE}/inbox`, {
      params: { limit, page },
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return response.data;
  }

  async searchConversations(query: string, limit = 20) {
    const response = await axios.get(`${API_BASE}/search`, {
      params: { q: query, limit },
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return response.data;
  }

  async getMessages(conversationId: string, page = 1, pageSize = 50) {
    const response = await axios.get(
      `${API_BASE}/conversation/${conversationId}/messages`,
      {
        params: { page, page_size: pageSize },
        headers: { Authorization: `Bearer ${this.token}` }
      }
    );
    return response.data;
  }

  async sendMessage(conversationId: string, text: string) {
    const response = await axios.post(`${API_BASE}/send`, {
      conversation_id: conversationId,
      text,
    }, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return response.data;
  }

  async markMessagesSeen(conversationId: string, messageIds?: string[]) {
    const response = await axios.post(`${API_BASE}/mark-seen`, {
      conversation_id: conversationId,
      message_ids: messageIds,
    }, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return response.data;
  }

  async updatePresence(online: boolean, activeConversationId?: string) {
    const params = new URLSearchParams({ online: String(online) });
    if (activeConversationId) {
      params.append('active_conversation_id', activeConversationId);
    }
    const response = await axios.post(`${API_BASE}/presence?${params}`, {}, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return response.data;
  }

  async getUserPresence(userId: string) {
    const response = await axios.get(`${API_BASE}/presence/${userId}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return response.data;
  }

  connectWebSocket(userId: string, conversationId: string): WebSocket {
    const ws = new WebSocket(`${WS_BASE}/${userId}/${conversationId}`);
    return ws;
  }
}

export const messagingService = new MessagingService();
```

---

## React Implementation

### 1. Messaging Hook

```typescript
// hooks/useMessaging.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { messagingService } from '../services/messagingService';

interface Message {
  message_id: string;
  sender_id: string;
  sender: {
    user_id: string;
    name: string;
    avatar?: string;
    online: boolean;
  };
  text: string;
  created_at: string;
  seen: boolean;
  seen_at?: string;
}

interface Conversation {
  conversation_id: string;
  participants: Array<{
    user_id: string;
    name: string;
    avatar?: string;
    online: boolean;
  }>;
  last_message: Message | null;
  last_message_text?: string;
  unread_count: number;
  updated_at: string;
}

interface UseMessagingProps {
  userId: string;
  conversationId: string;
  token: string;
}

export function useMessaging({ userId, conversationId, token }: UseMessagingProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const typingStatusRef = useRef(false);

  // Set token for API calls
  useEffect(() => {
    messagingService.setToken(token);
  }, [token]);

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const data = await messagingService.getMessages(conversationId, 1, 50);
        setMessages(data.messages);
        
        // Mark as seen
        if (data.messages.length > 0) {
          await messagingService.markMessagesSeen(conversationId);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
      setIsLoading(false);
    };

    loadMessages();
  }, [conversationId]);

  // Connect WebSocket
  useEffect(() => {
    const ws = messagingService.connectWebSocket(userId, conversationId);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      // Update presence
      messagingService.updatePresence(true, conversationId);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;

    return () => {
      // Update presence before disconnecting
      messagingService.updatePresence(false);
      ws.close();
    };
  }, [userId, conversationId]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'message':
        // New message received
        setMessages((prev) => [...prev, {
          message_id: data.payload.message_id,
          sender_id: data.payload.sender_id,
          sender: { 
            user_id: data.payload.sender_id, 
            name: data.payload.sender_name,
            online: true 
          },
          text: data.payload.text,
          created_at: data.payload.created_at,
          seen: false,
        }]);
        break;

      case 'typing':
        // Typing indicator
        if (data.payload.is_typing) {
          setTypingUsers((prev) => 
            prev.includes(data.payload.user_id) 
              ? prev 
              : [...prev, data.payload.user_id]
          );
        } else {
          setTypingUsers((prev) => 
            prev.filter((id) => id !== data.payload.user_id)
          );
        }
        break;

      case 'message_seen':
        // Messages marked as seen
        setMessages((prev) =>
          prev.map((msg) =>
            data.payload.message_ids.includes(msg.message_id)
              ? { ...msg, seen: true, seen_at: new Date().toISOString() }
              : msg
          )
        );
        break;

      case 'user_joined':
        console.log(`${data.payload.user_name} joined`);
        break;

      case 'user_left':
        console.log(`${data.payload.user_name} left`);
        break;

      case 'error':
        console.error('Server error:', data.payload);
        break;
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !wsRef.current) return;

    try {
      // Stop typing indicator
      stopTyping();

      // Send via WebSocket for real-time delivery
      wsRef.current.send(JSON.stringify({
        type: 'message',
        payload: { text },
      }));
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, []);

  // Typing indicator
  const startTyping = useCallback(() => {
    if (typingStatusRef.current || !wsRef.current) return;

    typingStatusRef.current = true;
    wsRef.current.send(JSON.stringify({
      type: 'typing',
      payload: { is_typing: true },
    }));

    // Clear timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Auto-stop after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  }, []);

  const stopTyping = useCallback(() => {
    if (!typingStatusRef.current || !wsRef.current) return;

    typingStatusRef.current = false;
    wsRef.current.send(JSON.stringify({
      type: 'typing',
      payload: { is_typing: false },
    }));
  }, []);

  // Handle input change with typing indicator
  const handleInputChange = useCallback(() => {
    startTyping();
  }, [startTyping]);

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async (page: number) => {
    try {
      const data = await messagingService.getMessages(conversationId, page, 50);
      setMessages((prev) => [...prev, ...data.messages]);
    } catch (error) {
      console.error('Error loading more messages:', error);
    }
  }, [conversationId]);

  return {
    messages,
    typingUsers,
    isConnected,
    isLoading,
    sendMessage,
    handleInputChange,
    loadMoreMessages,
  };
}
```

### 2. Chat Component

```typescript
// components/ChatWindow.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useMessaging } from '../hooks/useMessaging';

interface ChatWindowProps {
  userId: string;
  conversationId: string;
  token: string;
  recipientName: string;
  recipientOnline: boolean;
}

export function ChatWindow({
  userId,
  conversationId,
  token,
  recipientName,
  recipientOnline,
}: ChatWindowProps) {
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    typingUsers,
    isConnected,
    sendMessage,
    handleInputChange,
  } = useMessaging({ userId, conversationId, token });

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput('');
    }
  };

  const handleInputChangeLocal = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    handleInputChange();
  };

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="recipient-info">
          <h2>{recipientName}</h2>
          <span className={`status ${recipientOnline ? 'online' : 'offline'}`}>
            {recipientOnline ? 'Active now' : 'Offline'}
          </span>
        </div>
        <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '◉' : '◯'}
        </span>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.map((msg) => (
          <div
            key={msg.message_id}
            className={`message ${msg.sender_id === userId ? 'sent' : 'received'}`}
          >
            <div className="message-content">
              <p>{msg.text}</p>
              <span className="timestamp">
                {new Date(msg.created_at).toLocaleTimeString()}
              </span>
              {msg.sender_id === userId && (
                <span className="seen-status">
                  {msg.seen ? '✓✓' : '✓'}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <span>{typingUsers.length === 1 ? '' : 'Multiple people'} typing...</span>
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input">
        <textarea
          value={messageInput}
          onChange={handleInputChangeLocal}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          rows={1}
        />
        <button onClick={handleSend} disabled={!messageInput.trim() || !isConnected}>
          Send
        </button>
      </div>
    </div>
  );
}
```

### 3. Inbox Component

```typescript
// components/Inbox.tsx
import React, { useEffect, useState } from 'react';
import { messagingService } from '../services/messagingService';

interface InboxProps {
  userId: string;
  token: string;
  onSelectConversation: (conversationId: string) => void;
}

export function Inbox({ userId, token, onSelectConversation }: InboxProps) {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    messagingService.setToken(token);
    loadInbox();
  }, [token]);

  const loadInbox = async () => {
    setIsLoading(true);
    try {
      const data = await messagingService.getInbox(20, 1);
      setConversations(data.conversations);
    } catch (error) {
      console.error('Error loading inbox:', error);
    }
    setIsLoading(false);
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim()) {
      try {
        const data = await messagingService.searchConversations(query, 20);
        setConversations(data.conversations);
      } catch (error) {
        console.error('Error searching:', error);
      }
    } else {
      loadInbox();
    }
  };

  return (
    <div className="inbox">
      <input
        type="text"
        placeholder="Search conversations..."
        value={searchQuery}
        onChange={handleSearch}
        className="search-box"
      />

      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="conversations-list">
          {conversations.map((conv) => (
            <div
              key={conv.conversation_id}
              className="conversation-item"
              onClick={() => onSelectConversation(conv.conversation_id)}
            >
              <div className="conversation-info">
                <h3>{conv.participants[0]?.name}</h3>
                <p className="last-message">{conv.last_message_text}</p>
              </div>
              {conv.unread_count > 0 && (
                <span className="unread-badge">{conv.unread_count}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## JavaScript (Vanilla)

### WebSocket Usage

```javascript
// Initialize WebSocket connection
const userId = 'user_123';
const conversationId = 'conv_456';
const ws = new WebSocket(`ws://localhost:8002/ws/${userId}/${conversationId}`);

// Handle connection open
ws.onopen = () => {
  console.log('Connected');
};

// Handle incoming messages
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'message':
      displayMessage(message.payload);
      break;
    case 'typing':
      showTypingIndicator(message.payload);
      break;
    case 'message_seen':
      updateSeenStatus(message.payload);
      break;
  }
};

// Send message
function sendMessage(text) {
  ws.send(JSON.stringify({
    type: 'message',
    payload: { text },
  }));
}

// Send typing indicator
function sendTypingStatus(isTyping) {
  ws.send(JSON.stringify({
    type: 'typing',
    payload: { is_typing: isTyping },
  }));
}

// Mark messages seen
function markSeen(messageIds) {
  ws.send(JSON.stringify({
    type: 'message_seen',
    payload: { message_ids: messageIds },
  }));
}

// Handle input with typing indicator
const inputElement = document.getElementById('message-input');
let typingTimer;

inputElement.addEventListener('input', () => {
  sendTypingStatus(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    sendTypingStatus(false);
  }, 1000);
});
```

---

## Database Schema

### Collections Used

**conversations**:
```json
{
  "_id": ObjectId,
  "participant_key": "user1:user2",
  "participants": ["user1", "user2"],
  "last_message_id": ObjectId,
  "last_message_text": "Last message preview",
  "last_message_sender_id": "user1",
  "updated_at": ISODate,
  "created_at": ISODate,
  "message_count": 524
}
```

**messages**:
```json
{
  "_id": ObjectId,
  "conversation_id": "conv_id",
  "sender_id": "user_id",
  "text": "Message content",
  "created_at": ISODate,
  "seen": true,
  "seen_by": ["user_id"],
  "seen_at": ISODate
}
```

**typing_indicators** (ephemeral):
```json
{
  "_id": ObjectId,
  "conversation_id": "conv_id",
  "user_id": "user_id",
  "is_typing": true,
  "timestamp": ISODate
}
```

**user_presence** (ephemeral):
```json
{
  "_id": ObjectId,
  "user_id": "user_id",
  "online": true,
  "last_seen": ISODate,
  "active_conversation_id": "conv_id"
}
```

---

## Optimizations

### Caching

```typescript
// Cache recent conversations
const conversationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedConversation(convId: string) {
  const cached = conversationCache.get(convId);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await messagingService.getMessages(convId);
  conversationCache.set(convId, { data, timestamp: Date.now() });
  return data;
}
```

### Pagination

```typescript
// Infinite scroll implementation
function setupInfiniteScroll() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        loadMoreMessages(nextPage++);
      }
    });
  });

  const sentinel = document.getElementById('scroll-sentinel');
  observer.observe(sentinel);
}
```

### Connection Resilience

```typescript
// Automatic reconnect with exponential backoff
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_BACKOFF = 1000;

function reconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached');
    return;
  }

  const backoff = INITIAL_BACKOFF * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;

  setTimeout(() => {
    ws = new WebSocket(`ws://localhost:8002/ws/${userId}/${conversationId}`);
  }, backoff);
}
```

---

## Testing

```typescript
// Mock data for testing
const mockMessages: Message[] = [
  {
    message_id: '1',
    sender_id: 'user1',
    sender: { user_id: 'user1', name: 'Alice', online: true },
    text: 'Hello!',
    created_at: new Date().toISOString(),
    seen: true,
  },
];

// Test component
it('renders ChatWindow correctly', () => {
  render(
    <ChatWindow
      userId="user1"
      conversationId="conv1"
      token="test_token"
      recipientName="Bob"
      recipientOnline={true}
    />
  );
  
  expect(screen.getByText('Bob')).toBeInTheDocument();
  expect(screen.getByText('Active now')).toBeInTheDocument();
});
```

---

## Deployment Checklist

- [ ] Environment variables configured (.env)
- [ ] MongoDB indexes created on startup
- [ ] JWT authentication tokens valid
- [ ] WebSocket server running on correct port
- [ ] CORS configured for frontend domain
- [ ] Rate limiting enabled (optional)
- [ ] Message persistence verified
- [ ] Error logging configured
- [ ] Monitoring/alerting set up
- [ ] Load testing completed

---

## Troubleshooting

### Messages not appearing

1. Check WebSocket connection status
2. Verify user is conversation participant
3. Check browser console for errors
4. Verify JWT token is valid

### Slow inbox loading

1. Check MongoDB indexes are created
2. Monitor database query performance
3. Implement pagination (limit conversations)
4. Cache conversation list client-side

### WebSocket disconnects

1. Implement automatic reconnect
2. Check server logs for errors
3. Verify production environment setup
4. Monitor network conditions

---

## Support

For issues or questions:
1. Check error logs: `server.log`
2. Review MongoDB connections
3. Test with curl/Postman first
4. Check network tab in browser DevTools
