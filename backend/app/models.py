from supabase import create_client
from app.config import settings
from datetime import datetime
from typing import Optional, Dict, Any
import json

# Schema for casino models

class CasinoModels:
    def __init__(self):
        self.client = create_client(settings.supabase_url, settings.supabase_key)
    
    # User Profiles (extends Supabase auth.users)
    async def create_user_profile(self, user_id: str, email: str, username: Optional[str] = None):
        """Create extended user profile in casino_profiles table"""
        profile_data = {
            "user_id": user_id,
            "email": email,
            "username": username or email.split('@')[0],
            "balance": {},
            "total_wagered": {},
            "total_won": {},
            "kyc_status": "pending",
            "level": 1,
            "created_at": datetime.utcnow().isoformat()
        }
        
        return self.client.table("casino_profiles").insert(profile_data).execute()
    
    async def get_user_profile(self, user_id: str):
        """Get user's casino profile"""
        response = self.client.table("casino_profiles").select("*").eq("user_id", user_id).execute()
        
        profile = response.data[0] if response.data else None
        
        # Parse JSON fields if they're strings
        json_fields = ['balance', 'total_wagered', 'total_won']
        for field in json_fields:
            if field in profile and isinstance(profile[field], str):
                try:
                    profile[field] = json.loads(profile[field])
                except json.JSONDecodeError:
                    profile[field] = {}
        return profile
    
    async def update_user_balance(self, user_id: str, currency: str, amount: float):
        """Update user's balance atomically"""
        # Use Supabase RPC for atomic operations
        return self.client.rpc(
            "update_user_balance",
            {
                "p_user_id": user_id,
                "p_currency": currency,
                "p_amount": amount
            }
        ).execute()
        
    async def update_transaction_status(self, tx_hash: str, status: str):
        """Update transaction status after confirmation"""
        return self.client.table("casino_transactions") \
            .update({"status": status, "updated_at": datetime.utcnow().isoformat()}) \
            .filter("metadata->>tx_hash", "eq", tx_hash) \
            .execute()
    
    # Wallets Table
    async def create_wallet(self, user_id: str, currency: str, address: str):
        """Create crypto wallet for user"""
        wallet_data = {
            "user_id": user_id,
            "currency": currency,
            "address": address,
            "balance": 0.0,
            "created_at": datetime.utcnow().isoformat(),
            "is_active": True
        }
        
        return self.client.table("casino_wallets").insert(wallet_data).execute()
    
    # Transactions Table
    async def create_transaction(
        self,
        user_id: str,
        transaction_type: str,
        currency: str,
        amount: float,
        status: str = "pending",
        metadata: Optional[Dict] = None
    ):
        """Create transaction record"""
        tx_data = {
            "user_id": user_id,
            "transaction_type": transaction_type,
            "currency": currency,
            "amount": amount,
            "status": status,
            "metadata": json.dumps(metadata or {}),
            "created_at": datetime.utcnow().isoformat()
        }
        
        return self.client.table("casino_transactions").insert(tx_data).execute()
    
    # Bets Table
    async def create_bet(
        self,
        user_id: str,
        game_type: str,
        currency: str,
        amount: float,
        result: Dict[str, Any],
        win_amount: float
    ):
        """Record a bet"""
        bet_data = {
            "user_id": user_id,
            "game_type": game_type,
            "currency": currency,
            "amount": amount,
            "result": json.dumps(result),
            "win_amount": win_amount,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return self.client.table("casino_bets").insert(bet_data).execute()
    
    # House Stats
    async def update_house_stats(
        self,
        game_type: str,
        currency: str,
        amount_wagered: float,
        amount_paid: float
    ):
        """Update house statistics"""
        return self.client.rpc(
            "update_house_stats",
            {
                "p_game_type": game_type,
                "p_currency": currency,
                "p_wagered": amount_wagered,
                "p_paid": amount_paid
            }
        ).execute()

casino_models = CasinoModels()