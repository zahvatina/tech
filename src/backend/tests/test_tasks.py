"""Tests for /api/v1/tasks — Tasks entity."""
from __future__ import annotations

import uuid

import pytest

from tests.conftest import FakeResult

_TASK_UUID = uuid.UUID("50000000-0000-4000-8000-000000000001")
_PROBLEM_UUID = uuid.UUID("40000000-0000-4000-8000-000000000001")


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

class TestTaskCreateSchema:
    def test_requires_problem_id(self):
        from pydantic import ValidationError
        from app.schemas.tasks import TaskCreate

        with pytest.raises(ValidationError):
            TaskCreate(title="Test")

    def test_requires_title(self):
        from pydantic import ValidationError
        from app.schemas.tasks import TaskCreate

        with pytest.raises(ValidationError):
            TaskCreate(problem_id="PRB-218", title="")

    def test_defaults(self):
        from app.schemas.tasks import TaskCreate

        t = TaskCreate(problem_id="PRB-218", title="Test task")
        assert t.task_type == "bug"
        assert t.priority == "medium"
        assert t.has_workaround is False
        assert t.tags == []

    def test_invalid_task_type(self):
        from pydantic import ValidationError
        from app.schemas.tasks import TaskCreate

        with pytest.raises(ValidationError):
            TaskCreate(problem_id="PRB-218", title="Test", task_type="hotfix")


class TestTaskUpdateSchema:
    def test_all_optional(self):
        from app.schemas.tasks import TaskUpdate

        u = TaskUpdate()
        assert u.title is None
        assert u.status is None

    def test_invalid_status(self):
        from pydantic import ValidationError
        from app.schemas.tasks import TaskUpdate

        with pytest.raises(ValidationError):
            TaskUpdate(status="in-progress")

    def test_valid_status(self):
        from app.schemas.tasks import TaskUpdate

        u = TaskUpdate(status="in_progress")
        assert u.status == "in_progress"


class TestTaskRejectSchema:
    def test_requires_review_comment(self):
        from pydantic import ValidationError
        from app.schemas.tasks import TaskReject

        with pytest.raises(ValidationError):
            TaskReject(reviewed_by="some-uuid", review_comment="")

    def test_valid(self):
        from app.schemas.tasks import TaskReject

        r = TaskReject(reviewed_by="user-uuid", review_comment="Needs fixing")
        assert r.review_comment == "Needs fixing"


# ---------------------------------------------------------------------------
# Auth enforcement
# ---------------------------------------------------------------------------

class TestTaskAuth:
    async def test_create_without_key_401(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/v1/tasks",
            json={"problem_id": "PRB-218", "title": "test"},
        )
        assert resp.status_code == 401

    async def test_patch_without_key_401(self, client_no_auth):
        resp = await client_no_auth.patch(
            "/api/v1/tasks/BUG-1001", json={"title": "updated"}
        )
        assert resp.status_code == 401

    async def test_submit_without_key_401(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/v1/tasks/BUG-1001/submit-for-review",
            json={"proposed_by": "user-uuid"},
        )
        assert resp.status_code == 401

    async def test_confirm_without_key_401(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/v1/tasks/BUG-1001/confirm",
            json={"reviewed_by": "user-uuid"},
        )
        assert resp.status_code == 401

    async def test_reject_without_key_401(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/v1/tasks/BUG-1001/reject",
            json={"reviewed_by": "user-uuid", "review_comment": "reason"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /tasks — list
# ---------------------------------------------------------------------------

class TestListTasks:
    async def test_empty_list(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=0),
            FakeResult(rows=[]),
        ]
        resp = await client.get("/api/v1/tasks")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["meta"]["total"] == 0

    async def test_pagination(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=30),
            FakeResult(rows=[]),
        ]
        resp = await client.get("/api/v1/tasks?page=2&limit=10")
        assert resp.status_code == 200
        meta = resp.json()["meta"]
        assert meta["page"] == 2
        assert meta["total"] == 30
        assert meta["total_pages"] == 3

    async def test_invalid_limit(self, client, mock_session):
        resp = await client.get("/api/v1/tasks?limit=500")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /tasks/{identifier}
