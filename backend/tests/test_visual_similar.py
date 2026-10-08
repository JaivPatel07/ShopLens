"""Visual similarity endpoint - Google Lens via SerpApi."""

from __future__ import annotations

from app.models.product import VisualMatch
from app.services import lens_service
from app.services.serpapi_service import LensResult
from app.utils.images import prepare_image
from app.utils.normalization import normalize_visual_matches
from app.data.demo_data import DEMO_LENS_PAYLOAD


def _jpeg_upload():
    from tests.conftest import _image_bytes

    data = _image_bytes()
    return {"file": ("shoe.jpg", data, "image/jpeg")}


def test_visual_similar_returns_demo_matches(client):
    response = client.post("/api/visual-similar", files=_jpeg_upload())
    assert response.status_code == 200

    payload = response.json()
    assert payload["is_demo"] is True
    assert payload["count"] == len(payload["matches"])
    assert payload["matches"], "demo lens fixture should produce matches"
    match = payload["matches"][0]
    for field in ("id", "title", "currency", "is_demo"):
        assert field in match
    assert match["price_formatted"] == "₹8,499"


def test_visual_similar_rejects_non_images(client):
    response = client.post(
        "/api/visual-similar",
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 400


def test_visual_similar_url_variant_demo(client):
    response = client.get(
        "/api/visual-similar", params={"url": "https://example.com/photo.jpg"}
    )
    assert response.status_code == 200
    assert response.json()["is_demo"] is True


def test_normalize_visual_matches_parses_lens_price_shape():
    matches = normalize_visual_matches(DEMO_LENS_PAYLOAD, limit=3)
    assert len(matches) == 3
    first = matches[0]
    assert isinstance(first, VisualMatch)
    assert first.price == 8499
    assert first.currency == "INR"
    assert first.in_stock is True
    assert first.rating == 4.6
    assert first.reviews == 1234


def test_normalize_visual_matches_tolerates_missing_fields():
    matches = normalize_visual_matches(
        {
            "visual_matches": [
                {"title": "Bare minimum"},
                {"title": ""},
                "not-a-dict",
                {"title": "With raw price", "price": "₹1,299"},
            ]
        },
        limit=10,
    )
    assert [m.title for m in matches] == ["Bare minimum", "With raw price"]
    assert matches[0].price is None
    assert matches[1].price == 1299


def test_normalize_visual_matches_empty_payload():
    assert normalize_visual_matches({}) == []
    assert normalize_visual_matches({"visual_matches": "oops"}) == []


def test_visual_cache_avoids_repeat_upload(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "demo_mode", "off")
    monkeypatch.setattr(settings, "serpapi_api_key", "test-key")
    calls = {"upload": 0}

    async def fake_upload(data: bytes) -> str:
        calls["upload"] += 1
        return "fake-image-id"

    async def fake_lens(*, image_id=None, image_url=None, limit=12, force_refresh=False):
        return LensResult([], notes=[])

    monkeypatch.setattr(lens_service, "upload_image_for_lens", fake_upload)
    monkeypatch.setattr(lens_service, "search_google_lens", fake_lens)
    lens_service.clear_cache()

    files = _jpeg_upload()
    assert client.post("/api/visual-similar", files=files).status_code == 200
    assert client.post("/api/visual-similar", files=files).status_code == 200
    assert calls["upload"] == 1, "identical photo must hit SerpApi only once"


def test_shrink_for_upload_enforces_500kb():
    import io
    import os

    from PIL import Image

    from app.utils.images import PreparedImage, shrink_for_upload

    noise = os.urandom(2200 * 2200 * 3)
    image = Image.frombytes("RGB", (2200, 2200), noise)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    raw = buffer.getvalue()
    assert len(raw) > 500 * 1024, "noise PNG should exceed the upload limit"

    prepared = PreparedImage(raw, "image/png", 2200, 2200, len(raw))
    shrunk = shrink_for_upload(prepared)
    assert len(shrunk) <= 500 * 1024
