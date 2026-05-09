from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.mapping import platform_db_to_ui, ticket_status_db_to_ui

router = APIRouter(prefix="/queues", tags=["queues"])


@router.get("")
async def list_queues(session: AsyncSession = Depends(get_db)):
    q = text(
        """SELECT q.id::text, q.code::text, q.name::text, q.sla_minutes,
               COUNT(*) FILTER (WHERE qi.status = 'pending')::int AS pending_count,
               COUNT(*) FILTER (WHERE qi.status = 'in_progress')::int AS in_progress_count,
               COUNT(*) FILTER (WHERE qi.sla_breached IS TRUE)::int AS sla_breached_count,
               COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - qi.created_at))/60)
                 FILTER (WHERE qi.status='pending'), 0)::float AS avg_wait_minutes,
               MIN(qi.created_at) FILTER (WHERE qi.status='pending') AS oldest_item_at
            FROM queues q
            LEFT JOIN queue_items qi ON qi.queue_id = q.id
            GROUP BY q.id, q.code, q.name, q.sla_minutes
            ORDER BY q.code"""
    )
    rows = []
    for r in (await session.execute(q)).mappings():
        d = dict(r)
        rows.append(
            {
                "id": d["id"],
                "code": d["code"],
                "name": d["name"],
                "sla_minutes": d["sla_minutes"],
                "pending_count": d["pending_count"],
                "in_progress_count": d["in_progress_count"],
                "sla_breached_count": d["sla_breached_count"],
                "avg_wait_minutes": round(float(d["avg_wait_minutes"] or 0), 2),
                "oldest_item_at": d["oldest_item_at"].isoformat() if d.get("oldest_item_at") else None,
            }
        )
    return {"data": rows}


@router.get("/{code}/items")
async def queue_items(
    code: str,
    session: AsyncSession = Depends(get_db),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    qid = (
        await session.execute(text("SELECT id FROM queues WHERE code = :c"), {"c": code})
    ).scalar_one_or_none()
    if not qid:
        raise HTTPException(404, "NOT_FOUND")

    clauses = ["qi.queue_id = CAST(:qid AS uuid)"]
    params: dict = {"qid": str(qid), "lim": limit}
    if status:
        clauses.append("qi.status = :st")
        params["st"] = status

    where = " AND ".join(clauses)
    sql = text(
        f"""SELECT qi.*, st.short_id::text AS ticket_short_id, st.summary::text,
              st.status::text AS ticket_status,
              st.ai_problem_confidence::float AS ai_problem_confidence,
              p.short_id::text AS problem_short_id,
              pr.name AS product_name, st.platform AS platform_raw
            FROM queue_items qi
            JOIN support_tickets st ON st.id = qi.ticket_id
            LEFT JOIN problems p ON p.id = st.problem_id
            LEFT JOIN products pr ON pr.id = st.product_id
            WHERE {where}
            ORDER BY qi.priority_score DESC NULLS LAST, qi.created_at ASC
            LIMIT :lim"""
    )
    res = await session.execute(sql, params)
    items = []
    for d in res.mappings():
        r = dict(d)
        items.append(
            {
                "id": str(r["id"]),
                "priority_score": float(r["priority_score"] or 0),
                "status": r["status"],
                "reason": r.get("reason"),
                "sla_deadline": r["sla_deadline"].isoformat() if r.get("sla_deadline") else None,
                "ticket": {
                    "id": r["ticket_short_id"],
                    "summary": r.get("summary"),
                    "product": r.get("product_name"),
                    "platform": platform_db_to_ui(r.get("platform_raw")),
                    "ai_problem_confidence": r.get("ai_problem_confidence"),
                    "problem_short_id": r.get("problem_short_id"),
                    "status_ui": ticket_status_db_to_ui(r.get("ticket_status")),
                },
            }
        )
    return {"data": items}
