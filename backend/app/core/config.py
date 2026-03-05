"""
Application Configuration
Manages all environment variables and settings.
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "Signal Intelligence"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development/staging/production
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/signal_intel"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 300  # 5 minutes
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS — wildcard by default so any frontend domain works out of the box.
    # Override via CORS_ORIGINS env var in production to lock down to specific URLs.
    CORS_ORIGINS: list[str] = ["*"]
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    
    # External APIs - Clay
    CLAY_API_KEY: Optional[str] = None
    CLAY_BASE_URL: str = "https://api.clay.com/v1"
    
    # External APIs - Salesforce
    SALESFORCE_CLIENT_ID: Optional[str] = None
    SALESFORCE_CLIENT_SECRET: Optional[str] = None
    SALESFORCE_USERNAME: Optional[str] = None
    SALESFORCE_PASSWORD: Optional[str] = None
    SALESFORCE_SECURITY_TOKEN: Optional[str] = None
    SALESFORCE_DOMAIN: str = "login"  # or "test" for sandbox
    
    # External APIs - Snitcher
    SNITCHER_API_KEY: Optional[str] = None
    SNITCHER_BASE_URL: str = "https://snitcher.com/api/v2"
    
    # External APIs - HubSpot
    HUBSPOT_ACCESS_TOKEN: Optional[str] = None  # Private App access token
    
    # Anthropic (Claude)
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"

    # OpenAI (legacy — kept for backwards compat, prefer ANTHROPIC_API_KEY)
    OPENAI_API_KEY: Optional[str] = None
    
    # Celery (Task Queue)
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    # Monitoring
    SENTRY_DSN: Optional[str] = None
    
    # ML Model
    ML_MODEL_PATH: str = "./models"
    ML_MODEL_VERSION: str = "v1"
    
    # Sync Settings
    DEFAULT_SYNC_FREQUENCY: str = "2h"  # 2h/6h/daily

    # Alert Engine
    ALERT_STALE_DEAL_DAYS: int = 7           # Days without SF activity → stalled deal alert
    ALERT_INTENT_SPIKE_PAGES: int = 3        # Pages in session → intent spike threshold
    SLACK_WEBHOOK_URL: Optional[str] = None  # Optional Slack alert notifications

    # Webhook Secrets
    SNITCHER_WEBHOOK_SECRET: Optional[str] = None  # HMAC-SHA256 for Snitcher webhooks
    SF_CDC_VERIFY_TOKEN: Optional[str] = None       # Salesforce CDC webhook verify token

    class Config:
        env_file = ".env"
        case_sensitive = True


# Singleton instance
settings = Settings()


# Convenience functions
def is_development() -> bool:
    """Check if running in development mode"""
    return settings.ENVIRONMENT == "development"


def is_production() -> bool:
    """Check if running in production mode"""
    return settings.ENVIRONMENT == "production"


def get_database_url() -> str:
    """Get database URL for SQLAlchemy"""
    return settings.DATABASE_URL


def get_redis_url() -> str:
    """Get Redis URL"""
    return settings.REDIS_URL
