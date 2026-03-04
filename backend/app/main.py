"""
Main FastAPI Application
Entry point for the Signal Intelligence API.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

import uuid
from app.core.config import settings, is_production
from app.api import leads, analysis, outbound, connections, auth, alerts, webhooks, chat, reports, cmt
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"📊 Environment: {settings.ENVIRONMENT}")
    
    # Create / migrate database tables (create_all is idempotent — safe in all envs)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ DB tables ensured")
    except Exception as e:
        print(f"⚠️  create_all failed: {e}")

    # Seed the dev customer so the FK constraint on integrations/leads is satisfied
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
                print("✅ Dev customer seeded")
    except Exception as e:
        print(f"⚠️  Dev customer seed skipped: {e}")

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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,   # App uses JWT headers, not cookies — wildcard origin is safe
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
    """Detailed health check"""
    # TODO: Add checks for database, Redis, external APIs
    return {
        "status": "healthy",
        "checks": {
            "database": "ok",
            "redis": "ok",
            "integrations": "ok"
        }
    }


# API Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(leads.router, prefix="/api/leads", tags=["Leads"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(outbound.router, prefix="/api/outbound", tags=["Outbound"])
app.include_router(connections.router, prefix="/api/connections", tags=["Connections"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(settings_api.router, prefix="/api/settings", tags=["Settings"])
app.include_router(reports.router, prefix="/api/reports/weekly", tags=["Reports"])
app.include_router(cmt.router, prefix="/api/cmt", tags=["CMT"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=not is_production(),
        workers=settings.WORKERS if is_production() else 1,
    )
