import logging

from app.admin_stats import build_admin_stats
from app.dependencies import require_admin_key
from app.models import casino_models
from app.schemas import AdminStatsResponse
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)


# ============= ADMIN ENDPOINTS =============

@router.post("/users/{user_id}/balance", tags=["Admin"])
async def admin_adjust_balance(
    user_id: str,
    adjustment: dict[str, float],
    _: None = Depends(require_admin_key),
):
    """Admin: Adjust user balance"""
    try:
        for currency, amount in adjustment.items():
            await casino_models.update_user_balance(user_id, currency, amount)

        return {"message": "Balance updated successfully"}
    except Exception as e:  # noqa: BLE001 - API boundary: convert unexpected failures into an HTTP error response
        logger.error("Admin balance error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/stats", response_model=AdminStatsResponse, tags=["Admin"])
async def get_admin_stats(_: None = Depends(require_admin_key)):
    """Admin: real casino statistics from the operational tables."""
    try:
        return await build_admin_stats()
    except Exception as e:  # noqa: BLE001 - API boundary: report an unavailable aggregate as 503
        logger.error("Admin stats query failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin stats unavailable",
        )
