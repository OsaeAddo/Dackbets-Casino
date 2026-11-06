"""Admin stats must come from real operational rows, not placeholders."""

import httpx
import pytest
from app.admin_stats import summarize_admin_stats
from app.config import settings
from app.main import app
from app.models import casino_models


def _summary(**overrides):
    payload = {
        "total_users": 3,
        "active_user_ids": [],
        "wallet_rows": [],
        "recent_bets": [],
        "house_rows": [],
    }
    payload.update(overrides)
    return summarize_admin_stats(**payload)


def test_summary_sums_balances_and_volume_per_currency():
    state = _summary(
        wallet_rows=[
            {"currency": "BTC", "balance": 1.5},
            {"currency": "BTC", "balance": 2.0},
            {"currency": "ETH", "balance": 0.75},
        ],
        recent_bets=[
            {"currency": "BTC", "amount": 0.5},
            {"currency": "BTC", "amount": 0.25},
            {"currency": "ETH", "amount": 2.0},
        ],
    )

    assert state.total_balance == {"BTC": 3.5, "ETH": 0.75}
    assert state.daily_volume == {"BTC": 0.75, "ETH": 2.0}


def test_summary_counts_distinct_online_users():
    state = _summary(active_user_ids=["u1", "u1", "u2"])

    assert state.online_users == 2


def test_summary_reports_negative_house_profit_honestly():
    state = _summary(
        house_rows=[
            {"currency": "BTC", "total_wagered": 1.0, "total_paid": 2.5},
            {"currency": "ETH", "total_wagered": 4.0, "total_paid": 1.0},
        ]
    )

    assert state.house_profit == {"BTC": -1.5, "ETH": 3.0}


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as api_client:
        yield api_client


@pytest.mark.asyncio
async def test_admin_stats_endpoint_reads_operational_tables(client, monkeypatch):
    monkeypatch.setattr(settings, "admin_api_key", "admin-secret")

    async def count_profiles():
        return 8

    async def get_active_session_user_ids(now):
        assert now.endswith("+00:00")
        return ["u1", "u1", "u2"]

    async def get_wallet_balances():
        return [{"currency": "BTC", "balance": 2}]

    async def get_bets_since(since):
        assert since.endswith("+00:00")
        return [{"currency": "BTC", "amount": 0.5}]

    async def get_house_stats_rows():
        return [{"game_type": "dice", "currency": "BTC", "total_wagered": 5, "total_paid": 3}]

    monkeypatch.setattr(casino_models, "count_profiles", count_profiles)
    monkeypatch.setattr(casino_models, "get_active_session_user_ids", get_active_session_user_ids)
    monkeypatch.setattr(casino_models, "get_wallet_balances", get_wallet_balances)
    monkeypatch.setattr(casino_models, "get_bets_since", get_bets_since)
    monkeypatch.setattr(casino_models, "get_house_stats_rows", get_house_stats_rows)

    response = await client.get(
        "/api/admin/stats",
        headers={"X-Admin-Key": "admin-secret"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "total_users": 8,
        "online_users": 2,
        "total_balance": {"BTC": 2.0},
        "daily_volume": {"BTC": 0.5},
        "house_profit": {"BTC": 2.0},
    }


@pytest.mark.asyncio
async def test_admin_stats_returns_503_when_the_query_fails(client, monkeypatch):
    monkeypatch.setattr(settings, "admin_api_key", "admin-secret")

    async def boom():
        raise RuntimeError("connection refused")

    monkeypatch.setattr(casino_models, "count_profiles", boom)

    response = await client.get(
        "/api/admin/stats",
        headers={"X-Admin-Key": "admin-secret"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Admin stats unavailable"
