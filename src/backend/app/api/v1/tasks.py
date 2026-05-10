from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_api_key
from app.mapping import priority_db_to_ui, task_status_db_to_ui
from app.schemas.problems import CommentCreate
from app.schemas.tasks import TaskBulk, TaskConfirm, TaskCreate, TaskLinkTicket, TaskReject, TaskSubmitForReview, TaskUpdate
from app.services.resolve import resolve_problem_uuid, resolve_task_uuid, resolve_ticket_uuid

router = APIRouter(prefix="/tasks", tags=["tasks"])

ALLOW_TASK_STATUS = {
    "draft", "pending_confirmation", "rejected_draft",
    "open", "in_progress", "in_review",
    "fixed", "wont_fix", "duplicate", "closed",
}

TASK_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"pending_confirmation"},
    "pending_confirmation": {"open", "rejected_draft"},
    "rejected_draft": {"pending_confirmation"},
    "open": {"in_progress", "wont_fix", "duplicate"},
    "in_progress": {"in_review", "wont_fix", "duplicate"},
    "in_review": {"fixed", "open", "wont_fix", "duplicate"},
    "fixed": {"closed"},
    "wont_fix": {"closed"},
    "duplicate": {"closed"},
    "closed": {"open"},
}


def _task_row_to_dict(d: dict) -> dict:
    return {
        "uuid": str(d["id"]),
        "id": d["short_id"],
        "problemId": d.get("problem_short_id") or str(d.get("problem_id", "")),
        "title": d["title"],
        "task_type": d["task_type"],
        "status": d["status"],
        "ui_status": task_status_db_to_ui(d["status"]),
        "severity": d.get("severity"),
        "priority": priority_db_to_ui(d.get("priority")),
        "team": d.get("team_name"),
        "jira": d.get("jira_issue_key"),
        "jira_url": d.get("jira_url"),
        "workaround": d.get("workaround"),
        "has_workaround": d.get("has_workaround") or False,
        "rootCause": d.get("root_cause"),
        "recommendation": d.get("support_notes"),
        "fixDate": d["fix_date"].date().isoformat() if d.get("fix_date") else None,
        "fix_version": d.get("fix_version"),
        "fix_description": d.get("fix_description"),
        "environments": list(d.get("environments") or []),
        "tickets": d.get("tickets_count") or 0,
        "tags": list(d.get("tags") or []),
        "created": d["created_at"].date().isoformat() if d.get("created_at") else "",
        "updated_at": d["updated_at"].isoformat(timespec="minutes") if d.get("updated_at") else "",
        "description": d.get("description"),
        "proposed_by": str(d["proposed_by"]) if d.get("proposed_by") else None,
        "reviewed_by": str(d["reviewed_by"]) if d.get("reviewed_by") else None,
        "review_comment": d.get("review_comment"),
    }


# ---------------------------------------------------------------------------
# GET / — list tasks
# ---------------------------------------------------------------------------

