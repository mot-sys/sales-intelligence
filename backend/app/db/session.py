"""
Database Session Management
Handles database connections and sessions.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator

from app.core.config import get_database_url

# Create async engine
# Railway provides postgresql:// but asyncpg needs postgresql+asyncpg://
# SQLite (dev) doesn't support pool_size / max_overflow — use minimal config
_db_url = get_database_url()
if _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
_is_sqlite = _db_url.startswith("sqlite")

engine = create_async_engine(
    _db_url,
    echo=False,  # Set to True for SQL query logging
    **({} if _is_sqlite else {
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
        "connect_args": {"timeout": 10},  # asyncpg: fail fast if DB unreachable
    }),
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base for models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting database sessions.
    Use in FastAPI route functions.

    Example:
        @app.get("/leads")
        async def get_leads(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def set_rls_customer_id(session: AsyncSession, customer_id: str) -> None:
    """
    P2.9 — Set the PostgreSQL session variable used by RLS policies.

    Call this at the start of any request handler that should benefit from
    row-level security enforcement:

        async def my_endpoint(
            customer_id: str = Depends(get_current_customer_id),
            db: AsyncSession = Depends(get_db),
        ):
            await set_rls_customer_id(db, customer_id)
            ...

    Uses SET LOCAL so the variable is automatically cleared when the
    transaction commits or rolls back (transaction-scoped, safe with pooling).
    """
    from sqlalchemy import text
    # Validate it looks like a UUID before passing to SQL (belt-and-suspenders)
    import re
    if not re.match(r'^[0-9a-f-]{36}$', customer_id.lower()):
        raise ValueError(f"Invalid customer_id for RLS: {customer_id!r}")
    await session.execute(
        text("SET LOCAL app.current_customer_id = :cid"),
        {"cid": customer_id},
    )
