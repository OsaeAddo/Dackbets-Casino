"""Cookie names, setters and CSRF helpers for the session-hardening flow.

Tokens never reach JavaScript:

- ``casino_access`` (HttpOnly) holds the short-lived application JWT.
- ``casino_refresh`` (HttpOnly, path ``/api/auth``) holds the rotating opaque
  refresh token.
- ``casino_csrf`` (readable) is the double-submit CSRF token; the SPA echoes it
  in ``X-CSRF-Token`` on every unsafe request.
- ``casino_session`` (readable, no secret) lets the Next.js middleware know a
  refreshable session exists even when the access cookie has expired.
"""

import secrets

from fastapi import Request, Response

from app.config import settings
from app.session_service import SessionTokens

ACCESS_COOKIE = "casino_access"
REFRESH_COOKIE = "casino_refresh"
CSRF_COOKIE = "casino_csrf"
SESSION_COOKIE = "casino_session"
CSRF_HEADER = "X-CSRF-Token"

REFRESH_COOKIE_PATH = "/api/auth"
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

def _access_max_age() -> int:
    return settings.jwt_access_token_expire_minutes * 60


def _refresh_max_age() -> int:
    return settings.refresh_token_expire_days * 86400


def _cookie_attributes() -> dict:
    attributes: dict = {
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
    }
    if settings.cookie_domain:
        attributes["domain"] = settings.cookie_domain
    return attributes


def set_auth_cookies(response: Response, tokens: SessionTokens) -> None:
    """Attach the access, refresh, CSRF and session-marker cookies."""
    attributes = _cookie_attributes()

    response.set_cookie(
        ACCESS_COOKIE,
        tokens.access_token,
        max_age=_access_max_age(),
        path="/",
        httponly=True,
        **attributes,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        tokens.refresh_token,
        max_age=_refresh_max_age(),
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        **attributes,
    )
    # JS must read the CSRF token to echo it, so this cookie is not HttpOnly.
    response.set_cookie(
        CSRF_COOKIE,
        tokens.csrf_token,
        max_age=_refresh_max_age(),
        path="/",
        httponly=False,
        **attributes,
    )
    # Non-secret marker only; the middleware uses it to avoid bouncing a user
    # whose access cookie has expired but whose refresh cookie is still valid.
    response.set_cookie(
        SESSION_COOKIE,
        "1",
        max_age=_refresh_max_age(),
        path="/",
        httponly=False,
        **attributes,
    )


def clear_auth_cookies(response: Response) -> None:
    """Expire every auth cookie, including the path-scoped refresh cookie."""
    attributes = _cookie_attributes()
    for name, path in (
        (ACCESS_COOKIE, "/"),
        (REFRESH_COOKIE, REFRESH_COOKIE_PATH),
        (CSRF_COOKIE, "/"),
        (SESSION_COOKIE, "/"),
    ):
        response.delete_cookie(name, path=path, **attributes)


def csrf_is_valid(request: Request) -> bool:
    """Double-submit check: header must match the readable CSRF cookie."""
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header:
        return False
    return secrets.compare_digest(cookie, header)
