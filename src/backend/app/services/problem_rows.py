"""Build problem list/detail dicts aligned with VECTOR UI + API spec fields."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any


def _f(x: Any) -> float:
    if x is None:
        return 0.0
    if isinstance(x, Decimal):
        return float(x)
    return float(x)


def _pct_delta(cur: int, prev: int) -> float | None:
    if prev <= 0:
        return None
    return round((cur - prev) / prev, 4)


def sparkline_series(daily_counts: list[tuple[Any, int]], days: int = 28) -> list[int]:
    """Build `days`-length series ending at latest day present in counts (pad missing with smoothed filler)."""
    if not daily_counts:
        return [max(3, ((i * 17) % 40) // 7 + i % 5) for i in range(days)]

    by_day: dict[date, int] = {}
    for d, c in daily_counts:
        if hasattr(d, "date"):
            d = d.date()
        by_day[d] = int(c)

    max_d = max(by_day.keys())
    fill = max(2, sum(by_day.values()) // max(len(by_day) * days // 14, 1))
    out: list[int] = []
    for i in range(days - 1, -1, -1):
        dd = max_d - timedelta(days=i)
        out.append(by_day.get(dd, fill))
    return out


def problem_record_to_ui(row: dict[str, Any], product_names: list[str], extras: dict[str, Any]) -> dict[str, Any]:
    from app.mapping import priority_db_to_ui, problem_status_db_to_ui

    pid = row["short_id"]
    tickets = row["tickets_count"] or 0
    tpw = row["tickets_count_prev_week"] or 0
    untr = row["unresearched_count"] or 0
    upw = row["unresearched_count_prev_week"] or 0
    tickets_delta = extras.get("tickets_delta_pct")
    if tickets_delta is None:
        d = _pct_delta(tickets, tpw)
        tickets_delta = d if d is not None else 0.0
    untriaged_delta = extras.get("unresearched_delta_pct")
    if untriaged_delta is None:
        ud = _pct_delta(untr, upw)
        untriaged_delta = ud if ud is not None else 0.0

    breach = bool(row.get("sla_breached"))

    owner_id = extras.get("owner_id")
    owner_display = extras.get("owner_name")

    return {
        # VECTOR routes use short_id (`PRB-218`) as canonical client id:
        "id": pid,
        "uuid": str(row["id"]),
        "short_id": pid,
        "key": pid,
        "title": row["title"],
        "desc": row.get("description") or "",
        "status": problem_status_db_to_ui(row.get("status")),
        "priority": priority_db_to_ui(row.get("priority")),
        "severity": row.get("severity") or "moderate",
        "owner_id": str(owner_id) if owner_id else None,
        "owner_name": owner_display,
        "products": product_names or [],
        "platforms": extras.get("platforms") or _default_platforms(),
        "created": _iso_date(row.get("created_at")),
        "lastUpdate": _iso_dt(row.get("updated_at")),
        "tickets": tickets,
        "ticketsDelta": tickets_delta,
        "untriaged": untr,
        "untriagedDelta": float(untriaged_delta),
        "bugs": row.get("bugs_count") or 0,
        "ticketsNoBug": row.get("tickets_no_task_count") or 0,
        "trend": extras.get("trend_spark") or sparkline_series([]),
        "untriagedTrend": extras.get("untriaged_spark") or sparkline_series([]),
        "sla": 0.93 if not breach else 0.72,
        "slaBreach": 1 if breach else 0,
        "tags": list(row.get("tags") or []),
        # DB verbatim (frontend adapter / tools)
        "db_status": row.get("status"),
        "db_priority": row.get("priority"),
    }


def _default_platforms() -> list[str]:
    return ["mobile", "web"]


def _iso_date(dt: datetime | date | None) -> str:
    if not dt:
        return ""
    if isinstance(dt, datetime):
        return dt.date().isoformat()
    return dt.isoformat()


def _iso_dt(dt: datetime | None) -> str:
    if not dt:
        return ""
    return dt.isoformat(timespec="minutes")
