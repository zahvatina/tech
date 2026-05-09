from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_api_key
from app.mapping import (
    platform_db_to_ui,
    priority_db_to_ui,
    task_status_db_to_ui,
    ticket_status_db_to_ui,
)
from app.schemas.problems import BulkStatusChange, CommentCreate, ProblemCreate, ProblemUpdate
from app.services.problem_rows import problem_record_to_ui, sparkline_series
from app.services.resolve import resolve_problem_uuid

router = APIRouter(prefix="/problems", tags=["problems"])

ALLOW_PROB_STATUS = {"new", "in_progress", "waiting_fix", "resolved", "closed", "monitoring"}
ALLOW_PRIO = {"critical", "high", "medium", "low"}

STATUS_TRANSITIONS: dict[str, set[str]] = {
    "new": {"in_progress", "closed"},
    "in_progress": {"waiting_fix", "monitoring", "resolved", "closed"},
    "waiting_fix": {"in_progress", "monitoring", "resolved", "closed"},
    "monitoring": {"in_progress", "resolved", "closed"},
    "resolved": {"closed", "in_progress"},
    "closed": {"in_progress"},
}


# ---------------------------------------------------------------------------
# Per-item helpers (used only in detail / sub-resource endpoints)
# ---------------------------------------------------------------------------

async def _product_names_for_problem(session: AsyncSession, p: dict) -> list[str]:
    ids = list(p.get("affected_product_ids") or [])
    if not ids:
        return []
    r = await session.execute(
        text("SELECT name FROM products WHERE id = ANY(CAST(:ids AS uuid[])) ORDER BY name"),
        {"ids": ids},
    )
    return [row[0] for row in r.fetchall()]


async def _platforms_for_problem(session: AsyncSession, pid: UUID) -> list[str]:
    r = await session.execute(
        text(
            "SELECT DISTINCT platform FROM support_tickets"
            " WHERE problem_id = :pid AND platform IS NOT NULL"
        ),
        {"pid": str(pid)},
    )
    return sorted({platform_db_to_ui(row[0]) for row in r.fetchall()} or {"web"})


async def _ticket_daily_counts(session: AsyncSession, pid: UUID) -> list:
    r = await session.execute(
        text(
            "SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS d,"
            " COUNT(*)::int FROM support_tickets"
            " WHERE problem_id = CAST(:pid AS uuid)"
            "   AND created_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '35 days'"
            " GROUP BY 1 ORDER BY 1"
        ),
        {"pid": str(pid)},
    )
    return r.fetchall()


async def _unresearched_daily(session: AsyncSession, pid: UUID) -> list:
    r = await session.execute(
        text(
            "SELECT date_trunc('day', created_at)::date AS d, COUNT(*)::int"
            " FROM support_tickets"
            " WHERE problem_id = CAST(:pid AS uuid)"
            "   AND requires_research IS TRUE"
            "   AND created_at >= NOW() - INTERVAL '35 days'"
            " GROUP BY 1 ORDER BY 1"
        ),
        {"pid": str(pid)},
    )
    return r.fetchall()


async def _load_mv(session: AsyncSession, problem_id: str) -> dict | None:
    r = await session.execute(
        text(
            "SELECT tickets_delta_pct, unresearched_delta_pct"
            " FROM mv_problem_stats WHERE id = CAST(:id AS uuid)"
        ),
        {"id": problem_id},
    )
    row = r.mappings().first()
    return dict(row) if row else None


def _extras_from_mv(mv_row: dict | None) -> dict:
    if not mv_row:
        return {}
    return {
        "tickets_delta_pct": (float(mv_row["tickets_delta_pct"]) / 100.0)
        if mv_row.get("tickets_delta_pct") is not None
        else None,
        "unresearched_delta_pct": (float(mv_row["unresearched_delta_pct"]) / 100.0)
        if mv_row.get("unresearched_delta_pct") is not None
        else None,
    }


