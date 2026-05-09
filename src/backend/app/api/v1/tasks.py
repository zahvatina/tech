from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.mapping import priority_db_to_ui, task_status_db_to_ui
from app.services.resolve import resolve_problem_uuid

router = APIRouter(prefix="/tasks", tags=["tasks"])


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
        clauses.append("t.status = ANY(:sts)")
        params["sts"] = status
    if has_workaround is False:
        clauses.append("COALESCE(t.has_workaround, FALSE) = FALSE")
    elif has_workaround is True:
        clauses.append("t.has_workaround = TRUE")
    if search:
        clauses.append("(t.title ILIKE :sq OR t.short_id ILIKE :sq OR t.description ILIKE :sq)")
        params["sq"] = f"%{search}%"

    where = " AND ".join(clauses)
    cnt = (await session.execute(text(f"SELECT COUNT(*) FROM tasks t WHERE {where}"), params)).scalar_one()
    q = text(
        f"""SELECT t.*, tm.name AS team_name, p.short_id AS problem_short_id
            FROM tasks t
            LEFT JOIN teams tm ON tm.id = t.team_id
            JOIN problems p ON p.id = t.problem_id
            WHERE {where}
            ORDER BY t.updated_at DESC
            LIMIT :limit OFFSET :off"""
    )
    rows = (await session.execute(q, params)).mappings().all()
    items = []
    for r in rows:
        d = dict(r)
        items.append(
            {
                "uuid": str(d["id"]),
                "id": d["short_id"],
                "problemId": d["problem_short_id"],
                "title": d["title"],
                "task_type": d["task_type"],
                "status": d["status"],
                "ui_status": task_status_db_to_ui(d["status"]),
                "severity": d.get("severity"),
                "priority": priority_db_to_ui(d.get("priority")),
                "team": d.get("team_name"),
                "jira": d.get("jira_issue_key"),
                "workaround": d.get("workaround"),
                "rootCause": d.get("root_cause"),
                "recommendation": d.get("support_notes"),
                "fixDate": d["fix_date"].date().isoformat() if d.get("fix_date") else None,
                "environments": list(d.get("environments") or []),
                "tickets": d.get("tickets_count") or 0,
                "created": d["created_at"].date().isoformat() if d.get("created_at") else "",
            }
        )
    tp = limit or 1
    return {"data": items, "meta": {"page": page, "limit": limit, "total": cnt, "total_pages": (cnt + tp - 1) // tp}}
