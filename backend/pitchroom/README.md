PitchRoom AI Backend Module

This module adds production-focused script intelligence features:
- Embedding generation at script creation
- Vector and hybrid semantic search
- Personalized recommendations
- RAG-ready relevant script retrieval
- Interaction tracking and trending scripts

Environment variables required:
- OPENAI_API_KEY
- OPENAI_EMBEDDING_MODEL (optional, default text-embedding-3-small)
- MONGODB_VECTOR_INDEX (optional, default scripts_embedding_idx)
- EMBEDDING_DIMENSIONS (optional, default 1536)

Endpoints:
- POST /api/scripts
- GET /api/search?query=...&page=1&pageSize=10
- GET /api/search/vector?query=...&page=1&pageSize=10
- GET /api/recommendations/:userId?page=1&pageSize=10
- GET /api/scripts/relevant?query=...&page=1&pageSize=10
- POST /api/scripts/:scriptId/interactions
- GET /api/scripts/trending?page=1&pageSize=10

Example request: create script
POST /api/scripts
{
  "title": "Silent Horizon",
  "description": "A disillusioned journalist uncovers a conspiracy on a floating city.",
  "genre": "Sci-Fi Thriller",
  "tags": ["mystery", "future", "conspiracy"]
}

Example request: hybrid search
GET /api/search?query=futuristic conspiracy thriller&page=1&pageSize=10

Example request: track interaction
POST /api/scripts/66f3a8c7f8f0f2bdc6bf4f7a/interactions
{
  "type": "liked"
}

Example response shape:
{
  "data": [
    {
      "_id": "...",
      "title": "...",
      "description": "...",
      "genre": "...",
      "tags": ["..."],
      "authorId": "...",
      "score": 0.92
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "pageSize": 10
  },
  "error": null
}
