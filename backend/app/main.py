"""SnapBuy API entrypoint.

Image -> product identification -> SerpApi shopping search -> price comparison.

Run locally::

    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import health, image, lens, search
from app.utils.errors import SnapBuyError

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("snapbuy")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    logger.info(
        "Configuration -> serpapi=%s vision_provider=%s demo_mode=%s market=%s",
        "configured" if settings.serpapi_configured else "MISSING",
        settings.resolved_vision_provider,
        settings.demo_mode,
        settings.serpapi_location,
    )
    if settings.demo_active("search") or settings.demo_active("vision"):
        logger.warning(
            "Demo data is enabled for %s - results will be labelled 'Demo Data' in the UI.",
            ", ".join(
                capability
                for capability in ("vision", "search")
                if settings.demo_active(capability)
            ),
        )
    yield
    logger.info("Shutting down %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "SnapBuy turns a product photo into live price comparisons. "
        "AI identifies the product, SerpApi retrieves shopping results, "
        "SnapBuy normalises and ranks them."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    # Preview/hosted deployments are served from dynamic subdomains.
    allow_origin_regex=r"https://.*\.(e2b\.app|arena\.ai|vercel\.app|netlify\.app|onrender\.com)",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    response.headers["X-Process-Time-ms"] = f"{elapsed_ms:.0f}"
    return response


# --------------------------------------------------------------------------- #
# Error handling - users get friendly copy, the log keeps the technical detail.
# --------------------------------------------------------------------------- #


@app.exception_handler(SnapBuyError)
async def snapbuy_error_handler(request: Request, exc: SnapBuyError) -> JSONResponse:
    logger.warning(
        "Handled error on %s %s: code=%s message=%s detail=%s",
        request.method,
        request.url.path,
        exc.code,
        exc.message,
        exc.detail,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "invalid_request",
                "message": "That request was missing something. Check the search query and try again.",
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "server_error",
                "message": "Something went wrong on our side. Please try again.",
            }
        },
    )


app.include_router(health.router, prefix="/api")
app.include_router(image.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(lens.router, prefix="/api")


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/health",
    }
