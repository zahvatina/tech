"""
Pytest fixtures для всех тестов VECTOR backend.

Стратегия тестирования: юнит-тесты с замоканной БД (без реального PostgreSQL).
  mock_session — MagicMock с AsyncMock.execute; каждый тест задаёт return_value вручную
                 через FakeResult(rows=[...]) или FakeResult(scalar=N).
  client       — httpx AsyncClient c dependency-override для get_db и require_api_key.
  client_no_auth — тот же клиент, но require_api_key НЕ переопределён (для тестов 401).

FakeResult имитирует SQLAlchemy CursorResult: поддерживает .mappings().all(),
.scalar_one(), .fetchone(), .fetchall() — достаточно для всех raw-SQL запросов.
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock

from app.main import app
from app.api.deps import get_db, require_api_key


class FakeResult:
    """Minimal stand-in for SQLAlchemy CursorResult."""

    def __init__(
        self,
        scalar=None,
        rows: list | None = None,
        fetchall_rows: list | None = None,
    ):
        self._scalar = scalar
        self._rows = rows or []
        self._fetchall = fetchall_rows or []

    def scalar_one(self):
        return self._scalar

    def scalar_one_or_none(self):
        return self._scalar

    def fetchone(self):
        return self._fetchall[0] if self._fetchall else None

    def fetchall(self):
        return self._fetchall

    def mappings(self):
        return self

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None

    def __iter__(self):
        return iter(self._rows)


class FakeRow(dict):
    """Dict that also supports attribute-style access (matches SQLAlchemy RowMapping)."""

    def __getattr__(self, k):
        try:
            return self[k]
        except KeyError:
            raise AttributeError(k)


@pytest.fixture
def mock_session():
    session = MagicMock()
    session.execute = AsyncMock(return_value=FakeResult())
    session.commit = AsyncMock()
    return session


@pytest.fixture
async def client(mock_session):
    async def _get_db():
        yield mock_session

    async def _require_api_key():
        return None

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[require_api_key] = _require_api_key

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
async def client_no_auth(mock_session):
    """Client with real require_api_key (tests auth enforcement)."""

    async def _get_db():
        yield mock_session

    app.dependency_overrides[get_db] = _get_db
    # require_api_key intentionally not overridden

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
