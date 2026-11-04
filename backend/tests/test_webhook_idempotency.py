"""Deposit idempotency: the unique tx_hash index must win races, not the app."""

import pytest
from app.core.tatum_webhook import DepositEvent, WebhookProcessor
from app.models import casino_models


class DuplicateKeyError(Exception):
    """Mimics postgrest.APIError for a unique-index violation."""

    code = "23505"


def _event(tx_hash: str = "0xabc", amount: float = 1.5) -> DepositEvent:
    return DepositEvent(
        tx_hash=tx_hash,
        currency="ETH",
        amount=amount,
        address="0xwallet",
        confirmations=12,
        provider="tatum",
    )


@pytest.fixture
def processor(monkeypatch):
    instance = WebhookProcessor()

    async def fake_find_wallet(currency, address):
        return {"user_id": "user-1"}

    async def fake_find_transaction(tx_hash):
        # Both racing webhooks see "not processed" at the pre-check.
        return None

    monkeypatch.setattr(instance, "_find_wallet_by_address", fake_find_wallet)
    monkeypatch.setattr(instance, "_find_transaction_by_hash", fake_find_transaction)
    return instance


@pytest.mark.asyncio
async def test_deposit_is_claimed_before_the_balance_is_credited(
    processor, monkeypatch
):
    calls = []

    async def create_transaction(**kwargs):
        calls.append(("create", kwargs["status"], kwargs["metadata"]["tx_hash"]))

    async def update_user_balance(**kwargs):
        calls.append(("balance", kwargs["amount"]))

    async def update_transaction_status(tx_hash, status):
        calls.append(("status", status))

    monkeypatch.setattr(casino_models, "create_transaction", create_transaction)
    monkeypatch.setattr(casino_models, "update_user_balance", update_user_balance)
    monkeypatch.setattr(
        casino_models, "update_transaction_status", update_transaction_status
    )

    result = await processor.process_deposit(_event())

    assert result["status"] == "confirmed"
    assert calls == [
        ("create", "pending", "0xabc"),
        ("balance", 1.5),
        ("status", "confirmed"),
    ]


@pytest.mark.asyncio
async def test_duplicate_insert_is_skipped_and_never_credits_again(
    processor, monkeypatch
):
    balance_calls = []

    async def create_transaction(**kwargs):
        raise DuplicateKeyError("duplicate key value violates unique constraint")

    async def update_user_balance(**kwargs):
        balance_calls.append(kwargs)

    monkeypatch.setattr(casino_models, "create_transaction", create_transaction)
    monkeypatch.setattr(casino_models, "update_user_balance", update_user_balance)

    result = await processor.process_deposit(_event())

    assert result == {"status": "skipped", "reason": "already_processed"}
    assert balance_calls == []


@pytest.mark.asyncio
async def test_failed_credit_releases_the_claim_for_a_retry(processor, monkeypatch):
    deleted = []

    async def create_transaction(**kwargs):
        return None

    async def update_user_balance(**kwargs):
        raise RuntimeError("balance RPC failed")

    async def delete_transaction_by_hash(tx_hash):
        deleted.append(tx_hash)

    monkeypatch.setattr(casino_models, "create_transaction", create_transaction)
    monkeypatch.setattr(casino_models, "update_user_balance", update_user_balance)
    monkeypatch.setattr(
        casino_models, "delete_transaction_by_hash", delete_transaction_by_hash
    )

    result = await processor.process_deposit(_event())

    assert result["status"] == "failed"
    assert deleted == ["0xabc"]


@pytest.mark.asyncio
async def test_credited_deposit_is_never_released_if_status_update_fails(
    processor, monkeypatch
):
    deleted = []
    balance_calls = []

    async def create_transaction(**kwargs):
        return None

    async def update_user_balance(**kwargs):
        balance_calls.append(kwargs)

    async def update_transaction_status(tx_hash, status):
        raise RuntimeError("update failed")

    async def delete_transaction_by_hash(tx_hash):
        deleted.append(tx_hash)

    monkeypatch.setattr(casino_models, "create_transaction", create_transaction)
    monkeypatch.setattr(casino_models, "update_user_balance", update_user_balance)
    monkeypatch.setattr(
        casino_models, "update_transaction_status", update_transaction_status
    )
    monkeypatch.setattr(
        casino_models, "delete_transaction_by_hash", delete_transaction_by_hash
    )

    result = await processor.process_deposit(_event())

    assert result["status"] == "confirmed"
    assert len(balance_calls) == 1
    assert deleted == []
