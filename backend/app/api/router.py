# app/api/router.py
from fastapi import APIRouter
from app.api import auth, casino, profile, wallet, games, admin, webhooks

api_router = APIRouter()

api_router.include_router(admin.router)
api_router.include_router(auth.router)
api_router.include_router(casino.router)
api_router.include_router(games.router)
api_router.include_router(profile.router)
api_router.include_router(wallet.router)
api_router.include_router(webhooks.router)