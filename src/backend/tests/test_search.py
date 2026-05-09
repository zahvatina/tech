"""Tests for /api/v1/search."""
from __future__ import annotations

import pytest

from tests.conftest import FakeResult


class TestSearch:
    async def test_missing_q_422(self, client, mock_session):
        resp = await client.get("/api/v1/search")
        assert resp.status_code == 422

    async def test_empty_q_422(self, client, mock_session):
        resp = await client.get("/api/v1/search?q=")
        assert resp.status_code == 422

    async def test_search_all_empty(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(rows=[]),
            FakeResult(rows=[]),
            FakeResult(rows=[]),
        ]
        resp = await client.get("/api/v1/search?q=test")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert d["problems"] == []
        assert d["tasks"] == []
        assert d["tickets"] == []
        assert d["query"] == "test"

    async def test_search_type_problem(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[
            {"short_id": "PRB-218", "title": "Test problem", "priority": "critical", "status": "new"}
        ])
        resp = await client.get("/api/v1/search?q=test&type=problem")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert len(d["problems"]) == 1
        assert d["problems"][0]["id"] == "PRB-218"
        assert d["tasks"] == []
        assert d["tickets"] == []

    async def test_search_type_task(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[
            {"short_id": "BUG-001", "title": "3DS bug", "task_type": "bug",
             "status": "open", "problem_short_id": "PRB-218"}
        ])
        resp = await client.get("/api/v1/search?q=3ds&type=task")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert len(d["tasks"]) == 1
        assert d["tasks"][0]["problemId"] == "PRB-218"

    async def test_search_type_ticket(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[
            {"short_id": "TKT-001", "excerpt": "Полис не выпускается", "status": "new"}
        ])
        resp = await client.get("/api/v1/search?q=полис&type=ticket")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert len(d["tickets"]) == 1
        assert d["tickets"][0]["kind"] == "ticket"

    async def test_invalid_limit(self, client, mock_session):
        resp = await client.get("/api/v1/search?q=test&limit=100")
        assert resp.status_code == 422

    async def test_search_all_returns_three_keys(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(rows=[]),
            FakeResult(rows=[]),
            FakeResult(rows=[]),
        ]
        resp = await client.get("/api/v1/search?q=осаго")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert "problems" in d
        assert "tasks" in d
        assert "tickets" in d
