import json
from datetime import datetime
from typing import Any

from app.database import db

# Schema for casino models

class CasinoModels:
    def __init__(self):
        self.client = db.client  # Regular client (subject to RLS)
        self.admin_client = db.admin_client  # Admin client (bypasses RLS)
    
    # User Profiles (extends Supabase auth.users)
    async def create_user_profile(self, user_id: str, email: str, username: str | None = None):
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
        client = self.admin_client if self.admin_client else self.client
        return client.table("casino_profiles").insert(profile_data).execute()
            
    async def get_user_profile(self, user_id: str):
        """Get user's casino profile"""
        client = self.admin_client if self.admin_client else self.client
        response = client.table("casino_profiles").select("*").eq("user_id", user_id).execute()
        
        profile = response.data[0] if response.data else None
        if profile is None:
            return None

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
        client = self.admin_client if self.admin_client else self.client  
        return client.rpc(
            "update_user_balance",
            {
                "p_user_id": user_id,
                "p_currency": currency,
                "p_amount": amount
            }
        ).execute()
        
    async def update_transaction_status(self, tx_hash: str, status: str):
        """Update transaction status after confirmation"""
        client = self.admin_client if self.admin_client else self.client
        return client.table("casino_transactions") \
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
        client = self.admin_client if self.admin_client else self.client
        
        return client.table("casino_wallets").insert(wallet_data).execute()
    
    # Transactions Table
    async def create_transaction(
        self,
        user_id: str,
        transaction_type: str,
        currency: str,
        amount: float,
        status: str = "pending",
        metadata: dict | None = None
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
        client = self.admin_client if self.admin_client else self.client
        
        return client.table("casino_transactions").insert(tx_data).execute()
    
    # Bets Table
    async def create_bet(
        self,
        user_id: str,
        game_type: str,
        currency: str,
        amount: float,
        result: dict[str, Any],
        win_amount: float
    ):
        """Record a bet"""
        bet_data = {
            "user_id": user_id,
            "game_type": game_type,
            "currency": currency,
            "amount": amount,
            "result": result,
            "win_amount": win_amount,
            "timestamp": datetime.utcnow().isoformat()
        }
        client = self.admin_client if self.admin_client else self.client
        
        return client.table("casino_bets").insert(bet_data).execute()
    
    # House Stats
    async def update_house_stats(
        self,
        game_type: str,
        currency: str,
        amount_wagered: float,
        amount_paid: float
    ):
        """Update house statistics"""
        client = self.admin_client if self.admin_client else self.client
        
        return client.rpc(
            "update_house_stats",
            {
                "p_game_type": game_type,
                "p_currency": currency,
                "p_wagered": amount_wagered,
                "p_paid": amount_paid
            }
        ).execute()

casino_models = CasinoModels()