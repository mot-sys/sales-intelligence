"""
Main FastAPI Application
Entry point for the Signal Intelligence API.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pathlib import Path
from contextlib import asynccontextmanager
import time
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

import uuid
from app.core.config import settings, is_production
from app.api import leads, analysis, connections, auth, alerts, webhooks, chat, reports, cmt, workflows, gtm, accounts, team, alert_rules, board
from app.api import settings as settings_api
from app.db.session import engine, Base, AsyncSessionLocal


# Initialize Sentry for error tracking (production only)
if is_production() and settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
        environment=settings.ENVIRONMENT,
    )


def _validate_startup_config():
    """Log warnings for unsafe or missing configuration — never blocks startup."""
    if settings.SECRET_KEY == "your-secret-key-change-in-production":
        print("⚠️  WARNING: SECRET_KEY is the placeholder default. Set a random 64-byte hex string via SECRET_KEY env var.")

    if is_production():
        if not settings.FRONTEND_URL:
            print("⚠️  WARNING: FRONTEND_URL not set — CORS will deny all cross-origin requests.")
        if not settings.CREDENTIAL_ENCRYPTION_KEY:
            print("⚠️  WARNING: CREDENTIAL_ENCRYPTION_KEY not set — using temp in-memory key. Credentials won't survive restart.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"📊 Environment: {settings.ENVIRONMENT}")

    # Outer safety net — nothing inside startup can prevent yield from being reached
    try:
        _validate_startup_config()

        # Create / migrate database tables (create_all is idempotent — safe in all envs)
        print("⏳ Connecting to database...")
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("✅ DB tables ensured")
        except Exception as e:
            print(f"⚠️  create_all failed (continuing anyway): {type(e).__name__}: {e}")

        # Enable pgvector and add embedding columns to existing tables (all idempotent)
        try:
            from sqlalchemy import text
            async with engine.begin() as conn:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                await conn.execute(text(
                    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS embedding vector(1536)"
                ))
                await conn.execute(text(
                    "ALTER TABLE salesforce_opportunities ADD COLUMN IF NOT EXISTS embedding vector(1536)"
                ))
                await conn.execute(text(
                    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS embedding vector(1536)"
                ))
                # HNSW indexes for fast cosine similarity search
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_leads_embedding "
                    "ON leads USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL"
                ))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_sf_opp_embedding "
                    "ON salesforce_opportunities USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL"
                ))
            print("✅ pgvector extension + embedding columns ready")
        except Exception as e:
            print(f"⚠️  pgvector setup skipped: {type(e).__name__}: {e}")

        # Seed the default customer so the FK constraint on integrations/leads is satisfied
        print("⏳ Seeding default customer...")
        try:
            from app.db.models import Customer
            from app.core.security import TEMP_CUSTOMER_ID
            from sqlalchemy import select as sa_select
            dev_id = uuid.UUID(TEMP_CUSTOMER_ID)
            async with AsyncSessionLocal() as session:
                exists = await session.scalar(sa_select(Customer).where(Customer.id == dev_id))
                if not exists:
                    session.add(Customer(
                        id=dev_id,
                        name="Dev User",
                        email="dev@example.com",
                    ))
                    await session.commit()
                    print("✅ Default customer seeded")
        except Exception as e:
            print(f"⚠️  Default customer seed skipped: {type(e).__name__}: {e}")

    except Exception as e:
        print(f"🔴 Unexpected startup error (uvicorn will still serve): {type(e).__name__}: {e}")

    print("✅ Startup complete — serving requests")
    yield

    # Shutdown
    print("👋 Shutting down...")
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered sales intelligence platform",
    lifespan=lifespan,
    redirect_slashes=False,  # Prevents 307 redirects when Vercel proxies without trailing slash
    docs_url="/docs" if not is_production() else None,  # Disable docs in production
    redoc_url="/redoc" if not is_production() else None,
)


# Middleware
# ---------

# CORS — uses FRONTEND_URL env var in production; falls back to wildcard in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,   # App uses JWT headers, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add X-Process-Time header to responses"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    return response


# Exception handlers
# ------------------

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Custom 404 handler"""
    return JSONResponse(
        status_code=404,
        content={
            "detail": "Resource not found",
            "path": str(request.url.path)
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Custom 500 handler — exposes error in dev for debugging"""
    import traceback
    err = traceback.format_exc()
    print("500 ERROR:", err)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": str(exc) if not is_production() else "Something went wrong.",
            "trace": err if not is_production() else None,
        }
    )


# Routes
# ------

@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "healthy",
        "environment": settings.ENVIRONMENT
    }


@app.get("/health")
async def health_check():
    """Liveness probe — always 200 if uvicorn is alive. Used by Railway healthcheck."""
    return {"status": "healthy", "environment": settings.ENVIRONMENT}


@app.get("/health/db")
async def db_health_check():
    """Deep health check with DB connectivity probe (not used for Railway healthcheck)."""
    import asyncio
    from sqlalchemy import text
    db_status = "ok"
    db_error  = None
    try:
        async with asyncio.timeout(5):
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
    except TimeoutError:
        db_status = "timeout"
        db_error  = "DB query exceeded 5 s"
    except Exception as exc:
        db_status = "error"
        db_error  = str(exc)[:200]

    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "checks": {
            "database": db_status,
            **({"database_error": db_error} if db_error else {}),
        },
    }


# API Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(leads.router, prefix="/api/leads", tags=["Leads"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(connections.router, prefix="/api/connections", tags=["Connections"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(settings_api.router, prefix="/api/settings", tags=["Settings"])
app.include_router(reports.router, prefix="/api/reports/weekly", tags=["Reports"])
app.include_router(cmt.router, prefix="/api/cmt", tags=["CMT"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["Workflows"])
app.include_router(gtm.router, prefix="/api/gtm", tags=["GTM"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(team.router,        prefix="/api/team",         tags=["Team"])
app.include_router(alert_rules.router, prefix="/api/alert-rules", tags=["Alert Rules"])
app.include_router(board.router,       prefix="/api/board",       tags=["Board"])


# ── Serve Vite frontend (production) ─────────────────────────────────────────
# The root Dockerfile copies the built React app into /app/frontend_dist.
# This catch-all serves index.html for all non-API paths (React Router SPA).
_FRONTEND = Path("/app/frontend_dist")
if _FRONTEND.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def _serve_spa(full_path: str):
        f = _FRONTEND / full_path
        return FileResponse(str(f if f.is_file() else _FRONTEND / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=not is_production(),
        workers=settings.WORKERS if is_production() else 1,
    )
