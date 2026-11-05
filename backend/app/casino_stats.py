"""Real public casino statistics.

The public `/api/casino/state` endpoint used to return hardcoded numbers. These
aggregates come from the analytics tables instead:

- ``casino_house_stats`` is bounded (one row per game/currency) and provides
  the wagered/paid totals.
- ``casino_bets`` provides the biggest wins and the recent players per game.

There is no progressive-jackpot table, so ``jackpot_amount`` reports the
house-retained margin per currency (wagered minus paid). It is derived from real
data and never negative, which keeps the mobile contract truthful instead of
inventing a prize pool.
"""

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from app.models import casino_models
from app.schemas import CasinoStateResponse

HOT_GAME_WINDOW = timedelta(hours=24)
TOP_WINS_LIMIT = 5
HOT_GAMES_LIMIT = 5


def _money(value: Any) -> float:
    return round(float(value or 0), 8)


def _player_label(user_id: str, usernames: dict[str, str]) -> str:
    if not user_id:
        return "anon"
    return usernames.get(user_id) or f"anon-{user_id[:6]}"


def summarize_state(
    *,
    total_players: int,
    house_rows: list[dict[str, Any]],
    top_wins: list[dict[str, Any]],
    recent_bettors: list[dict[str, Any]],
    usernames: dict[str, str],
) -> CasinoStateResponse:
    """Turn raw analytics rows into the public casino-state payload."""
    wagered: dict[str, float] = defaultdict(float)
    paid: dict[str, float] = defaultdict(float)
    for row in house_rows:
        currency = row["currency"]
        wagered[currency] += _money(row.get("total_wagered"))
        paid[currency] += _money(row.get("total_paid"))

    biggest_wins = [
        {
            "player": _player_label(row.get("user_id", ""), usernames),
            "amount": _money(row.get("win_amount")),
            "currency": row["currency"],
            "game": row["game_type"],
        }
        for row in top_wins
    ]

    players_by_game: dict[str, set[str]] = defaultdict(set)
    for row in recent_bettors:
        user_id = row.get("user_id")
        if user_id:
            players_by_game[row["game_type"]].add(user_id)

    hot_games = [
        {"game": game, "players": len(players)}
        for game, players in sorted(
            players_by_game.items(), key=lambda item: (-len(item[1]), item[0])
        )[:HOT_GAMES_LIMIT]
    ]

    currencies = sorted(set(wagered) | set(paid))
    return CasinoStateResponse(
        total_players=total_players,
        total_wagered={currency: round(wagered[currency], 8) for currency in currencies},
        biggest_wins=biggest_wins,
        hot_games=hot_games,
        jackpot_amount={
            currency: round(max(wagered[currency] - paid[currency], 0.0), 8)
            for currency in currencies
        },
    )


async def build_casino_state() -> CasinoStateResponse:
    """Read the analytics tables and summarize the current public state."""
    total_players = await casino_models.count_profiles()
    house_rows = await casino_models.get_house_stats_rows()
    top_wins = await casino_models.get_top_wins(TOP_WINS_LIMIT)
    since = (datetime.now(UTC) - HOT_GAME_WINDOW).isoformat()
    recent_bettors = await casino_models.get_recent_bettors(since)
    winner_ids = sorted({row["user_id"] for row in top_wins if row.get("user_id")})
    usernames = await casino_models.get_usernames(winner_ids)

    return summarize_state(
        total_players=total_players,
        house_rows=house_rows,
        top_wins=top_wins,
        recent_bettors=recent_bettors,
        usernames=usernames,
    )
