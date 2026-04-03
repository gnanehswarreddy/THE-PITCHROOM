# User Aggregation API - Frontend Integration Guide

## Complete Integration Example

### 1. Authentication Flow

```bash
# Step 1: Register User
curl -X POST http://localhost:8002/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "email": "john@example.com",
    "password": "SecurePass123",
    "role": "writer"
  }'

# Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}

# Step 2: Store token in localStorage (browser)
localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')

# Step 3: Decode JWT to extract user_id (JavaScript)
# Use jwt-decode library or:
function parseJwt(token) {
    const base64 = token.split('.')[1];
    const decoded = JSON.parse(atob(base64));
    return decoded.sub; // user_id is in 'sub' claim
}
const userId = parseJwt(token);
localStorage.setItem('user_id', userId);
```

### 2. Frontend - React Example

```typescript
// hooks/useUserProfile.ts
import { useState, useEffect } from 'react';

interface UserProfile {
  user: any;
  profile: any;
  scripts: any[];
  engagement: any[];
  messages: any[];
  conversations: any[];
  notifications: any[];
  posts: any[];
  uploads: any[];
  stats: any;
}

export function useUserProfile(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  async function fetchUserProfile() {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `http://localhost:8002/user/full-profile/${userId}?limit=20&page=1`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProfile(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { profile, loading, error, refetch: fetchUserProfile };
}

// components/UserProfile.tsx
import { useUserProfile } from '../hooks/useUserProfile';