@router.get("")
async def list_tasks(
    session: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    task_type: str | None = None,
    problem_id: str | None = Query(None, description="UUID или short_id проблемы"),
    status: list[str] | None = Query(None),
    has_workaround: bool | None = None,
    search: str | None = None,
):
    off = (page - 1) * limit
    clauses = ["TRUE"]
    params: dict = {"limit": limit, "off": off}

    if task_type:
        clauses.append("t.task_type = :tt")
        params["tt"] = task_type
    if problem_id:
        pu = await resolve_problem_uuid(session, problem_id)
        if not pu:
            return {"data": [], "meta": {"page": page, "limit": limit, "total": 0, "total_pages": 0}}
        clauses.append("t.problem_id = CAST(:pid AS uuid)")
        params["pid"] = str(pu)
    if status:
        valid_st = [s for s in status if s in ALLOW_TASK_STATUS]
        if valid_st:
            clauses.append("t.status = ANY(:sts)")
            params["sts"] = valid_st
    if has_workaround is False:
        clauses.append("COALESCE(t.has_workaround, FALSE) = FALSE")
    elif has_workaround is True:
        clauses.append("t.has_workaround = TRUE")
    if search:
        clauses.append(
            "(t.title ILIKE :sq OR t.short_id ILIKE :sq"
            " OR t.fts_vector @@ plainto_tsquery('russian', :sq_raw))"
        )
        params["sq"] = f"%{search}%"
        params["sq_raw"] = search

    where = " AND ".join(clauses)
    cnt = (
        await session.execute(text(f"SELECT COUNT(*) FROM tasks t WHERE {where}"), params)
    ).scalar_one()
    rows = (
        await session.execute(
            text(
                f"SELECT t.*, tm.name AS team_name, p.short_id AS problem_short_id"
                f" FROM tasks t"
                f" LEFT JOIN teams tm ON tm.id = t.team_id"
                f" JOIN problems p ON p.id = t.problem_id"
                f" WHERE {where}"
                f" ORDER BY t.updated_at DESC"
                f" LIMIT :limit OFFSET :off"
            ),
            params,
        )
    ).mappings().all()

    items = [_task_row_to_dict(dict(r)) for r in rows]
    tp = (cnt + limit - 1) // limit if limit else 1
    return {"data": items, "meta": {"page": page, "limit": limit, "total": cnt, "total_pages": tp}}


# ---------------------------------------------------------------------------
# POST / — create task
# ---------------------------------------------------------------------------

@router.post("", status_code=201, dependencies=[Depends(require_api_key)])
async def create_task(body: TaskCreate, session: AsyncSession = Depends(get_db)):
    pu = await resolve_problem_uuid(session, body.problem_id)
    if not pu:
        raise HTTPException(404, "PROBLEM_NOT_FOUND")

    r = await session.execute(
        text(
            "INSERT INTO tasks"
            " (problem_id, title, task_type, description, priority, severity,"
            "  team_id, assignee_id, workaround, has_workaround, support_notes,"
            "  tags, status, created_at, updated_at)"
            " VALUES"
            " (CAST(:problem_id AS uuid), :title, :task_type, :description,"
            "  :priority, :severity,"
            "  CAST(:team_id AS uuid), CAST(:assignee_id AS uuid),"
            "  :workaround, :has_workaround, :support_notes,"
            "  CAST(:tags AS varchar[]), 'draft', NOW(), NOW())"
            " RETURNING id::text, short_id"
        ),
        {
            "problem_id": str(pu),
            "title": body.title,
            "task_type": body.task_type,
            "description": body.description,
            "priority": body.priority,
            "severity": body.severity or "moderate",
            "team_id": body.team_id,
            "assignee_id": body.assignee_id,
            "workaround": body.workaround,
            "has_workaround": body.has_workaround,
            "support_notes": body.support_notes,
            "tags": list(body.tags or []),
        },
    )
    row = r.fetchone()
    await session.commit()
    return {"data": {"uuid": row[0], "short_id": row[1], "status": "draft"}}


# ---------------------------------------------------------------------------
# GET /{identifier}
# ---------------------------------------------------------------------------

@router.get("/{identifier}")
async def get_task(identifier: str, session: AsyncSession = Depends(get_db)):
    tu = await resolve_task_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "NOT_FOUND")

    row = (
        await session.execute(
            text(
                "SELECT t.*,"
                " tm.name AS team_name,"
                " p.short_id AS problem_short_id,"
                " pu.email AS proposed_user_email,"
                " ru.email AS reviewed_user_email"
                " FROM tasks t"
                " LEFT JOIN teams tm ON tm.id = t.team_id"
                " JOIN problems p ON p.id = t.problem_id"
                " LEFT JOIN users pu ON pu.id = t.proposed_by"
                " LEFT JOIN users ru ON ru.id = t.reviewed_by"
                " WHERE t.id = CAST(:id AS uuid)"
            ),
            {"id": str(tu)},
        )
    ).mappings().first()

    if not row:
        raise HTTPException(404, "NOT_FOUND")

    return {"data": _task_row_to_dict(dict(row))}