def _extras_from_row(row: dict) -> dict:
    """Extract mv delta fields already joined in the list query."""
    return {
        "tickets_delta_pct": (float(row["mv_tickets_delta_pct"]) / 100.0)
        if row.get("mv_tickets_delta_pct") is not None
        else None,
        "unresearched_delta_pct": (float(row["mv_unresearched_delta_pct"]) / 100.0)
        if row.get("mv_unresearched_delta_pct") is not None
        else None,
    }


async def _one_problem_core(session: AsyncSession, pid: UUID) -> dict | None:
    r = await session.execute(
        text(
            "SELECT p.*,"
            " u.id AS oid, u.email AS owner_email,"
            " COALESCE(NULLIF(trim(u.name), ''), split_part(u.email, '@', 1)) AS owner_display"
            " FROM problems p"
            " LEFT JOIN users u ON u.id = p.owner_id"
            " WHERE p.id = CAST(:pid AS uuid)"
        ),
        {"pid": str(pid)},
    )
    return r.mappings().first()


# ---------------------------------------------------------------------------
# GET / — list (N+1 fixed: 6 queries total regardless of page size)
# ---------------------------------------------------------------------------

@router.get("")
async def list_problems(
    session: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    sort_by: str = Query(
        "tickets_delta_pct",
        description="tickets_delta_pct|tickets|unresearched|priority|updated",
    ),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    status: list[str] | None = Query(None),
    priority: list[str] | None = Query(None),
    product_code: str | None = Query(None, description="osago,kasko,..."),
    owner_id: str | None = None,
    tags: list[str] | None = Query(None),
    search: str | None = None,
    has_unresearched: bool | None = None,
    tickets_no_bug: bool | None = Query(None),
    sla_breached: bool | None = None,
    view: Literal["all", "growing", "untriaged", "no-bug"] | None = Query(None),
):
    off = (page - 1) * limit
    sd = "DESC" if sort_dir == "desc" else "ASC"
    order_exprs = {
        "tickets_delta_pct": "COALESCE(mv.tickets_delta_pct, 0)",
        "tickets": "p.tickets_count",
        "unresearched": "p.unresearched_count",
        "priority": "CASE p.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END",
        "updated": "p.updated_at",
    }
    ob = order_exprs.get(sort_by, order_exprs["tickets_delta_pct"])

    clauses: list[str] = ["TRUE"]
    params: dict = {"limit": limit, "off": off}

    if status:
        st = [s for s in status if s in ALLOW_PROB_STATUS]
        if st:
            clauses.append("p.status = ANY(:st)")
            params["st"] = st
    if priority:
        pr = [x for x in priority if x in ALLOW_PRIO]
        if pr:
            clauses.append("p.priority = ANY(:pr)")
            params["pr"] = pr
    if product_code:
        clauses.append(
            "EXISTS (SELECT 1 FROM unnest(p.affected_product_ids) x"
            " JOIN products pr ON pr.id = x WHERE lower(pr.code) = lower(:pcode))"
        )
        params["pcode"] = product_code
    if owner_id:
        clauses.append("p.owner_id = CAST(:oid AS uuid)")
        params["oid"] = owner_id
    if tags:
        clauses.append("p.tags && CAST(:tg AS varchar[])")
        params["tg"] = tags
    if search:
        clauses.append(
            "(p.title ILIKE :sq OR p.short_id ILIKE :sq"
            " OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE :sq))"
        )
        params["sq"] = f"%{search}%"
    if has_unresearched:
        clauses.append("p.unresearched_count > 0")
    if tickets_no_bug is True:
        clauses.append("p.tickets_no_task_count > 0")
    if sla_breached is True:
        clauses.append("p.sla_breached = TRUE")
    if view == "growing":
        clauses.append(
            "((p.tickets_count_prev_week > 0"
            " AND ((p.tickets_count - p.tickets_count_prev_week)::float"
            " / p.tickets_count_prev_week) > 0.1)"
            " OR COALESCE(mv.tickets_delta_pct, 0) > 10)"
        )
    elif view == "untriaged":
        clauses.append("p.unresearched_count >= 10")
    elif view == "no-bug":
        clauses.append("p.tickets_no_task_count > 0")

    where_sql = " AND ".join(clauses)
    total = (
        await session.execute(
            text(
                f"SELECT COUNT(*) FROM problems p"
                f" LEFT JOIN mv_problem_stats mv ON mv.id = p.id WHERE {where_sql}"
            ),
            params,
        )
    ).scalar_one()

    list_q = text(
        f"SELECT p.*,"
        f" mv.tickets_delta_pct AS mv_tickets_delta_pct,"
        f" mv.unresearched_delta_pct AS mv_unresearched_delta_pct,"
        f" COALESCE(NULLIF(trim(u.name), ''), split_part(u.email, '@', 1)) AS owner_name"
        f" FROM problems p"
        f" LEFT JOIN mv_problem_stats mv ON mv.id = p.id"
        f" LEFT JOIN users u ON u.id = p.owner_id"
        f" WHERE {where_sql}"
        f" ORDER BY {ob} {sd}, p.short_id"
        f" LIMIT :limit OFFSET :off"
    )
    rows = (await session.execute(list_q, params)).mappings().all()

    total_pages = (total + limit - 1) // limit if limit else 1
    meta = {"page": page, "limit": limit, "total": total, "total_pages": total_pages}

    if not rows:
        return {"data": [], "meta": meta}

    pids = [str(r["id"]) for r in rows]

    # Batch: product names per problem
    prod_rows = (
        await session.execute(
            text(
                "SELECT p.id::text AS pid, pr.name"
                " FROM problems p"
                " JOIN unnest(p.affected_product_ids) prod_id ON TRUE"
                " JOIN products pr ON pr.id = prod_id"
                " WHERE p.id = ANY(CAST(:ids AS uuid[]))"
                " ORDER BY p.id, pr.name"
            ),
            {"ids": pids},
        )
    ).fetchall()
    prod_by_pid: dict[str, list[str]] = {}
    for pid, name in prod_rows:
        prod_by_pid.setdefault(pid, []).append(name)

    # Batch: platforms per problem
    plat_rows = (
        await session.execute(
            text(
                "SELECT problem_id::text, platform"
                " FROM support_tickets"
                " WHERE problem_id = ANY(CAST(:ids AS uuid[]))"
                "   AND platform IS NOT NULL"
                " GROUP BY problem_id, platform"
            ),
            {"ids": pids},
        )
    ).fetchall()
    plat_by_pid: dict[str, set[str]] = {}
    for pid, plat in plat_rows:
        plat_by_pid.setdefault(pid, set()).add(platform_db_to_ui(plat))

    # Batch: daily ticket counts
    daily_rows = (
        await session.execute(
            text(
                "SELECT problem_id::text,"
                "       date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS d,"
                "       COUNT(*)::int AS c"
                " FROM support_tickets"
                " WHERE problem_id = ANY(CAST(:ids AS uuid[]))"
                "   AND created_at >= NOW() - INTERVAL '35 days'"
                " GROUP BY 1, 2"
            ),
            {"ids": pids},
        )
    ).fetchall()
    daily_by_pid: dict[str, list] = {}
    for pid, d, c in daily_rows:
        daily_by_pid.setdefault(pid, []).append((d, c))

    # Batch: daily unresearched counts
    udaily_rows = (
        await session.execute(
            text(
                "SELECT problem_id::text,"
                "       date_trunc('day', created_at)::date AS d,"
                "       COUNT(*)::int AS c"
                " FROM support_tickets"
                " WHERE problem_id = ANY(CAST(:ids AS uuid[]))"
                "   AND requires_research IS TRUE"
                "   AND created_at >= NOW() - INTERVAL '35 days'"
                " GROUP BY 1, 2"
            ),
            {"ids": pids},
        )
    ).fetchall()
    udaily_by_pid: dict[str, list] = {}
    for pid, d, c in udaily_rows:
        udaily_by_pid.setdefault(pid, []).append((d, c))

    items = []
    for row in rows:
        rdict = dict(row)
        pid = str(rdict["id"])
        ex = _extras_from_row(rdict)
        ex.update(
            {
                "owner_id": rdict.get("owner_id"),
                "owner_name": rdict.get("owner_name"),
                "platforms": sorted(plat_by_pid.get(pid, {"web"})),
                "trend_spark": sparkline_series(daily_by_pid.get(pid, [])),
                "untriaged_spark": sparkline_series(udaily_by_pid.get(pid, [])),
            }
        )
        items.append(problem_record_to_ui(rdict, prod_by_pid.get(pid, []), ex))

    return {"data": items, "meta": meta}


