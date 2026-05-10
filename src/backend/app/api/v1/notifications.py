"""
Notifications API — VECTOR support service.

Уведомления пишутся в таблицу notifications бэкграунд-процессами и вебхуками.
Типы (type): draft_confirmed, draft_rejected, priority_changed, triage_sla_breach,
             spike_alert, support_notes_missing, new_problem.

Каждое уведомление адресовано либо конкретному user_id, либо всей team_id.
Реал-тайм доставка — через WebSocket (не реализован в этом прототипе);
здесь только REST-polling и PATCH /read-all.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_api_key

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    session: AsyncSession = Depends(get_db),
    user_id: str | None = Query(None),
    team_id: str | None = Query(None),
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
):
    clauses = ["TRUE"]
    params: dict = {"lim": limit}

    if user_id:
        clauses.append("(n.user_id = CAST(:uid AS uuid) OR n.team_id IS NOT NULL)")
        params["uid"] = user_id
    if team_id:
        clauses.append("n.team_id = CAST(:tid AS uuid)")
        params["tid"] = team_id
    if unread_only:
        clauses.append("n.is_read = FALSE")

    where = " AND ".join(clauses)
    rows = (
        await session.execute(
            text(
                f"""SELECT n.id::text, n.user_id::text, n.team_id::text,
                       n.type, n.title, n.body,
                       n.entity_type, n.entity_id::text,
                       n.is_read, n.created_at
                    FROM notifications n
                    WHERE {where}
                    ORDER BY n.created_at DESC
                    LIMIT :lim"""
            ),
            params,
        )
    ).mappings().all()

    items = []
    for r in rows:
        d = dict(r)
        items.append({
            "id": d["id"],
            "user_id": d.get("user_id"),
            "team_id": d.get("team_id"),
            "type": d["type"],
            "title": d.get("title"),
            "body": d.get("body"),
            "entity_type": d.get("entity_type"),
            "entity_id": d.get("entity_id"),
            "is_read": bool(d["is_read"]),
            "created_at": d["created_at"].isoformat() if d.get("created_at") else None,
        })

    unread_count = sum(1 for n in items if not n["is_read"])
    return {"data": items, "meta": {"total": len(items), "unread": unread_count}}


@router.patch("/read-all", status_code=204, dependencies=[Depends(require_api_key)])
async def mark_all_read(
    session: AsyncSession = Depends(get_db),
    user_id: str | None = Query(None),
    team_id: str | None = Query(None),
):
    clauses = ["is_read = FALSE"]
    params: dict = {}

    if user_id:
        clauses.append("user_id = CAST(:uid AS uuid)")
        params["uid"] = user_id
    if team_id:
        clauses.append("team_id = CAST(:tid AS uuid)")
        params["tid"] = team_id

    where = " AND ".join(clauses)
    await session.execute(
        text(f"UPDATE notifications SET is_read = TRUE WHERE {where}"),
        params,
    )
    await session.commit()
    return Response(status_code=204)
