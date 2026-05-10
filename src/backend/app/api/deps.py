"""
FastAPI dependencies shared across all routers.

  get_db          — yields AsyncSession per request (SQLAlchemy async); auto-closes after response.
  require_api_key — header guard: X-API-Key must equal settings.api_key (simple shared-secret auth).
                    Inject via dependencies=[Depends(require_api_key)] or as a function parameter.
"""
from collections.abc import AsyncGenerator

from fastapi import Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def require_api_key(x_api_key: str | None = Header(None, alias="X-API-Key")) -> None:
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