# ---------------------------------------------------------------------------
# POST / — create
# ---------------------------------------------------------------------------

@router.post("", status_code=201, dependencies=[Depends(require_api_key)])
async def create_problem(body: ProblemCreate, session: AsyncSession = Depends(get_db)):
    r = await session.execute(
        text(
            "INSERT INTO problems"
            " (id, title, description, priority, severity, status,"
            "  owner_id, affected_product_ids, tags, created_at, updated_at)"
            " VALUES"
            " (gen_random_uuid(), :title, :description, :priority, :severity, 'new',"
            "  CAST(:owner_id AS uuid), CAST(:prod_ids AS uuid[]), CAST(:tags AS varchar[]),"
            "  NOW(), NOW())"
            " RETURNING id::text, short_id"
        ),
        {
            "title": body.title,
            "description": body.description,
            "priority": body.priority,
            "severity": body.severity or "moderate",
            "owner_id": body.owner_id,
            "prod_ids": [str(x) for x in (body.affected_product_ids or [])],
            "tags": list(body.tags or []),
        },
    )
    row = r.fetchone()
    await session.commit()
    return {"data": {"uuid": row[0], "short_id": row[1], "status": "new"}}


# ---------------------------------------------------------------------------
# POST /bulk — bulk status change (must come before /{identifier})
# ---------------------------------------------------------------------------

