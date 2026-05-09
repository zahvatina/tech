from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.mapping import (
    platform_db_to_ui,
    priority_db_to_ui,
    task_status_db_to_ui,
    ticket_status_db_to_ui,
)
from app.services.problem_rows import problem_record_to_ui, sparkline_series
from app.services.resolve import resolve_problem_uuid

router = APIRouter(prefix="/problems", tags=["problems"])

ALLOW_PROB_STATUS = {
    "new",
    "in_progress",
    "waiting_fix",
    "resolved",
    "closed",
    "monitoring",
}
ALLOW_PRIO = {"critical", "high", "medium", "low"}


async def _product_names_for_problem(session: AsyncSession, p: dict) -> list[str]:
    ids = list(p.get("affected_product_ids") or [])
    if not ids:
        return []
    q = text(
        """SELECT name FROM products WHERE id = ANY(CAST(:ids AS uuid[])) ORDER BY name"""
    )
    r = await session.execute(q, {"ids": ids})
    return [row[0] for row in r.fetchall()]


async def _platforms_for_problem(session: AsyncSession, pid: UUID) -> list[str]:
    q = text(
        """SELECT DISTINCT platform FROM support_tickets
           WHERE problem_id = :pid AND platform IS NOT NULL"""
    )
    r = await session.execute(q, {"pid": str(pid)})
    return sorted({platform_db_to_ui(row[0]) for row in r.fetchall()} or {"web"})


async def _ticket_daily_counts(session: AsyncSession, pid: UUID) -> list:
    q = text(
        """SELECT date_trunc('day', created AT TIME ZONE 'UTC')::date AS d, COUNT(*)::int
           FROM (
             SELECT created_at AS created FROM support_tickets WHERE problem_id = CAST(:pid AS uuid)
               AND created_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '35 days'
           ) s
           GROUP BY 1 ORDER BY 1"""
    )
    res = await session.execute(q, {"pid": str(pid)})
    return res.fetchall()


async def _unresearched_daily(session: AsyncSession, pid: UUID) -> list:
    q = text(
        """SELECT date_trunc('day', created)::date AS d, COUNT(*)::int
           FROM (
             SELECT created_at AS created FROM support_tickets
             WHERE problem_id = CAST(:pid AS uuid)
               AND requires_research IS TRUE
               AND created_at >= NOW() - INTERVAL '35 days'
           ) s
           GROUP BY 1 ORDER BY 1"""
    )
    res = await session.execute(q, {"pid": str(pid)})
    return res.fetchall()


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


async def _load_mv(session: AsyncSession, problem_id: str) -> dict | None:
    r = await session.execute(
        text("SELECT tickets_delta_pct, unresearched_delta_pct FROM mv_problem_stats WHERE id = CAST(:id AS uuid)"),
        {"id": problem_id},
    )
    row = r.mappings().first()
    return dict(row) if row else None


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
    dirs = {"asc": "ASC", "desc": "DESC"}
    sd = dirs.get(sort_dir, "DESC")
    order_exprs = {
        "tickets_delta_pct": "(COALESCE(mv.tickets_delta_pct, 0))",
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
            """EXISTS (
               SELECT 1 FROM unnest(p.affected_product_ids) x
               JOIN products pr ON pr.id = x
               WHERE lower(pr.code) = lower(:pcode))"""
        )
        params["pcode"] = product_code
    if owner_id:
        clauses.append("p.owner_id = CAST(:oid AS uuid)")
        params["oid"] = owner_id
    if tags:
        clauses.append("p.tags && CAST(:tg AS varchar[])")
        params["tg"] = tags
    if search:
        clauses.append("(p.title ILIKE :sq OR p.short_id ILIKE :sq OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE :sq))")
        params["sq"] = f"%{search}%"
    if has_unresearched:
        clauses.append("p.unresearched_count > 0")
    if tickets_no_bug is True:
        clauses.append("p.tickets_no_task_count > 0")
    if sla_breached is True:
        clauses.append("p.sla_breached = TRUE")

    if view == "growing":
        clauses.append(
            """((p.tickets_count_prev_week > 0
                AND ((p.tickets_count - p.tickets_count_prev_week)::float / p.tickets_count_prev_week) > 0.1)
               OR COALESCE(mv.tickets_delta_pct, 0) > 10)"""
        )
    elif view == "untriaged":
        clauses.append("p.unresearched_count >= 10")
    elif view == "no-bug":
        clauses.append("p.tickets_no_task_count > 0")

    where_sql = " AND ".join(clauses)
    cnt_q = text(f"SELECT COUNT(*) FROM problems p LEFT JOIN mv_problem_stats mv ON mv.id = p.id WHERE {where_sql}")
    total = (await session.execute(cnt_q, params)).scalar_one()

    list_q = text(
        f"""SELECT p.*,
             u.email AS owner_email,
             COALESCE(NULLIF(trim(u.name), ''), split_part(u.email, '@', 1)) AS owner_name
             FROM problems p
             LEFT JOIN mv_problem_stats mv ON mv.id = p.id
             LEFT JOIN users u ON u.id = p.owner_id
             WHERE {where_sql}
             ORDER BY {ob} {sd}, p.short_id
             LIMIT :limit OFFSET :off"""
    )
    rows = (await session.execute(list_q, params)).mappings().all()
    items = []
    for row in rows:
        rdict = dict(row)
        pname = await _product_names_for_problem(session, rdict)
        mv = await _load_mv(session, str(rdict["id"]))
        ex = _extras_from_mv(mv)
        plat = await _platforms_for_problem(session, rdict["id"])
        daily = await _ticket_daily_counts(session, rdict["id"])
        udaily = await _unresearched_daily(session, rdict["id"])
        ex.update(
            {
                "owner_id": rdict.get("owner_id"),
                "owner_name": rdict.get("owner_name"),
                "platforms": list(plat) if plat else None,
                "trend_spark": sparkline_series([(t[0], t[1]) for t in daily]),
                "untriaged_spark": sparkline_series([(t[0], t[1]) for t in udaily]),
            }
        )
        items.append(problem_record_to_ui(rdict, pname, ex))

    return {
        "data": items,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit if limit else 1,
        },
    }


