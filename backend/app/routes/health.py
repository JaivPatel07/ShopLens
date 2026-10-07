"""``GET /api/health`` and ``GET /api/config``."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.models.search import AppConfigResponse, HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health() -> HealthResponse:
    """Never leaks keys - only reports whether a provider is configured."""
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        demo_mode=settings.demo_mode,
        serpapi_configured=settings.serpapi_configured,
        vision_provider=settings.resolved_vision_provider,
        vision_configured=settings.vision_configured,
    )


@router.get("/config", response_model=AppConfigResponse, summary="Public runtime configuration")
async def public_config() -> AppConfigResponse:
    """Non-secret settings the UI needs to label demo data correctly."""
    return AppConfigResponse(
        app_name=settings.app_name,
        version=settings.app_version,
        demo_mode=settings.demo_mode,
        demo_vision=settings.demo_active("vision"),
        demo_search=settings.demo_active("search"),
        serpapi_configured=settings.serpapi_configured,
        vision_provider=settings.resolved_vision_provider,
        vision_configured=settings.vision_configured,
        currency="INR",
        market=settings.serpapi_location,
        supported_image_types=["JPG", "JPEG", "PNG", "WEBP"],
        max_upload_mb=settings.max_upload_mb,
    )