@router.post("/bulk", dependencies=[Depends(require_api_key)])
async def bulk_update_problems(body: BulkStatusChange, session: AsyncSession = Depends(get_db)):
    updated: list[str] = []
    failed: list[dict] = []
    now = datetime.utcnow()

    for identifier in body.ids:
        pu = await resolve_problem_uuid(session, identifier)
        if not pu:
            failed.append({"id": identifier, "error": "NOT_FOUND"})
            continue
        cur = (
            await session.execute(
                text("SELECT status FROM problems WHERE id = CAST(:id AS uuid)"),
                {"id": str(pu)},
            )
        ).scalar_one_or_none()
        if body.status != cur:
            valid = STATUS_TRANSITIONS.get(cur or "", set())
            if body.status not in valid:
                failed.append(
                    {"id": identifier, "error": f"INVALID_TRANSITION:{cur}->{body.status}"}
                )
                continue
        await session.execute(
            text(
                "UPDATE problems SET status = :st, updated_at = :now"
                " WHERE id = CAST(:id AS uuid)"
            ),
            {"st": body.status, "now": now, "id": str(pu)},
        )
        updated.append(identifier)

    await session.commit()
    return {"data": {"updated": updated, "failed": failed}}


# ---------------------------------------------------------------------------
# GET /{identifier}
# ---------------------------------------------------------------------------

