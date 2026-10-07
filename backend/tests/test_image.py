"""Image upload and recognition endpoint behaviour."""

from __future__ import annotations

from app.utils.images import prepare_image


def test_analyze_image_accepts_valid_jpeg(client, jpeg_image):
    response = client.post(
        "/api/analyze-image",
        files={"file": ("product.jpg", jpeg_image, "image/jpeg")},
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["detected"] is True
    assert payload["product_name"]
    assert payload["search_query"]
    assert isinstance(payload["attributes"], list)
    assert payload["provider"] == "demo"  # no key configured in tests
    assert payload["is_demo"] is True


def test_analyze_image_accepts_png(client, png_image):
    response = client.post(
        "/api/analyze-image",
        files={"file": ("product.png", png_image, "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["detected"] is True


def test_analyze_image_rejects_non_image(client):
    response = client.post(
        "/api/analyze-image",
        files={"file": ("notes.txt", b"just some text, definitely not an image", "text/plain")},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "invalid_image"
    # User-safe copy only - no stack traces or library internals.
    assert "Traceback" not in body["error"]["message"]
    assert "PIL" not in body["error"]["message"]


def test_analyze_image_rejects_empty_file(client):
    response = client.post("/api/analyze-image", files={"file": ("empty.png", b"", "image/png")})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_image"


def test_analyze_image_rejects_oversized_file(client):
    oversized = b"\xff\xd8\xff" + b"0" * (11 * 1024 * 1024)
    response = client.post(
        "/api/analyze-image",
        files={"file": ("big.jpg", oversized, "image/jpeg")},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "image_too_large"


def test_missing_file_field_returns_friendly_error(client):
    response = client.post("/api/analyze-image")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_large_images_are_downscaled(large_jpeg):
    prepared = prepare_image(large_jpeg, "image/jpeg")
    assert max(prepared.width, prepared.height) <= 1280
    assert prepared.mime_type == "image/jpeg"
    assert len(prepared.data) < len(large_jpeg)
    assert prepared.data_uri.startswith("data:image/jpeg;base64,")


def test_corrupt_image_file_is_rejected(client):
    """A file with a JPEG signature but garbage content must not crash the app."""
    response = client.post(
        "/api/analyze-image",
        files={"file": ("broken.jpg", b"\xff\xd8\xff\xe0garbage-content", "image/jpeg")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_image"
