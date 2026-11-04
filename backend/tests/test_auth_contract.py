from types import SimpleNamespace

import httpx
import pytest
from app.auth import auth_service
from app.database import db
from app.main import app
from app.models import casino_models


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as api_client:
        yield api_client


@pytest.mark.asyncio
async def test_signup_without_session_returns_confirmation(client, monkeypatch):
    """Signup must return SignupResponse and create a profile without a session."""
    created = {}
    user = SimpleNamespace(
        id="user-1",
        email="new@example.com",
        email_confirmed_at=None,
    )

    monkeypatch.setattr(
        db,
        "sign_up",
        lambda email, password: SimpleNamespace(user=user, session=None),
    )

    async def fake_create_profile(user_id, email, username=None):
        created.update(
            {"user_id": user_id, "email": email, "username": username}
        )

    async def fake_get_profile(user_id):
        return {"username": "new-player", "balance": {}, "created_at": "2026-01-01T00:00:00"}

    monkeypatch.setattr(casino_models, "create_user_profile", fake_create_profile)
    monkeypatch.setattr(casino_models, "get_user_profile", fake_get_profile)

    response = await client.post(
        "/api/auth/signup",
        json={
            "email": "new@example.com",
            "password": "password123",
            "username": "new-player",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user_id"] == "user-1"
    assert body["email"] == "new@example.com"
    assert body["requires_confirmation"] is True
    assert "access_token" not in body
    assert "supabase_token" not in body
    assert "check your email" in body["message"].lower()
    assert created == {
        "user_id": "user-1",
        "email": "new@example.com",
        "username": "new-player",
    }


@pytest.mark.asyncio
async def test_signin_then_me_returns_stable_user_id(client, monkeypatch):
    """The custom-JWT fallback must return a normalized user with a defined id."""
    user = SimpleNamespace(id="user-1", email="player@example.com")
    session = SimpleNamespace(access_token="supabase-access-token")

    monkeypatch.setattr(
        db,
        "sign_in",
        lambda email, password: SimpleNamespace(user=user, session=session),
    )
    monkeypatch.setattr(db, "get_user_by_id", lambda user_id: user)

    async def fake_create_session(**kwargs):
        return {"id": "session-1", **kwargs}

    monkeypatch.setattr(casino_models, "create_session", fake_create_session)

    async def fake_get_profile(user_id):
        return {
            "username": "player",
            "balance": {"ETH": 0.5},
            "created_at": "2026-01-01T00:00:00",
            "kyc_status": "pending",
            "level": 1,
        }

    monkeypatch.setattr(casino_models, "get_user_profile", fake_get_profile)

    signin_response = await client.post(
        "/api/auth/signin",
        json={"email": "player@example.com", "password": "password123"},
    )
    assert signin_response.status_code == 200, signin_response.text
    signin_body = signin_response.json()
    assert signin_body["user_id"] == "user-1"
    assert "access_token" not in signin_body
    assert signin_response.cookies.get("casino_access")

    me_response = await client.get("/api/auth/me")
    assert me_response.status_code == 200, me_response.text
    me = me_response.json()
    assert me["id"] == "user-1"
    assert me["email"] == "player@example.com"
    assert me["username"] == "player"
    assert me["balance"] == {"ETH": 0.5}


@pytest.mark.asyncio
async def test_custom_jwt_fallback_normalizes_supabase_user_shape(client, monkeypatch):
    """The admin API returns a bare User, unlike the Supabase token wrapper."""
    token = auth_service.create_access_token(data={"sub": "user-2"})
    user = SimpleNamespace(id="user-2", email="fallback@example.com")

    monkeypatch.setattr(db, "get_user_by_id", lambda user_id: user)

    async def fake_get_profile(user_id):
        return {"username": "fallback", "balance": {}, "created_at": "2026-01-01T00:00:00"}

    monkeypatch.setattr(casino_models, "get_user_profile", fake_get_profile)

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["id"] == "user-2"
