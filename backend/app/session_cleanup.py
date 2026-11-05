"""Periodic housekeeping for stale refresh-token sessions.

Expired and revoked rows accumulate in ``casino_sessions`` as sessions rotate.
The API process prunes them on a slow interval instead of relying on a database
scheduler (the project does not enable ``pg_cron``). Deleting is idempotent, so
running the loop in every replica is safe.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from app.config import settings
from app.models import casino_models

logger = logging.getLogger(__name__)


def _cutoff() -> str:
    """Return the ISO timestamp before which rows are considered stale."""
    return (
        datetime.now(UTC) - timedelta(days=settings.session_retention_days)
    ).isoformat()


async def prune_stale_sessions() -> int:
    """Delete sessions that expired or were revoked before the retention window."""
    cutoff = _cutoff()
    deleted = await casino_models.prune_sessions(cutoff)
    logger.info("Pruned %s stale refresh session(s) older than %s", deleted, cutoff)
    return deleted


async def run_session_cleanup() -> None:
    """Prune stale sessions now, then repeat on the configured interval.

    The loop is cancelled on application shutdown and must never take the API
    down, so database errors are logged and retried on the next tick.
    """
    while True:
        try:
            await prune_stale_sessions()
        except Exception as e:  # noqa: BLE001 - housekeeping: a failed prune must not stop the API
            logger.warning("Session cleanup failed: %s", e)
        await asyncio.sleep(settings.session_cleanup_interval_seconds)
