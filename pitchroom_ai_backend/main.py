from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket

from pitchroom_ai_backend.config import settings
from pitchroom_ai_backend.database.mongo import get_db, mongo
from pitchroom_ai_backend.database.schemas import ensure_indexes
from pitchroom_ai_backend.routes.auth import router as auth_router
from pitchroom_ai_backend.routes.interactions import router as interactions_router
from pitchroom_ai_backend.routes.matching import router as matching_router
from pitchroom_ai_backend.routes.messaging import router as messaging_router
from pitchroom_ai_backend.routes.scripts import router as scripts_router
from pitchroom_ai_backend.routes.user import router as user_router
from pitchroom_ai_backend.services.vector_service import vector_service
from pitchroom_ai_backend.websocket.handler import websocket_endpoint
from pitchroom_ai_backend.websocket.manager import ws_manager
from pitchroom_ai_backend.utils.logger import configure_logging, get_logger


configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await mongo.connect()
    await ensure_indexes(mongo.db)
    await vector_service.rebuild(mongo.db)
    logger.info("PitchRoom AI backend started")
    yield
    await mongo.disconnect()
    logger.info("PitchRoom AI backend stopped")


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

# Store ws_manager in app state for access
app.state.ws_manager = ws_manager


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "pitchroom-ai", "env": settings.app_env}


app.include_router(auth_router)
app.include_router(scripts_router)
app.include_router(interactions_router)
app.include_router(matching_router)
app.include_router(user_router)
app.include_router(messaging_router)


# ============================================================================
# WebSocket Endpoint - Real-time Messaging
# ============================================================================
@app.websocket("/ws/{user_id}/{conversation_id}")
async def ws_endpoint(
    websocket: WebSocket,
    user_id: str,
    conversation_id: str,
):
    """
    WebSocket endpoint for real-time messaging.

    **Features**:
    - Live message delivery
    - Typing indicators
    - Seen status updates
    - User presence
    - Join/leave notifications

    **Usage**:
    ```javascript
    const ws = new WebSocket('ws://localhost:8002/ws/{user_id}/{conversation_id}');
    
    // Send message
    ws.send(JSON.stringify({
        type: 'message',
        payload: { text: 'Hello!' }
    }));

    // Send typing indicator
    ws.send(JSON.stringify({
        type: 'typing',
        payload: { is_typing: true }
    }));

    // Mark messages as seen
    ws.send(JSON.stringify({
        type: 'message_seen',
        payload: { message_ids: ['msg_id_1', 'msg_id_2'] }
    }));
    ```

    **Messages Received**:
    - `message`: New message from another user
    - `typing`: User is/was typing
    - `message_seen`: Messages marked as seen
    - `user_joined`: User joined conversation
    - `user_left`: User left conversation
    - `error`: Error occurred
    """
    db = mongo.db
    await websocket_endpoint(websocket, user_id, conversation_id, db)
