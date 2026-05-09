from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.mapping import priority_db_to_ui

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def search(
    session: AsyncSession = Depends(get_db),
    q: str = Query(..., min_length=1),
    type: str = Query("all", description="all|problem|task|ticket"),
    limit: int = Query(10, ge=1, le=40),
):
    pat = f"%{q}%"
    out: dict = {"query": q, "problems": [], "tasks": [], "tickets": []}

    if type in {"all", "problem"}:
        pr = await session.execute(
            text(
                """SELECT short_id::text, title::text, priority::text, status::text FROM problems
                   WHERE title ILIKE :pat OR description ILIKE :pat OR short_id ILIKE :pat
                   ORDER BY updated_at DESC LIMIT :lim"""
            ),
            {"pat": pat, "lim": limit},
        )
        for r in pr.mappings():
            d = dict(r)
            out["problems"].append(
                {
                    "kind": "problem",
                    "id": d["short_id"],
                    "title": d["title"],
                    "priority_ui": priority_db_to_ui(d.get("priority")),
                    "db_status": d.get("status"),
                }
            )

    if type in {"all", "task"}:
        tr = await session.execute(
            text(
                """SELECT short_id::text, title::text, task_type::text, status::text,
                          p.short_id::text AS problem_short_id FROM tasks t
                   JOIN problems p ON p.id = t.problem_id
                   WHERE t.title ILIKE :pat OR t.description ILIKE :pat OR t.short_id ILIKE :pat
                   ORDER BY t.updated_at DESC LIMIT :lim"""
            ),
            {"pat": pat, "lim": limit},
        )
        for r in tr.mappings():
            d = dict(r)
            out["tasks"].append(
                {
                    "kind": "task",
                    "id": d["short_id"],
                    "title": d["title"],
                    "task_type": d["task_type"],
                    "problemId": d["problem_short_id"],
                    "status": d.get("status"),
                }
            )

    if type in {"all", "ticket"}:
        tk = await session.execute(
            text(
                """SELECT short_id::text, COALESCE(summary, left(raw_text, 120))::text AS excerpt,
                       status::text FROM support_tickets
                   WHERE summary ILIKE :pat OR raw_text ILIKE :pat OR short_id ILIKE :pat
                   ORDER BY created_at DESC LIMIT :lim"""
            ),
            {"pat": pat, "lim": limit},
        )
        for r in tk.mappings():
            d = dict(r)
            out["tickets"].append(
                {"kind": "ticket", "id": d["short_id"], "excerpt": d["excerpt"], "status": d.get("status")}
            )

    return {"data": out}
