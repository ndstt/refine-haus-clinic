import logging

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware

from app.api.router import router as api_router
from app.db.postgres import DataBasePool

logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    app = FastAPI()

    # Global middleware
    app.add_middleware(GZipMiddleware)

    # API routers
    app.include_router(api_router, prefix="/api/v1")

    @app.on_event("startup")
    async def startup() -> None:
        # Create a database connection pool
        await DataBasePool.setup()

    @app.on_event("shutdown")
    async def shutdown() -> None:
        # Close the database connection pool on shutdown
        await DataBasePool.teardown()

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