@router.get("/{identifier}")
async def get_problem(identifier: str, session: AsyncSession = Depends(get_db)):
    pu = await resolve_problem_uuid(session, identifier)
    if not pu:
        raise HTTPException(404, "NOT_FOUND")

    core = dict((await _one_problem_core(session, pu)) or {})
    if not core:
        raise HTTPException(404, "NOT_FOUND")

    pname = await _product_names_for_problem(session, core)
    plat = await _platforms_for_problem(session, pu)
    mv = await _load_mv(session, str(pu))
    ex = _extras_from_mv(mv)
    daily = await _ticket_daily_counts(session, pu)
    udaily = await _unresearched_daily(session, pu)
    ex.update(
        {
            "owner_id": core.get("oid"),
            "owner_name": core.get("owner_display"),
            "platforms": list(plat),
            "trend_spark": sparkline_series([(t[0], t[1]) for t in daily])[-7:],
            "untriaged_spark": sparkline_series([(t[0], t[1]) for t in udaily]),
        }
    )
    overview = problem_record_to_ui(core, pname, ex)

    tq = await session.execute(
        text(
            "SELECT id::text, short_id, task_type, status, title,"
            "       jira_issue_key, has_workaround, tickets_count,"
            "       substring(coalesce(ai_summary,''), 1, 200) AS ai_summary_preview"
            " FROM tasks WHERE problem_id = CAST(:pid AS uuid)"
            " ORDER BY updated_at DESC"
        ),
        {"pid": str(pu)},
    )
    task_rows = []
    for t in tq.mappings().all():
        tr = dict(t)
        task_rows.append(
            {
                "uuid": tr["id"],
                "id": tr["short_id"],
                "task_type": tr["task_type"],
                "status": tr["status"],
                "ui_status": task_status_db_to_ui(tr["status"]),
                "title": tr["title"],
                "jira": tr["jira_issue_key"],
                "has_workaround": tr["has_workaround"],
                "tickets_count": tr["tickets_count"],
            }
        )

    rq = await session.execute(
        text(
            "SELECT short_id::text, summary::text, status::text, created_at"
            " FROM support_tickets WHERE problem_id = CAST(:pid AS uuid)"
            " ORDER BY created_at DESC LIMIT 12"
        ),
        {"pid": str(pu)},
    )
    recent_tickets = []
    for row in rq.mappings():
        rd = dict(row)
        recent_tickets.append(
            {
                "id": rd["short_id"],
                "summary": rd["summary"],
                "status": ticket_status_db_to_ui(rd["status"]),
                "created_at": rd["created_at"].isoformat(timespec="minutes")
                if rd["created_at"]
                else "",
            }
        )

    breakdown: dict = {}
    pq = await session.execute(
        text(
            "SELECT pr.code::text AS code, COUNT(*)::int AS c"
            " FROM support_tickets st JOIN products pr ON pr.id = st.product_id"
            " WHERE st.problem_id = CAST(:pid AS uuid) GROUP BY pr.code"
        ),
        {"pid": str(pu)},
    )
    for code, c in pq.fetchall():
        breakdown.setdefault("products_breakdown", {})[code or "unknown"] = c

    plq = await session.execute(
        text(
            "SELECT COALESCE(platform, 'unknown') AS pl, COUNT(*)::int"
            " FROM support_tickets WHERE problem_id = CAST(:pid AS uuid) GROUP BY platform"
        ),
        {"pid": str(pu)},
    )
    for pl, c in plq.fetchall():
        breakdown.setdefault("platforms_breakdown", {})[platform_db_to_ui(pl)] = c

    return {
        "data": {
            "overview": overview,
            "tasks": task_rows,
            "recent_tickets": recent_tickets,
            "sparkline_7d": overview["trend"][-7:] if len(overview["trend"]) >= 7 else overview["trend"],
            "stats": {"tickets_today": 0, **breakdown},
        }
    }


# ---------------------------------------------------------------------------
# PATCH /{identifier}
# ---------------------------------------------------------------------------

