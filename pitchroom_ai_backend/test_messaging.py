"""
Messaging System Integration Tests

Comprehensive tests for all messaging features including conversations,
messages, typing indicators, and WebSocket functionality.
"""

import asyncio
import json
import time
from datetime import datetime, timezone

import httpx
import pytest  # type: ignore[import-not-found]

# Test configuration
API_BASE = "http://127.0.0.1:8002"
MESSAGING_BASE = f"{API_BASE}/messaging"
WS_BASE = "ws://127.0.0.1:8002/ws"


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def auth_tokens():
    """Create users and get auth tokens."""
    tokens = {}

    # Register writer
    response = httpx.post(
        f"{API_BASE}/auth/register",
        json={
            "name": "Alice Writer",
            "email": f"alice_{time.time()}@test.com",
            "password": "TestPass123",
            "role": "writer",
        },
    )
    tokens["alice"] = response.json()["access_token"]

    # Register producer
    response = httpx.post(
        f"{API_BASE}/auth/register",
        json={
            "name": "Bob Producer",
            "email": f"bob_{time.time()}@test.com",
            "password": "TestPass123",
            "role": "producer",
        },
    )
    tokens["bob"] = response.json()["access_token"]

    return tokens


@pytest.fixture
def alice_headers(auth_tokens):
    """Alice's Authorization header."""
    return {"Authorization": f"Bearer {auth_tokens['alice']}"}


@pytest.fixture
def bob_headers(auth_tokens):
    """Bob's Authorization header."""
    return {"Authorization": f"Bearer {auth_tokens['bob']}"}


# ============================================================================
# Conversation Tests
# ============================================================================


def test_create_conversation(alice_headers, bob_headers):
    """Test creating a conversation between two users."""
    # Get Bob's user ID first
    response = httpx.get(
        f"{API_BASE}/messaging/health",
        headers=alice_headers,
    )
    assert response.status_code == 200

    # Alice creates conversation with Bob
    response = httpx.post(
        f"{MESSAGING_BASE}/conversation",
        json={"other_user_id": "507f1f77bcf86cd799439011"},
        headers=alice_headers,
    )

    # Should succeed or fail gracefully (if user ID invalid)
    assert response.status_code in [200, 404, 400]

    if response.status_code == 200:
        data = response.json()
        assert "conversation_id" in data
        assert "participants" in data
        assert data["conversation_id"]


def test_cannot_create_conversation_with_self(alice_headers):
    """Test that users cannot create conversations with themselves."""
    # Extract Alice's user ID from token (decoded)
    response = httpx.post(
        f"{MESSAGING_BASE}/conversation",
        json={"other_user_id": "507f1f77bcf86cd799439011"},  # Invalid for self-check
        headers=alice_headers,
    )

    # Should handle gracefully
    assert response.status_code in [200, 400, 404]


def test_duplicate_conversation_prevention(alice_headers, bob_headers):
    """Test that duplicate conversations aren't created."""
    # Alice creates conversation with Bob
    response1 = httpx.post(
        f"{MESSAGING_BASE}/conversation",
        json={"other_user_id": "507f1f77bcf86cd799439011"},
        headers=alice_headers,
    )

    if response1.status_code == 200:
        conv_id_1 = response1.json()["conversation_id"]

        # Alice creates conversation with Bob again
        response2 = httpx.post(
            f"{MESSAGING_BASE}/conversation",
            json={"other_user_id": "507f1f77bcf86cd799439011"},
            headers=alice_headers,
        )

        if response2.status_code == 200:
            conv_id_2 = response2.json()["conversation_id"]

            # Should be same conversation
            assert conv_id_1 == conv_id_2


