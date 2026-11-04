# app/api/webhooks.py
import json
import logging
import uuid

from app.config import settings
from app.core.tatum_webhook import DepositEvent, WebhookProcessor, WebhookProvider
from app.core.webhook_auth import verify_webhook_signature
from app.dependencies import require_admin_key
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = logging.getLogger(__name__)


async def _require_test_webhooks() -> None:
    """Hide the simulator outside local development."""
    if not settings.enable_test_webhooks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not Found",
        )


def _reject_unverified_webhook(raw_body: bytes, headers) -> None:
    if not settings.webhook_hmac_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook signing is not configured",
        )
    if not verify_webhook_signature(
        raw_body,
        headers,
        settings.webhook_hmac_secret,
    ):
        logger.warning("Rejected webhook with a missing or invalid signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )


# Public endpoint for receiving Tatum webhooks (LIVE)
@router.post("/tatum/deposit")
async def tatum_deposit_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Receive deposit notifications from Tatum.

    The signature is checked against the raw body before it is parsed, so a
    caller cannot fabricate deposits without the shared secret.
    """
    raw_body = await request.body()
    _reject_unverified_webhook(raw_body, request.headers)

    try:
        payload = json.loads(raw_body)
        logger.debug("Tatum webhook received: %s", payload.get("txId"))

        # Convert Tatum payload to standardized event
        event = DepositEvent(
            tx_hash=payload["txId"],
            currency=payload.get("asset", "ETH"),
            amount=float(payload.get("amount", 0)),
            address=payload["address"],
            confirmations=int(payload.get("confirmations", 0)),
            provider="tatum",
        )

        # Process in background
        processor = WebhookProcessor(provider=WebhookProvider.TATUM)
        background_tasks.add_task(processor.process_deposit, event)

        return {"status": "processing", "tx_id": event.tx_hash}

    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 - API boundary: convert unexpected failures into an HTTP error response
        logger.error("Tatum webhook error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload",
        )


# TESTING ENDPOINTS - Mock webhook simulator
# Disabled unless ENABLE_TEST_WEBHOOKS=true, and always admin-key protected.
@router.post(
    "/test/deposit",
    dependencies=[Depends(_require_test_webhooks), Depends(require_admin_key)],
)
async def test_deposit_webhook(
    request: Request,
):
    """Simulate a deposit webhook for testing"""
    payload = await request.json()

    event = DepositEvent(
        tx_hash=payload.get("tx_hash", f"0x{uuid.uuid4().hex[:64]}"),
        currency=payload.get("currency", "ETH"),
        amount=float(payload.get("amount", 0)),
        address=payload.get("address", ""),
        confirmations=payload.get("confirmations", 12),
        provider="mock",
    )

    processor = WebhookProcessor(provider=WebhookProvider.MOCK)
    result = await processor.process_deposit(event)

    return result


@router.get(
    "/test/last",
    dependencies=[Depends(_require_test_webhooks), Depends(require_admin_key)],
)
async def get_last_test_deposit():
    """Helper to quickly test with fixed values"""
    from app.core.tatum_webhook import MockTatumWebhook

    processor = WebhookProcessor(provider=WebhookProvider.MOCK)
    mock = MockTatumWebhook(processor)

    return await mock.simulate_deposit(
        currency="ETH",
        amount=0.05,
        confirmations=12,
    )
