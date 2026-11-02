import logging

from app.models import casino_models
from fastapi import APIRouter, Header, HTTPException, status

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)



# ============= ADMIN ENDPOINTS =============

@router.post("users/{user_id}/balance", tags=["Admin"])
async def admin_adjust_balance(
    user_id: str,
    adjustment: dict[str, float],
    authorization: str = Header(None)
):
    """Admin: Adjust user balance"""
    # TODO: Implement admin authentication
    try:
        for currency, amount in adjustment.items():
            await casino_models.update_user_balance(user_id, currency, amount)
        
        return {"message": "Balance updated successfully"}
    except Exception as e:
        logger.error(f"Admin balance error: {e!s}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("stats", tags=["Admin"])
async def get_admin_stats(authorization: str = Header(None)):
    """Admin: Get casino statistics"""
    # TODO: Implement admin authentication and real stats
    return {
        "total_users": 1500,
        "online_users": 243,
        "total_balance": {"BTC": 125.5, "ETH": 2450.2},
        "daily_volume": {"BTC": 12.3, "ETH": 245.6},
        "house_profit": {"BTC": 2.5, "ETH": 45.2}
    }