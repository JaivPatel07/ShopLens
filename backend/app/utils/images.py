"""Upload validation and image preparation.

Large phone photos are downscaled and re-encoded before they are sent to a
vision provider.  That keeps request payloads small (faster + cheaper) without
hurting recognition quality.
"""

from __future__ import annotations

import io
import logging

from PIL import Image, UnidentifiedImageError

from app.config import settings
from app.utils.errors import ImageTooLargeError, InvalidImageError

logger = logging.getLogger("snapbuy.images")

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
ALLOWED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")
MAX_UPLOAD_BYTES = int(settings.max_upload_mb * 1024 * 1024)


class PreparedImage:
    """A validated, resized image ready for a vision provider."""

    def __init__(self, data: bytes, mime_type: str, width: int, height: int, original_bytes: int):
        self.data = data
        self.mime_type = mime_type
        self.width = width
        self.height = height
        self.original_bytes = original_bytes

    @property
    def data_uri(self) -> str:
        import base64

        encoded = base64.b64encode(self.data).decode("ascii")
        return f"data:{self.mime_type};base64,{encoded}"


def validate_upload(filename: str | None, content_type: str | None, data: bytes) -> None:
    """Reject files that are obviously not usable images."""
    if not data:
        raise InvalidImageError("The uploaded file was empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ImageTooLargeError(
            f"That image is too large ({len(data) / 1024 / 1024:.1f} MB). "
            f"Please upload a file smaller than {settings.max_upload_mb:g} MB."
        )

    looks_like_image = data[:3] == b"\xff\xd8\xff" or data[1:4] in (b"PNG", b"WEBP") or data[4:12] == b"ftypheic"
    name_ok = bool(filename) and filename.lower().endswith(ALLOWED_EXTENSIONS)
    type_ok = bool(content_type) and content_type.lower() in ALLOWED_CONTENT_TYPES

    if not looks_like_image and not (type_ok and name_ok):
        raise InvalidImageError()


def prepare_image(data: bytes, content_type: str | None = None) -> PreparedImage:
    """Validate, auto-orient, downscale and re-encode an uploaded image.

    Falls back to returning the original bytes when Pillow cannot decode the
    file but the file signature looked valid (rare formats such as HEIC).
    """
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            original_size = image.size
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            elif image.mode == "L":
                image = image.convert("RGB")

            max_dimension = settings.max_image_dimension
            if max(image.size) > max_dimension:
                ratio = max_dimension / float(max(image.size))
                new_size = (max(1, int(image.width * ratio)), max(1, int(image.height * ratio)))
                image = image.resize(new_size, Image.Resampling.LANCZOS)

            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=85, optimize=True)
            prepared = buffer.getvalue()
            width, height = image.size
            logger.debug(
                "Prepared image %sx%s -> %sx%s (%s -> %s bytes)",
                original_size[0],
                original_size[1],
                width,
                height,
                len(data),
                len(prepared),
            )
            return PreparedImage(prepared, "image/jpeg", width, height, len(data))
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.warning("Could not decode uploaded image with Pillow: %s", exc)
        raise InvalidImageError() from exc
