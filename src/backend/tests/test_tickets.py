"""Tests for /api/v1/tickets — Tickets entity."""
from __future__ import annotations

import uuid

import pytest

from tests.conftest import FakeResult

_TICKET_UUID = uuid.UUID("60000000-0000-4000-8000-000000000001")
_PROBLEM_UUID = uuid.UUID("40000000-0000-4000-8000-000000000001")
_TASK_UUID    = uuid.UUID("50000000-0000-4000-8000-000000000001")


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

class TestTicketCreateSchema:
    def test_requires_user_id(self):
        from pydantic import ValidationError
        from app.schemas.tickets import TicketCreate

        with pytest.raises(ValidationError):
            TicketCreate(raw_text="some text")

    def test_requires_raw_text(self):
        from pydantic import ValidationError
        from app.schemas.tickets import TicketCreate

        with pytest.raises(ValidationError):
            TicketCreate(user_id="usr-1", raw_text="")

    def test_defaults(self):
        from app.schemas.tickets import TicketCreate

        t = TicketCreate(user_id="usr-1", raw_text="some text")
        assert t.platform is None
        assert t.tags == []

    def test_invalid_platform(self):
        from pydantic import ValidationError
        from app.schemas.tickets import TicketCreate

        with pytest.raises(ValidationError):
            TicketCreate(user_id="usr-1", raw_text="t", platform="telegram")

    def test_valid_platform(self):
        from app.schemas.tickets import TicketCreate

        t = TicketCreate(user_id="usr-1", raw_text="t", platform="mobile_app")
        assert t.platform == "mobile_app"


class TestTicketUpdateSchema:
    def test_all_optional(self):
        from app.schemas.tickets import TicketUpdate

        u = TicketUpdate()
        assert u.status is None
        assert u.problem_id is None

    def test_invalid_status(self):
        from pydantic import ValidationError
        from app.schemas.tickets import TicketUpdate

        with pytest.raises(ValidationError):
            TicketUpdate(status="open")

    def test_valid_status(self):
        from app.schemas.tickets import TicketUpdate

        u = TicketUpdate(status="linked")
        assert u.status == "linked"


class TestTicketBulkSchema:
    def test_requires_ids(self):
        from pydantic import ValidationError
        from app.schemas.tickets import TicketBulk

        with pytest.raises(ValidationError):
            TicketBulk(ids=[], action="change_status")

    def test_invalid_action(self):
        from pydantic import ValidationError
        from app.schemas.tickets import TicketBulk

        with pytest.raises(ValidationError):
            TicketBulk(ids=["TKT-001"], action="delete_all")

    def test_valid(self):
        from app.schemas.tickets import TicketBulk

        b = TicketBulk(ids=["TKT-001", "TKT-002"], action="mark_research")
        assert len(b.ids) == 2


# ---------------------------------------------------------------------------
# Auth enforcement
# ---------------------------------------------------------------------------

class TestTicketAuth:
    async def test_create_without_key_401(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/v1/tickets",
            json={"user_id": "usr-1", "raw_text": "test"},
        )
        assert resp.status_code == 401

    async def test_patch_without_key_401(self, client_no_auth):
        resp = await client_no_auth.patch(
            "/api/v1/tickets/TKT-001", json={"status": "in_queue"}
        )
        assert resp.status_code == 401

    async def test_bulk_without_key_401(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/v1/tickets/bulk",
            json={"ids": ["TKT-001"], "action": "mark_research"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /tickets — list
# ---------------------------------------------------------------------------

class TestListTickets:
    async def test_empty_list(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=0),
            FakeResult(rows=[]),
        ]
        resp = await client.get("/api/v1/tickets")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["meta"]["total"] == 0

    async def test_pagination_meta(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=50),
            FakeResult(rows=[]),
        ]
        resp = await client.get("/api/v1/tickets?page=2&limit=10")
        assert resp.status_code == 200
        meta = resp.json()["meta"]
        assert meta["page"] == 2
        assert meta["total"] == 50
        assert meta["total_pages"] == 5

    async def test_invalid_limit(self, client):
        resp = await client.get("/api/v1/tickets?limit=200")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /tickets/{identifier}
# ---------------------------------------------------------------------------

