import logging
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import HTTPException, status
from jwt import InvalidTokenError

from app.config import settings
from app.database import db
from app.models import casino_models
from app.schemas import CasinoUser, TokenData

logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    def create_access_token(data: dict, expires_delta: timedelta | None = None):
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(UTC) + expires_delta
        else:
            expire = datetime.now(UTC) + timedelta(
                minutes=settings.jwt_access_token_expire_minutes
            )

        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm
        )
        return encoded_jwt

    @staticmethod
    def verify_token(token: str) -> TokenData:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm]
            )
            user_id: str = payload.get("sub")
            if user_id is None:
                raise credentials_exception
            return TokenData(user_id=user_id)
        except InvalidTokenError:
            raise credentials_exception

    @staticmethod
    async def authenticate_user(email: str, password: str):
        try:
            response = db.sign_in(email, password)
            if response.user and response.session:
                return {
                    "user": response.user,
                    "session": response.session
                }
            return None
        except Exception:  # noqa: BLE001 - Authentication fallback: try the next credential source
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

    @staticmethod
    async def _resolve_auth_user(custom_jwt_token: str):
        """Resolve the Supabase auth user behind an application JWT."""
        try:
            token_data = AuthService.verify_token(custom_jwt_token)
            user = db.get_user_by_id(token_data.user_id)
            if user:
                logger.debug("User found via admin API: %s", user.id)
                return user
        except Exception as e:  # noqa: BLE001 - Authentication boundary: normalizes every failure to 401
            logger.warning("Custom JWT authentication failed: %s", str(e))

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    @staticmethod
    async def get_current_user(custom_jwt_token: str) -> CasinoUser:
        """Get the current user from an application JWT and load their profile."""
        auth_user = await AuthService._resolve_auth_user(
            custom_jwt_token=custom_jwt_token,
        )
        user_id = str(auth_user.id)
        email = getattr(auth_user, "email", "") or ""

        profile = await casino_models.get_user_profile(user_id)
        if profile is None:
            # Keep the profile invariant: every authenticated user has one.
            await casino_models.create_user_profile(user_id, email)
            profile = await casino_models.get_user_profile(user_id)
        profile = profile or {}

        return CasinoUser(
            id=user_id,
            email=email,
            username=profile.get("username"),
            profile=profile,
        )


auth_service = AuthService()
