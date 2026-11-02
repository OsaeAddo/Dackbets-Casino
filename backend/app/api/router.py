# app/api/router.py
from app.api import admin, auth, casino, games, profile, wallet, webhooks
from fastapi import APIRouter

api_router = APIRouter()

api_router.include_router(admin.router)
api_router.include_router(auth.router)
api_router.include_router(casino.router)
api_router.include_router(games.router)
api_router.include_router(profile.router)
api_router.include_router(wallet.router)
api_router.include_router(webhooks.router)