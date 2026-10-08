"""Google Lens powered visual similarity.

Takes the user's photo, hands it to SerpApi (Image API -> ``google_lens``) and
returns the visually similar products it finds - matches by pixels, not
keywords.  Demo fixtures keep the feature presentable without a key.
"""

from __future__ import annotations

import logging
import time
import hashlib

from app.config import settings
from app.data.demo_data import DEMO_LENS_PAYLOAD
from app.models.product import VisualMatch, VisualSimilarResponse
from app.services.serpapi_service import (
    LensResult,
    clear_cache as clear_serpapi_cache,
    search_google_lens,
    upload_image_for_lens,
)
from app.utils.errors import SearchNotConfiguredError
from app.utils.images import PreparedImage, shrink_for_upload
from app.utils.normalization import normalize_visual_matches

logger = logging.getLogger("snapbuy.lens")

_lens_cache: dict[str, VisualSimilarResponse] = {}
_MAX_CACHED = 64


def demo_visual_response(notes: list[str] | None = None) -> VisualSimilarResponse:
    matches = normalize_visual_matches(DEMO_LENS_PAYLOAD, limit=12, is_demo=True)
    return VisualSimilarResponse(
        matches=matches,
        engine="google_lens (demo fixture)",
        count=len(matches),
        is_demo=True,
        notes=notes or [],
    )


def build_visual_response(
    result: LensResult,
    *,
    is_demo: bool = False,
    elapsed_ms: int | None = None,
) -> VisualSimilarResponse:
    return VisualSimilarResponse(
        matches=result.matches,
        engine=result.engine,
        count=len(result.matches),
        is_demo=is_demo,
        notes=result.notes,
    )


async def visual_similar_for_image(prepared: PreparedImage) -> VisualSimilarResponse:
    """Find products that look like the uploaded photo."""
    started = time.perf_counter()

    if settings.demo_mode == "on" or settings.demo_active("search"):
        if settings.demo_mode == "off" and not settings.serpapi_configured:
            raise SearchNotConfiguredError()
        return demo_visual_response()

    fingerprint = image_fingerprint(prepared.data)
    cached = _lens_cache.get(fingerprint)
    if cached is not None:
        return cached

    upload_bytes = shrink_for_upload(prepared)
    logger.info(
        "Lens upload bytes=%s (from %s prepared)",
        len(upload_bytes),
        len(prepared.data),
    )
    image_id = await upload_image_for_lens(upload_bytes)
    result = await search_google_lens(image_id=image_id, limit=12)

    logger.info(
        "Lens matches=%s cached=%s in %sms",
        len(result.matches),
        result.cached,
        int((time.perf_counter() - started) * 1000),
    )
    response = build_visual_response(result)
    if len(_lens_cache) >= _MAX_CACHED:
        _lens_cache.clear()
    _lens_cache[fingerprint] = response
    return response


async def visual_similar_for_url(image_url: str) -> VisualSimilarResponse:
    """Find products that look like a public image URL (e.g. a result thumbnail)."""
    started = time.perf_counter()

    if settings.demo_mode == "on" or settings.demo_active("search"):
        if settings.demo_mode == "off" and not settings.serpapi_configured:
            raise SearchNotConfiguredError()
        return demo_visual_response()

    result = await search_google_lens(image_url=image_url, limit=12)
    logger.info(
        "Lens matches=%s for url in %sms",
        len(result.matches),
        int((time.perf_counter() - started) * 1000),
    )
    return build_visual_response(result)


def image_fingerprint(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]


def clear_cache() -> None:
    _lens_cache.clear()
    clear_serpapi_cache()
