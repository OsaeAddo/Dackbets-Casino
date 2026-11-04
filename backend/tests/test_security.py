"""Security regression tests for the Phase 1 gaps in the handoff (§4b)."""

import hashlib
import hmac
from types import SimpleNamespace

import httpx
import pytest
from app.auth import auth_service
from app.config import settings
from app.core.tatum_webhook import WebhookProcessor
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


def _sign(body: bytes, secret: str, algorithm: str = "sha256") -> str:
    return hmac.new(secret.encode(), body, getattr(hashlib, algorithm)).hexdigest()


@pytest.mark.asyncio
async def test_webhook_fails_closed_without_a_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "webhook_hmac_secret", None)

    response = await client.post("/api/webhooks/tatum/deposit", json={})

    assert response.status_code == 503


@pytest.mark.asyncio
async def test_webhook_rejects_missing_or_invalid_signature(client, monkeypatch):
    monkeypatch.setattr(settings, "webhook_hmac_secret", "webhook-secret")
    body = b'{"txId": "0xabc", "address": "0xdef", "amount": 1}'

    unsigned = await client.post(
        "/api/webhooks/tatum/deposit",
        content=body,
        headers={"Content-Type": "application/json"},
    )
    wrong = await client.post(
        "/api/webhooks/tatum/deposit",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Signature": "sha256=" + "0" * 64,
        },
    )

    assert unsigned.status_code == 401
    assert wrong.status_code == 401


@pytest.mark.asyncio
async def test_webhook_accepts_a_valid_signature_and_queues_the_deposit(
    client, monkeypatch
):
    monkeypatch.setattr(settings, "webhook_hmac_secret", "webhook-secret")
    events = []

    async def fake_process(self, event):
        events.append(event)
        return {"status": "confirmed"}

    monkeypatch.setattr(WebhookProcessor, "process_deposit", fake_process)

    body = (
        b'{"txId": "0xabc", "asset": "eth", "amount": "1.5", '
        b'"address": "0xdef", "confirmations": 12}'
    )
    response = await client.post(
        "/api/webhooks/tatum/deposit",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Signature": "sha256=" + _sign(body, "webhook-secret"),
        },
    )

    assert response.status_code == 200, response.text
    assert events[0].tx_hash == "0xabc"
    assert events[0].currency == "ETH"
    assert events[0].amount == 1.5


@pytest.mark.asyncio
async def test_tatum_style_payload_hash_signature_is_accepted(client, monkeypatch):
    monkeypatch.setattr(settings, "webhook_hmac_secret", "webhook-secret")

    async def fake_process(self, event):
        return {"status": "confirmed"}

    monkeypatch.setattr(WebhookProcessor, "process_deposit", fake_process)

    body = b'{"txId": "0x512", "address": "0xdef", "amount": 2}'
    response = await client.post(
        "/api/webhooks/tatum/deposit",
        content=body,
        headers={
            "Content-Type": "application/json",
            "x-payload-hash": _sign(body, "webhook-secret", "sha512"),
        },
    )

    assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_test_webhooks_are_hidden_unless_enabled(client, monkeypatch):
    monkeypatch.setattr(settings, "enable_test_webhooks", False)
    monkeypatch.setattr(settings, "admin_api_key", "admin-secret")

    response = await client.post(
        "/api/webhooks/test/deposit",
        json={"amount": 1},
        headers={"X-Admin-Key": "admin-secret"},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_test_webhooks_require_the_admin_key_when_enabled(client, monkeypatch):
    monkeypatch.setattr(settings, "enable_test_webhooks", True)
    monkeypatch.setattr(settings, "admin_api_key", "admin-secret")

    response = await client.post("/api/webhooks/test/deposit", json={"amount": 1})

    assert response.status_code == 403