async def _one_problem_core(session: AsyncSession, pid: UUID) -> dict | None:
    r = await session.execute(
        text(
            """SELECT p.*,
              u.id AS oid, u.email AS owner_email,
              COALESCE(NULLIF(trim(u.name), ''), split_part(u.email, '@', 1)) AS owner_display
              FROM problems p
              LEFT JOIN users u ON u.id = p.owner_id
              WHERE p.id = CAST(:pid AS uuid)"""
        ),
        {"pid": str(pid)},
    )
    return r.mappings().first()


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

    # tasks summary (VECTOR «bugs» tab uses task-like records)
    tq = await session.execute(
        text(
            """SELECT id::text, short_id, task_type, status, title,
                  jira_issue_key, has_workaround, tickets_count,
                  substring(coalesce(ai_summary,''), 1, 200) AS ai_summary_preview
               FROM tasks WHERE problem_id = CAST(:pid AS uuid)
               ORDER BY updated_at DESC"""
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

    recent_tickets = []
    rq = await session.execute(
        text(
            """SELECT short_id::text, summary::text, status::text, created_at
               FROM support_tickets WHERE problem_id = CAST(:pid AS uuid)
               ORDER BY created_at DESC LIMIT 12"""
        ),
        {"pid": str(pu)},
    )
    for row in rq.mappings():
        rd = dict(row)
        recent_tickets.append(
            {
                "id": rd["short_id"],
                "summary": rd["summary"],
                "status": ticket_status_db_to_ui(rd["status"]),
                "created_at": rd["created_at"].isoformat(timespec="minutes") if rd["created_at"] else "",
            }
        )

    breakdown = {}
    pq = await session.execute(
        text(
            """SELECT pr.code::text AS code, COUNT(*)::int AS c
               FROM support_tickets st JOIN products pr ON pr.id = st.product_id
               WHERE st.problem_id = CAST(:pid AS uuid) GROUP BY pr.code"""
        ),
        {"pid": str(pu)},
    )
    for code, c in pq.fetchall():
        breakdown.setdefault("products_breakdown", {})[code or "unknown"] = c

    plq = await session.execute(
        text(
            """SELECT COALESCE(platform, 'unknown') AS pl, COUNT(*)::int FROM support_tickets
               WHERE problem_id = CAST(:pid AS uuid) GROUP BY platform"""
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
            "stats": {
                "tickets_today": 0,
                **breakdown,
            },
        }
    }


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
            text("SELECT COUNT(*) FROM support_tickets WHERE problem_id = CAST(:pid AS uuid)"),
            {"pid": str(pu)},
        )
    ).scalar_one()
    q = text(
        """SELECT st.*, pr.name AS product_name, pr.code AS product_code
           FROM support_tickets st
           LEFT JOIN products pr ON pr.id = st.product_id
           WHERE st.problem_id = CAST(:pid AS uuid)
           ORDER BY st.created_at DESC
           LIMIT :lim OFFSET :off"""
    )
    rows = (await session.execute(q, {"pid": str(pu), "lim": limit, "off": off})).mappings().all()
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
                "created_at": d["created_at"].isoformat(timespec="minutes") if d["created_at"] else None,
                "requires_research": d.get("requires_research"),
                "current_queue": d.get("current_queue"),
            }
        )
    return {"data": items, "meta": {"page": page, "limit": limit, "total": cnt, "total_pages": (cnt + limit - 1) // limit}}


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
    q = text(
        f"""SELECT t.*, tm.name AS team_name
            FROM tasks t
            LEFT JOIN teams tm ON tm.id = t.team_id
            WHERE {where}
            ORDER BY t.updated_at DESC LIMIT :lim OFFSET :off"""
    )
    rows = (await session.execute(q, params)).mappings().all()
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
    return {"data": items, "meta": {"page": page, "limit": limit, "total": cnt, "total_pages": (cnt + limit - 1) // limit}}


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
                """SELECT COUNT(*) FROM activity_log
                   WHERE entity_type = 'problem' AND entity_id = CAST(:pid AS uuid)"""
            ),
            {"pid": str(pu)},
        )
    ).scalar_one()
    q = text(
        """SELECT id::text, action::text, actor_name::text, new_value, created_at
           FROM activity_log
           WHERE entity_type = 'problem' AND entity_id = CAST(:pid AS uuid)
           ORDER BY created_at DESC LIMIT :lim OFFSET :off"""
    )
    rows = (await session.execute(q, {"pid": str(pu), "lim": limit, "off": off})).mappings().all()
    return {
        "data": [dict(r) for r in rows],
        "meta": {"page": page, "limit": limit, "total": cnt, "total_pages": (cnt + limit - 1) // limit},
    }
