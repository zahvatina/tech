"""Tests for /api/v1/products, /teams, /users."""
from __future__ import annotations

import pytest

from tests.conftest import FakeResult


class TestProducts:
    async def test_empty(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get("/api/v1/products")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    async def test_returns_list(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[
            {"id": "11111111-0000-4000-8000-000000000001", "name": "ОСАГО", "code": "osago", "is_active": True},
            {"id": "22222222-0000-4000-8000-000000000001", "name": "КАСКО", "code": "kasko", "is_active": True},
        ])
        resp = await client.get("/api/v1/products")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert len(d) == 2
        assert d[0]["code"] == "osago"


class TestTeams:
    async def test_empty(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get("/api/v1/teams")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    async def test_returns_list(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[
            {
                "id": "aaaaaaaa-0000-4000-8000-000000000001",
                "name": "Payments", "slug": "payments",
                "color": "#ff0000", "jira_project_key": "PAY",
            }
        ])
        resp = await client.get("/api/v1/teams")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert d[0]["slug"] == "payments"


class TestUsers:
    async def test_empty(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get("/api/v1/users")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    async def test_returns_list(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[
            {
                "id": "cccccccc-0000-4000-8000-000000000001",
                "email": "anna@sbr.ru", "name": "Анна Котова",
                "role": "operator", "team_id": None, "team_name": None,
            }
        ])
        resp = await client.get("/api/v1/users")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert d[0]["name"] == "Анна Котова"
        assert d[0]["role"] == "operator"
