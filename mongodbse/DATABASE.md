# MongoDB Database Doc

Database name: `pitchroom`

This document describes the MongoDB collections currently created by the app migration and how they are used by the backend and frontend.

## Core Auth Collections

### `users`
Purpose: Stores login credentials and the main auth identity.

Typical fields:
- `_id`: MongoDB ObjectId
- `email`: string, unique
- `passwordHash`: string
- `created_at`: ISO string
- `updated_at`: ISO string

Indexes:
- `users_email_unique` on `{ email: 1 }` unique

### `user_data`
Purpose: Consolidated per-user document for quick access to one user's complete app data snapshot.

Typical fields:
- `_id`: MongoDB ObjectId
- `user_id`: string
- `auth`: object with login identity fields like `email`, `created_at`, `last_login_at`
- `profile`: object snapshot from `profiles`
- `role`: string
- `scripts`: array of the user's scripts
- `stories`: array of the user's stories
- `uploads`: array of uploaded file metadata
- `saved_scripts`: array of producer-side saved script entries
- `notifications`: array of notifications
- `enrollments`: array of academy enrollments
- `conversations`: array of related conversations
- `messages`: array of all messages from the user's conversations
- `stats`: object with counts such as scripts/messages/unread messages
- `created_at`: ISO string
- `updated_at`: ISO string

Indexes:
- `user_data_user_id_unique` on `{ user_id: 1 }` unique

Notes:
- This is a denormalized snapshot collection maintained by the backend.
- It is intended for "complete user data" views and admin/debug access.
- Password hashes remain only in `users`; they are not duplicated into `user_data`.

### `profiles`
Purpose: Stores public profile information for a user.

Typical fields:
- `_id`: MongoDB ObjectId
- `id`: string, maps to the user `_id`
- `name`: string
- `bio`: string
- `avatar_url`: string
- `created_at`: ISO string
- `updated_at`: ISO string

Indexes:
- `profiles_id_unique` on `{ id: 1 }` unique

### `user_roles`
Purpose: Stores one role per user such as `writer` or `producer`.

Typical fields:
- `_id`: MongoDB ObjectId
- `user_id`: string
- `role`: `"writer"` | `"producer"`
- `created_at`: ISO string
- `updated_at`: ISO string

Indexes:
- `user_roles_user_id_unique` on `{ user_id: 1 }` unique

Notes:
- This collection must contain only one document per user.
- The backend now treats duplicate role insert attempts as an update to avoid `E11000` crashes.

## Writer Collections

### `scripts`
Purpose: Uploaded scripts and screenplay metadata.

Typical fields:
- `_id`
- `writer_id`
- `title`
- `logline`
- `genre`
- `visibility`
- `file_url`
- `views`
- `created_at`
- `updated_at`

Indexes:
- `scripts_writer_created_at` on `{ writer_id: 1, created_at: -1 }`

### `stories`
Purpose: Writer story ideas and development entries.

Typical fields:
- `_id`
- `user_id`
- `title`
- `content`
- `status`
- `starred`
- `created_at`
- `updated_at`

Indexes:
- `stories_user_updated_at` on `{ user_id: 1, updated_at: -1 }`

### `script_versions`
Purpose: Stores version history for scripts and AI-enhanced revisions.

Typical fields:
- `_id`
- `script_id`
- `user_id`
- `version_number`
- `title`
- `content`
- `change_summary`
- `created_at`
- `updated_at`

### `character_profiles`
Purpose: Stores AI-generated or manually saved character information.

Typical fields:
- `_id`
- `user_id`
- `script_id`
- `name`
- `description`
- `traits`
- `arc`
- `created_at`
- `updated_at`

## Collaboration Collections

### `conversations`
Purpose: Direct conversation thread between a writer and a producer.

Typical fields:
- `_id`
- `writer_id`
- `producer_id`
- `script_id`
- `last_message_at`
- `created_at`
- `updated_at`

### `messages`
Purpose: Messages inside a conversation.

Typical fields:
- `_id`
- `conversation_id`
- `sender_id`
- `content`
- `read`
- `created_at`
- `updated_at`

Indexes:
- `messages_conversation_created_at` on `{ conversation_id: 1, created_at: 1 }`

### `notifications`
Purpose: User notifications such as pitch activity or message alerts.

Typical fields:
- `_id`
- `user_id`
- `title`
- `message`
- `type`
- `read`
- `created_at`
- `updated_at`

Indexes:
- `notifications_user_created_at` on `{ user_id: 1, created_at: -1 }`

## Producer Collections

### `collections`
Purpose: Saved scripts for a producer.

Typical fields:
- `_id`
- `producer_id`
- `script_id`
- `notes`
- `tags`
- `category`
- `priority`
- `created_at`
- `updated_at`

Indexes:
- `collections_producer_script` on `{ producer_id: 1, script_id: 1 }`

### `collection_shares`
Purpose: Tracks collection sharing between users.

Typical fields:
- `_id`
- `collection_id`
- `shared_with`
- `shared_by`
- `created_at`
- `updated_at`

### `script_views`
Purpose: Tracks view activity on scripts.

Typical fields:
- `_id`
- `script_id`
- `viewer_id`
- `viewed_at`
- `created_at`
- `updated_at`

Indexes:
- `script_views_script_viewer` on `{ script_id: 1, viewer_id: 1 }`

### `script_engagement`
Purpose: Tracks save/engagement actions on scripts.

Typical fields:
- `_id`
- `script_id`
- `user_id`
- `engagement_type`
- `created_at`
- `updated_at`

Indexes:
- `script_engagement_script_user` on `{ script_id: 1, user_id: 1 }`

## Community Collections

### `posts`
Purpose: Community feed posts.

Typical fields:
- `_id`
- `user_id`
- `content`
- `tags`
- `created_at`
- `updated_at`

### `post_comments`
Purpose: Comments on community posts.

Typical fields:
- `_id`
- `post_id`
- `user_id`
- `content`
- `created_at`
- `updated_at`

### `post_likes`
Purpose: Likes on community posts.

Typical fields:
- `_id`
- `post_id`
- `user_id`
- `created_at`
- `updated_at`

## Learning Collections

### `course_enrollments`
Purpose: Stores academy enrollment and progress.

Typical fields:
- `_id`
- `user_id`
- `course_id`
- `progress`
- `created_at`
- `updated_at`

Indexes:
- `course_enrollments_user_course_unique` on `{ user_id: 1, course_id: 1 }` unique

## Files and Uploads

Uploads are stored on the backend filesystem under:

- `backend/uploads/<bucket>/<filename>`

Current API bucket usage includes:
- `scripts`

Public file serving path:
- `/uploads/:bucket/:filename`

## Current Backend API Responsibilities

Implemented in [server.js](/c:/Users/Gnaneshwar%20Reddy/OneDrive/Desktop/Pitchroom-team01-main/backend/server.js):

- Auth signup/login/session lookup
- Generic CRUD operations for collections
- File upload/download handling
- Function dispatch for `mongodbse/functions`

## Migrations

Migration files live in:

- [mongodbse/migrations](/c:/Users/Gnaneshwar%20Reddy/OneDrive/Desktop/Pitchroom-team01-main/mongodbse/migrations)

Current migration:
- `001-init.js`

Run with:

```bash
npm run migrate
```

Applied migrations are tracked in:
- `_migrations`

## Recommended Next Improvements

- Add schema validation for each collection
- Add seed data for courses, demo posts, and sample scripts
- Replace generic CRUD with dedicated domain endpoints for sensitive flows
- Add role-based backend authorization checks
- Add indexes for high-traffic queries in dashboards and messaging
