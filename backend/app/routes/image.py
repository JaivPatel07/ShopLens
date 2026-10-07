"""``POST /api/analyze-image`` - image upload + product identification."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, UploadFile, status

from app.config import settings
from app.models.search import VisionAttributes
from app.services import vision_service
from app.utils.errors import InvalidImageError
from app.utils.images import prepare_image, validate_upload

logger = logging.getLogger("snapbuy.routes.image")

router = APIRouter(tags=["vision"])


@router.post(
    "/analyze-image",
    response_model=VisionAttributes,
    status_code=status.HTTP_200_OK,
    summary="Identify the product in an uploaded photo",
)
async def analyze_image(file: UploadFile = File(..., description="Product photo (JPG/PNG/WEBP)")) -> VisionAttributes:
    """Accept a multipart image, identify the product and return a search query.

    This endpoint only *identifies* products - it never returns shopping results.
    """
    data = await file.read()
    validate_upload(file.filename, file.content_type, data)
    if not data:
        raise InvalidImageError("The uploaded file was empty.")

    logger.info(
        "Received image upload filename=%s content_type=%s bytes=%s demo_vision=%s",
        file.filename,
        file.content_type,
        len(data),
        settings.demo_active("vision"),
    )

    prepared = prepare_image(data, file.content_type)
    return await vision_service.analyse_image(prepared)
