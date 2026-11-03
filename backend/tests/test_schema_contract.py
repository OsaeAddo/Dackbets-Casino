"""Guards the Python ↔ SQL contract for the reference schema.

The SQL runs in Supabase, not in pytest, so these tests pin the names and
signatures that `backend/app` depends on. `supabase/tests/initial_schema.sql`
covers the runtime behaviour; `scripts/validate-migration.sh` runs both against
a throwaway Postgres.
"""

import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from app.database import db
from app.models import casino_models

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "20261103000000_init_casino_schema.sql"
)


class _FakeQuery:
    def __init__(self, client, data=None):
        self.client = client
        self.data = [] if data is None else data

    def insert(self, data):
        self.client.calls.append(("insert", data))
        return self

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=self.data)


class _FakeClient:
    def __init__(self, rpc_data=None):
        self.calls = []
        self.rpc_data = rpc_data or []

    def table(self, name):
        self.calls.append(("table", name))
        return _FakeQuery(self)

    def rpc(self, name, params):
        self.calls.append(("rpc", name, params))
        return _FakeQuery(self, self.rpc_data)


@pytest.mark.asyncio
async def test_update_user_balance_uses_migration_rpc(monkeypatch):
    fake = _FakeClient()
    monkeypatch.setattr(casino_models, "admin_client", fake)

    await casino_models.update_user_balance("user-1", "ETH", 1.25)

    assert fake.calls == [
        (
            "rpc",
            "update_user_balance",
            {
                "p_user_id": "user-1",
                "p_currency": "ETH",
                "p_amount": 1.25,
            },
        )
    ]


@pytest.mark.asyncio
async def test_update_house_stats_uses_migration_rpc(monkeypatch):
    fake = _FakeClient()
    monkeypatch.setattr(casino_models, "admin_client", fake)

    await casino_models.update_house_stats("dice", "ETH", 2.0, 1.5)

    assert fake.calls == [
        (
            "rpc",
            "update_house_stats",
            {
                "p_game_type": "dice",
                "p_currency": "ETH",
                "p_wagered": 2.0,
                "p_paid": 1.5,
            },
        )
    ]


@pytest.mark.asyncio
async def test_create_transaction_sends_metadata_as_object(monkeypatch):
    """The jsonb column and the `metadata ->> 'tx_hash'` index need an object."""
    fake = _FakeClient()
    monkeypatch.setattr(casino_models, "admin_client", fake)

    await casino_models.create_transaction(
        user_id="user-1",
        transaction_type="deposit",
        currency="ETH",
        amount=1.0,
        metadata={"tx_hash": "0xabc"},
    )

    insert = next(call for call in fake.calls if call[0] == "insert")[1]
    assert insert["metadata"] == {"tx_hash": "0xabc"}


@pytest.mark.asyncio
async def test_get_user_by_email_uses_scoped_rpc(monkeypatch):
    fake = _FakeClient(
        rpc_data=[
            {
                "id": "user-1",
                "email": "alice@example.com",
                "email_confirmed_at": None,
                "created_at": None,
                "username": "alice",
            }
        ]
    )
    monkeypatch.setattr(db, "client", fake)

    user = await db.get_user_by_email("alice@example.com")

    assert fake.calls == [("rpc", "get_user_by_email", {"p_email": "alice@example.com"})]
    assert user is not None
    assert user.id == "user-1"
    assert user.username == "alice"


@pytest.mark.asyncio
async def test_get_user_by_email_returns_none_without_rows(monkeypatch):
    fake = _FakeClient(rpc_data=[])
    monkeypatch.setattr(db, "client", fake)

    assert await db.get_user_by_email("nobody@example.com") is None


def test_migration_declares_the_objects_the_api_uses():
    sql = MIGRATION.read_text()
    normalized = re.sub(r"\s+", " ", sql.lower())

    for table in (
        "casino_profiles",
        "casino_wallets",
        "casino_transactions",
        "casino_bets",
        "casino_house_stats",
    ):
        assert f"create table if not exists public.{table}" in normalized
        assert f"alter table public.{table} enable row level security" in normalized

    for function in ("update_user_balance", "update_house_stats", "get_user_by_email"):
        assert f"create or replace function public.{function}" in normalized

    assert "create or replace view public.user_profiles" in normalized
    assert "references auth.users (id)" in normalized
    assert "unique index if not exists casino_transactions_tx_hash_uidx" in normalized
    assert "on public.casino_bets (user_id, timestamp desc)" in normalized
    assert "on public.casino_transactions (user_id, created_at desc)" in normalized
