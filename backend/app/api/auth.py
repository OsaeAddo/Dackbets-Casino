from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime

from app.auth import auth_service
from app.config import settings
from app.dependencies import get_current_user_dep
from app.database import db
from app.models import casino_models
from app.schemas import TokenResponse, UserResponse, UserSignUp, UserSignIn

import logging

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

# Security
security = HTTPBearer()

# Authentication endpoints
@router.post("/signup", response_model=TokenResponse)
async def signup(user_data: UserSignUp):
    """
    Register a new casino user
    """
    try:
        # Sign up user with Supabase
        print(f"Attempting signup for: {user_data.email}")
        response = db.sign_up(user_data.email, user_data.password)
        
        if response.user and response.session:    
            #Create casino profile
            await casino_models.create_user_profile(
                response.user.id, 
                response.user.email,
                user_data.username
            ) 
            
            #Get initial casino profile
            profile = await casino_models.get_user_profile(response.user.id)
            
            # Check if email confirmation is required
            email_confirmed = response.user.email_confirmed_at is not None
            
            if email_confirmed:
                supabase_token = response.session.access_token #for get_user() calls
                #(optional, for my API)
                access_token = auth_service.create_access_token(
                    data={"sub": response.user.id}
                )
            else:
                # Email confirmation required
                return {
                    "user_id": response.user.id,
                    "email": response.user.email,
                    "requires_confirmation": True,
                    "message": "Please check your email to confirm your account"
                }
               
            return TokenResponse(
                access_token=access_token,
                expires_in=settings.jwt_access_token_expire_minutes * 60,
                user_id=response.user.id,
                email=response.user.email,
                supabase_token=supabase_token,
                username=user_data.username,
                balance=profile.get("balance", {}) if profile else {}
            )
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Signup error: {error_msg}")  # Debug log
        
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
        
        if auth_response:
            user = auth_response["user"]
            session = auth_response["session"]
            
            # Get Supabase's JWT token from the session
            supabase_token = session.access_token
            
            # Create JWT token
            access_token = auth_service.create_access_token(
                data={"sub": user.id}
            )
            
            return TokenResponse(
                access_token=access_token,
                expires_in=settings.jwt_access_token_expire_minutes * 60,
                user_id=user.id,
                email=user.email,
                supabase_token=supabase_token  
            )
    
    except HTTPException:
        raise
    except Exception as e:
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
async def get_current_user_info(user = Depends(get_current_user_dep)):
    """
    Get current authenticated user with casino profile
    """    
    profile = user["profile"]
    return UserResponse(
        id=user["id"],
        email=getattr(user, 'email', ''),
        username=profile.get('username'),
        created_at=profile.get('created_at', datetime.utcnow().isoformat()),
        balance=profile.get('balance', {}),
        kyc_status=profile.get('kyc_status', 'pending'),
        level=profile.get('level', 1),
        wagering_requirement=profile.get('wagering_requirement', 0.0)
    )
    
@router.get("/protected-test", tags=["Authentication"])
async def protected_test(
    user = Depends(get_current_user_dep)
):
    """
    Test endpoint that requires authentication
    """
    
    return {
        "message": "You have accessed a protected route!",
        "user_id": user["id"],
        "email": user.get("email", "")
    }
