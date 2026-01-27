from fastapi import APIRouter, HTTPException, status

from app.db.postgres import DataBasePool, UninitializedDatabasePoolError

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/db")
async def health_check_db() -> dict:
    try:
        pool = await DataBasePool.get_pool()
    except UninitializedDatabasePoolError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database pool not initialized",
        ) from exc

    try:
        async with pool.acquire() as connection:
            result = await connection.fetchval("SELECT 1;")
    except Exception as exc:  # pragma: no cover - exercised in container
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database unavailable",
        ) from exc

    if result != 1:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database health check failed",
        )

    return {"status": "ok", "database": "ok"}
