"""Tests for /api/v1/problems — Problems entity."""
from __future__ import annotations

import uuid

import pytest

from tests.conftest import FakeResult, FakeRow

_PROBLEM_UUID = uuid.UUID("40000000-0000-4000-8000-000000000001")

# ---------------------------------------------------------------------------
# Schema validation (pure Pydantic — no HTTP)
# ---------------------------------------------------------------------------

class TestProblemCreateSchema:
    def test_requires_title(self):
        from pydantic import ValidationError
        from app.schemas.problems import ProblemCreate

        with pytest.raises(ValidationError):
            ProblemCreate()

    def test_defaults(self):
        from app.schemas.problems import ProblemCreate

        p = ProblemCreate(title="Test problem")
        assert p.priority == "medium"
        assert p.affected_product_ids == []
        assert p.tags == []

    def test_invalid_priority(self):
        from pydantic import ValidationError
        from app.schemas.problems import ProblemCreate

        with pytest.raises(ValidationError):
            ProblemCreate(title="Test", priority="super-high")

    def test_title_too_short(self):
        from pydantic import ValidationError
        from app.schemas.problems import ProblemCreate

        with pytest.raises(ValidationError):
            ProblemCreate(title="")


class TestProblemUpdateSchema:
    def test_all_optional(self):
        from app.schemas.problems import ProblemUpdate

        u = ProblemUpdate()
        assert u.title is None
        assert u.status is None
        assert u.priority is None

    def test_valid_status(self):
        from app.schemas.problems import ProblemUpdate

        u = ProblemUpdate(status="in_progress")
        assert u.status == "in_progress"

    def test_invalid_status(self):
        from pydantic import ValidationError
        from app.schemas.problems import ProblemUpdate

        with pytest.raises(ValidationError):
            ProblemUpdate(status="super_status")

    def test_invalid_priority(self):
        from pydantic import ValidationError
        from app.schemas.problems import ProblemUpdate

        with pytest.raises(ValidationError):
            ProblemUpdate(priority="P0")


class TestBulkStatusChangeSchema:
    def test_requires_ids(self):
        from pydantic import ValidationError
        from app.schemas.problems import BulkStatusChange

        with pytest.raises(ValidationError):
            BulkStatusChange(ids=[], status="in_progress")

    def test_valid(self):
        from app.schemas.problems import BulkStatusChange

        b = BulkStatusChange(ids=["PRB-1", "PRB-2"], status="resolved")
        assert len(b.ids) == 2


# ---------------------------------------------------------------------------
# Auth enforcement
# ---------------------------------------------------------------------------

class TestAuth:
    async def test_create_without_key_returns_401(self, client_no_auth):
        resp = await client_no_auth.post("/api/v1/problems", json={"title": "test"})
        assert resp.status_code == 401

    async def test_patch_without_key_returns_401(self, client_no_auth):
        resp = await client_no_auth.patch(
            "/api/v1/problems/PRB-218", json={"title": "updated"}
        )
        assert resp.status_code == 401

    async def test_delete_without_key_returns_401(self, client_no_auth):
        resp = await client_no_auth.delete("/api/v1/problems/PRB-218")
        assert resp.status_code == 401

    async def test_bulk_without_key_returns_401(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/v1/problems/bulk",
            json={"ids": ["PRB-1"], "status": "in_progress"},
        )
        assert resp.status_code == 401

    async def test_wrong_key_returns_401(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/v1/problems",
            json={"title": "test"},
            headers={"X-API-Key": "wrong-key"},
        )
        assert resp.status_code == 401

    async def test_correct_key_reaches_handler(self, client_no_auth, mock_session):
        mock_session.execute.return_value = FakeResult(
            fetchall_rows=[("40000000-0000-4000-8000-000000000001", "PRB-001")]
        )
        resp = await client_no_auth.post(
            "/api/v1/problems",
            json={"title": "test"},
            headers={"X-API-Key": "dev-key"},
        )
        assert resp.status_code == 201


# ---------------------------------------------------------------------------
# GET /problems — list
# ---------------------------------------------------------------------------

class TestListProblems:
    async def test_empty_list(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=0),   # COUNT
            FakeResult(rows=[]),    # list query
        ]
        resp = await client.get("/api/v1/problems")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["meta"]["total"] == 0

    async def test_pagination_meta(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=50),
            FakeResult(rows=[]),
        ]
        resp = await client.get("/api/v1/problems?page=2&limit=10")
        assert resp.status_code == 200
        meta = resp.json()["meta"]
        assert meta["page"] == 2
        assert meta["limit"] == 10
        assert meta["total"] == 50
        assert meta["total_pages"] == 5

    async def test_invalid_page_returns_422(self, client, mock_session):
        resp = await client.get("/api/v1/problems?page=0")
        assert resp.status_code == 422

    async def test_invalid_limit_returns_422(self, client, mock_session):
        resp = await client.get("/api/v1/problems?limit=200")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /problems/{identifier}
# ---------------------------------------------------------------------------

