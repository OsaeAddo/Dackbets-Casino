import logging

from app.dependencies import require_admin_key
from app.models import casino_models
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


@router.get("/stats", tags=["Admin"])
async def get_admin_stats(_: None = Depends(require_admin_key)):
    """Admin: Get casino statistics"""
    # TODO: Implement real stats
    return {
        "total_users": 1500,
        "online_users": 243,
        "total_balance": {"BTC": 125.5, "ETH": 2450.2},
        "daily_volume": {"BTC": 12.3, "ETH": 245.6},
        "house_profit": {"BTC": 2.5, "ETH": 45.2},
    }
