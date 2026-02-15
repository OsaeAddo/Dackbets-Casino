from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from typing import List, Optional
import logging
from datetime import datetime

from app.models import casino_models
from app.config import settings
from app.dependencies import get_current_user_dep
from app.database import db
from app.games.dice import DiceGame
from app.schemas import (
    GameHistoryResponse, BetResponse, 
    BetRequest, GameType, Currency
)

router = APIRouter(prefix="/games", tags=["Games"])

logger = logging.getLogger(__name__)

# ============= GAME ENDPOINTS =============

@router.post("/bet", response_model=BetResponse)
async def place_bet(
    bet_request: BetRequest,
    background_tasks: BackgroundTasks,
    user = Depends(get_current_user_dep)
):
    """Place a bet on a game"""
    # Validate bet amount
    if bet_request.amount < settings.min_bet_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum bet is {settings.min_bet_amount}"
        )
    
    if bet_request.amount > settings.max_bet_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum bet is {settings.max_bet_amount}"
        )
    
    # Check balance
    profile = user["profile"]
    balance = profile.get("balance", {})
    currency_balance = balance.get(bet_request.currency.value, 0.0)
    
    if currency_balance < bet_request.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient balance"
        )
    
    # Process bet based on game type
    try:
        if bet_request.game_type == GameType.DICE:
            game = DiceGame()
            result = game.play(bet_request.amount, bet_request.parameters)
        else:
            # TODO: Implement other games
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Game {bet_request.game_type} not implemented yet"
            )
        
        # Update balance
        win_amount = result.get("win_amount", 0.0)
        net_change = win_amount - bet_request.amount
        
        # Update in database
        await casino_models.update_user_balance(
            user_id=user["id"],
            currency=bet_request.currency.value,
            amount=net_change
        )
        
        # Record bet
        await casino_models.create_bet(
            user_id=user["id"],
            game_type=bet_request.game_type.value,
            currency=bet_request.currency.value,
            amount=bet_request.amount,
            result=result,
            win_amount=win_amount
        )
        
        # Update house stats (in background)
        background_tasks.add_task(
            casino_models.update_house_stats,
            bet_request.game_type.value,
            bet_request.currency.value,
            bet_request.amount,
            win_amount
        )
        
        # Get updated balance
        updated_profile = await casino_models.get_user_profile(user["id"])
        
        return BetResponse(
            bet_id=result.get("bet_id", ""),
            game_type=bet_request.game_type,
            currency=bet_request.currency,
            amount=bet_request.amount,
            result=result,
            win_amount=win_amount,
            new_balance=updated_profile.get("balance", {}),
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Bet error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/history", response_model=List[GameHistoryResponse])
async def get_game_history(
    limit: int = 50,
    offset: int = 0,
    game_type: Optional[GameType] = None,
    user = Depends(get_current_user_dep)
):
    """Get user's game history"""
    try:
        # Query bets
        query = db.client.table("casino_bets").select("*").eq("user_id", user["id"])
        
        if game_type:
            query = query.eq("game_type", game_type.value)
        
        response = query.order("timestamp", desc=True).limit(limit).offset(offset).execute()
        
        bets = []
        for bet in response.data:
            # Parse result if it's a string
            result_data = bet.get("result", {})
            if isinstance(result_data, str):
                import json
                try:
                    result_data = json.loads(result_data)
                except json.JSONDecodeError:
                    result_data = {}
            bets.append(GameHistoryResponse(
                bet_id=bet.get("id", ""),
                game_type=GameType(bet.get("game_type", "")),
                currency=Currency(bet.get("currency", "")),
                amount=bet.get("amount", 0.0),
                win_amount=bet.get("win_amount", 0.0),
                result=result_data,
                timestamp=bet.get("timestamp", "")
            ))
        
        return bets
    except Exception as e:
        logger.error(f"History error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )