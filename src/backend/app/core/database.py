from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

_engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
)
async_session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
