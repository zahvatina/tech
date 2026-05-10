"""Tests for /api/v1/notifications."""
from __future__ import annotations

import datetime

import pytest

from tests.conftest import FakeResult

_USER_ID = "cccccccc-0000-4000-8000-000000000001"
_TEAM_ID = "aaaaaaaa-0000-4000-8000-000000000001"
_NOW = datetime.datetime(2026, 5, 10, 12, 0, 0)

_NOTIF_ROW = {
    "id": "dddddddd-0000-4000-8000-000000000001",
    "user_id": _USER_ID,
    "team_id": None,
    "type": "draft_confirmed",
    "title": "Черновик подтверждён",
    "body": "Задача BUG-42 переведена в open",
    "entity_type": "task",
    "entity_id": "50000000-0000-4000-8000-000000000001",
    "is_read": False,
    "created_at": _NOW,
}


class TestListNotifications:
    async def test_empty(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get("/api/v1/notifications")
        assert resp.status_code == 200
        assert resp.json()["data"] == []
        assert resp.json()["meta"]["unread"] == 0

    async def test_returns_list(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[_NOTIF_ROW])
        resp = await client.get("/api/v1/notifications")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert len(d) == 1
        assert d[0]["type"] == "draft_confirmed"
        assert d[0]["is_read"] is False

    async def test_unread_count(self, client, mock_session):
        read_row = {**_NOTIF_ROW, "id": "dddddddd-0000-4000-8000-000000000002", "is_read": True}
        mock_session.execute.return_value = FakeResult(rows=[_NOTIF_ROW, read_row])
        resp = await client.get("/api/v1/notifications")
        assert resp.status_code == 200
        assert resp.json()["meta"]["unread"] == 1
        assert resp.json()["meta"]["total"] == 2

    async def test_filter_unread_only(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[_NOTIF_ROW])
        resp = await client.get("/api/v1/notifications?unread_only=true")
        assert resp.status_code == 200

    async def test_filter_by_user_id(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[_NOTIF_ROW])
        resp = await client.get(f"/api/v1/notifications?user_id={_USER_ID}")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1

    async def test_filter_by_team_id(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get(f"/api/v1/notifications?team_id={_TEAM_ID}")
        assert resp.status_code == 200

    async def test_invalid_limit(self, client):
        resp = await client.get("/api/v1/notifications?limit=500")
        assert resp.status_code == 422

    async def test_response_fields(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[_NOTIF_ROW])
        resp = await client.get("/api/v1/notifications")
        d = resp.json()["data"][0]
        assert "id" in d
        assert "type" in d
        assert "title" in d
        assert "is_read" in d
        assert "created_at" in d


class TestMarkAllRead:
    async def test_mark_all_read_204(self, client, mock_session):
        mock_session.execute.return_value = FakeResult()
        resp = await client.patch("/api/v1/notifications/read-all")
        assert resp.status_code == 204

    async def test_mark_all_read_with_user_id(self, client, mock_session):
        mock_session.execute.return_value = FakeResult()
        resp = await client.patch(f"/api/v1/notifications/read-all?user_id={_USER_ID}")
        assert resp.status_code == 204

    async def test_mark_all_read_with_team_id(self, client, mock_session):
        mock_session.execute.return_value = FakeResult()
        resp = await client.patch(f"/api/v1/notifications/read-all?team_id={_TEAM_ID}")
        assert resp.status_code == 204

    async def test_requires_auth(self, client_no_auth, mock_session):
        resp = await client_no_auth.patch("/api/v1/notifications/read-all")
        assert resp.status_code == 401
