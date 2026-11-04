"""Security regression tests for the Phase 1 gaps in the handoff (§4b)."""

from types import SimpleNamespace

import httpx
import pytest
from app.auth import auth_service
from app.database import db
from app.main import app


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
