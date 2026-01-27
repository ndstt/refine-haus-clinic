from fastapi import APIRouter

# AI-related endpoints will live under /api/v1/ai/*
router = APIRouter(prefix="/ai", tags=["ai"])

