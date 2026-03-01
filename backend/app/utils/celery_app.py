"""
Celery Application
Configures the Celery worker with Redis broker and periodic beat schedule.
"""

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings


celery_app = Celery(
    "signal_intel",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.utils.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    # Check for stalled Salesforce deals every 15 minutes
    "check-stalled-deals": {
        "task": "app.utils.tasks.check_stalled_deals",
        "schedule": 900.0,
    },
    # Check for intent spikes from Snitcher signals every hour
    "check-intent-spikes": {
        "task": "app.utils.tasks.check_intent_spikes",
        "schedule": 3600.0,
    },
    # Re-score all recently active leads every 2 hours
    "run-scoring-cycle": {
        "task": "app.utils.tasks.run_scoring_cycle",
        "schedule": 7200.0,
    },
    # Daily digest alert at 8 AM UTC
    "daily-digest": {
        "task": "app.utils.tasks.send_daily_digest",
        "schedule": crontab(hour=8, minute=0),
    },
}
