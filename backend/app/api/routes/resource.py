from fastapi import APIRouter

# Application domain resources will live under /api/v1/resource/*
router = APIRouter(prefix="/resource", tags=["resource"])