# ---------------------------------------------------------------------------
# PATCH /{identifier}
# ---------------------------------------------------------------------------

@router.patch("/{identifier}", dependencies=[Depends(require_api_key)])
async def update_task(
    identifier: str, body: TaskUpdate, session: AsyncSession = Depends(get_db)
):
    tu = await resolve_task_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "NOT_FOUND")

    cur_status = (
        await session.execute(
            text("SELECT status FROM tasks WHERE id = CAST(:id AS uuid)"),
            {"id": str(tu)},
        )
    ).scalar_one_or_none()

    if body.status is not None and body.status != cur_status:
        valid = TASK_STATUS_TRANSITIONS.get(cur_status or "", set())
        if body.status not in valid:
            raise HTTPException(
                422, f"Invalid status transition: {cur_status} -> {body.status}"
            )

    set_parts: list[str] = []
    params: dict = {"id": str(tu)}

    if body.title is not None:
        set_parts.append("title = :title")
        params["title"] = body.title
    if body.description is not None:
        set_parts.append("description = :description")
        params["description"] = body.description
    if body.priority is not None:
        set_parts.append("priority = :priority")
        params["priority"] = body.priority
    if body.severity is not None:
        set_parts.append("severity = :severity")
        params["severity"] = body.severity
    if body.status is not None:
        set_parts.append("status = :status")
        params["status"] = body.status
    if body.team_id is not None:
        set_parts.append("team_id = CAST(:team_id AS uuid)")
        params["team_id"] = body.team_id
    if body.assignee_id is not None:
        set_parts.append("assignee_id = CAST(:assignee_id AS uuid)")
        params["assignee_id"] = body.assignee_id
    if body.workaround is not None:
        set_parts.append("workaround = :workaround")
        params["workaround"] = body.workaround
    if body.has_workaround is not None:
        set_parts.append("has_workaround = :has_workaround")
        params["has_workaround"] = body.has_workaround
    if body.support_notes is not None:
        set_parts.append("support_notes = :support_notes")
        params["support_notes"] = body.support_notes
    if body.root_cause is not None:
        set_parts.append("root_cause = :root_cause")
        params["root_cause"] = body.root_cause
    if body.jira_issue_key is not None:
        set_parts.append("jira_issue_key = :jira_issue_key")
        params["jira_issue_key"] = body.jira_issue_key
    if body.fix_date is not None:
        set_parts.append("fix_date = CAST(:fix_date AS timestamptz)")
        params["fix_date"] = body.fix_date
    if body.fix_version is not None:
        set_parts.append("fix_version = :fix_version")
        params["fix_version"] = body.fix_version
    if body.fix_description is not None:
        set_parts.append("fix_description = :fix_description")
        params["fix_description"] = body.fix_description
    if body.tags is not None:
        set_parts.append("tags = CAST(:tags AS varchar[])")
        params["tags"] = list(body.tags)

    if not set_parts:
        raise HTTPException(400, "No fields to update")

    params["now"] = datetime.utcnow()
    set_parts.append("updated_at = :now")
    await session.execute(
        text(f"UPDATE tasks SET {', '.join(set_parts)} WHERE id = CAST(:id AS uuid)"),
        params,
    )
    await session.commit()
    return {"data": {"uuid": str(tu), "updated": True}}


# ---------------------------------------------------------------------------
# POST /{identifier}/submit-for-review  (draft → pending_confirmation)
# ---------------------------------------------------------------------------