class TestGetTicket:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get("/api/v1/tickets/TKT-999")
        assert resp.status_code == 404

    async def test_not_found_uuid(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get(
            "/api/v1/tickets/00000000-0000-4000-8000-000000000099"
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /tickets — create
# ---------------------------------------------------------------------------

class TestCreateTicket:
    async def test_missing_user_id(self, client, mock_session):
        resp = await client.post("/api/v1/tickets", json={"raw_text": "text"})
        assert resp.status_code == 422

    async def test_missing_raw_text(self, client, mock_session):
        resp = await client.post("/api/v1/tickets", json={"user_id": "usr-1"})
        assert resp.status_code == 422

    async def test_product_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(fetchall_rows=[])
        resp = await client.post(
            "/api/v1/tickets",
            json={"user_id": "usr-1", "raw_text": "text", "product_id": "osago"},
        )
        assert resp.status_code == 404

    async def test_create_minimal_success(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(
            fetchall_rows=[("60000000-0000-4000-8000-000000000001", "TKT-001")]
        )
        resp = await client.post(
            "/api/v1/tickets",
            json={"user_id": "usr-1", "raw_text": "My policy is stuck"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["data"]["short_id"] == "TKT-001"
        assert body["data"]["status"] == "new"

    async def test_create_with_problem(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),
            FakeResult(fetchall_rows=[("60000000-0000-4000-8000-000000000002", "TKT-002")]),
        ]
        resp = await client.post(
            "/api/v1/tickets",
            json={"user_id": "usr-1", "raw_text": "text", "problem_id": "PRB-218"},
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["short_id"] == "TKT-002"

    async def test_create_problem_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            "/api/v1/tickets",
            json={"user_id": "usr-1", "raw_text": "text", "problem_id": "PRB-999"},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /tickets/{identifier}
# ---------------------------------------------------------------------------

class TestUpdateTicket:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.patch(
            "/api/v1/tickets/TKT-999", json={"status": "in_queue"}
        )
        assert resp.status_code == 404

    async def test_no_fields_400(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=_TICKET_UUID)
        resp = await client.patch("/api/v1/tickets/TKT-001", json={})
        assert resp.status_code == 400

    async def test_invalid_transition_new_to_linked(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(scalar="new"),
        ]
        resp = await client.patch(
            "/api/v1/tickets/TKT-001", json={"status": "linked"}
        )
        assert resp.status_code == 422

    async def test_valid_transition_new_to_in_queue(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(scalar="new"),
            FakeResult(),
        ]
        resp = await client.patch(
            "/api/v1/tickets/TKT-001", json={"status": "in_queue"}
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["updated"] is True

    async def test_valid_transition_processing_to_linked(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(scalar="processing"),
            FakeResult(),
        ]
        resp = await client.patch(
            "/api/v1/tickets/TKT-001", json={"status": "linked"}
        )
        assert resp.status_code == 200

    async def test_link_problem(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(scalar=_PROBLEM_UUID),
            FakeResult(),
        ]
        resp = await client.patch(
            "/api/v1/tickets/TKT-001",
            json={"problem_id": "PRB-218"},
        )
        assert resp.status_code == 200

    async def test_link_problem_not_found(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(scalar=None),
        ]
        resp = await client.patch(
            "/api/v1/tickets/TKT-001",
            json={"problem_id": "PRB-999"},
        )
        assert resp.status_code == 404

    async def test_mark_duplicate(self, client, mock_session):
        dup_uuid = uuid.UUID("60000000-0000-4000-8000-000000000099")
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(scalar="processing"),
            FakeResult(scalar=dup_uuid),
            FakeResult(),
        ]
        resp = await client.patch(
            "/api/v1/tickets/TKT-001",
            json={"is_duplicate": True, "status": "duplicate",
                  "duplicate_of": "60000000-0000-4000-8000-000000000099"},
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /tickets/bulk
# ---------------------------------------------------------------------------

class TestBulkTickets:
    async def test_mark_research(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tickets/bulk",
            json={"ids": ["TKT-001"], "action": "mark_research"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["updated"] == 1
        assert body["data"]["action"] == "mark_research"

    async def test_change_status(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tickets/bulk",
            json={"ids": ["TKT-001"], "action": "change_status", "status": "researching"},
        )
        assert resp.status_code == 200

    async def test_link_to_problem(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tickets/bulk",
            json={"ids": ["TKT-001"], "action": "link_to_problem",
                  "problem_id": "PRB-218"},
        )
        assert resp.status_code == 200

    async def test_link_to_problem_missing_problem_id(self, client, mock_session):
        resp = await client.post(
            "/api/v1/tickets/bulk",
            json={"ids": ["TKT-001"], "action": "link_to_problem"},
        )
        assert resp.status_code == 422

    async def test_tickets_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            "/api/v1/tickets/bulk",
            json={"ids": ["TKT-999"], "action": "mark_research"},
        )
        assert resp.status_code == 404

    async def test_empty_ids_422(self, client, mock_session):
        resp = await client.post(
            "/api/v1/tickets/bulk",
            json={"ids": [], "action": "mark_research"},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /tickets/triage-queue
# ---------------------------------------------------------------------------

class TestTriageQueue:
    async def test_returns_structure(self, client, mock_session):
        # endpoint executes: qcounts (fetchall), sparks (mappings iter),
        # cluster_sql (fetchall), hint (mappings iter)
        mock_session.execute.side_effect = [
            FakeResult(fetchall_rows=[]),  # qcounts
            FakeResult(rows=[]),           # sparks.mappings() iter
            FakeResult(fetchall_rows=[]),  # cluster_sql
            FakeResult(rows=[]),           # hint.mappings() iter
        ]
        resp = await client.get("/api/v1/tickets/triage-queue")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert "total_by_queue" in d
        assert "critical_spikes" in d
        assert "clusters" in d