# ---------------------------------------------------------------------------

class TestGetTask:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get("/api/v1/tasks/BUG-999")
        assert resp.status_code == 404

    async def test_not_found_uuid(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get(
            "/api/v1/tasks/00000000-0000-4000-8000-000000000099"
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /tasks — create
# ---------------------------------------------------------------------------

class TestCreateTask:
    async def test_missing_problem_id(self, client, mock_session):
        resp = await client.post("/api/v1/tasks", json={"title": "test"})
        assert resp.status_code == 422

    async def test_missing_title(self, client, mock_session):
        resp = await client.post(
            "/api/v1/tasks", json={"problem_id": "PRB-218"}
        )
        assert resp.status_code == 422

    async def test_problem_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            "/api/v1/tasks",
            json={"problem_id": "PRB-999", "title": "test"},
        )
        assert resp.status_code == 404

    async def test_create_success(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_PROBLEM_UUID),
            FakeResult(fetchall_rows=[("50000000-0000-4000-8000-000000000001", "BUG-001")]),
        ]
        resp = await client.post(
            "/api/v1/tasks",
            json={"problem_id": "PRB-218", "title": "New bug", "task_type": "bug"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["data"]["short_id"] == "BUG-001"
        assert body["data"]["status"] == "draft"


# ---------------------------------------------------------------------------
# PATCH /tasks/{identifier}
# ---------------------------------------------------------------------------

class TestUpdateTask:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.patch("/api/v1/tasks/BUG-999", json={"title": "x"})
        assert resp.status_code == 404

    async def test_no_fields_400(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="draft"),
        ]
        resp = await client.patch("/api/v1/tasks/BUG-1001", json={})
        assert resp.status_code == 400

    async def test_invalid_transition_draft_to_fixed(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="draft"),
        ]
        resp = await client.patch(
            "/api/v1/tasks/BUG-1001", json={"status": "fixed"}
        )
        assert resp.status_code == 422

    async def test_valid_transition_draft_to_pending(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="draft"),
            FakeResult(),
        ]
        resp = await client.patch(
            "/api/v1/tasks/BUG-1001", json={"status": "pending_confirmation"}
        )
        assert resp.status_code == 200

    async def test_valid_transition_open_to_in_progress(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="open"),
            FakeResult(),
        ]
        resp = await client.patch(
            "/api/v1/tasks/BUG-1001", json={"status": "in_progress"}
        )
        assert resp.status_code == 200

    async def test_update_title(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="draft"),
            FakeResult(),
        ]
        resp = await client.patch(
            "/api/v1/tasks/BUG-1001", json={"title": "Updated title"}
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["updated"] is True


# ---------------------------------------------------------------------------
# POST /tasks/{identifier}/submit-for-review
# ---------------------------------------------------------------------------

class TestSubmitForReview:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            "/api/v1/tasks/BUG-999/submit-for-review",
            json={"proposed_by": "user-uuid"},
        )
        assert resp.status_code == 404

    async def test_wrong_status_422(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="open"),
        ]
        resp = await client.post(
            "/api/v1/tasks/BUG-1001/submit-for-review",
            json={"proposed_by": "user-uuid"},
        )
        assert resp.status_code == 422

    async def test_submit_from_draft_success(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="draft"),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tasks/BUG-1001/submit-for-review",
            json={"proposed_by": "00000000-0000-4000-8000-000000000001"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "pending_confirmation"

    async def test_submit_from_rejected_success(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="rejected_draft"),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tasks/BUG-1001/submit-for-review",
            json={"proposed_by": "00000000-0000-4000-8000-000000000001"},
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /tasks/{identifier}/confirm
# ---------------------------------------------------------------------------

class TestConfirmTask:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            "/api/v1/tasks/BUG-999/confirm",
            json={"reviewed_by": "user-uuid"},
        )
        assert resp.status_code == 404

    async def test_wrong_status_422(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="draft"),
        ]
        resp = await client.post(
            "/api/v1/tasks/BUG-1001/confirm",
            json={"reviewed_by": "user-uuid"},
        )
        assert resp.status_code == 422

    async def test_confirm_success(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="pending_confirmation"),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tasks/BUG-1001/confirm",
            json={"reviewed_by": "00000000-0000-4000-8000-000000000001"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "open"


# ---------------------------------------------------------------------------
# POST /tasks/{identifier}/reject
# ---------------------------------------------------------------------------

class TestRejectTask:
    async def test_missing_comment(self, client, mock_session):
        resp = await client.post(
            "/api/v1/tasks/BUG-1001/reject",
            json={"reviewed_by": "user-uuid", "review_comment": ""},
        )
        assert resp.status_code == 422

    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            "/api/v1/tasks/BUG-999/reject",
            json={"reviewed_by": "user-uuid", "review_comment": "reason"},
        )
        assert resp.status_code == 404

    async def test_wrong_status_422(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="open"),
        ]
        resp = await client.post(
            "/api/v1/tasks/BUG-1001/reject",
            json={"reviewed_by": "user-uuid", "review_comment": "reason"},
        )
        assert resp.status_code == 422

    async def test_reject_success(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar="pending_confirmation"),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tasks/BUG-1001/reject",
            json={
                "reviewed_by": "00000000-0000-4000-8000-000000000001",
                "review_comment": "Needs more details",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "rejected_draft"


# ---------------------------------------------------------------------------
# GET /tasks/{identifier}/activity
# ---------------------------------------------------------------------------

class TestTaskActivity:
    async def test_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get("/api/v1/tasks/BUG-999/activity")
        assert resp.status_code == 404

    async def test_empty_activity(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar=0),
            FakeResult(rows=[]),
        ]
        resp = await client.get("/api/v1/tasks/BUG-1001/activity")
        assert resp.status_code == 200
        assert resp.json()["data"] == []


