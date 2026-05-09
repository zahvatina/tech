from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.mapping import platform_db_to_ui, ticket_status_db_to_ui
from app.services.resolve import resolve_problem_uuid, resolve_task_uuid, resolve_ticket_uuid

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _ticket_item(d: dict) -> dict:
    has_problem = bool(d.get("problem_uuid"))
    dup = bool(d.get("is_duplicate"))
    tid = d.get("task_id")
    st = (d.get("status") or "").lower()
    return {
        "id": d["short_id"],
        "uuid": str(d["id"]),
        "userId": d.get("user_id"),
        "product": d.get("product_name"),
        "platform": platform_db_to_ui(d.get("platform")),
        "summary": d.get("summary") or ((d.get("raw_text") or "")[:140]),
        "text": d.get("raw_text"),
        "created": d["created_at"].isoformat(timespec="minutes") if d.get("created_at") else "",
        "status": d.get("status"),
        "ui_status": ticket_status_db_to_ui(d.get("status")),
        "region": d.get("region"),
        "channel": d.get("channel"),
        "problemId": d.get("problem_short_id"),
        "problem_uuid": str(d["problem_uuid"]) if d.get("problem_uuid") else None,
        "bugId": d.get("task_short_id"),
        "requires_research": d.get("requires_research"),
        "current_queue": d.get("current_queue"),
        "flags": {
            "isNew": st in {"new", "in_queue"} and not has_problem and not dup,
            "needsResearch": bool(d.get("requires_research")),
            "confirmedBug": bool(tid),
            "duplicate": dup,
        },
        "attachments": [],
    }