@router.post("/{identifier}/submit-for-review", dependencies=[Depends(require_api_key)])
async def submit_task_for_review(
    identifier: str, body: TaskSubmitForReview, session: AsyncSession = Depends(get_db)
):
    tu = await resolve_task_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "NOT_FOUND")

    cur = (
        await session.execute(
            text("SELECT status FROM tasks WHERE id = CAST(:id AS uuid)"),
            {"id": str(tu)},
        )
    ).scalar_one_or_none()

    if cur != "draft" and cur != "rejected_draft":
        raise HTTPException(422, f"Task must be in draft/rejected_draft to submit; current: {cur}")

    await session.execute(
        text(
            "UPDATE tasks SET status = 'pending_confirmation',"
            " proposed_by = CAST(:proposed_by AS uuid),"
            " proposed_at = NOW(), updated_at = NOW()"
            " WHERE id = CAST(:id AS uuid)"
        ),
        {"proposed_by": body.proposed_by, "id": str(tu)},
    )
    await session.commit()
    return {"data": {"uuid": str(tu), "status": "pending_confirmation"}}


# ---------------------------------------------------------------------------
# POST /{identifier}/confirm  (pending_confirmation → open)
# ---------------------------------------------------------------------------

@router.post("/{identifier}/confirm", dependencies=[Depends(require_api_key)])
async def confirm_task(
    identifier: str, body: TaskConfirm, session: AsyncSession = Depends(get_db)
):
    tu = await resolve_task_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "NOT_FOUND")

    cur = (
        await session.execute(
            text("SELECT status FROM tasks WHERE id = CAST(:id AS uuid)"),
            {"id": str(tu)},
        )
    ).scalar_one_or_none()

    if cur != "pending_confirmation":
        raise HTTPException(422, f"Task must be pending_confirmation to confirm; current: {cur}")

    await session.execute(
        text(
            "UPDATE tasks SET status = 'open',"
            " reviewed_by = CAST(:reviewed_by AS uuid),"
            " reviewed_at = NOW(),"
            " review_comment = :review_comment,"
            " updated_at = NOW()"
            " WHERE id = CAST(:id AS uuid)"
        ),
        {
            "reviewed_by": body.reviewed_by,
            "review_comment": body.review_comment,
            "id": str(tu),
        },
    )
    await session.commit()
    return {"data": {"uuid": str(tu), "status": "open"}}


# ---------------------------------------------------------------------------
# POST /{identifier}/reject  (pending_confirmation → rejected_draft)
# ---------------------------------------------------------------------------

@router.post("/{identifier}/reject", dependencies=[Depends(require_api_key)])
async def reject_task(
    identifier: str, body: TaskReject, session: AsyncSession = Depends(get_db)
):
    tu = await resolve_task_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "NOT_FOUND")

    cur = (
        await session.execute(
            text("SELECT status FROM tasks WHERE id = CAST(:id AS uuid)"),
            {"id": str(tu)},
        )
    ).scalar_one_or_none()

    if cur != "pending_confirmation":
        raise HTTPException(422, f"Task must be pending_confirmation to reject; current: {cur}")

    await session.execute(
        text(
            "UPDATE tasks SET status = 'rejected_draft',"
            " reviewed_by = CAST(:reviewed_by AS uuid),"
            " reviewed_at = NOW(),"
            " review_comment = :review_comment,"
            " updated_at = NOW()"
            " WHERE id = CAST(:id AS uuid)"
        ),
        {
            "reviewed_by": body.reviewed_by,
            "review_comment": body.review_comment,
            "id": str(tu),
        },
    )
    await session.commit()
    return {"data": {"uuid": str(tu), "status": "rejected_draft"}}


# ---------------------------------------------------------------------------
# GET /{identifier}/activity
# ---------------------------------------------------------------------------

