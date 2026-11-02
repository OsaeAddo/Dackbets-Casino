import logging
import uuid
from datetime import UTC, datetime, timedelta

# from tatum_sdk_python import TatumSDK, Network
from app.config import settings
from app.models import casino_models
from supabase import create_client

logger = logging.getLogger(__name__)

class WalletService:
    def __init__(self):
        self.client = create_client(settings.supabase_url, settings.supabase_key)
    
    async def get_or_create_wallet(self, user_id: str, currency: str) -> dict:
        """Get existing wallet or create new one"""
        try:
            response = self.client.table("casino_wallets").select("*").eq(
                "user_id", user_id
            ).eq("currency", currency).execute()
            
            if response.data:
                logger.debug(f"Found the existing wallet: {response} \n with type: {type(response)}")
                return response.data[0]
            
            # Create new wallet
            # TODO: Generate actual blockchain address
            # For now, use a placeholder
            wallet_address = f"{currency}_addr_{uuid.uuid4().hex[:16]}"
            
            wallet_data = {
                "user_id": user_id,
                "currency": currency,
                "address": wallet_address,
                "balance": 0.0,
                "created_at": datetime.now(UTC).isoformat(),
                "is_active": True
            }
            
            result = self.client.table("casino_wallets").insert(wallet_data).execute()
            return result.data[0] if result.data else wallet_data
            
        except Exception as e:
            logger.error(f"Wallet creation error: {e!s}")
            raise
    
    async def create_deposit(self, user_id: str, currency: str, amount: float) -> dict:
        """Create a deposit record"""
        try:
            # Get wallet
            wallet = await self.get_or_create_wallet(user_id, currency)
            
            # Create transaction
            transaction_id = f"dep_{uuid.uuid4().hex[:16]}"
            
            await casino_models.create_transaction(
                user_id=user_id,
                transaction_type="deposit",
                currency=currency,
                amount=amount,
                status="pending",
                metadata={
                    "transaction_id": transaction_id,
                    "wallet_address": wallet["address"]
                }
            )
            
            #Webhooks processor will update balance and transaction status when deposit is confirmed on blockchain
            
            return {
                "transaction_id": transaction_id,
                "currency": currency,
                "amount": amount,
                "deposit_address": wallet["address"],
                "qr_code_url": f"https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={wallet['address']}",
                "expires_at": (datetime.now(UTC) + timedelta(hours=24)).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Deposit creation error: {e!s}")
            raise
    
    async def create_withdrawal(self, user_id: str, currency: str, amount: float, address: str) -> dict:
        """Create a withdrawal request"""
        try:
            # Check balance
            profile = await casino_models.get_user_profile(user_id)
            balance = profile.get("balance", {})
            current_balance = balance.get(currency, 0.0)
            
            if current_balance < amount:
                raise ValueError("Insufficient balance")
            
            # Create transaction
            transaction_id = f"wdr_{uuid.uuid4().hex[:16]}"
            
            await casino_models.create_transaction(
                user_id=user_id,
                transaction_type="withdrawal",
                currency=currency,
                amount=amount,
                status="pending",
                metadata={
                    "transaction_id": transaction_id,
                    "to_address": address
                }
            )
            
            # Deduct balance immediately
            await casino_models.update_user_balance(user_id, currency, -amount)
            
            # TODO: Process actual blockchain withdrawal
            # This would connect to your node/API
            
            return {
                "transaction_id": transaction_id,
                "currency": currency,
                "amount": amount,
                "address": address,
                "status": "pending",
                "estimated_time": "10-30 minutes"
            }
            
        except Exception as e:
            logger.error(f"Withdrawal creation error: {e!s}")
            raise
    
    async def get_user_transactions(self, user_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
        """Get user's transaction history"""
        try:
            response = self.client.table("casino_transactions").select("*").eq(
                "user_id", user_id
            ).order("created_at", desc=True).limit(limit).offset(offset).execute()
            
            return response.data
        except Exception as e:
            logger.error(f"Transactions query error: {e!s}")
            raise
        
wallet_service = WalletService()