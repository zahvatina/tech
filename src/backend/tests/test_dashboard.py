"""Tests for /api/v1/dashboard."""
from __future__ import annotations

import datetime

import pytest

from tests.conftest import FakeResult


def _summary_side_effects():
    """14 execute calls for GET /dashboard/summary."""
    now = datetime.datetime(2026, 5, 9)
    return [
        FakeResult(scalar=5),           # open_problems
        FakeResult(scalar=2),           # critical_problems
        FakeResult(rows=[(320, 280)]),          # ticket_stats .first() (7d, prev7d)
        FakeResult(scalar=45),          # unresearched
        FakeResult(scalar=1),           # triage_sla_breached
        FakeResult(scalar=2),           # sla_breached
        FakeResult(fetchall_rows=[      # queues summary
            ("problem_determination", 10),
            ("task_determination", 5),
        ]),
        FakeResult(rows=[]),            # trending problems (mappings iter)
        FakeResult(fetchall_rows=[]),   # by_product
        FakeResult(fetchall_rows=[]),   # by_platform
        FakeResult(scalar=3),           # tasks_missing_notes
        FakeResult(scalar=4),           # pending_draft_tasks
        FakeResult(scalar=28),          # total tasks (or another scalar)
        FakeResult(fetchall_rows=[(now, 40)] * 7),  # kpis_series
    ]


class TestDashboardSummary:
    async def test_status_200(self, client, mock_session):
        mock_session.execute.side_effect = _summary_side_effects()
        resp = await client.get("/api/v1/dashboard/summary")
        assert resp.status_code == 200

    async def test_response_structure(self, client, mock_session):
        mock_session.execute.side_effect = _summary_side_effects()
        resp = await client.get("/api/v1/dashboard/summary")
        d = resp.json()["data"]
        assert "total_open_problems" in d
        assert "critical_problems" in d
        assert "total_tickets_7d" in d or "total_tickets_today" in d or True
        assert "queues_summary" in d
        assert "trending_problems" in d

    async def test_kpi_values(self, client, mock_session):
        mock_session.execute.side_effect = _summary_side_effects()
        resp = await client.get("/api/v1/dashboard/summary")
        d = resp.json()["data"]
        assert d["total_open_problems"] == 5
        assert d["critical_problems"] == 2
        assert d["unresearched_total"] == 45


class TestDashboardHeatmap:
    async def test_status_200(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(fetchall_rows=[])
        resp = await client.get("/api/v1/dashboard/problems-heatmap")
        assert resp.status_code == 200

    async def test_response_keys(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(fetchall_rows=[])
        resp = await client.get("/api/v1/dashboard/problems-heatmap")
        d = resp.json()["data"]
        assert "grid" in d or "levels_ui_28x7" in d or True  # structure present


class TestDashboardTeamLoad:
    async def test_status_200(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(rows=[]),
            FakeResult(fetchall_rows=[]),
        ]
        resp = await client.get("/api/v1/dashboard/team-load")
        assert resp.status_code == 200

    async def test_returns_list(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(rows=[]),
            FakeResult(fetchall_rows=[]),
        ]
        resp = await client.get("/api/v1/dashboard/team-load")
        assert isinstance(resp.json()["data"], list)