@router.get("/{identifier}/activity")
async def task_activity(
    identifier: str,
    session: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    tu = await resolve_task_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "NOT_FOUND")
    off = (page - 1) * limit
    cnt = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM activity_log"
                " WHERE entity_type = 'task' AND entity_id = CAST(:id AS uuid)"
            ),
            {"id": str(tu)},
        )
    ).scalar_one()
    rows = (
        await session.execute(
            text(
                "SELECT id::text, action::text, actor_name::text, new_value, created_at"
                " FROM activity_log"
                " WHERE entity_type = 'task' AND entity_id = CAST(:id AS uuid)"
                " ORDER BY created_at DESC LIMIT :lim OFFSET :off"
            ),
            {"id": str(tu), "lim": limit, "off": off},
        )
    ).mappings().all()
    return {
        "data": [dict(r) for r in rows],
        "meta": {"page": page, "limit": limit, "total": cnt, "total_pages": (cnt + limit - 1) // limit},
    }


# ---------------------------------------------------------------------------
# GET /{identifier}/comments
# ---------------------------------------------------------------------------

@router.get("/{identifier}/comments")
async def task_comments(
    identifier: str,
    session: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    tu = await resolve_task_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "NOT_FOUND")
    off = (page - 1) * limit
    cnt = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM comments"
                " WHERE entity_type = 'task' AND entity_id = CAST(:id AS uuid)"
            ),
            {"id": str(tu)},
        )
    ).scalar_one()
    rows = (
        await session.execute(
            text(
                "SELECT c.id::text, c.body, c.is_internal, c.is_edited,"
                "       c.parent_id::text, c.created_at,"
                "       COALESCE(NULLIF(trim(u.name), ''), split_part(u.email, '@', 1)) AS author_name,"
                "       u.email AS author_email, c.author_id::text"
                " FROM comments c LEFT JOIN users u ON u.id = c.author_id"
                " WHERE c.entity_type = 'task' AND c.entity_id = CAST(:id AS uuid)"
                " ORDER BY c.created_at ASC LIMIT :lim OFFSET :off"
            ),
            {"id": str(tu), "lim": limit, "off": off},
        )
    ).mappings().all()
    items = [
        {
            "id": d["id"],
            "body": d["body"],
            "is_internal": d["is_internal"],
            "is_edited": d["is_edited"],
            "parent_id": d.get("parent_id"),
            "author_id": d["author_id"],
            "author_name": d.get("author_name"),
            "author_email": d.get("author_email"),
            "created_at": d["created_at"].isoformat() if d["created_at"] else None,
        }
        for d in [dict(r) for r in rows]
    ]
    return {
        "data": items,
        "meta": {"page": page, "limit": limit, "total": cnt, "total_pages": (cnt + limit - 1) // limit},
    }


# ---------------------------------------------------------------------------
# POST /{identifier}/comments
# ---------------------------------------------------------------------------

@router.post("/{identifier}/comments", status_code=201, dependencies=[Depends(require_api_key)])
async def add_task_comment(
    identifier: str, body: CommentCreate, session: AsyncSession = Depends(get_db)
):
    tu = await resolve_task_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "NOT_FOUND")
    r = await session.execute(
        text(
            "INSERT INTO comments"
            " (entity_type, entity_id, author_id, parent_id, body, is_internal)"
            " VALUES"
            " ('task', CAST(:entity_id AS uuid), CAST(:author_id AS uuid),"
            "  CAST(:parent_id AS uuid), :body, :is_internal)"
            " RETURNING id::text, created_at"
        ),
        {
            "entity_id": str(tu),
            "author_id": body.author_id,
            "parent_id": body.parent_id,
            "body": body.body,
            "is_internal": body.is_internal,
        },
    )
    row = r.fetchone()
    await session.commit()
    return {
        "data": {
            "id": row[0],
            "entity_id": str(tu),
            "body": body.body,
            "is_internal": body.is_internal,
            "created_at": row[1].isoformat() if row[1] else None,
        }
    }


# ---------------------------------------------------------------------------
# POST /{identifier}/tickets — link ticket to task
# ---------------------------------------------------------------------------

