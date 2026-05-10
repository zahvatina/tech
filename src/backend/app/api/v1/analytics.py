from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/trends")
async def trends(
    session: AsyncSession = Depends(get_db),
    metric: str = Query("tickets_created", description="tickets_created|unresearched"),
    granularity: str = Query("day", description="hour|day|week"),
    period: str = Query("14d"),
):
    days = {"7d": 7, "14d": 14, "30d": 30}.get(period.lower(), 14)
    trunc = {"hour": "hour", "day": "day", "week": "week"}.get(granularity, "day")

    interval_filter = "NOW() - (:d * interval '1 day')"
    if metric == "unresearched":
        sql_tmpl = f"""SELECT date_trunc(:trunc, created_at AT TIME ZONE 'UTC') AS bucket,
                      COUNT(*)::int AS cnt
               FROM support_tickets
               WHERE requires_research IS TRUE
                     AND created_at >= {interval_filter}"""
    else:
        sql_tmpl = f"""SELECT date_trunc(:trunc, created_at AT TIME ZONE 'UTC') AS bucket,
                      COUNT(*)::int AS cnt
               FROM support_tickets
               WHERE created_at >= {interval_filter}"""

    sql = sql_tmpl + " GROUP BY 1 ORDER BY 1"

    rows = (
        await session.execute(
            text(sql),
            {"trunc": trunc, "d": days},
        )
    ).fetchall()
    series = [{"bucket": row[0].isoformat(), "count": int(row[1])} for row in rows]

    vals = [p["count"] for p in series]
    mn = min(vals) if vals else 0
    mx = max(vals) if vals else 0

    return {
        "data": {
            "metric": metric,
            "granularity": granularity,
            "period": period,
            "series": series,
            "min": mn,
            "max": mx,
        }
    }


@router.get("/queue-metrics")
async def queue_metrics(
    session: AsyncSession = Depends(get_db),
    queue_code: str | None = Query(None),
    period: str = Query("7d"),
):
    days = {"7d": 7, "14d": 14, "30d": 30}.get(period.lower(), 7)
    clauses = ["qi.created_at >= NOW() - (:d * interval '1 day')"]
    params: dict = {"d": days}
    if queue_code:
        clauses.append("q.code = :qc")
        params["qc"] = queue_code

    where = " AND ".join(clauses)
    sql = text(
        f"""SELECT q.code,
               COUNT(*)::int AS total_items,
               COUNT(*) FILTER (WHERE qi.status = 'completed')::int AS completed,
               COALESCE(AVG(
                 EXTRACT(EPOCH FROM (COALESCE(qi.resolved_at, NOW()) - qi.created_at)) / 60
               ) FILTER (WHERE qi.status = 'completed'), 0)::float AS avg_wait_minutes,
               COUNT(*) FILTER (WHERE qi.sla_breached IS TRUE)::int AS sla_breaches,
               COALESCE(
                 COUNT(*) FILTER (WHERE qi.status = 'completed')::float /
                 NULLIF(COUNT(*), 0), 0
               )::float AS throughput_rate
            FROM queue_items qi
            JOIN queues q ON q.id = qi.queue_id
            WHERE {where}
            GROUP BY q.code
            ORDER BY q.code"""
    )
    rows = (await session.execute(sql, params)).mappings().all()
    result = []
    for r in rows:
        d = dict(r)
        total = int(d["total_items"] or 0)
        completed = int(d["completed"] or 0)
        sla_ok = max(0, completed - int(d["sla_breaches"] or 0))
        result.append(
            {
                "queue_code": d["code"],
                "total_items": total,
                "completed": completed,
                "avg_wait_minutes": round(float(d["avg_wait_minutes"] or 0), 2),
                "sla_breaches": int(d["sla_breaches"] or 0),
                "sla_compliance_pct": round(sla_ok / max(completed, 1) * 100, 1),
                "throughput_rate": round(float(d["throughput_rate"] or 0), 4),
            }
        )
    return {"data": result, "period": period}


@router.get("/team-performance")
async def team_performance(
    session: AsyncSession = Depends(get_db),
    period: str = Query("7d"),
):
    days = {"7d": 7, "14d": 14, "30d": 30}.get(period.lower(), 7)
    sql = text(
        """SELECT u.id::text, u.name, u.email, u.role,
               COUNT(qi.id)::int AS total_taken,
               COUNT(qi.id) FILTER (WHERE qi.status = 'completed')::int AS resolved,
               COUNT(qi.id) FILTER (WHERE qi.status = 'pending'
                   AND qi.assigned_to IS NULL)::int AS skipped,
               COALESCE(AVG(
                 EXTRACT(EPOCH FROM (qi.resolved_at - qi.assigned_at)) / 60
               ) FILTER (WHERE qi.status = 'completed'
                   AND qi.assigned_at IS NOT NULL AND qi.resolved_at IS NOT NULL), 0
               )::float AS avg_resolution_minutes
            FROM users u
            LEFT JOIN queue_items qi
              ON qi.assigned_to = u.id
              AND qi.created_at >= NOW() - (:d * interval '1 day')
            WHERE u.is_active = TRUE
            GROUP BY u.id, u.name, u.email, u.role
            ORDER BY resolved DESC, u.name"""
    )
    rows = (await session.execute(sql, {"d": days})).mappings().all()
    result = []
    for r in rows:
        d = dict(r)
        total = int(d["total_taken"] or 0)
        resolved = int(d["resolved"] or 0)
        skipped = int(d["skipped"] or 0)
        result.append(
            {
                "user_id": d["id"],
                "name": d["name"],
                "role": d["role"],
                "total_taken": total,
                "resolved": resolved,
                "skip_rate": round(skipped / max(total, 1), 4),
                "avg_resolution_minutes": round(float(d["avg_resolution_minutes"] or 0), 2),
            }
        )
    return {"data": result, "period": period}