class TestGetProblem:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get("/api/v1/problems/PRB-999")
        assert resp.status_code == 404

    async def test_not_found_uuid(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get(
            "/api/v1/problems/00000000-0000-4000-8000-000000000099"
        )
        assert resp.status_code == 404

    async def test_bulk_route_distinct_from_identifier(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=_PROBLEM_UUID)
        resp = await client.post(
            "/api/v1/problems/bulk",
            json={"ids": ["PRB-1"], "status": "in_progress"},
        )
        # /bulk is a separate route — must NOT return 404 (it would if treated as identifier)
        assert resp.status_code != 404


# ---------------------------------------------------------------------------
# POST /problems — create
# ---------------------------------------------------------------------------

class TestCreateProblem:
    async def test_missing_title_returns_422(self, client, mock_session):
        resp = await client.post("/api/v1/problems", json={})
        assert resp.status_code == 422

    async def test_empty_title_returns_422(self, client, mock_session):
        resp = await client.post("/api/v1/problems", json={"title": ""})
        assert resp.status_code == 422

    async def test_create_success(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(
            fetchall_rows=[("40000000-0000-4000-8000-000000000001", "PRB-001")]
        )
        resp = await client.post(
            "/api/v1/problems",
            json={"title": "New problem", "priority": "high"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "data" in body
        assert body["data"]["short_id"] == "PRB-001"
        assert body["data"]["status"] == "new"

    async def test_create_with_all_fields(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(
            fetchall_rows=[("40000000-0000-4000-8000-000000000002", "PRB-002")]
        )
        resp = await client.post(
            "/api/v1/problems",
            json={
                "title": "Full problem",
                "description": "Some description",
                "priority": "critical",
                "severity": "major",
                "tags": ["osago", "payments"],
                "affected_product_ids": [],
            },
        )
        assert resp.status_code == 201
        assert mock_session.commit.called


# ---------------------------------------------------------------------------
# PATCH /problems/{identifier}
# ---------------------------------------------------------------------------

class TestUpdateProblem:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.patch("/api/v1/problems/PRB-999", json={"title": "x"})
        assert resp.status_code == 404

    async def test_no_fields_returns_400(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),  # resolve_problem_uuid
            FakeResult(scalar="new"),           # get current status
        ]
        resp = await client.patch("/api/v1/problems/PRB-218", json={})
        assert resp.status_code == 400

    async def test_invalid_transition_new_to_resolved(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),
            FakeResult(scalar="new"),
        ]
        resp = await client.patch(
            "/api/v1/problems/PRB-218", json={"status": "resolved"}
        )
        assert resp.status_code == 422

    async def test_invalid_transition_new_to_monitoring(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),
            FakeResult(scalar="new"),
        ]
        resp = await client.patch(
            "/api/v1/problems/PRB-218", json={"status": "monitoring"}
        )
        assert resp.status_code == 422

    async def test_valid_transition_new_to_in_progress(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),  # resolve
            FakeResult(scalar="new"),           # current status
            FakeResult(),                        # UPDATE
        ]
        resp = await client.patch(
            "/api/v1/problems/PRB-218", json={"status": "in_progress"}
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["updated"] is True

    async def test_valid_transition_in_progress_to_resolved(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),
            FakeResult(scalar="in_progress"),
            FakeResult(),
        ]
        resp = await client.patch(
            "/api/v1/problems/PRB-218", json={"status": "resolved"}
        )
        assert resp.status_code == 200

    async def test_update_title_only(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),
            FakeResult(scalar="new"),
            FakeResult(),
        ]
        resp = await client.patch(
            "/api/v1/problems/PRB-218", json={"title": "Updated title"}
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# DELETE /problems/{identifier}
# ---------------------------------------------------------------------------

class TestDeleteProblem:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.delete("/api/v1/problems/PRB-999")
        assert resp.status_code == 404

    async def test_delete_success_returns_204(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),  # resolve
            FakeResult(),                        # UPDATE status='closed'
        ]
        resp = await client.delete("/api/v1/problems/PRB-218")
        assert resp.status_code == 204
        assert mock_session.commit.called


# ---------------------------------------------------------------------------
# GET /problems/{identifier}/sparkline
# ---------------------------------------------------------------------------

class TestSparkline:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get("/api/v1/problems/PRB-999/sparkline")
        assert resp.status_code == 404

    async def test_sparkline_shape(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),  # resolve
            FakeResult(fetchall_rows=[]),       # daily ticket counts
            FakeResult(fetchall_rows=[]),       # daily unresearched counts
        ]
        resp = await client.get("/api/v1/problems/PRB-218/sparkline")
        assert resp.status_code == 200
        body = resp.json()
        assert "tickets" in body["data"]
        assert "unresearched" in body["data"]
        assert len(body["data"]["tickets"]) == 28

    async def test_sparkline_days_param(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),
            FakeResult(fetchall_rows=[]),
            FakeResult(fetchall_rows=[]),
        ]
        resp = await client.get("/api/v1/problems/PRB-218/sparkline?days=7")
        assert resp.status_code == 200
        assert len(resp.json()["data"]["tickets"]) == 7


# ---------------------------------------------------------------------------
# GET /problems/{identifier}/comments
# ---------------------------------------------------------------------------

class TestComments:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get("/api/v1/problems/PRB-999/comments")
        assert resp.status_code == 404

    async def test_empty_comments(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),  # resolve
            FakeResult(scalar=0),              # COUNT
            FakeResult(rows=[]),               # list
        ]
        resp = await client.get("/api/v1/problems/PRB-218/comments")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["meta"]["total"] == 0

    async def test_add_comment_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            "/api/v1/problems/PRB-999/comments",
            json={
                "body": "test comment",
                "author_id": "00000000-0000-4000-8000-000000000001",
            },
        )
        assert resp.status_code == 404

    async def test_add_comment_missing_body(self, client, mock_session):
        resp = await client.post(
            "/api/v1/problems/PRB-218/comments",
            json={"author_id": "00000000-0000-4000-8000-000000000001"},
        )
        assert resp.status_code == 422

    async def test_add_comment_missing_author(self, client, mock_session):
        resp = await client.post(
            "/api/v1/problems/PRB-218/comments",
            json={"body": "some text"},
        )
        assert resp.status_code == 422
