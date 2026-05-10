"""
Resolve helpers: принимают identifier (UUID-строка или human-readable short_id вида PRB-218,
BUG-42, TKT-1001) и возвращают внутренний UUID объекта или None если не найден.

Используется во всех endpoint-ах, которые принимают {identifier} в пути — это позволяет
и фронтенду, и внешним клиентам обращаться по удобному short_id без знания UUID.
"""
from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.mapping import is_uuid


async def resolve_problem_uuid(session: AsyncSession, identifier: str) -> uuid.UUID | None:
    if is_uuid(identifier):
        q = text("SELECT id FROM problems WHERE id = CAST(:id AS uuid)")
        row = await session.execute(q, {"id": identifier})
    else:
        q = text("SELECT id FROM problems WHERE short_id = :sid")
        row = await session.execute(q, {"sid": identifier})
    return row.scalar_one_or_none()


async def resolve_ticket_uuid(session: AsyncSession, identifier: str) -> uuid.UUID | None:
    if is_uuid(identifier):
        q = text("SELECT id FROM support_tickets WHERE id = CAST(:id AS uuid)")
        row = await session.execute(q, {"id": identifier})
    else:
        q = text("SELECT id FROM support_tickets WHERE short_id = :sid")
        row = await session.execute(q, {"sid": identifier})
    return row.scalar_one_or_none()


async def resolve_task_uuid(session: AsyncSession, identifier: str) -> uuid.UUID | None:
    if is_uuid(identifier):
        q = text("SELECT id FROM tasks WHERE id = CAST(:id AS uuid)")
        row = await session.execute(q, {"id": identifier})
    else:
        q = text("SELECT id FROM tasks WHERE short_id = :sid")
        row = await session.execute(q, {"sid": identifier})
    return row.scalar_one_or_none()
