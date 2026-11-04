from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr, Field, ValidationInfo, field_validator


# Request schemas
class UserSignUp(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    username: str | None = None
    
class SignupResponse(BaseModel):
    """Response for signup that might require email confirmation"""
    user_id: str
    email: str
    requires_confirmation: bool = False
    message: str | None = None
    access_token: str | None = None
    token_type: str | None = None
    expires_in: int | None = None
    supabase_token: str | None = None
    username: str | None = None
    
    
class UserSignIn(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    """Supabase email-confirmation token.

    Magic-link emails carry a ``token_hash``; OTP emails carry a numeric
    ``token`` plus the address it was sent to. Either form is accepted, but
    the token must be validated by Supabase before a session is issued.
    """

    token: str = Field(..., min_length=1, max_length=512)
    email: EmailStr | None = None


class EmailVerificationResponse(BaseModel):
    success: bool
    message: str
    access_token: str | None = None
    token_type: str | None = None
    expires_in: int | None = None
    supabase_token: str | None = None


class TokenData(BaseModel):
    user_id: str | None = None
    
# Response schemas
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    email: str
    username: str | None = None
    supabase_token: str | None = None  # Supabase's JWT
    balance: dict[str, float] | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    username: str | None
    created_at: str
    balance: dict[str, float] = Field(default_factory=dict)
    kyc_status: str = "pending"
    level: int = 1
    wagering_requirement: float = 0.0
    
class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    database: str
    casino_open: bool = True
    
# ============= CASINO SCHEMAS =============

class CasinoUser(BaseModel):
    """Combined user object with normalized auth data and casino profile."""
    id: str
    email: str
    username: str | None = None
    profile: dict[str, Any] = Field(default_factory=dict)

class GameType(str, Enum):
    SLOTS = "slots"
    DICE = "dice"
    BLACKJACK = "blackjack"
    ROULETTE = "roulette"
    CRASH = "crash"
    LIMBO = "limbo"

class Currency(str, Enum):
    BTC = "BTC"
    ETH = "ETH"
    USDT = "USDT"
    USDC = "USDC"
    SOL = "SOL"
    BNB = "BNB"

class TransactionType(str, Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    BET = "bet"
    WIN = "win"
    BONUS = "bonus"
    REFUND = "refund"

class TransactionStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    CANCELLED = "cancelled"

# Wallet Schemas
class WalletCreate(BaseModel):
    currency: Currency
    
class WalletResponse(BaseModel):
    id: str
    user_id: str
    currency: Currency
    address: str
    balance: float
    created_at: str
    is_active: bool = True

class DepositRequest(BaseModel):
    currency: Currency
    amount: float
    
    @field_validator('amount')
    @classmethod
    def amount_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError('Amount must be positive')
        return v

class WithdrawalRequest(BaseModel):
    currency: Currency
    amount: float
    address: str
    
    @field_validator('amount')
    @classmethod
    def amount_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError('Amount must be positive')
        return v

class DepositResponse(BaseModel):
    transaction_id: str
    currency: Currency
    amount: float
    deposit_address: str
    qr_code_url: str | None = None
    expires_at: str

class WithdrawalResponse(BaseModel):
    transaction_id: str
    currency: Currency
    amount: float
    address: str
    tx_hash: str | None = None
    status: TransactionStatus
    estimated_time: str | None = None

# Game Schemas
class BetRequest(BaseModel):
    game_type: GameType
    currency: Currency
    amount: float
    parameters: dict[str, Any] = Field(default_factory=dict)
    
    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v: float, info: ValidationInfo) -> float:
        if info.data.get('game_type') == GameType.DICE and v < 0.000001:
            raise ValueError('Amount too small for dice game')
        return v

class BetResponse(BaseModel):
    bet_id: str
    game_type: GameType
    currency: Currency
    amount: float
    result: dict[str, Any] | None = None
    win_amount: float = 0.0
    new_balance: dict[str, float]
    timestamp: str

class BetLimit(BaseModel):
    min: float
    max: float

class BetLimitsResponse(BaseModel):
    limits: dict[str, BetLimit]
    defaults: BetLimit

class GameHistoryResponse(BaseModel):
    bet_id: str
    game_type: GameType
    currency: Currency
    amount: float
    win_amount: float
    result: dict[str, Any]
    timestamp: str

# Casino State
class CasinoStateResponse(BaseModel):
    total_players: int
    total_wagered: dict[str, float]
    biggest_wins: list[dict[str, Any]]
    hot_games: list[dict[str, Any]]
    jackpot_amount: dict[str, float]

# Admin Schemas
class AdminUserUpdate(BaseModel):
    user_id: str
    balance_adjustment: dict[str, float] | None = None
    kyc_status: str | None = None
    is_active: bool | None = None

class PayoutCalculation(BaseModel):
    game_type: GameType
    bet_amount: float
    currency: Currency
    player_multiplier: float | None = None
    win_chance: float | None = None