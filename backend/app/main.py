import logging

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router as api_router
from app.db.postgres import DataBasePool
from app.agents.runner import initialize_runner

logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    app = FastAPI()

    # Global middleware
    app.add_middleware(GZipMiddleware)

    # CORS middleware for frontend communication
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API routers
    app.include_router(api_router, prefix="/api/v1")

    @app.on_event("startup")
    async def startup() -> None:
        # Create a database connection pool
        await DataBasePool.setup()

        # Initialize AI agent runner with database pool
        pool = DataBasePool.get_pool()
        initialize_runner(pool)

    @app.on_event("shutdown")
    async def shutdown() -> None:
        # Close the database connection pool on shutdown
        await DataBasePool.teardown()

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
