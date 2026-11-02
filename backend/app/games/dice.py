import logging
import random
import uuid
from datetime import datetime
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

class DiceGame:
    def __init__(self):
        self.house_edge = settings.house_edge_dice / 100  # Convert percentage to decimal
    
    def play(self, bet_amount: float, parameters: dict[str, Any]) -> dict[str, Any]:
        """
        Play dice game
        
        Parameters can include:
        - target_number: Number to roll under (1-100)
        - win_chance: Percentage chance to win (1-99)
        """
        try:
            # Extract parameters
            target_number = parameters.get("target_number")
            win_chance = parameters.get("win_chance")
            
            if win_chance is not None:
                # Using win chance mode
                win_chance = float(win_chance)
                if win_chance < 1 or win_chance > 99:
                    raise ValueError("Win chance must be between 1 and 99")
                
                # Calculate multiplier with house edge
                multiplier = (100 / win_chance) * (1 - self.house_edge)
                target_number = win_chance
            elif target_number is not None:
                # Using target number mode
                target_number = float(target_number)
                if target_number < 1 or target_number > 100:
                    raise ValueError("Target number must be between 1 and 100")
                
                win_chance = target_number
                multiplier = (100 / target_number) * (1 - self.house_edge)
            else:
                # Default to 50% chance
                win_chance = 50.0
                multiplier = 2.0 * (1 - self.house_edge)
                target_number = 50.0
            
            # Roll the dice (1-100)
            roll = random.uniform(1, 100)
            
            # Determine win
            win = roll <= target_number
            
            # Calculate win amount
            win_amount = bet_amount * multiplier if win else 0.0
            
            # Generate bet ID
            bet_id = f"dice_{uuid.uuid4().hex[:12]}"
            
            return {
                "bet_id": bet_id,
                "game": "dice",
                "roll": round(roll, 2),
                "target": round(target_number, 2),
                "win_chance": round(win_chance, 2),
                "multiplier": round(multiplier, 4),
                "win": win,
                "win_amount": round(win_amount, 8),
                "house_edge": self.house_edge,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Dice game error: {e!s}")
            raise