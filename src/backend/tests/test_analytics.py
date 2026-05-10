"""Tests for /api/v1/analytics."""
from __future__ import annotations

import datetime

import pytest

from tests.conftest import FakeResult


class TestTrends:
    async def test_default_response(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(fetchall_rows=[])
        resp = await client.get("/api/v1/analytics/trends")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert d["metric"] == "tickets_created"
        assert d["granularity"] == "day"
        assert d["series"] == []

    async def test_with_data(self, client, mock_session):
        bucket = datetime.datetime(2026, 5, 1, 0, 0)
        mock_session.execute.return_value = FakeResult(fetchall_rows=[(bucket, 42)])
        resp = await client.get("/api/v1/analytics/trends?metric=tickets_created&period=7d")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert len(d["series"]) == 1
        assert d["series"][0]["count"] == 42
        assert d["min"] == 42
        assert d["max"] == 42

    async def test_unresearched_metric(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(fetchall_rows=[])
        resp = await client.get("/api/v1/analytics/trends?metric=unresearched&granularity=hour")
        assert resp.status_code == 200
        assert resp.json()["data"]["metric"] == "unresearched"

    async def test_week_granularity(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(fetchall_rows=[])
        resp = await client.get("/api/v1/analytics/trends?granularity=week&period=30d")
        assert resp.status_code == 200


class TestQueueMetrics:
    async def test_empty(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get("/api/v1/analytics/queue-metrics")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    async def test_returns_structure(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[
            {
                "code": "problem_determination",
                "total_items": 100, "completed": 80,
                "avg_wait_minutes": 12.5, "sla_breaches": 5,
                "throughput_rate": 0.8,
            }
        ])
        resp = await client.get("/api/v1/analytics/queue-metrics")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert len(d) == 1
        assert d[0]["queue_code"] == "problem_determination"
        assert d[0]["sla_compliance_pct"] == pytest.approx(93.75, abs=0.1)

    async def test_filter_by_queue_code(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get("/api/v1/analytics/queue-metrics?queue_code=task_determination")
        assert resp.status_code == 200

    async def test_period_param(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get("/api/v1/analytics/queue-metrics?period=30d")
        assert resp.status_code == 200
        assert resp.json()["period"] == "30d"


class TestTeamPerformance:
    async def test_empty(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get("/api/v1/analytics/team-performance")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    async def test_returns_structure(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[
            {
                "id": "cccccccc-0000-4000-8000-000000000001",
                "name": "Анна Котова", "role": "operator",
                "total_taken": 20, "resolved": 18,
                "skipped": 2, "avg_resolution_minutes": 8.5,
            }
        ])
        resp = await client.get("/api/v1/analytics/team-performance")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert len(d) == 1
        assert d[0]["name"] == "Анна Котова"
        assert d[0]["resolved"] == 18
        assert "skip_rate" in d[0]

    async def test_period_param(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(rows=[])
        resp = await client.get("/api/v1/analytics/team-performance?period=14d")
        assert resp.status_code == 200
        assert resp.json()["period"] == "14d"
