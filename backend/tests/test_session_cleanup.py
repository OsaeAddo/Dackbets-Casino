"""Housekeeping: stale refresh sessions are pruned on a slow interval."""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from app.config import settings
from app.models import casino_models
from app.session_cleanup import prune_stale_sessions, run_session_cleanup


class _FakeResponse:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, name, log, rows):
        self.name = name
        self.log = log
        self.rows = rows
        self.filters = []

    def delete(self):
        self.log.append(("delete", self.name))
        return self

    def lt(self, column, value):
        self.filters.append((column, value))
        return self

    def execute(self):
        self.log.append(("execute", self.name, tuple(self.filters)))
        return _FakeResponse(self.rows)


class _FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.log = []

    def table(self, name):
        return _FakeTable(name, self.log, self.responses.pop(0))


@pytest.mark.asyncio
async def test_prune_deletes_expired_and_revoked_rows(monkeypatch):
    fake = _FakeClient([[{"id": "a"}, {"id": "b"}], [{"id": "c"}]])
    monkeypatch.setattr(casino_models, "admin_client", fake)
    monkeypatch.setattr(settings, "session_retention_days", 7)

    deleted = await prune_stale_sessions()

    assert deleted == 3
    expected_cutoff = datetime.now(UTC) - timedelta(days=7)
    executes = [entry for entry in fake.log if entry[0] == "execute"]
    assert [(entry[1], entry[2][0][0]) for entry in executes] == [
        ("casino_sessions", "expires_at"),
        ("casino_sessions", "revoked_at"),
    ]
    for entry in executes:
        cutoff = datetime.fromisoformat(entry[2][0][1])
        assert abs(cutoff - expected_cutoff) < timedelta(seconds=1)


@pytest.mark.asyncio
async def test_cleanup_loop_swallows_failures_and_keeps_running(monkeypatch):
    async def failing_prune():
        raise RuntimeError("database unavailable")

    async def stop_after_one_tick(_seconds):
        raise asyncio.CancelledError

    monkeypatch.setattr("app.session_cleanup.prune_stale_sessions", failing_prune)
    monkeypatch.setattr(asyncio, "sleep", stop_after_one_tick)

    with pytest.raises(asyncio.CancelledError):
        await run_session_cleanup()


@pytest.mark.asyncio
async def test_cleanup_loop_prunes_then_sleeps(monkeypatch):
    calls = []

    async def fake_prune():
        calls.append("prune")
        return 0

    async def stop_after_one_tick(seconds):
        calls.append(("sleep", seconds))
        raise asyncio.CancelledError

    monkeypatch.setattr("app.session_cleanup.prune_stale_sessions", fake_prune)
    monkeypatch.setattr(asyncio, "sleep", stop_after_one_tick)
    monkeypatch.setattr(settings, "session_cleanup_interval_seconds", 1234)

    with pytest.raises(asyncio.CancelledError):
        await run_session_cleanup()

    assert calls == ["prune", ("sleep", 1234)]
