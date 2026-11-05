"""Public casino state must come from real analytics rows, not placeholders."""

import httpx
import pytest
from app.casino_stats import summarize_state
from app.main import app
from app.models import casino_models


def _summary(**overrides):
    payload = {
        "total_players": 4,
        "house_rows": [],
        "top_wins": [],
        "recent_bettors": [],
        "usernames": {},
    }
    payload.update(overrides)
    return summarize_state(**payload)


def test_summary_sums_wagered_and_paid_per_currency():
    state = _summary(
        house_rows=[
            {"game_type": "dice", "currency": "BTC", "total_wagered": 1.5, "total_paid": 0.5},
            {"game_type": "slots", "currency": "BTC", "total_wagered": 2.0, "total_paid": 0.25},
            {"game_type": "dice", "currency": "ETH", "total_wagered": 3.0, "total_paid": 4.0},
        ]
    )

    assert state.total_wagered == {"BTC": 3.5, "ETH": 3.0}
    # The jackpot pool is house-retained margin and never negative.
    assert state.jackpot_amount == {"BTC": 2.75, "ETH": 0.0}


def test_summary_uses_usernames_and_anonymizes_the_rest():
    state = _summary(
        top_wins=[
            {
                "user_id": "aaaaaaaa-1",
                "game_type": "dice",
                "currency": "BTC",
                "win_amount": 2.5,
            },
            {
                "user_id": "bbbbbbbb-2",
                "game_type": "slots",
                "currency": "ETH",
                "win_amount": 1.0,
            },
        ],
        usernames={"aaaaaaaa-1": "lucky"},
    )

    assert state.biggest_wins == [
        {"player": "lucky", "amount": 2.5, "currency": "BTC", "game": "dice"},
        {"player": "anon-bbbbbb", "amount": 1.0, "currency": "ETH", "game": "slots"},
    ]


def test_summary_counts_distinct_players_per_game():
    state = _summary(
        recent_bettors=[
            {"game_type": "dice", "user_id": "u1"},
            {"game_type": "dice", "user_id": "u1"},
            {"game_type": "dice", "user_id": "u2"},
            {"game_type": "slots", "user_id": "u2"},
            {"game_type": "crash", "user_id": "u3"},
            {"game_type": "crash", "user_id": None},
        ]
    )

    assert state.hot_games == [
        {"game": "dice", "players": 2},
        {"game": "crash", "players": 1},
        {"game": "slots", "players": 1},
    ]


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as api_client:
        yield api_client


@pytest.mark.asyncio
async def test_state_endpoint_reads_analytics_tables(client, monkeypatch):
    async def count_profiles():
        return 12

    async def get_house_stats_rows():
        return [{"game_type": "dice", "currency": "BTC", "total_wagered": 7, "total_paid": 2}]

    async def get_top_wins(limit):
        assert limit == 5
        return [{"user_id": "u1", "game_type": "dice", "currency": "BTC", "win_amount": 4}]

    async def get_recent_bettors(since):
        assert since.endswith("+00:00")
        return [{"game_type": "dice", "user_id": "u1"}]

    async def get_usernames(user_ids):
        assert user_ids == ["u1"]
        return {"u1": "highroller"}

    monkeypatch.setattr(casino_models, "count_profiles", count_profiles)
    monkeypatch.setattr(casino_models, "get_house_stats_rows", get_house_stats_rows)
    monkeypatch.setattr(casino_models, "get_top_wins", get_top_wins)
    monkeypatch.setattr(casino_models, "get_recent_bettors", get_recent_bettors)
    monkeypatch.setattr(casino_models, "get_usernames", get_usernames)

    response = await client.get("/api/casino/state")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "total_players": 12,
        "total_wagered": {"BTC": 7.0},
        "biggest_wins": [
            {"player": "highroller", "amount": 4.0, "currency": "BTC", "game": "dice"}
        ],
        "hot_games": [{"game": "dice", "players": 1}],
        "jackpot_amount": {"BTC": 5.0},
    }


@pytest.mark.asyncio
async def test_state_endpoint_returns_503_when_the_query_fails(client, monkeypatch):
    async def boom():
        raise RuntimeError("connection refused")

    monkeypatch.setattr(casino_models, "count_profiles", boom)

    response = await client.get("/api/casino/state")

    assert response.status_code == 503
    assert response.json()["detail"] == "Casino state unavailable"
