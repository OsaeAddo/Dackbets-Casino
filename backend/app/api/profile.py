# app/api/profile.py
import logging
from datetime import UTC, datetime

from app.database import db
from app.dependencies import get_current_user_dep
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/profile", tags=["Profile"])
logger = logging.getLogger(__name__)

@router.get("/stats")
async def get_user_stats(user = Depends(get_current_user_dep)):
    """Get user's gaming statistics"""
    try:
        user_id = user.id
        
        # Get all user bets
        bets_response = db.client.table("casino_bets") \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()
        
        bets = bets_response.data if bets_response.data else []
        
        # Calculate stats
        total_bets = len(bets)
        
        # Calculate wagered and won by currency
        total_wagered = {}
        total_won = {}
        biggest_win = {"amount": 0, "currency": "ETH", "game": ""}
        
        for bet in bets:
            currency = bet.get("currency", "ETH")
            amount = bet.get("amount", 0)
            win_amount = bet.get("win_amount", 0)
            
            # Update wagered
            total_wagered[currency] = total_wagered.get(currency, 0) + amount
            
            # Update won
            total_won[currency] = total_won.get(currency, 0) + win_amount
            
            # Check for biggest win
            if win_amount > biggest_win["amount"]:
                biggest_win = {
                    "amount": win_amount,
                    "currency": currency,
                    "game": bet.get("game_type", "unknown")
                }
        
        # Calculate win rate (bets where win_amount > 0)
        winning_bets = sum(1 for bet in bets if bet.get("win_amount", 0) > 0)
        win_rate = (winning_bets / total_bets * 100) if total_bets > 0 else 0
        
        # Get user profile for level and join date
        profile_response = db.client.table("casino_profiles") \
            .select("level, created_at") \
            .eq("user_id", user_id) \
            .execute()
        
        profile = profile_response.data[0] if profile_response.data else {}
        
        # Calculate level and XP (you can adjust this formula)
        level = profile.get("level", 1)
        # Simple XP calculation: each bet = 10 XP, each win = +5 XP
        xp = (total_bets * 10) + (winning_bets * 5)
        next_level_xp = level * 100  # Level 1: 100, Level 2: 200, etc.
        
        # Determine rank based on level
        rank = "Bronze"
        if level >= 10:
            rank = "Silver"
        if level >= 25:
            rank = "Gold"
        if level >= 50:
            rank = "Platinum"
        if level >= 100:
            rank = "Diamond"
        
        return {
            "totalBets": total_bets,
            "totalWagered": total_wagered,
            "totalWon": total_won,
            "biggestWin": biggest_win,
            "winRate": round(win_rate, 2),
            "level": level,
            "xp": xp,
            "nextLevelXp": next_level_xp,
            "rank": rank,
            "joinDate": profile.get("created_at", datetime.now(UTC).isoformat())
        }
        
    except Exception as e:  # noqa: BLE001 - API boundary: convert unexpected failures into an HTTP error response
        logger.error(f"Failed to get user stats: {e!s}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/activity")
async def get_user_activity(
    limit: int = 10,
    user = Depends(get_current_user_dep)
):
    """Get user's recent activity"""
    try:
        user_id = user.id
        
        # Get recent bets
        bets_response = db.client.table("casino_bets") \
            .select("id, game_type, currency, amount, win_amount, timestamp") \
            .eq("user_id", user_id) \
            .order("timestamp", desc=True) \
            .limit(limit) \
            .execute()
        
        # Get recent transactions
        tx_response = db.client.table("casino_transactions") \
            .select("id, transaction_type, currency, amount, status, created_at") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        
        # Format bets as activity
        bet_activities = []
        for bet in bets_response.data or []:
            bet_activities.append({
                "id": bet.get("id"),
                "type": "win" if bet.get("win_amount", 0) > 0 else "bet",
                "amount": bet.get("amount", 0),
                "currency": bet.get("currency", "ETH"),
                "timestamp": bet.get("timestamp"),
                "details": f"{bet.get('game_type', 'game')} • {bet.get('win_amount', 0)} won" if bet.get("win_amount", 0) > 0 else bet.get('game_type')
            })
        
        # Format transactions as activity
        tx_activities = []
        for tx in tx_response.data or []:
            if tx.get("status") == "confirmed":
                tx_activities.append({
                    "id": tx.get("id"),
                    "type": tx.get("transaction_type"),
                    "amount": tx.get("amount", 0),
                    "currency": tx.get("currency", "ETH"),
                    "timestamp": tx.get("created_at"),
                    "details": tx.get("status")
                })
        
        # Combine and sort by timestamp
        all_activities = bet_activities + tx_activities
        all_activities.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        return all_activities[:limit]
        
    except Exception as e:  # noqa: BLE001 - API boundary: convert unexpected failures into an HTTP error response
        logger.error(f"Failed to get user activity: {e!s}")
        raise HTTPException(status_code=400, detail=str(e))