from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        user_sockets = self.active_connections.get(user_id)
        if not user_sockets:
            return

        user_sockets.discard(websocket)
        if not user_sockets:
            self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, message: Dict[str, Any]) -> None:
        sockets = list(self.active_connections.get(user_id, set()))
        if not sockets:
            return

        dead_sockets: list[WebSocket] = []
        payload = {
            **message,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }

        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                dead_sockets.append(socket)

        for socket in dead_sockets:
            self.disconnect(user_id, socket)

    async def notify_participants(self, participants: list[str], message: Dict[str, Any], exclude_user_id: str | None = None) -> None:
        for participant in participants:
            if exclude_user_id and participant == exclude_user_id:
                continue
            await self.send_to_user(participant, message)
