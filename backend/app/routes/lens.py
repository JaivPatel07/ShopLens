"""``POST /api/visual-similar`` - Google Lens powered visual similarity."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, Query, UploadFile, status

from app.config import settings
from app.models.product import VisualSimilarResponse
from app.services import lens_service
from app.utils.errors import InvalidImageError
from app.utils.images import prepare_image, validate_upload

logger = logging.getLogger("snapbuy.routes.lens")

router = APIRouter(tags=["visual search"])


@router.post(
    "/visual-similar",
    response_model=VisualSimilarResponse,
    status_code=status.HTTP_200_OK,
    summary="Find visually similar products for an uploaded photo",
)
async def visual_similar(
    file: UploadFile = File(..., description="Product photo (JPG/PNG/WEBP)"),
) -> VisualSimilarResponse:
    """Match the uploaded photo against Google Lens via SerpApi.

    The photo is uploaded to SerpApi's Image API (which returns a short-lived
    id) and then searched with ``engine=google_lens`` - no third-party image
    hosting involved.
    """
    data = await file.read()
    validate_upload(file.filename, file.content_type, data)
    if not data:
        raise InvalidImageError("The uploaded file was empty.")

    logger.info(
        "Visual similar upload filename=%s bytes=%s demo=%s",
        file.filename,
        len(data),
        settings.demo_mode == "on" or settings.demo_active("search"),
    )
    prepared = prepare_image(data, file.content_type)
    return await lens_service.visual_similar_for_image(prepared)


@router.get(
    "/visual-similar",
    response_model=VisualSimilarResponse,
    summary="Find visually similar products for a public image URL",
)
async def visual_similar_url(
    url: str = Query(..., min_length=8, max_length=500, description="Public image URL"),
) -> VisualSimilarResponse:
    return await lens_service.visual_similar_for_url(url)