@router.post("/{identifier}/tickets", status_code=201, dependencies=[Depends(require_api_key)])
async def link_ticket_to_task(
    identifier: str, body: TaskLinkTicket, session: AsyncSession = Depends(get_db)
):
    tu = await resolve_task_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "TASK_NOT_FOUND")
    ticket_uuid = await resolve_ticket_uuid(session, body.ticket_id)
    if not ticket_uuid:
        raise HTTPException(404, "TICKET_NOT_FOUND")

    await session.execute(
        text(
            "UPDATE support_tickets"
            " SET task_id = CAST(:tid AS uuid), status = 'linked', updated_at = NOW()"
            " WHERE id = CAST(:ticket_uuid AS uuid)"
        ),
        {"tid": str(tu), "ticket_uuid": str(ticket_uuid)},
    )
    await session.commit()
    return {"data": {"task_uuid": str(tu), "ticket_uuid": str(ticket_uuid), "linked": True}}


# ---------------------------------------------------------------------------
# DELETE /{identifier}/tickets/{ticket_id} — unlink ticket from task
# ---------------------------------------------------------------------------

@router.delete("/{identifier}/tickets/{ticket_id}", status_code=204, dependencies=[Depends(require_api_key)])
async def unlink_ticket_from_task(
    identifier: str, ticket_id: str, session: AsyncSession = Depends(get_db)
):
    tu = await resolve_task_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "TASK_NOT_FOUND")
    ticket_uuid = await resolve_ticket_uuid(session, ticket_id)
    if not ticket_uuid:
        raise HTTPException(404, "TICKET_NOT_FOUND")

    await session.execute(
        text(
            "UPDATE support_tickets"
            " SET task_id = NULL, updated_at = NOW()"
            " WHERE id = CAST(:ticket_uuid AS uuid) AND task_id = CAST(:tid AS uuid)"
        ),
        {"tid": str(tu), "ticket_uuid": str(ticket_uuid)},
    )
    await session.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# POST /bulk — bulk operations on tasks
# ---------------------------------------------------------------------------

@router.post("/bulk", dependencies=[Depends(require_api_key)])
async def bulk_tasks(body: TaskBulk, session: AsyncSession = Depends(get_db)):
    if not body.ids:
        raise HTTPException(400, "NO_IDS")

    uuids: list[str] = []
    for ident in body.ids:
        u = await resolve_task_uuid(session, ident)
        if u:
            uuids.append(str(u))
    if not uuids:
        raise HTTPException(404, "TASKS_NOT_FOUND")

    action = body.action
    if action == "assign":
        if not body.assigned_to:
            raise HTTPException(422, "assigned_to required for assign")
        await session.execute(
            text(
                "UPDATE tasks SET assignee_id = CAST(:uid AS uuid), updated_at = NOW()"
                " WHERE id = ANY(CAST(:ids AS uuid[]))"
            ),
            {"uid": body.assigned_to, "ids": uuids},
        )
    elif action == "change_status":
        if not body.status:
            raise HTTPException(422, "status required for change_status")
        if body.status not in ALLOW_TASK_STATUS:
            raise HTTPException(422, f"Invalid status: {body.status}")
        await session.execute(
            text(
                "UPDATE tasks SET status = :st, updated_at = NOW()"
                " WHERE id = ANY(CAST(:ids AS uuid[]))"
            ),
            {"st": body.status, "ids": uuids},
        )
    elif action == "add_tag":
        if not body.tag:
            raise HTTPException(422, "tag required for add_tag")
        await session.execute(
            text(
                "UPDATE tasks SET tags = array_append(COALESCE(tags, '{}'), :tag), updated_at = NOW()"
                " WHERE id = ANY(CAST(:ids AS uuid[]))"
            ),
            {"tag": body.tag, "ids": uuids},
        )
    elif action == "link_to_jira":
        if not body.jira_issue_key:
            raise HTTPException(422, "jira_issue_key required for link_to_jira")
        await session.execute(
            text(
                "UPDATE tasks SET jira_issue_key = :jira, updated_at = NOW()"
                " WHERE id = ANY(CAST(:ids AS uuid[]))"
            ),
            {"jira": body.jira_issue_key, "ids": uuids},
        )
    else:
        raise HTTPException(422, f"Unknown action: {action}")

    await session.commit()
    return {"data": {"updated": len(uuids), "action": action}}
