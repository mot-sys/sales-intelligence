"""
Shared pytest fixtures for Signal Intelligence backend tests.

Uses an in-memory SQLite database so no running PostgreSQL instance is needed.
Every test function receives a fresh, rolled-back session so tests don't
interfere with each other.

Strategy
--------
1. A module-level ``TEST_ENGINE`` (SQLite in-memory) is created once.
2. ``setup_tables`` (session-scoped, autouse) creates all ORM tables on that
   engine before any test runs, and drops them afterwards.
3. Every test gets a ``db`` fixture — an ``AsyncSession`` that is always
   rolled back, regardless of whether the test committed.
4. The HTTPX ``client`` fixture overrides FastAPI's ``get_db`` dependency so
   all requests use the same test session.
"""

# ── Environment must be patched BEFORE any app modules are imported ──────────
import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault(
    "SECRET_KEY",
    "test-secret-key-do-not-use-in-production-xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
)
os.environ.setdefault("ENVIRONMENT", "testing")

# ── Standard imports ─────────────────────────────────────────────────────────
import asyncio
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# ── App imports (after env patch) ────────────────────────────────────────────
from app.db.session import Base, get_db  # noqa: E402
from app.db.models import Customer, User  # noqa: E402
from app.core.security import get_password_hash, create_access_token  # noqa: E402
from app.main import app  # noqa: E402

# ── Test engine (single in-memory SQLite for the full test session) ───────────
TEST_ENGINE = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    echo=False,
    connect_args={"check_same_thread": False},
)


# ── Table setup / teardown (session-scoped, runs once per pytest invocation) ──

@pytest.fixture(scope="session", autouse=True)
def setup_tables():
    """Create all ORM tables on the test engine before tests; drop after."""

    async def _create():
        async with TEST_ENGINE.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def _drop():
        async with TEST_ENGINE.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await TEST_ENGINE.dispose()

    asyncio.run(_create())
    yield
    asyncio.run(_drop())


# ── Per-test database session ─────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """
    Async SQLAlchemy session wired to the in-memory SQLite engine.
    Always rolls back at the end so every test starts with a clean state.
    """
    TestingSession = async_sessionmaker(
        TEST_ENGINE,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with TestingSession() as session:
        yield session
        await session.rollback()


# ── HTTPX test client with DB override ───────────────────────────────────────

@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    HTTPX async client bound to the FastAPI app.
    Overrides ``get_db`` so every request uses the same test session.
    """

    async def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)


# ── Seeded customer fixture ───────────────────────────────────────────────────

@pytest_asyncio.fixture
async def customer(db: AsyncSession) -> Customer:
    """A Customer (org) row pre-seeded in the test database."""
    c = Customer(
        id=uuid.uuid4(),
        name="Test Org",
        email="org@test.example",
        password_hash=get_password_hash("TestPass!1"),
        plan="starter",
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@pytest_asyncio.fixture
async def customer_user(db: AsyncSession, customer: Customer) -> User:
    """An owner User row for the test customer."""
    u = User(
        id=uuid.uuid4(),
        customer_id=customer.id,
        email=customer.email,
        name=customer.name,
        password_hash=customer.password_hash,
        role="owner",
        is_active=True,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


# ── Auth headers fixture ──────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def auth_headers(customer: Customer) -> dict:
    """
    JWT Authorization header for the test customer.
    Uses the new token format: {"sub": user_id, "cid": customer_id, "role": ...}
    For tests that don't need a real User row, sub == cid == customer.id.
    """
    token = create_access_token(
        {"sub": str(customer.id), "cid": str(customer.id), "role": "owner"}
    )
    return {"Authorization": f"Bearer {token}"}
