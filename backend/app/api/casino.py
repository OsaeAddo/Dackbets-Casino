import logging
from datetime import UTC, datetime

from app.casino_stats import build_casino_state
from app.database import db
from app.schemas import CasinoStateResponse, HealthResponse
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/casino", tags=["Casino"])
logger = logging.getLogger(__name__)


# ============= CASINO ENDPOINTS =============

@router.get("/health", response_model=HealthResponse)
async def casino_health():
    """Check casino health with a cheap Postgres read.

    The old probe called `auth.get_session()`, which never touched the
    database. A failing SELECT now returns 503 so the platform can act on it.
    """
    try:
        db.casino_client.table("casino_house_stats") \
            .select("game_type") \
            .limit(1) \
            .execute()
    except Exception as e:  # noqa: BLE001 - Health boundary: convert every failure into 503
        logger.error("Database health check failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )

    return HealthResponse(
        status="healthy",
        service="crypto-casino",
        timestamp=datetime.now(UTC).isoformat(),
        database="connected",
        casino_open=True
    )

@router.get("/state", response_model=CasinoStateResponse)
async def get_casino_state():
    """Public overview built from real house and bet data."""
    try:
        return await build_casino_state()
    except Exception as e:  # noqa: BLE001 - API boundary: report an unavailable aggregate as 503
        logger.error("Casino state query failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Casino state unavailable",
        )
