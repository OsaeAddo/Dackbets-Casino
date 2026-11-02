
from fastapi import Header, HTTPException, status

from app.auth import auth_service
from app.schemas import CasinoUser


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
