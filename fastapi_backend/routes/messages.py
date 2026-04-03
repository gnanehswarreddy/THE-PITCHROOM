from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db import get_db
from ..models import (
    ConversationCreateRequest,
    ConversationOut,
    InboxResponse,
    MarkSeenRequest,
    MarkSeenResponse,
    MessageOut,
    MessagesResponse,
    SendMessageRequest,
)

router = APIRouter(tags=["Messaging"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _participants_key(user_a: str, user_b: str) -> str:
    participants = sorted([user_a.strip(), user_b.strip()])
    return "|".join(participants)


async def _user_exists(db: AsyncIOMotorDatabase, user_id: str) -> bool:
    if not user_id:
        return False

    filters: list[dict[str, Any]] = [{"id": user_id}, {"user_id": user_id}]
    if ObjectId.is_valid(user_id):
        filters.append({"_id": ObjectId(user_id)})

    found = await db.users.find_one({"$or": filters}, {"_id": 1})
    return found is not None


async def _get_conversation_or_404(db: AsyncIOMotorDatabase, conversation_id: str) -> dict[str, Any]:
    conversation = await db.conversations.find_one({"conversation_id": conversation_id})
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conversation


def _serialize_message(message: dict[str, Any]) -> dict[str, Any]:
    return {
        "message_id": message["message_id"],
        "conversation_id": message["conversation_id"],
        "sender_id": message["sender_id"],
        "text": message["text"],
        "created_at": message["created_at"],
        "seen": bool(message.get("seen", False)),
    }


@router.post("/conversation", response_model=ConversationOut)
async def create_or_get_conversation(payload: ConversationCreateRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> ConversationOut:
    user_id = payload.user_id.strip()
    other_user_id = payload.other_user_id.strip()

    if user_id == other_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create conversation with yourself")

    user_exists, other_exists = await _user_exists(db, user_id), await _user_exists(db, other_user_id)
    if not user_exists or not other_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more users were not found")

    participants = sorted([user_id, other_user_id])
    participants_key = _participants_key(user_id, other_user_id)

    existing = await db.conversations.find_one({"participants_key": participants_key})
    if existing:
        return ConversationOut(
            conversation_id=existing["conversation_id"],
            participants=existing["participants"],
            last_message=existing.get("last_message", ""),
            updated_at=existing["updated_at"],
            unread_count=0,
        )

    now = _utc_now()
    conversation_id = str(uuid4())

    doc = {
        "conversation_id": conversation_id,
        "participants": participants,
        "participants_key": participants_key,
        "last_message": "",
        "updated_at": now,
        "created_at": now,
    }

    try:
        await db.conversations.insert_one(doc)
    except Exception:
        # Race-safe duplicate prevention via unique index on participants_key.
        existing = await db.conversations.find_one({"participants_key": participants_key})
        if existing is None:
            raise
        return ConversationOut(
            conversation_id=existing["conversation_id"],
            participants=existing["participants"],
            last_message=existing.get("last_message", ""),
            updated_at=existing["updated_at"],
            unread_count=0,
        )

    return ConversationOut(
        conversation_id=conversation_id,
        participants=participants,
        last_message="",
        updated_at=now,
        unread_count=0,
    )


@router.get("/inbox/{user_id}", response_model=InboxResponse)
async def get_inbox(user_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> InboxResponse:
    if not await _user_exists(db, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    conversations = await db.conversations.find({"participants": user_id}).sort("updated_at", -1).to_list(length=200)

    conversation_ids = [item["conversation_id"] for item in conversations]
    unread_map: dict[str, int] = {}

    if conversation_ids:
        unread_pipeline = [
            {
                "$match": {
                    "conversation_id": {"$in": conversation_ids},
                    "seen": False,
                    "sender_id": {"$ne": user_id},
                }
            },
            {
                "$group": {
                    "_id": "$conversation_id",
                    "count": {"$sum": 1},
                }
            },
        ]
        unread_rows = await db.messages.aggregate(unread_pipeline).to_list(length=None)
        unread_map = {row["_id"]: row["count"] for row in unread_rows}

    serialized = [
        ConversationOut(
            conversation_id=item["conversation_id"],
            participants=item["participants"],
            last_message=item.get("last_message", ""),
            updated_at=item["updated_at"],
            unread_count=unread_map.get(item["conversation_id"], 0),
        )
        for item in conversations
    ]

    return InboxResponse(conversations=serialized)


@router.post("/send-message", response_model=MessageOut)
async def send_message(payload: SendMessageRequest, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)) -> MessageOut:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message text cannot be empty")

    if not await _user_exists(db, payload.sender_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sender not found")

    conversation = await _get_conversation_or_404(db, payload.conversation_id)

    if payload.sender_id not in conversation["participants"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sender is not a participant of this conversation")

    now = _utc_now()
    message_doc = {
        "message_id": str(uuid4()),
        "conversation_id": payload.conversation_id,
        "sender_id": payload.sender_id,
        "text": text,
        "created_at": now,
        "seen": False,
    }

    await db.messages.insert_one(message_doc)
    await db.conversations.update_one(
        {"conversation_id": payload.conversation_id},
        {
            "$set": {
                "last_message": text,
                "updated_at": now,
            }
        },
    )

    manager = request.app.state.ws_manager
    recipients = [user for user in conversation["participants"] if user != payload.sender_id]
    for recipient in recipients:
        await manager.send_to_user(
            recipient,
            {
                "type": "new_message",
                "payload": {
                    "conversation_id": payload.conversation_id,
                    "message": _serialize_message(message_doc),
                },
            },
        )

    await manager.notify_participants(
        conversation["participants"],
        {
            "type": "inbox_refresh",
            "payload": {
                "conversation_id": payload.conversation_id,
                "updated_at": now.isoformat(),
                "last_message": text,
            },
        },
    )

    return MessageOut(**_serialize_message(message_doc))


@router.get("/messages/{conversation_id}", response_model=MessagesResponse)
async def get_messages(
    conversation_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MessagesResponse:
    await _get_conversation_or_404(db, conversation_id)

    skip = (page - 1) * page_size
    cursor = db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1).skip(skip).limit(page_size)
    rows = await cursor.to_list(length=page_size)
    total = await db.messages.count_documents({"conversation_id": conversation_id})

    return MessagesResponse(
        conversation_id=conversation_id,
        page=page,
        page_size=page_size,
        total=total,
        messages=[MessageOut(**_serialize_message(row)) for row in rows],
    )


@router.post("/mark-seen", response_model=MarkSeenResponse)
async def mark_seen(payload: MarkSeenRequest, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)) -> MarkSeenResponse:
    conversation = await _get_conversation_or_404(db, payload.conversation_id)

    if payload.user_id not in conversation["participants"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a participant of this conversation")

    result = await db.messages.update_many(
        {
            "conversation_id": payload.conversation_id,
            "sender_id": {"$ne": payload.user_id},
            "seen": False,
        },
        {
            "$set": {
                "seen": True,
                "seen_at": _utc_now(),
            }
        },
    )

    manager = request.app.state.ws_manager
    await manager.notify_participants(
        conversation["participants"],
        {
            "type": "seen_update",
            "payload": {
                "conversation_id": payload.conversation_id,
                "seen_by": payload.user_id,
                "updated_count": result.modified_count,
            },
        },
        exclude_user_id=payload.user_id,
    )

    return MarkSeenResponse(conversation_id=payload.conversation_id, updated_count=result.modified_count)
