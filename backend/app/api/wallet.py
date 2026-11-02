from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime

from app.dependencies import get_current_user_dep
from app.wallets.service import wallet_service
from app.config import settings
from app.schemas import (
    Currency, WalletResponse, DepositRequest, DepositResponse, 
    WithdrawalRequest, WithdrawalResponse, TransactionStatus
)
from app.models import casino_models


import logging

router = APIRouter(prefix="/wallet", tags=["Wallet"])
logger = logging.getLogger(__name__)

# ============= WALLET ENDPOINTS =============
#TODO: Add a get_balance endpoint - to reduce db calls from frontend
@router.get("/address/{currency}", response_model=WalletResponse, tags=["Wallet"])
async def get_deposit_address(
    currency: Currency,
    user = Depends(get_current_user_dep)
):
    """Get deposit address for a currency"""
    
    try:
        user_id = user.id
        # Get or create wallet
        wallet = await wallet_service.get_or_create_wallet(
            user_id=user_id,
            currency=currency.value
        )
        profile = await casino_models.get_user_profile(user_id) or {}
        profile_balance = profile.get("balance", {}) or {}
        
        # Use profile balance, not wallet balance
        actual_balance = profile_balance.get(currency.value, 0.0)
        return WalletResponse(
            id=wallet.get("id", ""),
            user_id=user_id,
            currency=Currency(wallet.get("currency", currency.value)),
            address=wallet.get("address", ""),
            balance=actual_balance,
            created_at=wallet.get("created_at", datetime.utcnow().isoformat()),
            is_active=wallet.get("is_active", True)
        )
    except Exception as e:
        logger.error(f"Wallet error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/deposit", response_model=DepositResponse, tags=["Wallet"])
async def create_deposit(
    deposit_request: DepositRequest,
    user = Depends(get_current_user_dep)
):
    """Create a deposit request"""
    
    try:
        deposit = await wallet_service.create_deposit(
            user_id=user.id,
            currency=deposit_request.currency.value,
            amount=deposit_request.amount
        )
        
        return DepositResponse(
            transaction_id=deposit["transaction_id"],
            currency=Currency(deposit["currency"]),
            amount=deposit["amount"],
            deposit_address=deposit["deposit_address"],
            qr_code_url=deposit.get("qr_code_url"),
            expires_at=deposit["expires_at"]
        )
    except Exception as e:
        logger.error(f"Deposit error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/withdraw", response_model=WithdrawalResponse, tags=["Wallet"])
async def create_withdrawal(
    withdrawal_request: WithdrawalRequest,
    user = Depends(get_current_user_dep)
):
    """Create a withdrawal request"""
    
    # Check KYC if required
    if settings.require_kyc_for_withdrawal:
        profile = user.profile
        if profile.get("kyc_status") != "verified":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="KYC verification required for withdrawals"
            )
        
    try:
        withdrawal = await wallet_service.create_withdrawal(
            user_id=user.id,
            currency=withdrawal_request.currency.value,
            amount=withdrawal_request.amount,
            address=withdrawal_request.address
        )
        
        return WithdrawalResponse(
            transaction_id=withdrawal["transaction_id"],
            currency=Currency(withdrawal["currency"]),
            amount=withdrawal["amount"],
            address=withdrawal["address"],
            tx_hash=withdrawal.get("tx_hash"),
            status=TransactionStatus(withdrawal["status"]),
            estimated_time=withdrawal.get("estimated_time")
        )
    except Exception as e:
        logger.error(f"Withdrawal error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/transactions", tags=["Wallet"])
async def get_transactions(
    limit: int = 50,
    offset: int = 0,
    user = Depends(get_current_user_dep)
):
    """Get user's transaction history"""
    
    try:
        transactions = await wallet_service.get_user_transactions(
            user_id=user.id,
            limit=limit,
            offset=offset
        )
        return transactions
    except Exception as e:
        logger.error(f"Transactions error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )