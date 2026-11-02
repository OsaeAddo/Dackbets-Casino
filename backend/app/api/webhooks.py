# app/api/webhooks.py
import logging
import uuid

from app.core.tatum_webhook import DepositEvent, WebhookProcessor, WebhookProvider
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = logging.getLogger(__name__)

# Public endpoint for receiving Tatum webhooks (LIVE)
@router.post("/tatum/deposit")
async def tatum_deposit_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """Receive deposit notifications from Tatum"""
    
    # TODO: Add HMAC signature verification here
    # signature = request.headers.get("tatum-signature")
    # verify_signature(signature, await request.body())
    
    try:
        payload = await request.json()
        logger.debug(f"Tatum webhook received: {payload.get('txId')}")
        
        # Convert Tatum payload to standardized event
        event = DepositEvent(
            tx_hash=payload.get("txId"),
            currency=payload.get("asset", "ETH"),
            amount=float(payload.get("amount", 0)),
            address=payload.get("address"),
            confirmations=payload.get("confirmations", 0),
            provider="tatum"
        )
        
        # Process in background
        processor = WebhookProcessor(provider=WebhookProvider.TATUM)
        background_tasks.add_task(processor.process_deposit, event)
        
        return {"status": "processing", "tx_id": event.tx_hash}
        
    except Exception as e:  # noqa: BLE001 - API boundary: convert unexpected failures into an HTTP error response
        logger.error(f"Tatum webhook error: {e!s}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# TESTING ENDPOINTS - Mock webhook simulator
@router.post("/test/deposit")
async def test_deposit_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """Simulate a deposit webhook for testing"""
    
    payload = await request.json()
    
    from app.core.tatum_webhook import DepositEvent, WebhookProcessor
    
    # Create event from payload
    event = DepositEvent(
        tx_hash=payload.get("tx_hash", f"0x{uuid.uuid4().hex[:64]}"),
        currency=payload.get("currency", "ETH"),
        amount=float(payload.get("amount", 0)),
        address=payload.get("address"),
        confirmations=payload.get("confirmations", 12),
        provider="mock"
    )
    
    processor = WebhookProcessor(provider=WebhookProvider.MOCK)
    
    # Process immediately (or in background)
    result = await processor.process_deposit(event)
    
    return result

@router.get("/test/last")
async def get_last_test_deposit():
    """Helper to quickly test with fixed values"""
    

    from app.core.tatum_webhook import MockTatumWebhook
    
    processor = WebhookProcessor(provider=WebhookProvider.MOCK)
    mock = MockTatumWebhook(processor)
    
    # Simulate deposit and wait for result
    result = await mock.simulate_deposit(
        currency="ETH",
        amount=0.05,
        confirmations=12
    )
    
    return result