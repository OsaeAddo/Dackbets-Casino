import logging
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from app.models import casino_models
from app.wallets.service import WalletService

logger = logging.getLogger(__name__)

class WebhookProvider(Enum):
    MOCK = "mock"
    TATUM = "tatum"


def _is_duplicate_transaction_error(exc: Exception) -> bool:
    """True when the deposit unique index rejected the insert.

    Two concurrent webhooks can both pass the pre-check. The database is the
    real guard, so the loser of that race must be reported as already
    processed, not as a failure.
    """
    return getattr(exc, "code", None) == "23505" or "23505" in str(exc)

class DepositEvent:
    """Standardized deposit event structure"""
    def __init__(self, 
                 tx_hash: str,
                 currency: str,
                 amount: float,
                 address: str,
                 confirmations: int = 0,
                 provider: str = "mock"):
        self.tx_hash = tx_hash
        self.currency = currency.upper()
        self.amount = amount
        self.address = address
        self.confirmations = confirmations
        self.provider = provider
        self.timestamp = datetime.now(UTC).isoformat()

class WebhookProcessor:
    def __init__(self, provider: WebhookProvider = WebhookProvider.MOCK):
        self.provider = provider
        self.wallet_service = WalletService()
    
    async def process_deposit(self, event: DepositEvent) -> dict[str, Any]:
        """
        Process a deposit webhook event
        1. Find wallet by address
        2. Check if transaction already processed
        3. Verify confirmations
        4. Credit user balance
        5. Update transaction record
        """
        logger.info(f"Processing deposit: {event.tx_hash} ({event.provider})")
        
        # Step 1: Find wallet by address
        wallet = await self._find_wallet_by_address(event.currency, event.address)
        if not wallet:
            logger.error(f"No wallet found for {event.currency} address: {event.address}")
            return {"status": "failed", "reason": "wallet_not_found"}
        
        # Step 2: Check for duplicate transaction
        existing = await self._find_transaction_by_hash(event.tx_hash)
        if existing:
            logger.info(f"Transaction {event.tx_hash} already processed")
            return {"status": "skipped", "reason": "already_processed"}
        
        # Step 3: Verify confirmations
        required_confirmations = self._get_required_confirmations(event.currency)
        if event.confirmations < required_confirmations:
            logger.info(f"Tx {event.tx_hash}: {event.confirmations}/{required_confirmations} confirmations")
            return {
                "status": "pending",
                "confirmations": event.confirmations,
                "required": required_confirmations
            }
        
        # Step 4: Claim the transaction before crediting the balance.
        # The unique partial index on metadata->>'tx_hash' is the arbiter: a
        # concurrent duplicate loses here and is reported as skipped instead of
        # double-crediting the user.
        transaction_metadata = {
            "tx_hash": event.tx_hash,
            "address": event.address,
            "confirmations": event.confirmations,
            "provider": event.provider,
            "processed_at": datetime.now(UTC).isoformat()
        }
        try:
            await casino_models.create_transaction(
                user_id=wallet["user_id"],
                transaction_type="deposit",
                currency=event.currency,
                amount=event.amount,
                status="pending",
                metadata=transaction_metadata
            )
        except Exception as e:  # noqa: BLE001 - Webhook boundary: report failures in the response body
            if _is_duplicate_transaction_error(e):
                logger.info(f"Transaction {event.tx_hash} was already claimed")
                return {"status": "skipped", "reason": "already_processed"}
            logger.error(f"Failed to record deposit {event.tx_hash}: {e!s}")
            return {"status": "failed", "reason": str(e)}

        # Step 5: Credit user balance, then mark the claim confirmed.
        try:
            await casino_models.update_user_balance(
                user_id=wallet["user_id"],
                currency=event.currency,
                amount=event.amount
            )
        except Exception as e:  # noqa: BLE001 - Webhook boundary: report failures in the response body
            logger.error(f"Failed to credit deposit {event.tx_hash}: {e!s}")
            # The balance was not credited, so release the claim and let the
            # provider's retry be processed.
            try:
                await casino_models.delete_transaction_by_hash(event.tx_hash)
            except Exception:
                logger.exception(
                    f"Could not release pending transaction {event.tx_hash}"
                )
            return {"status": "failed", "reason": str(e)}

        # The balance is credited at this point. Never delete the claim now, or
        # a retry could credit the same deposit twice.
        try:
            await casino_models.update_transaction_status(
                event.tx_hash,
                "confirmed"
            )
        except Exception:
            logger.exception(
                f"Deposit {event.tx_hash} credited but its record stays pending"
            )

        logger.info(f"✅ Credited {event.amount} {event.currency} to user {wallet['user_id']}")
        return {
            "status": "confirmed",
            "user_id": wallet["user_id"],
            "amount": event.amount,
            "currency": event.currency,
            "tx_hash": event.tx_hash
        }
    
    async def _find_wallet_by_address(self, currency: str, address: str) -> dict | None:
        """Find wallet by currency and address"""
        from app.database import db
        result = db.casino_client.table("casino_wallets") \
            .select("*") \
            .eq("currency", currency) \
            .eq("address", address) \
            .execute()
        return result.data[0] if result.data else None
    
    async def _find_transaction_by_hash(self, tx_hash: str) -> dict | None:
        """Check if transaction already processed"""
        from app.database import db
        result = db.casino_client.table("casino_transactions") \
            .select("*") \
            .filter("metadata->>tx_hash", "eq", tx_hash) \
            .execute()
        return result.data[0] if result.data else None
    
    def _get_required_confirmations(self, currency: str) -> int:
        """Get required confirmations for currency"""
        from app.config import settings
        return settings.wallet_min_confirmations.get(currency, 1)

# Mock Tatum webhook simulator
class MockTatumWebhook:
    """Simulate Tatum webhook calls for testing"""
    
    def __init__(self, processor: WebhookProcessor):
        self.processor = processor
    
    async def simulate_deposit(self, 
                               currency: str = "ETH",
                               amount: float = 0.1,
                               address: str | None = None,
                               confirmations: int = 12):
        """Simulate a deposit webhook from Tatum"""
        
        import uuid
        tx_hash = f"0x{uuid.uuid4().hex[:64]}"
        
        # If no address provided, get first wallet from DB
        if not address:
            from app.database import db
            result = db.casino_client.table("casino_wallets") \
                .select("address") \
                .eq("currency", currency) \
                .limit(1) \
                .execute()
            address = result.data[0]["address"] if result.data else "0xmock_address"
        
        event = DepositEvent(
            tx_hash=tx_hash,
            currency=currency,
            amount=amount,
            address=address,
            confirmations=confirmations,
            provider="mock"
        )
        
        return await self.processor.process_deposit(event)