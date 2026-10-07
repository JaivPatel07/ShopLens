"""Shared pytest fixtures.

Environment variables are set *before* the app is imported so the tests exercise
the demo/offline paths deterministically (no network access, no real keys).
"""

from __future__ import annotations

import io
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DEMO_MODE", "auto")
os.environ.pop("SERPAPI_API_KEY", None)
os.environ.pop("VISION_API_KEY", None)
os.environ.pop("VISION_PROVIDER", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.main import app  # noqa: E402
from app.services.serpapi_service import clear_cache  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    clear_cache()
    with TestClient(app) as test_client:
        yield test_client


def _image_bytes(width: int = 800, height: int = 600, fmt: str = "JPEG") -> bytes:
    image = Image.new("RGB", (width, height), (240, 240, 245))
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return buffer.getvalue()


@pytest.fixture()
def jpeg_image() -> bytes:
    return _image_bytes()


@pytest.fixture()
def png_image() -> bytes:
    return _image_bytes(320, 320, fmt="PNG")


@pytest.fixture()
def large_jpeg() -> bytes:
    """A big photo that must be downscaled before reaching a vision provider."""
    return _image_bytes(3200, 2400)
