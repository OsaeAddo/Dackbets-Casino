from fastapi import (
    APIRouter, BackgroundTasks, 
    Request, HTTPException, BackgroundTasks
)
import hmac
import hashlib
import json

from app.schemas import *
from app.dependencies import get_current_user
from app.core.tatum_webhook import process_deposit_event
from app import settings

import logging

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = logging.getLogger(__name__)

# Your Tatum webhook secret (set this in Tatum dashboard)
TATUM_WEBHOOK_SECRET = settings.tatum_webhook_secret


# ============= WEBHOOK ENDPOINTS =============

# @router.post("/blockchain/{currency}")
# async def blockchain_webhook(
#     currency: str,
#     payload: Dict,
#     background_tasks: BackgroundTasks
# ):
#     """Webhook for blockchain deposit notifications"""
#     # TODO: Implement webhook signature verification
#     try:
#         from app.core.tatum_webhook import process_blockchain_webhook
#         background_tasks.add_task(process_blockchain_webhook, currency, payload)
#         return {"status": "processing"}
#     except Exception as e:
#         logger.error(f"Webhook error: {str(e)}")
#         return {"status": "error", "message": str(e)}
    

@router.post("/tatum/deposit")
async def tatum_deposit_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Endpoint for Tatum to notify about deposits.
    Must be set in Tatum Dashboard: https://dashboard.tatum.io/webhooks
    """
    # 1. Get the raw body and the signature header
    body_bytes = await request.body()
    received_signature = request.headers.get("tatum-signature")

    # 2. Verify the HMAC signature
    expected_signature = hmac.new(
        TATUM_WEBHOOK_SECRET.encode(),
        body_bytes,
        hashlib.sha512
    ).hexdigest()

    if not hmac.compare_digest(received_signature, expected_signature):
        logger.warning("Invalid webhook signature received.")
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 3. Parse the webhook payload
    try:
        event = json.loads(body_bytes.decode())
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # 4. Log the raw payload (crucial for debugging)
    logger.debug(f"Tatum Webhook Received: {event}")
    # Optional: Save to casino_webhook_logs table here.

    # 5. Process the event in the background
    background_tasks.add_task(process_deposit_event, event)
    return {"status": "processing"}