@router.patch("/{identifier}", dependencies=[Depends(require_api_key)])
async def update_problem(
    identifier: str, body: ProblemUpdate, session: AsyncSession = Depends(get_db)
):
    pu = await resolve_problem_uuid(session, identifier)
    if not pu:
        raise HTTPException(404, "NOT_FOUND")

    cur_status = (
        await session.execute(
            text("SELECT status FROM problems WHERE id = CAST(:id AS uuid)"),
            {"id": str(pu)},
        )
    ).scalar_one_or_none()

    if body.status is not None and body.status != cur_status:
        valid = STATUS_TRANSITIONS.get(cur_status or "", set())
        if body.status not in valid:
            raise HTTPException(
                422, f"Invalid status transition: {cur_status} -> {body.status}"
            )

    set_parts: list[str] = []
    params: dict = {"id": str(pu)}

    if body.title is not None:
        set_parts.append("title = :title")
        params["title"] = body.title
    if body.description is not None:
        set_parts.append("description = :description")
        params["description"] = body.description
    if body.priority is not None:
        set_parts.append("priority = :priority")
        params["priority"] = body.priority
    if body.status is not None:
        set_parts.append("status = :status")
        params["status"] = body.status
    if body.severity is not None:
        set_parts.append("severity = :severity")
        params["severity"] = body.severity
    if body.owner_id is not None:
        set_parts.append("owner_id = CAST(:owner_id AS uuid)")
        params["owner_id"] = body.owner_id
    if body.affected_product_ids is not None:
        set_parts.append("affected_product_ids = CAST(:prod_ids AS uuid[])")
        params["prod_ids"] = [str(x) for x in body.affected_product_ids]
    if body.tags is not None:
        set_parts.append("tags = CAST(:tags AS varchar[])")
        params["tags"] = list(body.tags)
    if body.jira_issue_key is not None:
        set_parts.append("jira_issue_key = :jira_issue_key")
        params["jira_issue_key"] = body.jira_issue_key

    if not set_parts:
        raise HTTPException(400, "No fields to update")

    params["now"] = datetime.utcnow()
    set_parts.append("updated_at = :now")
    set_sql = ", ".join(set_parts)

    await session.execute(
        text(f"UPDATE problems SET {set_sql} WHERE id = CAST(:id AS uuid)"),
        params,
    )
    await session.commit()
    return {"data": {"uuid": str(pu), "updated": True}}


# ---------------------------------------------------------------------------
# DELETE /{identifier} — soft close
# ---------------------------------------------------------------------------

@router.delete("/{identifier}", status_code=204, dependencies=[Depends(require_api_key)])
async def close_problem(identifier: str, session: AsyncSession = Depends(get_db)):
    pu = await resolve_problem_uuid(session, identifier)
    if not pu:
        raise HTTPException(404, "NOT_FOUND")
    await session.execute(
        text(
            "UPDATE problems SET status = 'closed', updated_at = :now"
            " WHERE id = CAST(:id AS uuid)"
        ),
        {"id": str(pu), "now": datetime.utcnow()},
    )
    await session.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# GET /{identifier}/tickets
# ---------------------------------------------------------------------------

