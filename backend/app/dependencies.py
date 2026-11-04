
import secrets

from fastapi import Header, HTTPException, Request, status

from app.auth import auth_service
from app.config import settings
from app.cookies import ACCESS_COOKIE, UNSAFE_METHODS, csrf_is_valid
from app.schemas import CasinoUser


async def require_admin_key(
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
) -> None:
    """Require the shared admin secret on administrative endpoints.

    Fails closed: an unconfigured server refuses admin calls instead of
    accepting every request, and comparisons are constant-time.
    """
    configured = settings.admin_api_key
    if not configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API is not configured",
        )
    if not x_admin_key or not secrets.compare_digest(x_admin_key, configured):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin key",
        )


# Dependency to get current user
async def get_current_user_dep(
    request: Request,
    authorization: str | None = Header(None),
) -> CasinoUser:
    """Authenticate from the HttpOnly access cookie, or an explicit Bearer token.

    Bearer clients are not vulnerable to CSRF (the browser does not attach the
    token automatically), so the double-submit check applies only to cookie
    authentication.
    """
    if authorization is not None:
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid Authorization header",
            )
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid Authorization header",
            )
        return await auth_service.get_current_user(custom_jwt_token=token)

    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    if request.method in UNSAFE_METHODS and not csrf_is_valid(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing or invalid",
        )

    return await auth_service.get_current_user(custom_jwt_token=token)
