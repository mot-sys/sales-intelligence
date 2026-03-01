"""
Database Session Management
Handles database connections and sessions.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator

from app.core.config import get_database_url

# Create async engine
# SQLite (dev) doesn't support pool_size / max_overflow — use minimal config
_db_url = get_database_url()
_is_sqlite = _db_url.startswith("sqlite")

engine = create_async_engine(
    _db_url,
    echo=False,  # Set to True for SQL query logging
    **({} if _is_sqlite else {"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20}),
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
