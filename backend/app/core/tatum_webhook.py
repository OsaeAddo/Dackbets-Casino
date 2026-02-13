from typing import Optional

from app.config import settings
from app.models import casino_models
from app.database import db


import logging

logger = logging.getLogger(__name__)


# Background task function
async def process_deposit_event(event: dict):
    """Process deposit event from Tatum."""
    # 1. Extract key data (structure based on Tatum's docs)
    tx_hash = event.get("txId")
    currency = event.get("asset")  # e.g., "ETH"
    amount = float(event.get("amount", 0))
    address = event.get("address")  # The deposit address
    confirmations = event.get("confirmations", 0)

    # 2. Check minimum confirmations (prevents double-spend risk)
    required_confirmations = settings.wallet_min_confirmations.get(currency, 1)
    if confirmations < required_confirmations:
        logger.info(f"Transaction {tx_hash} has only {confirmations} confirmations. Waiting.")
        return  # Tatum will send another webhook when confirmations increase

    # 3. Find which user owns this deposit address
    wallet = await find_wallet_by_address(currency, address)
    if not wallet:
        logger.error(f"No wallet found for {currency} address {address}. Tx: {tx_hash}")
        return

    # 4. Check if this transaction was already processed
    existing_tx = await find_transaction_by_hash(tx_hash)
    if existing_tx:
        logger.info(f"Transaction {tx_hash} already credited.")
        return

    # 5. CREDIT THE USER'S BALANCE
    try:
        # Atomically update the user's balance in their profile
        await casino_models.update_user_balance(
            user_id=wallet["user_id"],
            currency=currency,
            amount=amount
        )

        # 6. Record the successful transaction
        await casino_models.create_transaction(
            user_id=wallet["user_id"],
            transaction_type="deposit",
            currency=currency,
            amount=amount,
            status="confirmed",
            metadata={
                "tx_hash": tx_hash,
                "address": address,
                "confirmations": confirmations,
                "webhook_event_id": event.get("id")
            }
        )

        logger.info(f"Credited {amount} {currency} to user {wallet['user_id']} via tx {tx_hash}")

    except Exception as e:
        logger.error(f"Failed to process deposit {tx_hash}: {e}")
        # Implement alerting here (email, Slack, etc.)

# Helper functions (to be implemented in your database service layer)
async def find_wallet_by_address(currency: str, address: str) -> Optional[dict]:
    """Query your casino_wallets table by currency and address."""
    # Example using your Supabase client:
    result = db.client.table("casino_wallets") \
        .select("user_id, id, tatum_account_id") \
        .eq("currency", currency) \
        .eq("address", address) \
        .execute()
    return result.data[0] if result.data else None

async def find_transaction_by_hash(tx_hash: str) -> Optional[dict]:
    """Check casino_transactions for this blockchain hash."""
    result = db.client.table("casino_transactions") \
        .select("id") \
        .eq("blockchain_tx_hash", tx_hash) \
        .execute()
    return result.data[0] if result.data else None