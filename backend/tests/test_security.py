"""Security regression tests for the Phase 1 gaps in the handoff (§4b)."""

from types import SimpleNamespace

import httpx
import pytest
from app.auth import auth_service
from app.config import settings
from app.database import db
from app.main import app
from app.models import casino_models


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as api_client:
        yield api_client


@pytest.mark.asyncio
async def test_verify_email_rejects_invalid_token(client, monkeypatch):
    def fake_verify(token, email=None):
        raise ValueError("invalid token")

    monkeypatch.setattr(db, "verify_email_token", fake_verify)

    response = await client.post(
        "/api/auth/verify-email",
        json={"token": "not-a-real-token"},
    )

    assert response.status_code == 400
    assert "access_token" not in response.json()


@pytest.mark.asyncio
async def test_verify_email_requires_a_token(client):
    response = await client.post("/api/auth/verify-email", json={})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_verify_email_issues_token_only_after_supabase_accepts(client, monkeypatch):
    calls = {}

    def fake_verify(token, email=None):
        calls["token"] = token
        calls["email"] = email
        return SimpleNamespace(
            user=SimpleNamespace(id="user-9"),
            session=SimpleNamespace(access_token="supabase-session-token"),
        )

    monkeypatch.setattr(db, "verify_email_token", fake_verify)

    response = await client.post(
        "/api/auth/verify-email",
        json={"token": "valid-token-hash"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert body["supabase_token"] == "supabase-session-token"
    assert auth_service.verify_token(body["access_token"]).user_id == "user-9"
    assert calls == {"token": "valid-token-hash", "email": None}


@pytest.mark.asyncio
async def test_check_verification_endpoint_is_gone(client):
    """The email-lookup token mint must not come back."""
    response = await client.post(
        "/api/auth/check-verification",
        json={"email": "verified@example.com"},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_api_fails_closed_when_unconfigured(client, monkeypatch):
    monkeypatch.setattr(settings, "admin_api_key", None)

    response = await client.get("/api/admin/stats")

    assert response.status_code == 503


@pytest.mark.asyncio
async def test_admin_api_requires_the_configured_key(client, monkeypatch):
    monkeypatch.setattr(settings, "admin_api_key", "admin-secret")

    missing = await client.get("/api/admin/stats")
    wrong = await client.get(
        "/api/admin/stats",
        headers={"X-Admin-Key": "not-the-secret"},
    )
    accepted = await client.get(
        "/api/admin/stats",
        headers={"X-Admin-Key": "admin-secret"},
    )

    assert missing.status_code == 403
    assert wrong.status_code == 403
    assert accepted.status_code == 200


@pytest.mark.asyncio
async def test_admin_balance_adjustment_requires_the_key(client, monkeypatch):
    monkeypatch.setattr(settings, "admin_api_key", "admin-secret")
    calls = []

    async def fake_update(user_id, currency, amount):
        calls.append((user_id, currency, amount))

    monkeypatch.setattr(casino_models, "update_user_balance", fake_update)

    denied = await client.post(
        "/api/admin/users/user-1/balance",
        json={"ETH": 1.0},
    )
    accepted = await client.post(
        "/api/admin/users/user-1/balance",
        json={"ETH": 1.0},
        headers={"X-Admin-Key": "admin-secret"},
    )

    assert denied.status_code == 403
    assert accepted.status_code == 200, accepted.text
    assert calls == [("user-1", "ETH", 1.0)]
