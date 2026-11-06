import json
from datetime import UTC, datetime
from typing import Any

from app.database import AdminClientUnavailableError, db

# Schema for casino models

class CasinoModels:
    def __init__(self):
        self.admin_client = db.admin_client  # Service-role client (bypasses RLS)

    @property
    def client(self):
        """Service-role client; casino tables deny anon/authenticated access."""
        if not self.admin_client:
            raise AdminClientUnavailableError(
                "SUPABASE_SECRET_KEY is required: casino tables are service-role only"
            )
        return self.admin_client

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
            "created_at": datetime.now(UTC).isoformat()
        }
        client = self.client
        return client.table("casino_profiles").insert(profile_data).execute()
            
    async def get_user_profile(self, user_id: str):
        """Get user's casino profile"""
        client = self.client
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
        client = self.client  
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
        client = self.client
        return client.table("casino_transactions") \
            .update({"status": status, "updated_at": datetime.now(UTC).isoformat()}) \
            .filter("metadata->>tx_hash", "eq", tx_hash) \
            .execute()

    async def delete_transaction_by_hash(self, tx_hash: str):
        """Remove a pending transaction so a failed deposit can be retried."""
        client = self.client
        return client.table("casino_transactions") \
            .delete() \
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
            "created_at": datetime.now(UTC).isoformat(),
            "is_active": True
        }
        client = self.client
        
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
            # Send an object, not a JSON string: the column is jsonb and the
            # webhook dedupe index reads `metadata ->> 'tx_hash'`.
            "metadata": metadata or {},
            "created_at": datetime.now(UTC).isoformat()
        }
        client = self.client
        
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
            "timestamp": datetime.now(UTC).isoformat()
        }
        client = self.client
        
        return client.table("casino_bets").insert(bet_data).execute()
    
    # Public stats (analytics tables)
    async def count_profiles(self) -> int:
        """Count registered casino profiles."""
        client = self.client
        response = client.table("casino_profiles") \
            .select("id", count="exact", head=True) \
            .execute()
        return int(response.count or 0)

    async def get_house_stats_rows(self) -> list[dict[str, Any]]:
        """Every `casino_house_stats` row (one per game/currency pair)."""
        client = self.client
        response = client.table("casino_house_stats") \
            .select("game_type,currency,total_wagered,total_paid,rounds") \
            .execute()
        return response.data or []

    async def get_top_wins(self, limit: int = 5) -> list[dict[str, Any]]:
        """Largest recorded wins, highest first."""
        client = self.client
        response = client.table("casino_bets") \
            .select("user_id,game_type,currency,win_amount") \
            .gt("win_amount", 0) \
            .order("win_amount", desc=True) \
            .limit(limit) \
            .execute()
        return response.data or []

    async def get_recent_bettors(self, since: str) -> list[dict[str, Any]]:
        """Distinct-player inputs for bets placed since ``since``."""
        client = self.client
        response = client.table("casino_bets") \
            .select("game_type,user_id") \
            .gte("timestamp", since) \
            .execute()
        return response.data or []

    async def get_usernames(self, user_ids: list[str]) -> dict[str, str]:
        """Map user ids to public usernames (empty when nobody has one)."""
        if not user_ids:
            return {}
        client = self.client
        response = client.table("casino_profiles") \
            .select("user_id,username") \
            .in_("user_id", user_ids) \
            .execute()
        return {
            row["user_id"]: row["username"]
            for row in response.data or []
            if row.get("user_id") and row.get("username")
        }

    async def get_active_session_user_ids(self, now: str) -> list[str]:
        """Users holding a session that is neither revoked nor expired."""
        client = self.client
        response = client.table("casino_sessions") \
            .select("user_id") \
            .is_("revoked_at", "null") \
            .gt("expires_at", now) \
            .execute()
        return [row["user_id"] for row in response.data or [] if row.get("user_id")]

    async def get_wallet_balances(self) -> list[dict[str, Any]]:
        """Every wallet's currency and balance (one row per user/currency)."""
        client = self.client
        response = client.table("casino_wallets") \
            .select("currency,balance") \
            .execute()
        return response.data or []

    async def get_bets_since(self, since: str) -> list[dict[str, Any]]:
        """Currency and stake for bets placed since ``since``."""
        client = self.client
        response = client.table("casino_bets") \
            .select("currency,amount") \
            .gte("timestamp", since) \
            .execute()
        return response.data or []

    # Sessions (refresh-token rotation)
    async def create_session(
        self,
        user_id: str,
        token_hash: str,
        family_id: str,
        expires_at: str,
    ):
        """Insert a refresh-token session and return the stored row."""
        session_data = {
            "user_id": user_id,
            "token_hash": token_hash,
            "family_id": family_id,
            "expires_at": expires_at,
        }
        client = self.client
        response = client.table("casino_sessions").insert(session_data).execute()
        return response.data[0] if response.data else None

    async def get_session_by_hash(self, token_hash: str):
        """Return the session for a presented refresh token, if any."""
        client = self.client
        response = client.table("casino_sessions") \
            .select("*") \
            .eq("token_hash", token_hash) \
            .execute()
        return response.data[0] if response.data else None

    async def claim_session_for_rotation(self, session_id: str) -> bool:
        """Atomically revoke a session; False means another request won the race."""
        client = self.client
        response = client.table("casino_sessions") \
            .update({"revoked_at": datetime.now(UTC).isoformat()}) \
            .eq("id", session_id) \
            .is_("revoked_at", "null") \
            .execute()
        return bool(response.data)

    async def mark_session_replaced(self, session_id: str, replaced_by: str):
        """Record which session replaced a rotated one (audit trail)."""
        client = self.client
        return client.table("casino_sessions") \
            .update({"replaced_by": replaced_by}) \
            .eq("id", session_id) \
            .execute()

    async def revoke_session_family(self, family_id: str):
        """Revoke every still-active session in a rotation family."""
        client = self.client
        return client.table("casino_sessions") \
            .update({"revoked_at": datetime.now(UTC).isoformat()}) \
            .eq("family_id", family_id) \
            .is_("revoked_at", "null") \
            .execute()

    async def revoke_session(self, session_id: str):
        """Revoke a single session (sign-out of this device)."""
        client = self.client
        return client.table("casino_sessions") \
            .update({"revoked_at": datetime.now(UTC).isoformat()}) \
            .eq("id", session_id) \
            .is_("revoked_at", "null") \
            .execute()

    async def prune_sessions(self, cutoff: str) -> int:
        """Delete rows that expired or were revoked before ``cutoff``.

        Active sessions are never touched. Revoked rows are kept until the
        retention window passes so replay detection still recognises them.
        """
        client = self.client
        expired = client.table("casino_sessions") \
            .delete() \
            .lt("expires_at", cutoff) \
            .execute()
        revoked = client.table("casino_sessions") \
            .delete() \
            .lt("revoked_at", cutoff) \
            .execute()
        return len(expired.data or []) + len(revoked.data or [])

    # House Stats
    async def update_house_stats(
        self,
        game_type: str,
        currency: str,
        amount_wagered: float,
        amount_paid: float
    ):
        """Update house statistics"""
        client = self.client
        
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