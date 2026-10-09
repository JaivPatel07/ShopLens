"""Shared exceptions with user-safe messages.

Routes translate these into HTTP errors; the raw technical detail is only ever
written to the backend log.
"""

from __future__ import annotations


class SnapBuyError(Exception):
    """Base class for handled application errors."""

    code = "server_error"
    status_code = 500
    message = "Something went wrong. Please try again."

    def __init__(self, message: str | None = None, *, detail: str | None = None):
        super().__init__(message or self.message)
        self.message = message or self.message
        self.detail = detail


class InvalidImageError(SnapBuyError):
    code = "invalid_image"
    status_code = 400
    message = "That file doesn't look like a supported image. Use a JPG, PNG or WEBP file."


class ImageTooLargeError(SnapBuyError):
    code = "image_too_large"
    status_code = 413
    message = "That image is too large. Please upload a file smaller than 10 MB."


class NoProductDetectedError(SnapBuyError):
    code = "no_product_detected"
    status_code = 422
    message = "We couldn't confidently identify this product."


class VisionProviderError(SnapBuyError):
    code = "vision_error"
    status_code = 502
    message = "The image recognition service is unavailable right now. Please try again."


class LocalVisionUnavailableError(SnapBuyError):
    """The optional local model is absent or cannot be loaded."""

    code = "local_vision_unavailable"
    status_code = 503
    message = (
        "Local image recognition is unavailable. Enter a product name or description "
        "to search shopping results manually."
    )


class VisionQuotaError(SnapBuyError):
    """The configured vision account cannot accept more API requests."""

    code = "vision_quota_exhausted"
    status_code = 429
    message = (
        "Image recognition is unavailable because the configured vision API account has no "
        "remaining credits. Add credits or configure another vision provider."
    )


class VisionNotConfiguredError(SnapBuyError):
    code = "vision_not_configured"
    status_code = 503
    message = "Image recognition isn't configured on this deployment."


class SearchNotConfiguredError(SnapBuyError):
    code = "search_not_configured"
    status_code = 503
    message = "Product search isn't configured on this deployment."


class SearchAuthenticationError(SnapBuyError):
    code = "search_authentication_failed"
    status_code = 503
    message = "The shopping search service is not configured with a valid SerpApi key."


class SearchProviderError(SnapBuyError):
    code = "search_error"
    status_code = 502
    message = "Something went wrong while searching. Please try again."


class SearchTimeoutError(SnapBuyError):
    code = "search_timeout"
    status_code = 504
    message = "The product search took too long. Please try again."


class RateLimitError(SnapBuyError):
    code = "rate_limited"
    status_code = 429
    message = "Too many searches right now. Please wait a moment and try again."