@router.get("")
async def list_tickets(
    session: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    problem_id: str | None = None,
    task_id: str | None = None,
    status: list[str] | None = Query(None),
    requires_research: bool | None = None,
    no_task: bool | None = Query(None),
    current_queue: str | None = None,
    search: str | None = None,
):
    off = (page - 1) * limit
    clauses = ["TRUE"]
    params: dict = {"limit": limit, "off": off}

    if problem_id:
        pu = await resolve_problem_uuid(session, problem_id)
        if pu:
            clauses.append("st.problem_id = CAST(:pid AS uuid)")
            params["pid"] = str(pu)
    if task_id:
        tk = await resolve_task_uuid(session, task_id)
        if tk:
            clauses.append("st.task_id = CAST(:tid AS uuid)")
            params["tid"] = str(tk)
    if status:
        clauses.append("st.status = ANY(:st)")
        params["st"] = status
    if requires_research is True:
        clauses.append("st.requires_research = TRUE")
    if no_task is True:
        clauses.append("st.task_id IS NULL AND st.problem_id IS NOT NULL")
    if current_queue:
        clauses.append("st.current_queue = :cq")
        params["cq"] = current_queue
    if search:
        clauses.append("(st.summary ILIKE :sq OR st.raw_text ILIKE :sq OR st.short_id ILIKE :sq)")
        params["sq"] = f"%{search}%"

    where = " AND ".join(clauses)
    base_from = """support_tickets st
        LEFT JOIN products pr ON pr.id = st.product_id
        LEFT JOIN problems p ON p.id = st.problem_id
        LEFT JOIN tasks tk ON tk.id = st.task_id"""

    cnt = (
        await session.execute(
            text(f"SELECT COUNT(*) FROM {base_from} WHERE {where}"),
            params,
        )
    ).scalar_one()

    q = text(
        f"""SELECT st.*, pr.name AS product_name, p.short_id AS problem_short_id, p.id AS problem_uuid,
               tk.short_id AS task_short_id
            FROM {base_from}
            WHERE {where}
            ORDER BY st.created_at DESC
            LIMIT :limit OFFSET :off"""
    )
    rows = (await session.execute(q, params)).mappings().all()
    items = [_ticket_item(dict(r)) for r in rows]

    tp = limit or 1
    return {"data": items, "meta": {"page": page, "limit": limit, "total": cnt, "total_pages": (cnt + tp - 1) // tp}}


@router.get("/triage-queue")
async def triage_queue(session: AsyncSession = Depends(get_db)):
    qcounts = await session.execute(
        text(
            """SELECT COALESCE(current_queue, '_none') AS k, COUNT(*)::int FROM support_tickets
               WHERE status IN ('new','in_queue','processing','researching') OR current_queue IS NOT NULL
               GROUP BY COALESCE(current_queue, '_none')"""
        )
    )
    total_by_queue = {row[0]: row[1] for row in qcounts.fetchall()}

    sparks = await session.execute(
        text(
            """SELECT p.short_id::text AS problem_short_id, p.title::text AS problem_title,
                  COUNT(*)::int AS new_tickets_1h,
                  COALESCE(MAX(mv.tickets_delta_pct), 0)::float AS delta_pct_wow
               FROM support_tickets st
               JOIN problems p ON p.id = st.problem_id
               LEFT JOIN mv_problem_stats mv ON mv.id = p.id
               WHERE st.created_at >= NOW() - INTERVAL '1 hour'
               GROUP BY p.short_id, p.title, p.id
               ORDER BY COUNT(*) DESC LIMIT 5"""
        )
    )
    critical_spikes = []
    for r in sparks.mappings():
        d = dict(r)
        critical_spikes.append(
            {
                "problem_id": None,
                "problem_short_id": d["problem_short_id"],
                "problem_title": d["problem_title"],
                "new_tickets_1h": d["new_tickets_1h"],
                "delta_pct_wow": round(float(d["delta_pct_wow"] or 0), 2),
            }
        )

    cluster_sql = text(
        """SELECT
             COALESCE(NULLIF(trim(ai_category), ''), left(coalesce(nullif(trim(summary),''), raw_text), 52)) AS title,
             COUNT(*)::int AS cnt,
             COALESCE(AVG(ai_problem_confidence), 0.5)::float AS avg_conf
           FROM support_tickets
           WHERE (requires_research OR task_id IS NULL OR current_queue IS NOT NULL)
             AND COALESCE(is_duplicate,FALSE) = FALSE
             AND created_at >= NOW() - INTERVAL '14 days'
           GROUP BY 1
           HAVING COUNT(*) >= 1
           ORDER BY cnt DESC
           LIMIT 8"""
    )
    cr = await session.execute(cluster_sql)
    clusters = []
    for idx, row in enumerate(cr.fetchall()):
        title, cnt, ac = row[0], row[1], float(row[2] or 0)
        growth = round(min(2.5, cnt / max(40.0, 1.0)), 4)
        clusters.append(
            {
                "id": f"C-{idx+1:03d}",
                "title": title,
                "count": cnt,
                "growth": growth,
                "severity": "critical" if ac < 0.75 else ("high" if ac < 0.85 else "medium"),
                "suggestedBug": False,
            }
        )

    queue_hints = []
    hint = await session.execute(
        text(
            """SELECT short_id::text, COALESCE(summary, '') AS summary,
                  COALESCE(ai_problem_confidence,0)::float AS c
               FROM support_tickets WHERE current_queue IS NOT NULL ORDER BY created_at DESC LIMIT 20"""
        )
    )
    for row in hint.mappings():
        d = dict(row)
        queue_hints.append(
            {
                "ticket_id": d["short_id"],
                "triage_score": float(d["c"] or 0.5),
                "reasons": ["low_confidence"] if (d["c"] or 0) < 0.9 else ["ai_ok"],
                "recommended_queue": "task_determination" if d["c"] and d["c"] < 0.85 else "problem_determination",
            }
        )

    return {
        "data": {
            "total_by_queue": {
                "problem_determination": total_by_queue.get("problem_determination", 0),
                "task_determination": total_by_queue.get("task_determination", 0),
                "recommendation_review": total_by_queue.get("recommendation_review", 0),
                "client_response": total_by_queue.get("client_response", 0),
            },
            "critical_spikes": critical_spikes,
            "clusters": clusters,
            "queue_hints": queue_hints,
        }
    }


@router.get("/{identifier}")
async def get_ticket(identifier: str, session: AsyncSession = Depends(get_db)):
    tu = await resolve_ticket_uuid(session, identifier)
    if not tu:
        raise HTTPException(404, "NOT_FOUND")

    q = text(
        """SELECT st.*, pr.name AS product_name, p.short_id AS problem_short_id, p.id AS problem_uuid,
              tk.short_id AS task_short_id
           FROM support_tickets st
           LEFT JOIN products pr ON pr.id = st.product_id
           LEFT JOIN problems p ON p.id = st.problem_id
           LEFT JOIN tasks tk ON tk.id = st.task_id
           WHERE st.id = CAST(:id AS uuid)"""
    )
    r = (await session.execute(q, {"id": str(tu)})).mappings().first()
    if not r:
        raise HTTPException(404, "NOT_FOUND")
    core = dict(r)

    aq = await session.execute(
        text(
            """SELECT suggestion_type, confidence::float AS confidence, reasoning,
                      suggested_entity_id::text AS suggested_entity_id
               FROM ai_suggestions WHERE ticket_id = CAST(:id AS uuid) ORDER BY confidence DESC LIMIT 12"""
        ),
        {"id": str(tu)},
    )
    ai_suggestions = [dict(row) for row in aq.mappings()]

    att = await session.execute(
        text(
            """SELECT file_name AS name, file_type, is_log, '/attachments/'||id::text AS url_stub
               FROM attachments WHERE ticket_id = CAST(:id AS uuid)"""
        ),
        {"id": str(tu)},
    )
    attachments = [dict(row) for row in att.mappings()]
    base = _ticket_item(core)
    base["attachments"] = attachments

    qi = await session.execute(
        text(
            """SELECT qi.id::text, q.code AS queue_code, qi.priority_score::float, qi.sla_deadline, qi.status
               FROM queue_items qi
               JOIN queues q ON q.id = qi.queue_id
               WHERE qi.ticket_id = CAST(:tid AS uuid) AND qi.status IN ('pending','in_progress')
               ORDER BY qi.updated_at DESC LIMIT 1"""
        ),
        {"tid": str(tu)},
    )
    qrow = qi.mappings().first()
    base["queue_item"] = dict(qrow) if qrow else None
    base["ai_suggestions"] = ai_suggestions
    return {"data": base}
