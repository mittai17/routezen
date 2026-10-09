from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging

log = logging.getLogger("routezen")


@asynccontextmanager
async def lifespan(_: FastAPI):
    s = get_settings()
    configure_logging(s.log_level, s.log_json)
    log.info("starting RouteZen API", extra={"env": s.app_env, "osrm": s.osrm_base_url})
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="RouteZen API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=s.cors_origin_list, allow_methods=["*"], allow_headers=["*"],
        allow_credentials=False,
    )

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        log.exception("unhandled error")
        return JSONResponse({"detail": "internal server error"}, status_code=500)

    app.include_router(api_router)
    return app


app = create_app()
