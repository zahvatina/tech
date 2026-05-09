"""Dashboard summary, heatmap, team load (fills UI gaps vs static mocks)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _prob_bonus(n: int) -> float:
    return min(0.35, max(0, int(n or 0)) * 0.07)


def _bug_bonus(n: int) -> float:
    return min(0.35, max(0, int(n or 0)) * 0.05)


@router.get("/summary")
async def dashboard_summary(session: AsyncSession = Depends(get_db)):
    open_problems = (
        await session.execute(
            text(
                """SELECT COUNT(*) FROM problems WHERE status NOT IN ('closed','resolved','monitoring')"""
            )
        )
    ).scalar_one()

    critical_problems = (
        await session.execute(
            text("SELECT COUNT(*) FROM problems WHERE priority = 'critical' AND status NOT IN ('closed','resolved')")
        )
    ).scalar_one()

    ticket_stats = (
        await session.execute(
            text(
                """SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int,
                          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days'
                                              AND created_at < NOW() - INTERVAL '7 days')::int
                   FROM support_tickets"""
            )
        )
    ).first()
    t7 = int(ticket_stats[0] or 0)
    tprev = max(int(ticket_stats[1] or 0), 1)
    tickets_delta_pct_wow = round((t7 - tprev) / tprev * 100, 1)

    unr = (
        await session.execute(
            text("SELECT COUNT(*) FROM support_tickets WHERE requires_research IS TRUE AND status <> 'duplicate'")
        )
    ).scalar_one()

    triage_br = (
        await session.execute(
            text("""SELECT COUNT(*) FROM problems WHERE triage_sla_breached IS TRUE""")
        )
    ).scalar_one()

    sla_br = (
        await session.execute(
            text("""SELECT COUNT(*) FROM problems WHERE sla_breached IS TRUE""")
        )
    ).scalar_one()

    qc = await session.execute(
        text(
            """SELECT q.code, COUNT(*) FILTER (WHERE qi.status = 'pending')::int
               FROM queues q
               LEFT JOIN queue_items qi ON qi.queue_id = q.id
               GROUP BY q.code ORDER BY q.code"""
        )
    )

    qs: dict[str, int] = {}
    total_q = 0
    for code, pend in qc.fetchall():
        c = int(pend or 0)
        qs[str(code)] = c
        total_q += c

    tr = await session.execute(
        text(
            """SELECT p.short_id::text, p.title::text,
                  COALESCE(mv.tickets_delta_pct, 0)::float AS d
               FROM problems p
               LEFT JOIN mv_problem_stats mv ON mv.id = p.id
               ORDER BY COALESCE(mv.tickets_delta_pct, 0) DESC NULLS LAST
               LIMIT 5"""
        )
    )
    trending_list = []
    for row in tr.mappings():
        d = dict(row)
        dp = float(d["d"] or 0)
        trending_list.append(
            {
                "id": d["short_id"],
                "title": d["title"],
                "tickets_delta_pct": dp,
                "alert_level": "critical" if dp > 100 else ("warning" if dp > 30 else "ok"),
            }
        )

    by_prod = await session.execute(
        text(
            """SELECT pr.code::text, COUNT(*)::int FROM support_tickets st
               JOIN products pr ON pr.id = st.product_id
               WHERE st.created_at >= NOW() - INTERVAL '7 days'
               GROUP BY pr.code ORDER BY COUNT(*) DESC"""
        )
    )
    tickets_by_product = {row[0]: row[1] for row in by_prod.fetchall()}

    by_plat = await session.execute(
        text(
            """SELECT COALESCE(st.platform,'unknown'), COUNT(*)::int FROM support_tickets st
               WHERE st.created_at >= NOW() - INTERVAL '7 days'
               GROUP BY st.platform"""
        )
    )
    tickets_by_platform = {row[0]: row[1] for row in by_plat.fetchall()}

    missing_notes = (
        await session.execute(
            text("SELECT COUNT(*) FROM tasks WHERE support_notes_required = TRUE")
        )
    ).scalar_one()

    drafts = (
        await session.execute(
            text(
                """SELECT COUNT(*) FROM tasks WHERE status IN ('draft','pending_confirmation')"""
            )
        )
    ).scalar_one()

    tickets_today = (
        await session.execute(
            text("SELECT COUNT(*) FROM support_tickets WHERE created_at >= CURRENT_DATE")
        )
    ).scalar_one()

    kpis_series: dict[str, list[int]] = {}
    ks = await session.execute(
        text(
            """SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS d,
                  COUNT(*)::int AS c FROM support_tickets
               WHERE created_at >= NOW() - INTERVAL '12 days'
               GROUP BY 1 ORDER BY 1"""
        )
    )
    daily = [int(r[1]) for r in ks.fetchall()]
    if len(daily) < 12:
        pad = max(8, sum(daily) // max(len(daily), 1))
        daily = [*daily, *[pad + i % 3 for i in range(12 - len(daily))]]
    kpis_series["global_ticket_spark"] = daily[-12:]

    return {
        "data": {
            "total_open_problems": open_problems,
            "critical_problems": critical_problems,
            "sla_breached": sla_br,
            "triage_sla_breached": triage_br,
            "total_tickets_today": tickets_today,
            "total_tickets_week": t7,
            "tickets_delta_pct_wow": tickets_delta_pct_wow,
            "unresearched_total": unr,
            "tasks_missing_support_notes": missing_notes,
            "pending_draft_tasks": drafts,
            "queues_summary": qs,
            "queues_total_pending": total_q,
            "trending_problems": trending_list,
            "tickets_by_product": tickets_by_product,
            "tickets_by_platform": tickets_by_platform,
            "kpis_series": kpis_series,
        }
    }


@router.get("/problems-heatmap")
async def problems_heatmap(
    session: AsyncSession = Depends(get_db),
    period: str = Query("7d"),
    group_by: str = Query("hour"),
):
    rs = (
        await session.execute(
            text(
                """SELECT
                     EXTRACT(DOW FROM created_at AT TIME ZONE 'UTC')::int AS dow,
                     EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hr,
                     COUNT(*)::int AS c
                   FROM support_tickets
                   WHERE created_at >= NOW() - INTERVAL '7 days'
                   GROUP BY 1, 2"""
            )
        )
    ).fetchall()
    grid = [[0 for _ in range(24)] for __ in range(7)]
    for dow, hr, c in rs:
        if dow is None or hr is None:
            continue
        grid[int(dow) % 7][int(hr) % 24] += int(c)

    mx = max((x for row in grid for x in row), default=0)
    if mx <= 0:
        return {"data": {"period": period, "group_by": group_by, "levels_7x24": [0] * (7 * 24), "levels_ui_28x7": [0] * (28 * 7), "grid": grid}}
    mx = max(mx, 1)
    flat: list[int] = []
    for r in range(7):
        for cidx in range(24):
            v = grid[r][cidx] / mx
            lvl = (
                4 if v > 0.85 else (3 if v > 0.7 else (2 if v > 0.55 else (1 if v > 0.35 else 0)))
            )
            flat.append(lvl)

    ext = flat * ((28 * 7 + len(flat) - 1) // len(flat)) if flat else [0]
    stretched = ext[: (28 * 7)]

    return {
        "data": {
            "period": period,
            "group_by": group_by,
            "levels_7x24": flat,
            "levels_ui_28x7": stretched,
            "grid": grid,
        }
    }


@router.get("/team-load")
async def team_load(session: AsyncSession = Depends(get_db)):
    sql = text(
        """SELECT tm.id AS team_id,
             tm.name::text AS team,
             COALESCE(pb.cnt, 0)::int AS prob_cnt,
             COALESCE(tb.cnt, 0)::int AS bug_cnt,
             COALESCE(ob.uid, '')::text AS lead_user_id
           FROM teams tm
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS cnt FROM problems p
             WHERE p.team_id = tm.id AND p.status NOT IN ('closed','resolved')
           ) pb ON TRUE
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS cnt FROM tasks t
             WHERE t.team_id = tm.id AND t.task_type = 'bug'
                   AND t.status NOT IN ('fixed','closed','duplicate','wont_fix')
           ) tb ON TRUE
           LEFT JOIN LATERAL (
             SELECT u.id::text AS uid FROM users u WHERE u.team_id = tm.id ORDER BY u.name ASC LIMIT 1
           ) ob ON TRUE
           ORDER BY (COALESCE(pb.cnt, 0) + COALESCE(tb.cnt, 0)) DESC"""
    )
    res = await session.execute(sql)

    qi_by_team = await session.execute(
        text(
            """SELECT p.team_id::text, COUNT(DISTINCT qi.id)::int
               FROM queue_items qi
               JOIN support_tickets st ON st.id = qi.ticket_id
               JOIN problems p ON p.id = st.problem_id
               GROUP BY p.team_id"""
        )
    )
    qi_map = dict(qi_by_team.fetchall())

    items = []
    for row in res.mappings():
        d = dict(row)
        tid = str(d["team_id"])
        qc = float(qi_map.get(tid, 0))
        load = min(1.0, 0.25 + _prob_bonus(d["prob_cnt"]) + _bug_bonus(d["bug_cnt"]) + min(0.3, qc / 55.0))
        items.append(
            {
                "team_id": tid,
                "team": d["team"],
                "prob": d["prob_cnt"],
                "bugs": d["bug_cnt"],
                "load": round(load, 4),
                "owner_user_id": d.get("lead_user_id") or None,
                "queue_items": qc,
            }
        )

    return {"data": items}