export function UserProfile() {
  const userId = localStorage.getItem('user_id');
  const { profile, loading, error } = useUserProfile(userId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!profile) return <div>No profile found</div>;

  return (
    <div className="user-profile">
      {/* User Info */}
      <div className="user-header">
        <h1>{profile.user.name}</h1>
        <p>{profile.profile?.bio}</p>
        {profile.profile?.avatar_url && (
          <img src={profile.profile.avatar_url} alt={profile.user.name} />
        )}
      </div>

      {/* Statistics */}
      <div className="stats">
        <div className="stat">
          <span className="label">Scripts</span>
          <span className="value">{profile.stats.total_scripts}</span>
        </div>
        <div className="stat">
          <span className="label">Total Views</span>
          <span className="value">{profile.stats.total_views}</span>
        </div>
        <div className="stat">
          <span className="label">Engagement</span>
          <span className="value">{profile.stats.total_engagement}</span>
        </div>
        <div className="stat">
          <span className="label">Conversations</span>
          <span className="value">{profile.stats.total_conversations}</span>
        </div>
      </div>

      {/* Scripts */}
      <div className="scripts-section">
        <h2>Scripts ({profile.scripts.length})</h2>
        <div className="scripts-list">
          {profile.scripts.map((script) => (
            <div key={script.id} className="script-card">
              <h3>{script.title}</h3>
              <p>{script.description}</p>
              <div className="metrics">
                <span>👁️ {script.views} views</span>
                <span>❤️ {script.likes} likes</span>
                <span>🔄 {script.shares} shares</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="messages-section">
        <h2>Messages ({profile.messages.length})</h2>
        <div className="messages-list">
          {profile.messages.map((msg) => (
            <div key={msg.id} className="message-item">
              <p className="from-to">
                {msg.sender_id === userId ? 'You' : 'Them'} →{' '}
                {msg.receiver_id === userId ? 'You' : 'Them'}
              </p>
              <p className="content">{msg.content}</p>
              <p className="date">{new Date(msg.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Conversations */}
      <div className="conversations-section">
        <h2>Conversations ({profile.conversations.length})</h2>
        <div className="conversations-list">
          {profile.conversations.map((conv) => (
            <div key={conv.id} className="conversation-item">
              <div className="participants">
                {conv.participants.map((p) => (
                  <span key={p} className="participant">{p}</span>
                ))}
              </div>
              <p className="last-message">{conv.last_message}</p>
              <p className="date">{new Date(conv.last_message_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="notifications-section">
        <h2>
          Notifications
          {profile.stats.total_notifications_unread > 0 && (
            <span className="unread-badge">{profile.stats.total_notifications_unread}</span>
          )}
        </h2>
        <div className="notifications-list">
          {profile.notifications.map((notif) => (
            <div key={notif.id} className={`notification-item ${!notif.is_read ? 'unread' : ''}`}>
              <span className="type">{notif.type}</span>
              <p className="title">{notif.title}</p>
              <p className="message">{notif.message}</p>
              <p className="date">{new Date(notif.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="posts-section">
        <h2>Posts ({profile.posts.length})</h2>
        <div className="posts-list">
          {profile.posts.map((post) => (
            <div key={post.id} className="post-card">
              <p className="content">{post.content}</p>
              <div className="metrics">
                <span>❤️ {post.likes_count} likes</span>
                <span>💬 {post.comments_count} comments</span>
              </div>
              <p className="date">{new Date(post.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Collections */}
      <div className="collections-section">
        <h2>Collections ({profile.collections.length})</h2>
        <div className="collections-grid">
          {profile.collections.map((coll) => (
            <div key={coll.id} className="collection-card">
              <h3>{coll.name}</h3>
              <p>{coll.description}</p>
              <p className="count">{coll.script_count} scripts</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 3. Profile Summary (Lightweight Endpoint)

```typescript
// For user cards in lists

interface UserCard {
  name: string;
  bio: string;
  avatar: string;
  followers: number;
  stats: {
    scripts: number;
    engagement: number;
  };
}

export async function fetchUserCard(userId: string): Promise<UserCard> {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(
    `http://localhost:8002/user/profile-summary/${userId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  return {
    name: data.user.name,
    bio: data.profile?.bio || '',
    avatar: data.profile?.avatar_url || '',
    followers: data.profile?.followers_count || 0,
    stats: {
      scripts: data.stats.total_scripts,
      engagement: data.stats.total_engagement,
    },
  };
}

// Component usage
export function UserCard({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserCard | null>(null);

  useEffect(() => {
    fetchUserCard(userId).then(setUser);
  }, [userId]);

  if (!user) return null;

  return (
    <div className="user-card">
      <img src={user.avatar} alt={user.name} />
      <h3>{user.name}</h3>
      <p className="bio">{user.bio}</p>
      <div className="follow-info">
        <span>👥 {user.followers} followers</span>
      </div>
      <div className="quick-stats">
        <span>📜 {user.stats.scripts} scripts</span>
        <span>⚡ {user.stats.engagement} engagement</span>
      </div>
    </div>
  );
}
```

### 4. Pagination Example

```typescript
// hooks/useUserProfilePagination.ts

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
}

export function useUserProfilePagination(userId: string, initialLimit = 20) {
  const [state, setState] = useState<PaginationState>({
    page: 1,
    limit: initialLimit,
    total: 0,
    hasNextPage: false,
  });

  const [allScripts, setAllScripts] = useState<any[]>([]);

  async function fetchPage(page: number) {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(
      `http://localhost:8002/user/full-profile/${userId}?limit=${state.limit}&page=${page}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    const scripts = data.data?.scripts || [];

    setAllScripts(scripts);
    setState((prev) => ({
      ...prev,
      page,
      total: scripts.length,
      hasNextPage: scripts.length === state.limit,
    }));
  }

  return {
    state,
    scripts: allScripts,
    goToPage: fetchPage,
    nextPage: () => fetchPage(state.page + 1),
    prevPage: () => state.page > 1 && fetchPage(state.page - 1),
  };
}

// Usage
export function ScriptsPaginated() {
  const userId = localStorage.getItem('user_id');
  const { state, scripts, nextPage, prevPage } = useUserProfilePagination(userId, 20);

  return (
    <div>
      <div className="scripts-list">
        {scripts.map((script) => (
          <ScriptCard key={script.id} script={script} />
        ))}
      </div>

      <div className="pagination">
        <button onClick={prevPage} disabled={state.page === 1}>
          ← Previous
        </button>
        <span>Page {state.page}</span>
        <button onClick={nextPage} disabled={!state.hasNextPage}>
          Next →
        </button>
      </div>
    </div>
  );
}
```

### 5. Error Handling

```typescript
async function safeUserProfileFetch(userId: string) {
  const token = localStorage.getItem('auth_token');

  try {
    const response = await fetch(
      `http://localhost:8002/user/full-profile/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    // Handle various status codes
    switch (response.status) {
      case 200:
      case 201:
        return await response.json();

      case 401:
        // Token expired, redirect to login
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        break;

      case 403:
        // User doesn't have permission
        throw new Error('You cannot access this profile');

      case 404:
        // User not found
        throw new Error('User profile not found');

      case 500:
        // Server error
        throw new Error('Server error occurred');

      default:
        throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    // Show error toast/modal to user
    showErrorNotification(error.message);
    return null;
  }
}
```

### 6. Caching Implementation

```typescript
// services/userProfileCache.ts

class UserProfileCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private TTL = 5 * 60 * 1000; // 5 minutes

  isValid(userId: string): boolean {
    const cached = this.cache.get(userId);
    if (!cached) return false;

    const now = Date.now();
    return now - cached.timestamp < this.TTL;
  }

  get(userId: string) {
    if (this.isValid(userId)) {
      return this.cache.get(userId)?.data;
    }
    this.cache.delete(userId);
    return null;
  }

  set(userId: string, data: any) {
    this.cache.set(userId, {
      data,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const profileCache = new UserProfileCache();

// Usage
export async function getCachedUserProfile(userId: string) {
  // Check cache first
  const cached = profileCache.get(userId);
  if (cached) {
    console.log('Using cached profile');
    return cached;
  }

  // Fetch from API
  const token = localStorage.getItem('auth_token');
  const response = await fetch(
    `http://localhost:8002/user/full-profile/${userId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  // Cache result
  if (data.success) {
    profileCache.set(userId, data.data);
  }

  return data.data;
}
```

### 7. TypeScript Interfaces

```typescript
// types/userProfile.ts

export interface UserProfile {
  user: User;
  profile?: Profile;
  scripts: Script[];
  engagement: Engagement[];
  messages: Message[];
  conversations: Conversation[];
  notifications: Notification[];
  posts: Post[];
  post_likes: PostLike[];
  post_comments: PostComment[];
  uploads: Upload[];
  collections: Collection[];
  characters: Character[];
  stories: Story[];
  stats: Statistics;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'writer' | 'producer' | 'admin';
  created_at: Date;
  updated_at?: Date;
}

export interface Profile {
  id: string;
  user_id: string;
  bio?: string;
  avatar_url?: string;
  followers_count: number;
  following_count: number;
}

export interface Script {
  id: string;
  title: string;
  description?: string;
  genre?: string;
  language?: string;
  views: number;
  likes: number;
  shares: number;
  created_at: Date;
}

export interface Statistics {
  total_scripts: number;
  total_views: number;
  total_engagement: number;
  total_messages: number;
  total_conversations: number;
  total_notifications_unread: number;
  total_posts: number;
  total_uploads: number;
  total_collections: number;
}

// ... other interfaces
```

## Browser DevTools Tips

```javascript
// Check stored user_id
localStorage.getItem('user_id')

// Check token
localStorage.getItem('auth_token')

// Decode token to verify user_id
const token = localStorage.getItem('auth_token');
const decoded = JSON.parse(atob(token.split('.')[1]));
console.log(decoded.sub); // This is the user_id

// Test API call in console
fetch('http://localhost:8002/user/full-profile/507f1f77bcf86cd799439011', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('auth_token')
  }
}).then(r => r.json()).then(console.log)

// Monitor fetch requests in Network tab
// Look for: Authorization header present
// Look for: 20x response status
// Look for: Payload size (should be < 100KB for typical user)
```

---

**Status**: Ready for Frontend Integration  
**Last Updated**: March 24, 2026