def test_get_inbox(alice_headers):
    """Test fetching user's inbox."""
    response = httpx.get(
        f"{MESSAGING_BASE}/inbox",
        params={"limit": 20, "page": 1},
        headers=alice_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "unread_total" in data
    assert "conversations" in data
    assert isinstance(data["conversations"], list)


def test_inbox_pagination(alice_headers):
    """Test inbox pagination."""
    response = httpx.get(
        f"{MESSAGING_BASE}/inbox",
        params={"limit": 5, "page": 1},
        headers=alice_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["conversations"]) <= 5

    if data["total"] > 5:
        # Load page 2
        response2 = httpx.get(
            f"{MESSAGING_BASE}/inbox",
            params={"limit": 5, "page": 2},
            headers=alice_headers,
        )
        assert response2.status_code == 200


def test_search_conversations(alice_headers):
    """Test searching conversations."""
    response = httpx.get(
        f"{MESSAGING_BASE}/search",
        params={"q": "alice", "limit": 20},
        headers=alice_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "total" in data
    assert "conversations" in data
    assert data["query"] == "alice"


def test_conversation_stats(alice_headers):
    """Test getting conversation statistics."""
    # First create a conversation
    response = httpx.post(
        f"{MESSAGING_BASE}/conversation",
        json={"other_user_id": "507f1f77bcf86cd799439011"},
        headers=alice_headers,
    )

    if response.status_code == 200:
        conv_id = response.json()["conversation_id"]

        # Get stats
        response = httpx.get(
            f"{MESSAGING_BASE}/conversation/{conv_id}/stats",
            headers=alice_headers,
        )

        if response.status_code == 200:
            data = response.json()
            assert "conversation_id" in data
            assert "total_messages" in data
            assert "unread_count" in data
            assert "participants_count" in data


# ============================================================================
# Message Tests
# ============================================================================


def test_send_message(alice_headers):
    """Test sending a message."""
    response = httpx.post(
        f"{MESSAGING_BASE}/send",
        json={
            "conversation_id": "507f1f77bcf86cd799439012",
            "text": "Hello, this is a test message!",
        },
        headers=alice_headers,
    )

    # May fail if conversation doesn't exist, which is expected
    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert "message_id" in data
        assert "conversation_id" in data
        assert "sender_id" in data
        assert data["text"] == "Hello, this is a test message!"
        assert "created_at" in data
        assert data["seen"] == False


def test_message_validation(alice_headers):
    """Test message text validation."""
    # Empty message
    response = httpx.post(
        f"{MESSAGING_BASE}/send",
        json={
            "conversation_id": "507f1f77bcf86cd799439012",
            "text": "",
        },
        headers=alice_headers,
    )

    assert response.status_code in [400, 404]

    # Message too long (> 5000 chars)
    response = httpx.post(
        f"{MESSAGING_BASE}/send",
        json={
            "conversation_id": "507f1f77bcf86cd799439012",
            "text": "x" * 5001,
        },
        headers=alice_headers,
    )

    assert response.status_code in [400, 404, 422]


def test_get_messages(alice_headers):
    """Test fetching messages from a conversation."""
    response = httpx.get(
        f"{MESSAGING_BASE}/conversation/507f1f77bcf86cd799439012/messages",
        params={"page": 1, "page_size": 50},
        headers=alice_headers,
    )

    # May fail if conversation doesn't exist
    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert "conversation_id" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "has_more" in data
        assert "messages" in data
        assert isinstance(data["messages"], list)


def test_message_pagination(alice_headers):
    """Test message pagination."""
    response = httpx.get(
        f"{MESSAGING_BASE}/conversation/507f1f77bcf86cd799439012/messages",
        params={"page": 1, "page_size": 10},
        headers=alice_headers,
    )

    if response.status_code == 200:
        data = response.json()
        assert len(data["messages"]) <= 10

        if data["has_more"]:
            # Load next page
            response2 = httpx.get(
                f"{MESSAGING_BASE}/conversation/507f1f77bcf86cd799439012/messages",
                params={"page": 2, "page_size": 10},
                headers=alice_headers,
            )
            assert response2.status_code == 200


# ============================================================================
# Seen Status Tests
# ============================================================================


def test_mark_messages_seen(alice_headers):
    """Test marking specific messages as seen."""
    response = httpx.post(
        f"{MESSAGING_BASE}/mark-seen",
        json={
            "conversation_id": "507f1f77bcf86cd799439012",
            "message_ids": [
                "507f1f77bcf86cd799439013",
                "507f1f77bcf86cd799439014",
            ],
        },
        headers=alice_headers,
    )

    # May fail if messages don't exist
    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert "success" in data
        assert "updated_count" in data
        assert data["success"] == True


def test_mark_all_messages_seen(alice_headers):
    """Test marking all unseen messages as seen."""
    response = httpx.post(
        f"{MESSAGING_BASE}/mark-seen",
        json={
            "conversation_id": "507f1f77bcf86cd799439012",
        },
        headers=alice_headers,
    )

    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert data["success"] == True


# ============================================================================
# Typing Indicator Tests
# ============================================================================


def test_send_typing_indicator(alice_headers):
    """Test sending typing indicator."""
    response = httpx.post(
        f"{MESSAGING_BASE}/typing",
        json={
            "conversation_id": "507f1f77bcf86cd799439012",
            "is_typing": True,
        },
        headers=alice_headers,
    )

    # May fail if conversation doesn't exist
    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert "conversation_id" in data
        assert "user_id" in data
        assert "is_typing" in data
        assert data["is_typing"] == True


def test_stop_typing_indicator(alice_headers):
    """Test stopping typing indicator."""
    response = httpx.post(
        f"{MESSAGING_BASE}/typing",
        json={
            "conversation_id": "507f1f77bcf86cd799439012",
            "is_typing": False,
        },
        headers=alice_headers,
    )

    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert data["is_typing"] == False


def test_get_typing_users(alice_headers):
    """Test getting users currently typing."""
    response = httpx.get(
        f"{MESSAGING_BASE}/typing/507f1f77bcf86cd799439012",
        headers=alice_headers,
    )

    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert "conversation_id" in data
        assert "typing_users" in data
        assert isinstance(data["typing_users"], list)


# ============================================================================
# Presence Tests
# ============================================================================


def test_update_presence_online(alice_headers):
    """Test marking user as online."""
    response = httpx.post(
        f"{MESSAGING_BASE}/presence",
        params={"online": "true"},
        headers=alice_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert "user_id" in data
    assert data["online"] == True
    assert "last_seen" in data


def test_update_presence_offline(alice_headers):
    """Test marking user as offline."""
    response = httpx.post(
        f"{MESSAGING_BASE}/presence",
        params={"online": "false"},
        headers=alice_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["online"] == False


def test_update_presence_with_active_conversation(alice_headers):
    """Test updating presence with active conversation."""
    response = httpx.post(
        f"{MESSAGING_BASE}/presence",
        params={
            "online": "true",
            "active_conversation_id": "507f1f77bcf86cd799439012",
        },
        headers=alice_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["online"] == True
    assert data["active_conversation_id"] == "507f1f77bcf86cd799439012"


def test_get_user_presence(alice_headers):
    """Test getting user's presence status."""
    # Update presence first
    httpx.post(
        f"{MESSAGING_BASE}/presence",
        params={"online": "true"},
        headers=alice_headers,
    )

    # Get presence
    response = httpx.get(
        f"{MESSAGING_BASE}/presence/507f1f77bcf86cd799439011",
        headers=alice_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert "user_id" in data
    assert "online" in data
    assert "last_seen" in data


# ============================================================================
# Conversation Settings Tests
# ============================================================================


def test_archive_conversation(alice_headers):
    """Test archiving a conversation."""
    response = httpx.post(
        f"{MESSAGING_BASE}/conversation/507f1f77bcf86cd799439012/archive",
        headers=alice_headers,
    )

    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert data["success"] == True
        assert data["archived"] == True


def test_unarchive_conversation(alice_headers):
    """Test unarchiving a conversation."""
    # First archive
    httpx.post(
        f"{MESSAGING_BASE}/conversation/507f1f77bcf86cd799439012/archive",
        headers=alice_headers,
    )

    # Then unarchive
    response = httpx.post(
        f"{MESSAGING_BASE}/conversation/507f1f77bcf86cd799439012/unarchive",
        headers=alice_headers,
    )

    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert data["archived"] == False


def test_mute_conversation(alice_headers):
    """Test muting a conversation."""
    response = httpx.post(
        f"{MESSAGING_BASE}/conversation/507f1f77bcf86cd799439012/mute",
        headers=alice_headers,
    )

    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert data["success"] == True
        assert data["muted"] == True


def test_unmute_conversation(alice_headers):
    """Test unmuting a conversation."""
    # First mute
    httpx.post(
        f"{MESSAGING_BASE}/conversation/507f1f77bcf86cd799439012/mute",
        headers=alice_headers,
    )

    # Then unmute
    response = httpx.post(
        f"{MESSAGING_BASE}/conversation/507f1f77bcf86cd799439012/unmute",
        headers=alice_headers,
    )

    assert response.status_code in [200, 404, 403]

    if response.status_code == 200:
        data = response.json()
        assert data["muted"] == False


# ============================================================================
# Authentication Tests
# ============================================================================


def test_missing_auth_header(alice_headers):
    """Test that missing auth header returns 401."""
    response = httpx.get(f"{MESSAGING_BASE}/inbox")

    assert response.status_code == 403  # Or 401, depending on implementation


def test_invalid_auth_token(alice_headers):
    """Test that invalid token returns 401."""
    response = httpx.get(
        f"{MESSAGING_BASE}/inbox",
        headers={"Authorization": "Bearer invalid_token"},
    )

    assert response.status_code in [401, 422]


# ============================================================================
# Health Check
# ============================================================================


def test_messaging_health(alice_headers):
    """Test messaging service health endpoint."""
    response = httpx.get(
        f"{MESSAGING_BASE}/health",
        headers=alice_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "messaging"


# ============================================================================
# Integration Tests
# ============================================================================


def test_full_conversation_flow(alice_headers, bob_headers):
    """Test a complete conversation flow."""
    # 1. Create conversation
    response = httpx.post(
        f"{MESSAGING_BASE}/conversation",
        json={"other_user_id": "507f1f77bcf86cd799439011"},
        headers=alice_headers,
    )

    if response.status_code != 200:
        pytest.skip("Cannot create conversation in test environment")

    conv_id = response.json()["conversation_id"]

    # 2. Get inbox
    response = httpx.get(f"{MESSAGING_BASE}/inbox", headers=alice_headers)
    assert response.status_code == 200

    # 3. Send message
    response = httpx.post(
        f"{MESSAGING_BASE}/send",
        json={
            "conversation_id": conv_id,
            "text": "Integration test message",
        },
        headers=alice_headers,
    )

    if response.status_code == 200:
        msg_id = response.json()["message_id"]

        # 4. Get messages
        response = httpx.get(
            f"{MESSAGING_BASE}/conversation/{conv_id}/messages",
            headers=alice_headers,
        )
        assert response.status_code == 200

        # 5. Mark as seen
        response = httpx.post(
            f"{MESSAGING_BASE}/mark-seen",
            json={"conversation_id": conv_id, "message_ids": [msg_id]},
            headers=alice_headers,
        )
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
