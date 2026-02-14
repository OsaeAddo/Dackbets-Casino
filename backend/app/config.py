from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_key: str
    supabase_service_role_key: Optional[str] = None
    
    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440  # 24 hours for casino
    
    # CORS
    frontend_url: str = "http://localhost:5173"
    
    # Casino Settings
    casino_name: str = "CryptoCasino"
    default_currency: str = "USD"
    supported_cryptos: List[str] = ["BTC", "ETH", "USDT", "USDC", "SOL", "BNB"]
    
    # House Edge (in percentage)
    house_edge_slots: float = 3.0
    house_edge_dice: float = 1.0
    house_edge_blackjack: float = 0.5
    house_edge_roulette: float = 2.7
    
    # Betting Limits
    min_bet_amount: float = 1.0
    max_bet_amount: float = 10000.0
    max_daily_loss: float = 5000.0
    
    # Wallet Settings
    wallet_hot_wallet_percentage: float = 0.1  # 10% in hot wallet
    wallet_min_confirmations: dict = {
        "BTC": 3,
        "ETH": 12,
        "USDT": 12,
        "USDC": 12,
        "SOL": 1,
        "BNB": 12
    }
    
    # Security
    debug: bool = False
    require_kyc_for_withdrawal: bool = True
    withdrawal_daily_limit: float = 10000.0
    
    # class Config:
    #     env_file = ".env"

settings = Settings()