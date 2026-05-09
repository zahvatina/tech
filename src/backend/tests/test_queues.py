"""Tests for /api/v1/queues — Queues entity."""
from __future__ import annotations

import pytest

from tests.conftest import FakeResult

_QUEUE_ID   = "aaaaaaaa-0000-4000-8000-000000000001"
_ITEM_ID    = "bbbbbbbb-0000-4000-8000-000000000001"
_USER_ID    = "cccccccc-0000-4000-8000-000000000001"


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

class TestQueueSchemas:
    def test_take_requires_assigned_to(self):
        from pydantic import ValidationError
        from app.schemas.queues import QueueTake

        with pytest.raises(ValidationError):
            QueueTake()

    def test_resolve_requires_note(self):
        from pydantic import ValidationError
        from app.schemas.queues import QueueResolve

        with pytest.raises(ValidationError):
            QueueResolve(resolution_note="")

    def test_resolve_valid(self):
        from app.schemas.queues import QueueResolve

        r = QueueResolve(resolution_note="Linked to PRB-218")
        assert r.resolution_note == "Linked to PRB-218"


# ---------------------------------------------------------------------------
# Auth enforcement
# ---------------------------------------------------------------------------

class TestQueueAuth:
    async def test_take_without_key_401(self, client_no_auth):
        resp = await client_no_auth.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/take",
            json={"assigned_to": _USER_ID},
        )
        assert resp.status_code == 401

    async def test_resolve_without_key_401(self, client_no_auth):
        resp = await client_no_auth.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/resolve",
            json={"resolution_note": "done"},
        )
        assert resp.status_code == 401

    async def test_skip_without_key_401(self, client_no_auth):
        resp = await client_no_auth.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/skip",
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /queues — list
# ---------------------------------------------------------------------------

class TestListQueues:
    async def test_empty(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get("/api/v1/queues")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    async def test_returns_structure(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[
            {
                "id": _QUEUE_ID, "code": "problem_determination",
                "name": "Problem determination", "sla_minutes": 30,
                "pending_count": 5, "in_progress_count": 2,
                "sla_breached_count": 1, "avg_wait_minutes": 12.5,
                "oldest_item_at": None,
            }
        ])
        resp = await client.get("/api/v1/queues")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert len(d) == 1
        assert d[0]["code"] == "problem_determination"
        assert d[0]["pending_count"] == 5


# ---------------------------------------------------------------------------
# GET /queues/{code}/items
# ---------------------------------------------------------------------------

class TestQueueItems:
    async def test_queue_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get("/api/v1/queues/unknown_queue/items")
        assert resp.status_code == 404

    async def test_empty_items(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_QUEUE_ID),
            FakeResult(rows=[]),
        ]
        resp = await client.get("/api/v1/queues/problem_determination/items")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    async def test_invalid_limit(self, client):
        resp = await client.get("/api/v1/queues/problem_determination/items?limit=500")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /{code}/items/{item_id}/take
# ---------------------------------------------------------------------------

import datetime as _dt

class TestTakeItem:
    async def test_queue_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            f"/api/v1/queues/bad_queue/items/{_ITEM_ID}/take",
            json={"assigned_to": _USER_ID},
        )
        assert resp.status_code == 404

    async def test_item_not_found(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_QUEUE_ID),
            FakeResult(scalar=None),
        ]
        resp = await client.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/take",
            json={"assigned_to": _USER_ID},
        )
        assert resp.status_code == 404

    async def test_already_taken_409(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_QUEUE_ID),
            FakeResult(scalar=_ITEM_ID),
            FakeResult(fetchall_rows=[]),  # UPDATE returned 0 rows
        ]
        resp = await client.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/take",
            json={"assigned_to": _USER_ID},
        )
        assert resp.status_code == 409

    async def test_take_success(self, client, mock_session):
        now = _dt.datetime.utcnow()
        mock_session.execute.side_effect = [
            FakeResult(scalar=_QUEUE_ID),
            FakeResult(scalar=_ITEM_ID),
            FakeResult(fetchall_rows=[(_ITEM_ID, now)]),
        ]
        resp = await client.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/take",
            json={"assigned_to": _USER_ID},
        )
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["status"] == "in_progress"
        assert body["assigned_to"] == _USER_ID

    async def test_missing_assigned_to_422(self, client, mock_session):
        resp = await client.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/take",
            json={},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /{code}/items/{item_id}/resolve
# ---------------------------------------------------------------------------

class TestResolveItem:
    async def test_queue_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            f"/api/v1/queues/bad_queue/items/{_ITEM_ID}/resolve",
            json={"resolution_note": "done"},
        )
        assert resp.status_code == 404

    async def test_cannot_resolve_422(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_QUEUE_ID),
            FakeResult(scalar=_ITEM_ID),
            FakeResult(fetchall_rows=[]),
        ]
        resp = await client.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/resolve",
            json={"resolution_note": "done"},
        )
        assert resp.status_code == 422

    async def test_resolve_success(self, client, mock_session):
        now = _dt.datetime.utcnow()
        mock_session.execute.side_effect = [
            FakeResult(scalar=_QUEUE_ID),
            FakeResult(scalar=_ITEM_ID),
            FakeResult(fetchall_rows=[(_ITEM_ID, now)]),
        ]
        resp = await client.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/resolve",
            json={"resolution_note": "Linked to PRB-218"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "completed"

    async def test_missing_note_422(self, client, mock_session):
        resp = await client.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/resolve",
            json={"resolution_note": ""},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /{code}/items/{item_id}/skip
# ---------------------------------------------------------------------------

class TestSkipItem:
    async def test_queue_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            f"/api/v1/queues/bad_queue/items/{_ITEM_ID}/skip",
        )
        assert resp.status_code == 404

    async def test_skip_success(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_QUEUE_ID),
            FakeResult(scalar=_ITEM_ID),
            FakeResult(),
        ]
        resp = await client.post(
            f"/api/v1/queues/problem_determination/items/{_ITEM_ID}/skip",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "pending"
