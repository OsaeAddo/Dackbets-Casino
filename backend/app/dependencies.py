
import secrets

from fastapi import Header, HTTPException, status

from app.auth import auth_service
from app.config import settings
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
    authorization: str | None = Header(None),
    x_supabase_token: str | None = Header(None)
) -> CasinoUser:
    # Check for Authorization header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )

    custom_token = authorization.removeprefix("Bearer ").strip()
    if not custom_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )

    return await auth_service.get_current_user(
        custom_jwt_token=custom_token,
        supabase_token=x_supabase_token
    )
