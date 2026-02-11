from fastapi import Depends, HTTPException, status, Header
from typing import Optional
from app.auth import auth_service
from app.models import casino_models
from app.schemas import CasinoUser


# Dependency to get current user
async def get_current_user(
    authorization: str = Header(None),
    x_supabase_token: Optional[str] = Header(None)
):
    # Check for Authorization header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )
    custom_token = authorization.replace("Bearer ", "")
    supabase_user = await auth_service.get_current_user(
        custom_jwt_token=custom_token,
        supabase_token=x_supabase_token
    )
    
    # Convert datetime to string
    created_at_str = supabase_user.created_at
    if hasattr(created_at_str, 'isoformat'):
        created_at_str = supabase_user.created_at.isoformat()
        
    supabase_user.created_at = created_at_str    #Optimize later to avoid double DB calls
        
    # Get casino profile
    profile = await casino_models.get_user_profile(supabase_user.id)
    if not profile:
        # Create profile if doesn't exist
        await casino_models.create_user_profile(supabase_user.id, getattr(supabase_user, 'email', 'unknown'))
        profile = await casino_models.get_user_profile(supabase_user.id)
    
    # Attach profile to user object
    # user.profile = profile
    
    return CasinoUser(
        id=supabase_user.id,
        email=getattr(supabase_user, 'email', ''),
        username=profile.get('username'),
        profile=profile
    )
