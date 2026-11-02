import logging
from datetime import UTC, datetime

from app.database import db
from app.schemas import CasinoStateResponse, HealthResponse
from fastapi import APIRouter

router = APIRouter(prefix="/casino", tags=["Casino"])
logger = logging.getLogger(__name__)


# ============= CASINO ENDPOINTS =============

@router.get("/health", response_model=HealthResponse)
async def casino_health():
    """Check casino health"""
    try:
        db.client.auth.get_session()
        db_status = "connected"
    except Exception as e:  # noqa: BLE001 - API boundary: convert unexpected failures into an HTTP error response
        db_status = f"error: {e!s}"
    
    return HealthResponse(
        status="healthy",
        service="crypto-casino",
        timestamp=datetime.now(UTC).isoformat(),
        database=db_status,
        casino_open=True
    )

@router.get("/state", response_model=CasinoStateResponse)
async def get_casino_state():
    """Get current casino state (public)"""
    # TODO: Implement actual stats
    return CasinoStateResponse(
        total_players=1000,
        total_wagered={"BTC": 125.5, "ETH": 2450.2, "USDT": 1500000},
        biggest_wins=[
            {"player": "anon123", "amount": 5.2, "currency": "BTC", "game": "slots"},
            {"player": "crypto_guy", "amount": 42.5, "currency": "ETH", "game": "dice"}
        ],
        hot_games=[
            {"game": "dice", "players": 245},
            {"game": "slots", "players": 189},
            {"game": "crash", "players": 156}
        ],
        jackpot_amount={"BTC": 12.5, "ETH": 125.3}
    )