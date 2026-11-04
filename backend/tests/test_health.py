"""The health endpoint must actually touch Postgres."""

from types import SimpleNamespace

import httpx
import pytest
from app.database import db
from app.main import app


class _FakeQuery:
    def __init__(self, fail: bool = False):
        self.fail = fail
        self.calls = []

    def select(self, *args):
        self.calls.append(("select", args))
        return self

    def limit(self, *args):
        self.calls.append(("limit", args))
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError("connection refused")
        return SimpleNamespace(data=[])


class _FakeClient:
    def __init__(self, fail: bool = False):
        self.query = _FakeQuery(fail)
        self.tables = []

    def table(self, name):
        self.tables.append(name)
        return self.query


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as api_client:
        yield api_client


@pytest.mark.asyncio
async def test_health_reports_connected_after_a_real_query(client, monkeypatch):
    fake = _FakeClient()
    monkeypatch.setattr(db, "admin_client", fake)

    response = await client.get("/api/casino/health")

    assert response.status_code == 200, response.text
    assert response.json()["database"] == "connected"
    assert fake.tables == ["casino_house_stats"]
    assert ("limit", (1,)) in fake.query.calls


@pytest.mark.asyncio
async def test_health_returns_503_when_the_query_fails(client, monkeypatch):
    fake = _FakeClient(fail=True)
    monkeypatch.setattr(db, "admin_client", fake)

    response = await client.get("/api/casino/health")

    assert response.status_code == 503
    assert response.json()["detail"] == "Database unavailable"
