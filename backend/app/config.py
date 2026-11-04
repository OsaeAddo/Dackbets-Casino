
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_key: str
    supabase_secret_key: str

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440  # 24 hours for casino

    # CORS
    frontend_url: str = "http://localhost:3000"
    # Optional comma-separated allowlist, e.g. "https://app.example.com,https://staging.example.com"
    frontend_urls: str | None = None

    # Casino Settings
    casino_name: str = "CryptoCasino"
    default_currency: str = "USD"
    supported_cryptos: list[str] = ["BTC", "ETH", "USDT", "USDC", "SOL", "BNB"]

    # House Edge (in percentage)
    house_edge_slots: float = 3.0
    house_edge_dice: float = 1.0
    house_edge_blackjack: float = 0.5
    house_edge_roulette: float = 2.7

    # Betting Limits
    # Global fallback limits. Per-currency values below override these.
    min_bet_amount: float = 1.0
    max_bet_amount: float = 10000.0
    min_bet_amounts: dict[str, float] = {
        "BTC": 0.0001,
        "ETH": 0.001,
        "USDT": 10.0,
        "USDC": 10.0,
        "SOL": 0.01,
        "BNB": 0.01,
    }
    max_bet_amounts: dict[str, float] = {
        "BTC": 10.0,
        "ETH": 100.0,
        "USDT": 100000.0,
        "USDC": 100000.0,
        "SOL": 1000.0,
        "BNB": 100.0,
    }
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

    # Email Settings
    mail_username: str | None = None
    mail_password: str | None = None
    mail_from: str = "noreply@cryptocasino.com"
    mail_from_name: str = "CryptoCasino"
    mail_port: int = 587
    mail_server: str = "smtp.gmail.com"
    mail_starttls: bool = True
    mail_ssl_tls: bool = False
    use_credentials: bool = True
    validate_certs: bool = True

    # Development Email Settings
    email_dev_mode: bool = True  # Set to False in production
    email_dev_dir: str = "./email_logs"

    # Security
    debug: bool = False
    # Shared secret for /api/admin/*. Empty means the admin API is disabled.
    admin_api_key: str | None = None
    # HMAC secret for inbound webhooks. Empty means signed webhooks are refused.
    webhook_hmac_secret: str | None = None
    # Expose /api/webhooks/test/* only in local development.
    enable_test_webhooks: bool = False
    require_kyc_for_withdrawal: bool = True
    withdrawal_daily_limit: float = 10000.0

    @property
    def allowed_origins(self) -> list[str]:
        """Return the exact CORS origins allowed to send credentialed requests."""
        raw_origins = [self.frontend_url]
        if self.frontend_urls:
            raw_origins.extend(self.frontend_urls.split(","))

        origins = []
        for origin in raw_origins:
            normalized = origin.strip().rstrip("/")
            # A wildcard is incompatible with allow_credentials=True.
            if normalized and normalized != "*" and normalized not in origins:
                origins.append(normalized)
        return origins

    def get_bet_limits(self, currency: str) -> tuple[float, float]:
        """Return (min, max) bet limits for a currency, with global fallbacks."""
        code = currency.upper()
        return (
            self.min_bet_amounts.get(code, self.min_bet_amount),
            self.max_bet_amounts.get(code, self.max_bet_amount),
        )

    def validate_bet_amount(self, currency: str, amount: float) -> None:
        """Validate a bet amount against the limits for its currency."""
        code = currency.upper()
        min_bet, max_bet = self.get_bet_limits(code)
        if amount < min_bet:
            raise ValueError(f"Minimum bet for {code} is {min_bet}")
        if amount > max_bet:
            raise ValueError(f"Maximum bet for {code} is {max_bet}")


settings = Settings()
