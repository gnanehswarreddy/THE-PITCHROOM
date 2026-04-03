# PitchRoom Intelligent Algorithm Backend

## Project Structure

```
pitchroom_ai_backend/
  main.py
  config.py
  requirements.txt
  .env.example
  ai/
    gemini_client.py
    metadata_extractor.py
  database/
    mongo.py
    schemas.py
  models/
    auth.py
    script.py
    interaction.py
    common.py
  routes/
    auth.py
    scripts.py
    interactions.py
    matching.py
  services/
    auth_service.py
    script_service.py
    interaction_service.py
    ranking_service.py
    recommendation_service.py
    matching_service.py
    safety_service.py
    vector_service.py
  utils/
    deps.py
    hashing.py
    logger.py
    rate_limit.py
    security.py
    serializers.py
```

## Setup

```bash
cd pitchroom_ai_backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn pitchroom_ai_backend.main:app --reload --host 0.0.0.0 --port 8002
```

## MongoDB Collections

### users
- _id
- name
- email
- password
- role (writer/producer)
- preferences (genres, budget, language, keywords)
- activity_history

### scripts
- _id
- title
- description
- full_script_text
- genre
- keywords
- tone
- summary
- language
- created_by
- created_at
- views
- likes
- shares
- messages_count
- embedding_vector
- hash_signature

### interactions
- user_id
- script_id
- type (view/like/share/message)
- timestamp

## Endpoints

- POST /auth/register
- POST /auth/login
- POST /scripts/upload_script
- GET /scripts/trending
- GET /scripts/recommendations
- GET /scripts/search?query=...
- GET /match/scripts_for_producer
- POST /interact

## Sample Requests / Responses

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "name": "Writer One",
  "email": "writer1@pitchroom.dev",
  "password": "StrongPass123",
  "role": "writer"
}
```

```json
{
  "access_token": "<JWT>",
  "token_type": "bearer"
}
```

### Upload Script
```http
POST /scripts/upload_script
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "title": "Silent Horizon",
  "description": "A journalist uncovers a floating-city conspiracy.",
  "full_script_text": "INT. ROOM - NIGHT ...",
  "language": "English"
}
```

```json
{
  "id": "66f...",
  "title": "Silent Horizon",
  "description": "A journalist uncovers a floating-city conspiracy.",
  "genre": "Thriller",
  "tone": "Dark",
  "language": "English",
  "keywords": ["conspiracy", "future"],
  "summary": "...",
  "created_by": "...",
  "created_at": "2026-03-24T00:00:00Z",
  "views": 0,
  "likes": 0,
  "shares": 0,
  "messages_count": 0,
  "ranking_score": null,
  "similarity_score": null
}
```

### Trending
```http
GET /scripts/trending?limit=10
```

### Recommendations
```http
GET /scripts/recommendations?limit=10
Authorization: Bearer <JWT>
```

### Semantic Search
```http
GET /scripts/search?query=psychological%20thriller&limit=10
```

### Producer Matching
```http
GET /match/scripts_for_producer?limit=10
Authorization: Bearer <JWT>
```

### Interaction
```http
POST /interact
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "script_id": "66f...",
  "type": "like"
}
```

```json
{
  "status": "ok"
}
```
