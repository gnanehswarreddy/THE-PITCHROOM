from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .db import ensure_indexes, mongo_manager
from .routes.messages import router as messages_router
from .websocket import ConnectionManager

app = FastAPI(title="PitchRoom Messaging API", version="1.0.0")
ws_manager = ConnectionManager()
app.state.ws_manager = ws_manager


@app.on_event("startup")
async def on_startup() -> None:
    mongo_manager.connect()
    await ensure_indexes()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    mongo_manager.disconnect()


@app.get("/health")
async def health() -> dict:
    return {
        "ok": True,
        "service": "pitchroom-messaging",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


app.include_router(messages_router)


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str) -> None:
    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            event = await websocket.receive_json()
            event_type = event.get("type")

            if event_type == "typing":
                to_user_id = str(event.get("to_user_id", "")).strip()
                conversation_id = str(event.get("conversation_id", "")).strip()
                is_typing = bool(event.get("is_typing", True))

                if not to_user_id or not conversation_id:
                    await websocket.send_json({
                        "type": "error",
                        "payload": {"detail": "typing event requires to_user_id and conversation_id"},
                    })
                    continue

                await ws_manager.send_to_user(
                    to_user_id,
                    {
                        "type": "typing",
                        "payload": {
                            "conversation_id": conversation_id,
                            "from_user_id": user_id,
                            "is_typing": is_typing,
                        },
                    },
                )
                continue

            if event_type == "ping":
                await websocket.send_json({"type": "pong", "payload": {}})
                continue

            await websocket.send_json(
                {
                    "type": "error",
                    "payload": {"detail": "Unsupported event type"},
                }
            )
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
