from pydantic import BaseModel, EmailStr, Field, ValidationInfo, field_validator
from typing import Optional, List, Dict, Any
from enum import Enum

# Request schemas
class UserSignUp(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    username: Optional[str] = None
    
class SignupResponse(BaseModel):
    """Response for signup that might require email confirmation"""
    user_id: str
    email: str
    requires_confirmation: bool = False
    message: Optional[str] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    expires_in: Optional[int] = None
    supabase_token: Optional[str] = None
    username: Optional[str] = None
    
    
class UserSignIn(BaseModel):
    email: EmailStr
    password: str

class TokenData(BaseModel):
    user_id: Optional[str] = None
    
# Response schemas
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    email: str
    username: Optional[str] = None
    supabase_token: Optional[str] = None  # Supabase's JWT
    balance: Optional[Dict[str, float]] = None


class UserResponse(BaseModel):
    id: str
    email: str
    username: Optional[str]
    created_at: str
    balance: Dict[str, float] = Field(default_factory=dict)
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
    username: Optional[str] = None
    profile: Dict[str, Any] = Field(default_factory=dict)

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
    qr_code_url: Optional[str] = None
    expires_at: str

class WithdrawalResponse(BaseModel):
    transaction_id: str
    currency: Currency
    amount: float
    address: str
    tx_hash: Optional[str] = None
    status: TransactionStatus
    estimated_time: Optional[str] = None

# Game Schemas
class BetRequest(BaseModel):
    game_type: GameType
    currency: Currency
    amount: float
    parameters: Dict[str, Any] = Field(default_factory=dict)
    
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
    result: Optional[Dict[str, Any]] = None
    win_amount: float = 0.0
    new_balance: Dict[str, float]
    timestamp: str

class BetLimit(BaseModel):
    min: float
    max: float

class BetLimitsResponse(BaseModel):
    limits: Dict[str, BetLimit]
    defaults: BetLimit

class GameHistoryResponse(BaseModel):
    bet_id: str
    game_type: GameType
    currency: Currency
    amount: float
    win_amount: float
    result: Dict[str, Any]
    timestamp: str

# Casino State
class CasinoStateResponse(BaseModel):
    total_players: int
    total_wagered: Dict[str, float]
    biggest_wins: List[Dict[str, Any]]
    hot_games: List[Dict[str, Any]]
    jackpot_amount: Dict[str, float]

# Admin Schemas
class AdminUserUpdate(BaseModel):
    user_id: str
    balance_adjustment: Optional[Dict[str, float]] = None
    kyc_status: Optional[str] = None
    is_active: Optional[bool] = None

class PayoutCalculation(BaseModel):
    game_type: GameType
    bet_amount: float
    currency: Currency
    player_multiplier: Optional[float] = None
    win_chance: Optional[float] = None