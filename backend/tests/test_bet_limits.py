import httpx
import pytest
from app.config import settings
from app.dependencies import get_current_user_dep
from app.games.dice import DiceGame
from app.main import app
from app.models import casino_models
from app.schemas import CasinoUser


def test_eth_minimum_allows_0001():
    """0.001 ETH must pass the per-currency minimum."""
    settings.validate_bet_amount("ETH", 0.001)


def test_usdt_below_minimum_is_rejected():
    """A USDT bet below its per-currency minimum must fail."""
    with pytest.raises(ValueError, match="Minimum bet for USDT"):
        settings.validate_bet_amount("USDT", 5.0)


@pytest.fixture
def fake_user():
    return CasinoUser(
        id="test-user-id",
        email="player@example.com",
        username="player",
        profile={
            "balance": {"ETH": 1.0, "USDT": 1000.0},
            "kyc_status": "pending",
        },
    )


@pytest.fixture
async def api_client(monkeypatch, fake_user):
    async def override_current_user():
        return fake_user

    async def fake_update_user_balance(**kwargs):
        return None

    async def fake_create_bet(**kwargs):
        return None

    async def fake_get_user_profile(user_id):
        return fake_user.profile

    async def fake_update_house_stats(*args, **kwargs):
        return None

    def fake_dice_play(self, bet_amount, parameters):
        return {
            "bet_id": "dice_test",
            "game": "dice",
            "roll": 42.0,
            "target": 50.0,
            "win_chance": 50.0,
            "multiplier": 1.98,
            "win": True,
            "win_amount": round(bet_amount * 1.98, 8),
        }

    monkeypatch.setattr(casino_models, "update_user_balance", fake_update_user_balance)
    monkeypatch.setattr(casino_models, "create_bet", fake_create_bet)
    monkeypatch.setattr(casino_models, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(casino_models, "update_house_stats", fake_update_house_stats)
    monkeypatch.setattr(DiceGame, "play", fake_dice_play)

    app.dependency_overrides[get_current_user_dep] = override_current_user
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.pop(get_current_user_dep, None)


@pytest.mark.asyncio
async def test_0001_eth_dice_bet_passes_validation(api_client):
    """The full route accepts a 0.001 ETH dice bet."""
    response = await api_client.post(
        "/api/games/bet",
        json={
            "game_type": "dice",
            "currency": "ETH",
            "amount": 0.001,
            "parameters": {"win_chance": 50},
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["currency"] == "ETH"
    assert body["amount"] == 0.001
    assert body["bet_id"] == "dice_test"


@pytest.mark.asyncio
async def test_below_minimum_usdt_bet_is_rejected(api_client):
    """The route rejects a USDT bet below the configured minimum."""
    response = await api_client.post(
        "/api/games/bet",
        json={
            "game_type": "dice",
            "currency": "USDT",
            "amount": 5.0,
            "parameters": {"win_chance": 50},
        },
    )

    assert response.status_code == 400
    assert "Minimum bet for USDT" in response.json()["detail"]
