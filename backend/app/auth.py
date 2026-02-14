from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import HTTPException, status
from app.config import settings
from app.schemas import TokenData
from app.database import db

class AuthService:
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
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
        except JWTError:
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
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )
    
    @staticmethod
    async def get_current_user(
        custom_jwt_token: Optional[str] = None, 
        supabase_token: Optional[str] = None
    ):
        """
        Get current user using either:
        1. Supabase token (preferred, more reliable)
        2. Custom JWT token (fallback)
        """
        logger.debug(f"get_current_user called")
        
        # Option 1: Try with Supabase token if provided
        if supabase_token:
            try:
                logger.debug("Trying with Supabase token...")
                user = db.get_user_with_supabase_token(supabase_token)
                logger.debug(f"Supabase auth user retrieved: {user}")
                logger.debug(f"Type of user object: {type(user)}")
                if user:
                    logger.debug(f"User found via Supabase token: {user.user.id}")
                    return user
            except Exception as e:
                logger.warning(f"Supabase token failed: {str(e)}")
        
        # Option 2: Fall back to custom JWT
        try:
            logger.debug("Falling back to custom JWT...")
            token_data = AuthService.verify_token(custom_jwt_token)
            logger.debug("JWT token verified ✅, data:")
            logger.debug(f"Token Data payload: {token_data}")
            
            # Try to get user from Supabase by ID (admin API)
            try:
                user = db.get_user_by_id(token_data.user_id)
                if user:
                    logger.debug(f"User found via admin API: {user.user.id}")
                    return user
            except Exception as e:
                logger.warning(f"Admin API failed: {str(e)}")
                        
        except Exception as e:
            logger.error(f"All authentication methods failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
auth_service = AuthService()