@router.get("/{identifier}/tickets")
async def problem_tickets(
    identifier: str,
    session: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    pu = await resolve_problem_uuid(session, identifier)
    if not pu:
        raise HTTPException(404, "NOT_FOUND")
    off = (page - 1) * limit
    cnt = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM support_tickets"
                " WHERE problem_id = CAST(:pid AS uuid)"
            ),
            {"pid": str(pu)},
        )
    ).scalar_one()
    rows = (
        await session.execute(
            text(
                "SELECT st.*, pr.name AS product_name, pr.code AS product_code"
                " FROM support_tickets st"
                " LEFT JOIN products pr ON pr.id = st.product_id"
                " WHERE st.problem_id = CAST(:pid AS uuid)"
                " ORDER BY st.created_at DESC LIMIT :lim OFFSET :off"
            ),
            {"pid": str(pu), "lim": limit, "off": off},
        )
    ).mappings().all()
    items = []
    for r in rows:
        d = dict(r)
        items.append(
            {
                "id": d["short_id"],
                "uuid": str(d["id"]),
                "summary": d.get("summary"),
                "status": d["status"],
                "ui_status": ticket_status_db_to_ui(d["status"]),
                "platform": platform_db_to_ui(d.get("platform")),
                "product": d.get("product_name"),
                "product_code": d.get("product_code"),
                "created_at": d["created_at"].isoformat(timespec="minutes")
                if d["created_at"]
                else None,
                "requires_research": d.get("requires_research"),
                "current_queue": d.get("current_queue"),
            }
        )
    return {
        "data": items,
        "meta": {
            "page": page,
            "limit": limit,
            "total": cnt,
            "total_pages": (cnt + limit - 1) // limit,
        },
    }


# ---------------------------------------------------------------------------
# GET /{identifier}/tasks
# ---------------------------------------------------------------------------

@router.get("/{identifier}/tasks")
async def problem_tasks(
    identifier: str,
    session: AsyncSession = Depends(get_db),
    task_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    pu = await resolve_problem_uuid(session, identifier)
    if not pu:
        raise HTTPException(404, "NOT_FOUND")
    off = (page - 1) * limit
    clauses = ["problem_id = CAST(:pid AS uuid)"]
    params: dict = {"pid": str(pu), "lim": limit, "off": off}
    if task_type:
        clauses.append("task_type = :tt")
        params["tt"] = task_type
    where = " AND ".join(clauses)
    cnt = (
        await session.execute(text(f"SELECT COUNT(*) FROM tasks WHERE {where}"), params)
    ).scalar_one()
    rows = (
        await session.execute(
            text(
                f"SELECT t.*, tm.name AS team_name"
                f" FROM tasks t LEFT JOIN teams tm ON tm.id = t.team_id"
                f" WHERE {where} ORDER BY t.updated_at DESC LIMIT :lim OFFSET :off"
            ),
            params,
        )
    ).mappings().all()
    items = []
    for r in rows:
        d = dict(r)
        items.append(
            {
                "uuid": str(d["id"]),
                "id": d["short_id"],
                "problem_id_ref": str(d["problem_id"]),
                "title": d["title"],
                "task_type": d["task_type"],
                "status": d["status"],
                "ui_status": task_status_db_to_ui(d["status"]),
                "severity": d.get("severity"),
                "priority": priority_db_to_ui(d.get("priority")),
                "team": d.get("team_name"),
                "jira": d.get("jira_issue_key"),
                "workaround": d.get("workaround"),
                "root_cause": d.get("root_cause"),
                "support_notes": d.get("support_notes"),
                "tickets": d.get("tickets_count"),
                "created": d["created_at"].date().isoformat() if d.get("created_at") else "",
            }
        )
    return {
        "data": items,
        "meta": {
            "page": page,
            "limit": limit,
            "total": cnt,
            "total_pages": (cnt + limit - 1) // limit,
        },
    }


# ---------------------------------------------------------------------------
# GET /{identifier}/activity
# ---------------------------------------------------------------------------

@router.get("/{identifier}/activity")
async def problem_activity(
    identifier: str,
    session: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    pu = await resolve_problem_uuid(session, identifier)
    if not pu:
        raise HTTPException(404, "NOT_FOUND")
    off = (page - 1) * limit
    cnt = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM activity_log"
                " WHERE entity_type = 'problem' AND entity_id = CAST(:pid AS uuid)"
            ),
            {"pid": str(pu)},
        )
    ).scalar_one()
    rows = (
        await session.execute(
            text(
                "SELECT id::text, action::text, actor_name::text, new_value, created_at"
                " FROM activity_log"
                " WHERE entity_type = 'problem' AND entity_id = CAST(:pid AS uuid)"
                " ORDER BY created_at DESC LIMIT :lim OFFSET :off"
            ),
            {"pid": str(pu), "lim": limit, "off": off},
        )
    ).mappings().all()
    return {
        "data": [dict(r) for r in rows],
        "meta": {
            "page": page,
            "limit": limit,
            "total": cnt,
            "total_pages": (cnt + limit - 1) // limit,
        },
    }


