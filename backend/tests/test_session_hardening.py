"""Session hardening: HttpOnly cookies, CSRF double-submit, refresh rotation."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest
from app.cookies import CSRF_HEADER
from app.database import db
from app.dependencies import get_current_user_dep
from app.main import app
from app.models import casino_models
from app.schemas import CasinoUser
from app.session_service import (
    RefreshRejected,
    SessionTokens,
    hash_refresh_token,
    session_service,
)
from fastapi import HTTPException
from starlette.requests import Request


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as api_client:
        yield api_client


def _request(
    method: str,
    cookie: str | None = None,
    csrf: str | None = None,
    authorization: str | None = None,
) -> Request:
    headers = []
    if cookie:
        headers.append((b"cookie", cookie.encode()))
    if csrf:
        headers.append((b"x-csrf-token", csrf.encode()))
    if authorization:
        headers.append((b"authorization", authorization.encode()))
    return Request(
        {
            "type": "http",
            "method": method,
            "headers": headers,
            "path": "/",
            "query_string": b"",
            "scheme": "http",
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 1234),
        }
    )


def _set_cookies(response: httpx.Response) -> list[str]:
    return response.headers.get_list("set-cookie")


@pytest.mark.asyncio
async def test_cookie_auth_accepts_get_without_csrf(monkeypatch):
    async def fake_user(custom_jwt_token):
        return CasinoUser(id="user-1", email="player@example.com")

    monkeypatch.setattr(
        "app.dependencies.auth_service.get_current_user",
        fake_user,
    )

    user = await get_current_user_dep(
        _request("GET", cookie="casino_access=token"),
        authorization=None,
    )

    assert user.id == "user-1"


@pytest.mark.asyncio
async def test_cookie_auth_rejects_unsafe_request_without_csrf(monkeypatch):
    async def fake_user(custom_jwt_token):
        return CasinoUser(id="user-1", email="player@example.com")

    monkeypatch.setattr(
        "app.dependencies.auth_service.get_current_user",
        fake_user,
    )

    with pytest.raises(HTTPException) as exc:
        await get_current_user_dep(
            _request("POST", cookie="casino_access=token"),
            authorization=None,
        )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_cookie_auth_rejects_mismatched_csrf(monkeypatch):
    async def fake_user(custom_jwt_token):
        return CasinoUser(id="user-1", email="player@example.com")

    monkeypatch.setattr(
        "app.dependencies.auth_service.get_current_user",
        fake_user,
    )

    with pytest.raises(HTTPException) as exc:
        await get_current_user_dep(
            _request("POST", cookie="casino_access=token; casino_csrf=right", csrf="wrong"),
            authorization=None,
        )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_cookie_auth_accepts_matching_csrf(monkeypatch):
    async def fake_user(custom_jwt_token):
        return CasinoUser(id="user-1", email="player@example.com")

    monkeypatch.setattr(
        "app.dependencies.auth_service.get_current_user",
        fake_user,
    )

    user = await get_current_user_dep(
        _request("POST", cookie="casino_access=token; casino_csrf=shared", csrf="shared"),
        authorization=None,
    )

    assert user.id == "user-1"


@pytest.mark.asyncio
async def test_bearer_auth_does_not_require_csrf(monkeypatch):
    async def fake_user(custom_jwt_token):
        assert custom_jwt_token == "header-token"
        return CasinoUser(id="user-1", email="player@example.com")

    monkeypatch.setattr(
        "app.dependencies.auth_service.get_current_user",
        fake_user,
    )

    request = _request("POST", authorization="Bearer header-token")

    user = await get_current_user_dep(request, authorization="Bearer header-token")

    assert user.id == "user-1"


@pytest.mark.asyncio
async def test_signin_sets_httponly_cookies_and_leaks_no_token(client, monkeypatch):
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

    async def fake_get_profile(user_id):
        return {"username": "player", "balance": {"ETH": 0.5}}

    monkeypatch.setattr(casino_models, "create_session", fake_create_session)
    monkeypatch.setattr(casino_models, "get_user_profile", fake_get_profile)

    response = await client.post(
        "/api/auth/signin",
        json={"email": "player@example.com", "password": "password123"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert "access_token" not in body
    assert "supabase_token" not in body
    assert body["user_id"] == "user-1"

    cookies = _set_cookies(response)
    access = next(c for c in cookies if c.startswith("casino_access="))
    refresh = next(c for c in cookies if c.startswith("casino_refresh="))
    csrf = next(c for c in cookies if c.startswith("casino_csrf="))
    assert "httponly" in access.lower()
    assert "httponly" in refresh.lower()
    assert "path=/api/auth" in refresh.lower()
    assert "httponly" not in csrf.lower()
    assert "samesite=lax" in access.lower()

    me = await client.get("/api/auth/me")
    assert me.status_code == 200, me.text
    assert me.json()["email"] == "player@example.com"


@pytest.mark.asyncio
async def test_refresh_requires_csrf(client):
    response = await client.post(
        "/api/auth/refresh",
        headers={"cookie": "casino_refresh=old; casino_csrf=csrf"},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_refresh_rotates_the_cookie_pair(client, monkeypatch):
    rotated = SessionTokens(
        access_token="new-access",
        refresh_token="new-refresh",
        csrf_token="new-csrf",
        session_id="session-2",
    )
    seen = {}

    async def fake_rotate(token):
        seen["token"] = token
        return rotated, "user-1"

    monkeypatch.setattr(session_service, "rotate", fake_rotate)

    response = await client.post(
        "/api/auth/refresh",
        headers={
            "cookie": "casino_refresh=old; casino_csrf=old-csrf",
            CSRF_HEADER: "old-csrf",
        },
    )

    assert response.status_code == 200, response.text
    assert seen["token"] == "old"
    cookies = _set_cookies(response)
    assert any("casino_access=new-access" in c for c in cookies)
    assert any("casino_refresh=new-refresh" in c for c in cookies)
    assert any("casino_csrf=new-csrf" in c for c in cookies)


@pytest.mark.asyncio
async def test_refresh_rejection_clears_cookies(client, monkeypatch):
    async def fake_rotate(token):
        raise RefreshRejected("replayed")

    monkeypatch.setattr(session_service, "rotate", fake_rotate)

    response = await client.post(
        "/api/auth/refresh",
        headers={
            "cookie": "casino_refresh=old; casino_csrf=csrf",
            CSRF_HEADER: "csrf",
        },
    )

    assert response.status_code == 401
    cookies = _set_cookies(response)
    assert any(c.startswith("casino_access=") and "Max-Age=0" in c for c in cookies)


@pytest.mark.asyncio
async def test_signout_revokes_and_clears_cookies(client, monkeypatch):
    seen = []

    async def fake_revoke(token):
        seen.append(token)

    monkeypatch.setattr(session_service, "revoke", fake_revoke)

    response = await client.post(
        "/api/auth/signout",
        headers={"cookie": "casino_refresh=refresh-abc"},
    )

    assert response.status_code == 200
    assert seen == ["refresh-abc"]
    cookies = _set_cookies(response)
    assert any(c.startswith("casino_refresh=") and "Max-Age=0" in c for c in cookies)


@pytest.mark.asyncio
async def test_rotation_creates_a_replacement_in_the_same_family(monkeypatch):
    row = {
        "id": "session-1",
        "user_id": "user-1",
        "family_id": "family-1",
        "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "revoked_at": None,
    }
    calls = {}

    async def fake_get(token_hash):
        calls["hash"] = token_hash
        return row

    async def fake_claim(session_id):
        calls["claim"] = session_id
        return True

    async def fake_create(**kwargs):
        calls["create"] = kwargs
        return {"id": "session-2"}

    async def fake_mark(session_id, replaced_by):
        calls["mark"] = (session_id, replaced_by)

    monkeypatch.setattr(casino_models, "get_session_by_hash", fake_get)
    monkeypatch.setattr(casino_models, "claim_session_for_rotation", fake_claim)
    monkeypatch.setattr(casino_models, "create_session", fake_create)
    monkeypatch.setattr(casino_models, "mark_session_replaced", fake_mark)

    tokens, user_id = await session_service.rotate("refresh-abc")

    assert user_id == "user-1"
    assert tokens.session_id == "session-2"
    assert calls["hash"] == hash_refresh_token("refresh-abc")
    assert calls["claim"] == "session-1"
    assert calls["create"]["family_id"] == "family-1"
    assert calls["mark"] == ("session-1", "session-2")


@pytest.mark.asyncio
async def test_replayed_refresh_token_revokes_the_family(monkeypatch):
    revoked = []

    async def fake_get(token_hash):
        return {
            "id": "session-1",
            "user_id": "user-1",
            "family_id": "family-1",
            "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "revoked_at": "2026-11-04T00:00:00+00:00",
        }

    async def fake_revoke_family(family_id):
        revoked.append(family_id)

    monkeypatch.setattr(casino_models, "get_session_by_hash", fake_get)
    monkeypatch.setattr(casino_models, "revoke_session_family", fake_revoke_family)

    with pytest.raises(RefreshRejected):
        await session_service.rotate("refresh-abc")

    assert revoked == ["family-1"]


@pytest.mark.asyncio
async def test_expired_refresh_token_is_revoked(monkeypatch):
    revoked = []

    async def fake_get(token_hash):
        return {
            "id": "session-1",
            "user_id": "user-1",
            "family_id": "family-1",
            "expires_at": (datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
            "revoked_at": None,
        }

    async def fake_revoke(session_id):
        revoked.append(session_id)

    monkeypatch.setattr(casino_models, "get_session_by_hash", fake_get)
    monkeypatch.setattr(casino_models, "revoke_session", fake_revoke)

    with pytest.raises(RefreshRejected):
        await session_service.rotate("refresh-abc")

    assert revoked == ["session-1"]


@pytest.mark.asyncio
async def test_losing_the_rotation_race_does_not_revoke_the_family(monkeypatch):
    revoked = []

    async def fake_get(token_hash):
        return {
            "id": "session-1",
            "user_id": "user-1",
            "family_id": "family-1",
            "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "revoked_at": None,
        }

    async def fake_claim(session_id):
        return False

    async def fake_revoke_family(family_id):
        revoked.append(family_id)

    monkeypatch.setattr(casino_models, "get_session_by_hash", fake_get)
    monkeypatch.setattr(casino_models, "claim_session_for_rotation", fake_claim)
    monkeypatch.setattr(casino_models, "revoke_session_family", fake_revoke_family)

    with pytest.raises(RefreshRejected):
        await session_service.rotate("refresh-abc")

    # The other tab won the rotation; its new token must stay valid.
    assert revoked == []


def test_secure_cookie_setting_defaults_on():
    from app.config import Settings

    # Production default; the autouse test fixture flips the shared instance.
    assert Settings.model_fields["cookie_secure"].default is True
    assert Settings.model_fields["cookie_samesite"].default == "lax"
