# app/config.py
from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    # No need for Config class when dotenv loads variables
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    FRONTEND_URL: str = "http://localhost:5173"
    DEBUG: bool = True
    
    # Tatum settings
    TATUM_API_KEY: Optional[str] = None
    TATUM_WEBHOOK_SECRET: Optional[str] = None
    
    # Casino Settings
    CASINO_NAME: str = "Crypto Casino"
    DEFAULT_CURRENCY: str = "USD"
    SUPPORTED_CRYPTOS: List[str] = ["BTC", "ETH", "USDT", "USDC", "SOL"]
    
    # Wallet Settings
    WALLET_MIN_CONFIRMATIONS: dict = {
        "BTC": 3,
        "ETH": 12,
        "USDT": 12,
        "USDC": 12,
        "SOL": 1
    }

    
    # Remove the Config class entirely
    class Config:
        # env_file = ".env"  # No longer needed
        env_file_encoding = 'utf-8'
        # If you have nested structures in .env, you might need this:
        case_sensitive = False  # Allows lowercase variable names in .env

settings = Settings()