# ---------------------------------------------------------------------------
# GET/POST /tasks/{identifier}/comments
# ---------------------------------------------------------------------------

class TestTaskComments:
    async def test_get_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.get("/api/v1/tasks/BUG-999/comments")
        assert resp.status_code == 404

    async def test_empty_comments(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar=0),
            FakeResult(rows=[]),
        ]
        resp = await client.get("/api/v1/tasks/BUG-1001/comments")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    async def test_add_comment_missing_body(self, client, mock_session):
        resp = await client.post(
            "/api/v1/tasks/BUG-1001/comments",
            json={"author_id": "some-uuid"},
        )
        assert resp.status_code == 422

    async def test_add_comment_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            "/api/v1/tasks/BUG-999/comments",
            json={"body": "comment", "author_id": "some-uuid"},
        )
        assert resp.status_code == 404

    async def test_add_comment_requires_auth(self, client_no_auth, mock_session):
        resp = await client_no_auth.post(
            "/api/v1/tasks/BUG-1001/comments",
            json={"body": "comment", "author_id": "some-uuid"},
        )
        assert resp.status_code == 401


_TICKET_UUID = "bbbbbbbb-0000-4000-8000-000000000001"
_TASK_ID_STR = str(_TASK_UUID)


# ---------------------------------------------------------------------------
# POST /{identifier}/tickets — link ticket to task
# ---------------------------------------------------------------------------

