"""Refresh-token sessions with rotation and reuse detection.

The access token is a short-lived JWT carried in an HttpOnly cookie. The
refresh token is opaque, stored only as a SHA-256 hash, and rotated on every
use. Presenting a revoked token means it was replayed, so the whole rotation
family is revoked.
"""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.auth import auth_service
from app.config import settings
from app.models import casino_models


class RefreshRejected(Exception):
    """The presented refresh token cannot be exchanged for a session."""


@dataclass(frozen=True)
class SessionTokens:
    access_token: str
    refresh_token: str
    csrf_token: str
    session_id: str | None = None


def hash_refresh_token(token: str) -> str:
    """Hash a refresh token for storage; only this digest touches the database."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _refresh_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)


def _parse_timestamp(value: str) -> datetime:
    """Parse a Supabase timestamptz (``Z`` or offset form) into an aware datetime."""
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


class SessionService:
    @staticmethod
    async def create(user_id: str, family_id: str | None = None) -> SessionTokens:
        """Start a new login session (or a rotation of an existing family)."""
        refresh_token = secrets.token_urlsafe(48)
        family = family_id or str(uuid.uuid4())

        row = await casino_models.create_session(
            user_id=user_id,
            token_hash=hash_refresh_token(refresh_token),
            family_id=family,
            expires_at=_refresh_expiry().isoformat(),
        )

        return SessionTokens(
            access_token=auth_service.create_access_token(data={"sub": user_id}),
            refresh_token=refresh_token,
            csrf_token=secrets.token_urlsafe(32),
            session_id=(row or {}).get("id"),
        )

    @staticmethod
    async def rotate(refresh_token: str) -> tuple[SessionTokens, str]:
        """Exchange a refresh token for a rotated pair.

        Returns the new tokens and the owning user id.
        """
        row = await casino_models.get_session_by_hash(
            hash_refresh_token(refresh_token)
        )
        if row is None:
            raise RefreshRejected("unknown refresh token")

        # A revoked token is a replay: assume theft and burn the family.
        if row.get("revoked_at"):
            await casino_models.revoke_session_family(row["family_id"])
            raise RefreshRejected("refresh token was already used")

        if _parse_timestamp(row["expires_at"]) <= datetime.now(UTC):
            await casino_models.revoke_session(row["id"])
            raise RefreshRejected("refresh token expired")

        # Atomic claim: only one concurrent request can rotate this token.
        # A lost claim is benign (another tab refreshed first) and must not
        # revoke the family; a genuine replay is caught by the revoked_at
        # branch above on the next request.
        if not await casino_models.claim_session_for_rotation(row["id"]):
            raise RefreshRejected("refresh token is being rotated")

        tokens = await SessionService.create(
            user_id=row["user_id"],
            family_id=row["family_id"],
        )
        if tokens.session_id:
            await casino_models.mark_session_replaced(row["id"], tokens.session_id)
        return tokens, row["user_id"]

    @staticmethod
    async def revoke(refresh_token: str) -> None:
        """Revoke the session behind a refresh token, if it still exists."""
        row = await casino_models.get_session_by_hash(
            hash_refresh_token(refresh_token)
        )
        if row and not row.get("revoked_at"):
            await casino_models.revoke_session_family(row["family_id"])


session_service = SessionService()
