"""Request/response models for vision analysis and search."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class DetectionDebug(BaseModel):
    label: str
    score: float = Field(ge=0, le=1)


class VisionAttributes(BaseModel):
    """Structured product information extracted from a photo."""

    product_name: str
    brand: str | None = None
    category: str | None = None
    description: str | None = None
    search_query: str
    attributes: list[str] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0, le=1)
    detected: bool = True
    provider: str = "demo"
    is_demo: bool = False
    notes: list[str] = Field(default_factory=list)
    # Safe, non-secret diagnostics for support and UI debugging.
    detection_debug: list[DetectionDebug] = Field(default_factory=list)


class SearchRequest(BaseModel):
    """Body of ``POST /api/search``."""

    query: str = Field(min_length=1, max_length=300)
    limit: int = Field(default=40, ge=1, le=60)
    gl: str | None = Field(default=None, max_length=8)
    hl: str | None = Field(default=None, max_length=8)
    #: Skip the in-memory cache (used by the "refresh" action).
    force_refresh: bool = False

    @field_validator("query")
    @classmethod
    def _clean_query(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("query must not be blank")
        return cleaned


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    demo_mode: str
    serpapi_configured: bool
    vision_provider: str
    vision_configured: bool


class AppConfigResponse(BaseModel):
    """Non-secret runtime information the UI uses to label things correctly."""

    app_name: str
    version: str
    demo_mode: str
    demo_vision: bool
    demo_search: bool
    serpapi_configured: bool
    vision_provider: str
    vision_configured: bool
    currency: str
    market: str
    supported_image_types: list[str]
    max_upload_mb: float