class TestLinkTicket:
    async def test_link_success(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(),
        ]
        resp = await client.post(
            f"/api/v1/tasks/{_TASK_ID_STR}/tickets",
            json={"ticket_id": _TICKET_UUID},
        )
        assert resp.status_code == 201
        d = resp.json()["data"]
        assert d["linked"] is True

    async def test_link_task_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            "/api/v1/tasks/BUG-999/tickets",
            json={"ticket_id": _TICKET_UUID},
        )
        assert resp.status_code == 404

    async def test_link_ticket_not_found(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar=None),
        ]
        resp = await client.post(
            f"/api/v1/tasks/{_TASK_ID_STR}/tickets",
            json={"ticket_id": "nonexistent"},
        )
        assert resp.status_code == 404

    async def test_link_requires_auth(self, client_no_auth, mock_session):
        resp = await client_no_auth.post(
            f"/api/v1/tasks/{_TASK_ID_STR}/tickets",
            json={"ticket_id": _TICKET_UUID},
        )
        assert resp.status_code == 401

    async def test_link_missing_ticket_id_422(self, client):
        resp = await client.post(
            f"/api/v1/tasks/{_TASK_ID_STR}/tickets",
            json={},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# DELETE /{identifier}/tickets/{ticket_id} — unlink
# ---------------------------------------------------------------------------

class TestUnlinkTicket:
    async def test_unlink_success(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(),
        ]
        resp = await client.delete(
            f"/api/v1/tasks/{_TASK_ID_STR}/tickets/{_TICKET_UUID}",
        )
        assert resp.status_code == 204

    async def test_unlink_task_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.delete(
            "/api/v1/tasks/BUG-999/tickets/some-ticket",
        )
        assert resp.status_code == 404

    async def test_unlink_requires_auth(self, client_no_auth, mock_session):
        resp = await client_no_auth.delete(
            f"/api/v1/tasks/{_TASK_ID_STR}/tickets/{_TICKET_UUID}",
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /bulk — bulk task operations
# ---------------------------------------------------------------------------

class TestTaskBulk:
    async def test_bulk_assign(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tasks/bulk",
            json={"ids": [_TASK_ID_STR], "action": "assign", "assigned_to": "some-user-uuid"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["updated"] == 1

    async def test_bulk_change_status(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tasks/bulk",
            json={"ids": [_TASK_ID_STR], "action": "change_status", "status": "in_progress"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["action"] == "change_status"

    async def test_bulk_add_tag(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tasks/bulk",
            json={"ids": [_TASK_ID_STR], "action": "add_tag", "tag": "regression"},
        )
        assert resp.status_code == 200

    async def test_bulk_link_to_jira(self, client, mock_session):
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TASK_UUID),
            FakeResult(),
        ]
        resp = await client.post(
            "/api/v1/tasks/bulk",
            json={"ids": [_TASK_ID_STR], "action": "link_to_jira", "jira_issue_key": "CORE-123"},
        )
        assert resp.status_code == 200

    async def test_bulk_empty_ids_400(self, client):
        resp = await client.post(
            "/api/v1/tasks/bulk",
            json={"ids": [], "action": "assign", "assigned_to": "uid"},
        )
        assert resp.status_code in (400, 422)

    async def test_bulk_unknown_action_422(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=_TASK_UUID)
        resp = await client.post(
            "/api/v1/tasks/bulk",
            json={"ids": [_TASK_ID_STR], "action": "delete_all"},
        )
        assert resp.status_code == 422

    async def test_bulk_requires_auth(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/v1/tasks/bulk",
            json={"ids": [_TASK_ID_STR], "action": "assign", "assigned_to": "uid"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /tickets/{identifier}/attachments
# ---------------------------------------------------------------------------

class TestAttachments:
    async def test_upload_success(self, client, mock_session):
        import datetime as dt
        mock_session.execute.side_effect = [
            FakeResult(scalar=_TICKET_UUID),
            FakeResult(fetchall_rows=[("att-uuid-1", dt.datetime.utcnow())]),
        ]
        resp = await client.post(
            f"/api/v1/tickets/{_TICKET_UUID}/attachments",
            files={"file": ("test.log", b"log content here", "text/plain")},
            data={"is_log": "true"},
        )
        assert resp.status_code == 201
        d = resp.json()["data"]
        assert d["file_name"] == "test.log"
        assert d["is_log"] is True

    async def test_upload_ticket_not_found(self, client, mock_session):
        mock_session.execute.return_value = FakeResult(scalar=None)
        resp = await client.post(
            "/api/v1/tickets/TKT-999/attachments",
            files={"file": ("test.txt", b"data", "text/plain")},
        )
        assert resp.status_code == 404

    async def test_upload_requires_auth(self, client_no_auth, mock_session):
        resp = await client_no_auth.post(
            f"/api/v1/tickets/{_TICKET_UUID}/attachments",
            files={"file": ("test.txt", b"data", "text/plain")},
        )
        assert resp.status_code == 401