# ---------------------------------------------------------------------------
# GET /{identifier}/sparkline
# ---------------------------------------------------------------------------

@router.get("/{identifier}/sparkline")
async def problem_sparkline(
    identifier: str,
    session: AsyncSession = Depends(get_db),
    days: int = Query(28, ge=7, le=90),
):
    pu = await resolve_problem_uuid(session, identifier)
    if not pu:
        raise HTTPException(404, "NOT_FOUND")
    daily = await _ticket_daily_counts(session, pu)
    udaily = await _unresearched_daily(session, pu)
    return {
        "data": {
            "tickets": sparkline_series([(t[0], t[1]) for t in daily], days=days),
            "unresearched": sparkline_series([(t[0], t[1]) for t in udaily], days=days),
        }
    }


# ---------------------------------------------------------------------------
# GET /{identifier}/comments
# ---------------------------------------------------------------------------

@router.get("/{identifier}/comments")
async def problem_comments(
    identifier: str,
    session: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    pu = await resolve_problem_uuid(session, identifier)
    if not pu:
        raise HTTPException(404, "NOT_FOUND")
    off = (page - 1) * limit
    cnt = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM comments"
                " WHERE entity_type = 'problem' AND entity_id = CAST(:pid AS uuid)"
            ),
            {"pid": str(pu)},
        )
    ).scalar_one()
    rows = (
        await session.execute(
            text(
                "SELECT c.id::text, c.body, c.is_internal, c.is_edited,"
                "       c.parent_id::text, c.created_at, c.updated_at,"
                "       COALESCE(NULLIF(trim(u.name), ''), split_part(u.email, '@', 1)) AS author_name,"
                "       u.email AS author_email, c.author_id::text"
                " FROM comments c"
                " LEFT JOIN users u ON u.id = c.author_id"
                " WHERE c.entity_type = 'problem' AND c.entity_id = CAST(:pid AS uuid)"
                " ORDER BY c.created_at ASC LIMIT :lim OFFSET :off"
            ),
            {"pid": str(pu), "lim": limit, "off": off},
        )
    ).mappings().all()
    items = []
    for r in rows:
        d = dict(r)
        items.append(
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
                "updated_at": d["updated_at"].isoformat() if d["updated_at"] else None,
            }
        )
    return {
        "data": items,
        "meta": {"page": page, "limit": limit, "total": cnt, "total_pages": (cnt + limit - 1) // limit},
    }


# ---------------------------------------------------------------------------
# POST /{identifier}/comments
# ---------------------------------------------------------------------------

@router.post("/{identifier}/comments", status_code=201, dependencies=[Depends(require_api_key)])
async def add_problem_comment(
    identifier: str, body: CommentCreate, session: AsyncSession = Depends(get_db)
):
    pu = await resolve_problem_uuid(session, identifier)
    if not pu:
        raise HTTPException(404, "NOT_FOUND")
    r = await session.execute(
        text(
            "INSERT INTO comments"
            " (entity_type, entity_id, author_id, parent_id, body, is_internal)"
            " VALUES"
            " ('problem', CAST(:entity_id AS uuid), CAST(:author_id AS uuid),"
            "  CAST(:parent_id AS uuid), :body, :is_internal)"
            " RETURNING id::text, created_at"
        ),
        {
            "entity_id": str(pu),
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
            "entity_id": str(pu),
            "body": body.body,
            "is_internal": body.is_internal,
            "created_at": row[1].isoformat() if row[1] else None,
        }
    }
