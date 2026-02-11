from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
import logging

env_path = Path(__file__).parent.parent / ".env" # Points to 'backend/'
load_dotenv(dotenv_path=env_path)

from app import config
from app.auth import auth_service
from app.api.router import api_router


# Enable debug logging
logging.basicConfig(
    # filename='myapp.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


app = FastAPI(
    title="Crypto Casino API",
    description="Backend API for Crypto Casino App",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Include all API routes
app.include_router(api_router) 

# Health check endpoint
@app.get("/", tags=["Health"])
async def root():
    return {"message": "Crypto Casino API is live!"}

@app.get("/protected-test", tags=["Authentication"])
async def protected_test(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Test endpoint that requires authentication
    """
    token = credentials.credentials
    user = await auth_service.get_current_user(token)
    
    return {
        "message": "You have accessed a protected route!",
        "user_id": user.id,
        "email": user.email
    }
    
# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True
    )