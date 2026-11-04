import logging
from datetime import UTC, datetime

from app.auth import auth_service
from app.config import settings
from app.database import db
from app.dependencies import get_current_user_dep
from app.models import casino_models
from app.schemas import (
    CasinoUser,
    EmailVerificationResponse,
    SignupResponse,
    TokenResponse,
    UserResponse,
    UserSignIn,
    UserSignUp,
    VerifyEmailRequest,
)
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

# Security
security = HTTPBearer()


async def _ensure_user_profile(user_id: str, email: str, username: str | None = None) -> dict:
    """Create the casino profile, tolerating a profile that already exists."""
    try:
        await casino_models.create_user_profile(user_id, email, username)
    except Exception:
        # Signup retries can race with an existing profile insert. If a
        # profile is already there, use it; otherwise surface the original
        # failure so we do not report a false success.
        existing_profile = await casino_models.get_user_profile(user_id)
        if existing_profile is None:
            raise

    return await casino_models.get_user_profile(user_id) or {}


# Authentication endpoints
@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserSignUp) -> SignupResponse:
    """
    Register a new casino user.

    Supabase may return either an active session (auto-confirm enabled) or no
    session (email confirmation required). Both branches return SignupResponse.
    """
    try:
        logger.info("Attempting signup for: %s", user_data.email)
        response = db.sign_up(user_data.email, user_data.password)

        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration failed: Supabase did not return a user",
            )

        user = response.user
        # The profile must exist even when Supabase requires email confirmation.
        profile = await _ensure_user_profile(user.id, user.email, user_data.username)
        username = profile.get("username") or user_data.username

        if response.session is None or user.email_confirmed_at is None:
            return SignupResponse(
                user_id=user.id,
                email=user.email,
                username=username,
                requires_confirmation=True,
                message=(
                    "Account created. Please check your email to confirm your "
                    "account before signing in."
                ),
            )

        access_token = auth_service.create_access_token(
            data={"sub": user.id}
        )

        return SignupResponse(
            user_id=user.id,
            email=user.email,
            username=username,
            requires_confirmation=False,
            message="Account created successfully.",
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.jwt_access_token_expire_minutes * 60,
            supabase_token=response.session.access_token,
        )

    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 - API boundary: convert unexpected failures into an HTTP error response
        error_msg = str(e)
        logger.error("Signup error: %s", error_msg)

        # Handle specific Supabase errors
        if "already registered" in error_msg.lower():
            detail = "Email already registered"
        elif "email" in error_msg.lower() and "invalid" in error_msg.lower():
            detail = f"Email validation failed: {error_msg}"
        elif "password" in error_msg.lower():
            detail = f"Password validation failed: {error_msg}"
        else:
            detail = f"Registration failed: {error_msg}"

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


@router.post("/verify-email", response_model=EmailVerificationResponse)
async def verify_email(token_data: VerifyEmailRequest) -> EmailVerificationResponse:
    """Exchange a Supabase email-confirmation token for an application JWT.

    The token is validated by Supabase. There is deliberately no fallback that
    mints a token from an email address: knowing an address must never be
    enough to obtain that user's session.
    """
    try:
        response = db.verify_email_token(token_data.token, token_data.email)
    except Exception as e:  # noqa: BLE001 - Verification failure must not leak token details
        logger.warning("Email verification rejected: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    user = getattr(response, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    session = getattr(response, "session", None)
    access_token = auth_service.create_access_token(data={"sub": str(user.id)})
    return EmailVerificationResponse(
        success=True,
        message="Email verified",
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        supabase_token=getattr(session, "access_token", None),
    )


@router.post("/signin", response_model=TokenResponse)
async def signin(user_data: UserSignIn):
    """
    Authenticate user and return tokens
    """
    try:
        # Authenticate with Supabase
        auth_response = await auth_service.authenticate_user(
            user_data.email,
            user_data.password
        )

        if not auth_response:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        user = auth_response["user"]
        session = auth_response["session"]

        # Get Supabase's JWT token from the session
        supabase_token = session.access_token

        # Create JWT token
        access_token = auth_service.create_access_token(
            data={"sub": user.id}
        )

        profile = await casino_models.get_user_profile(user.id) or {}

        return TokenResponse(
            access_token=access_token,
            expires_in=settings.jwt_access_token_expire_minutes * 60,
            user_id=user.id,
            email=user.email,
            username=profile.get("username"),
            supabase_token=supabase_token,
            balance=profile.get("balance", {}) or {},
        )

    except HTTPException:
        raise
    except Exception:  # noqa: BLE001 - API boundary: convert unexpected failures into an HTTP error response
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )


@router.post("/signout")
async def signout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Sign out user (invalidate token on client side)
    """
    # Note: With JWT, we can't invalidate server-side without a blacklist
    # This just tells client to remove token
    return {"message": "Signed out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: CasinoUser = Depends(get_current_user_dep)):
    """
    Get current authenticated user with casino profile
    """
    profile = user.profile
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username or profile.get("username"),
        created_at=profile.get("created_at") or datetime.now(UTC).isoformat(),
        balance=profile.get("balance", {}) or {},
        kyc_status=profile.get("kyc_status", "pending"),
        level=profile.get("level", 1),
        wagering_requirement=profile.get("wagering_requirement", 0.0)
    )


@router.get("/protected-test", tags=["Authentication"])
async def protected_test(
    user: CasinoUser = Depends(get_current_user_dep)
):
    """
    Test endpoint that requires authentication
    """

    return {
        "message": "You have accessed a protected route!",
        "user_id": user.id,
        "email": user.email
    }
