from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db

products_router = APIRouter(prefix="/products", tags=["products"])


@products_router.get("")
async def list_products(session: AsyncSession = Depends(get_db)):
    res = await session.execute(
        text("SELECT id::text, name, code, is_active FROM products WHERE is_active = TRUE ORDER BY name")
    )
    rows = res.mappings().all()
    return {"data": [dict(r) for r in rows]}


teams_router = APIRouter(prefix="/teams", tags=["teams"])


@teams_router.get("")
async def list_teams(session: AsyncSession = Depends(get_db)):
    res = await session.execute(
        text(
            """SELECT id::text, name, slug, color, jira_project_key
               FROM teams ORDER BY name"""
        )
    )
    return {"data": [dict(r) for r in res.mappings().all()]}


users_router = APIRouter(prefix="/users", tags=["users"])


@users_router.get("")
async def list_users(session: AsyncSession = Depends(get_db)):
    res = await session.execute(
        text(
            """SELECT u.id::text, u.email, u.name, u.role, u.team_id::text, t.name AS team_name
               FROM users u
               LEFT JOIN teams t ON t.id = u.team_id
               WHERE u.is_active = TRUE
               ORDER BY u.name"""
        )
    )
    return {"data": [dict(r) for r in res.mappings().all()]}
