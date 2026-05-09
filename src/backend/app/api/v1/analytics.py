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
