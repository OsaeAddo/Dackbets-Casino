"""Real admin dashboard statistics.

`/api/admin/stats` used to return invented numbers. These aggregates come from
the operational tables:

- ``casino_profiles`` — registered users.
- ``casino_sessions`` — users with a live (unrevoked, unexpired) session.
- ``casino_wallets`` — current balance per currency.
- ``casino_bets`` — stake volume over the last 24h.
- ``casino_house_stats`` — all-time wagered/paid, so house profit is truthful
  (it may be negative when players are ahead; admin data is not clamped).
"""

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from app.models import casino_models
from app.schemas import AdminStatsResponse

DAILY_VOLUME_WINDOW = timedelta(hours=24)


def _money(value: Any) -> float:
    return round(float(value or 0), 8)


def summarize_admin_stats(
    *,
    total_users: int,
    active_user_ids: list[str],
    wallet_rows: list[dict[str, Any]],
    recent_bets: list[dict[str, Any]],
    house_rows: list[dict[str, Any]],
) -> AdminStatsResponse:
    """Turn raw operational rows into the admin dashboard payload."""
    balances: dict[str, float] = defaultdict(float)
    for row in wallet_rows:
        balances[row["currency"]] += _money(row.get("balance"))

    volume: dict[str, float] = defaultdict(float)
    for row in recent_bets:
        volume[row["currency"]] += _money(row.get("amount"))

    wagered: dict[str, float] = defaultdict(float)
    paid: dict[str, float] = defaultdict(float)
    for row in house_rows:
        currency = row["currency"]
        wagered[currency] += _money(row.get("total_wagered"))
        paid[currency] += _money(row.get("total_paid"))

    currencies = sorted(set(balances) | set(volume) | set(wagered) | set(paid))
    return AdminStatsResponse(
        total_users=total_users,
        online_users=len(set(active_user_ids)),
        total_balance={currency: round(balances[currency], 8) for currency in currencies},
        daily_volume={currency: round(volume[currency], 8) for currency in currencies},
        house_profit={
            currency: round(wagered[currency] - paid[currency], 8)
            for currency in currencies
        },
    )


async def build_admin_stats() -> AdminStatsResponse:
    """Read the operational tables and summarize the admin dashboard."""
    now = datetime.now(UTC)
    total_users = await casino_models.count_profiles()
    active_user_ids = await casino_models.get_active_session_user_ids(now.isoformat())
    wallet_rows = await casino_models.get_wallet_balances()
    recent_bets = await casino_models.get_bets_since(
        (now - DAILY_VOLUME_WINDOW).isoformat()
    )
    house_rows = await casino_models.get_house_stats_rows()

    return summarize_admin_stats(
        total_users=total_users,
        active_user_ids=active_user_ids,
        wallet_rows=wallet_rows,
        recent_bets=recent_bets,
        house_rows=house_rows,
    )
