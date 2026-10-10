"""Vision provider selection and response parsing (HTTP is mocked)."""

from __future__ import annotations

import json

import httpx
import pytest

from app.config import settings
from app.models.search import VisionAttributes
from app.services import vision_service
from app.utils.errors import (
    LocalVisionUnavailableError,
    NoProductDetectedError,
    VisionProviderError,
    VisionQuotaError,
)
from app.utils.images import PreparedImage


@pytest.fixture()
def prepared_image() -> PreparedImage:
    return PreparedImage(b"\xff\xd8\xff\xe0fake-jpeg", "image/jpeg", 800, 600, 4096)


def test_demo_provider_returns_structured_demo_data(prepared_image):
    import asyncio

    provider = vision_service.DemoVisionProvider()
    attributes = asyncio.run(provider.analyse(prepared_image))

    assert isinstance(attributes, VisionAttributes)
    assert attributes.product_name
    assert attributes.search_query
    assert attributes.is_demo is True
    assert attributes.detected is True
    assert any("Demo" in note for note in attributes.notes)


def test_openai_provider_parses_a_json_response(monkeypatch, prepared_image):
    import asyncio

    content = json.dumps(
        {
            "product_name": "Sony WH-1000XM5",
            "brand": "Sony",
            "category": "Headphones",
            "description": "Black over-ear noise cancelling headphones.",
            "search_query": "Sony WH-1000XM5 black headphones",
            "attributes": ["black", "over-ear", "noise cancelling"],
            "confidence": 0.81,
            "detected": True,
        }
    )

    class FakeResponse:
        status_code = 200
        text = "{}"

        def json(self):
            return {"choices": [{"message": {"content": content}}]}

    captured: dict = {}

    async def fake_post(_client, url, json=None, headers=None, **_kwargs):
        captured["url"] = url
        captured["headers"] = headers
        captured["model"] = (json or {}).get("model")
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    provider = vision_service.OpenAIVisionProvider("test-key", "gpt-4o-mini", "")
    attributes = asyncio.run(provider.analyse(prepared_image))

    assert attributes.product_name == "Sony WH-1000XM5"
    assert attributes.search_query == "Sony WH-1000XM5 black headphones"
    assert attributes.attributes == ["black", "over-ear", "noise cancelling"]
    assert attributes.confidence == 0.81
    assert attributes.is_demo is False
    assert captured["url"].endswith("/chat/completions")
    assert captured["headers"]["Authorization"] == "Bearer test-key"


def test_gemini_provider_parses_a_json_response(monkeypatch, prepared_image):
    import asyncio

    content = (
        "```json\n"
        + json.dumps(
            {
                "product_name": "Leather backpack",
                "brand": None,
                "category": "Backpack",
                "description": "Brown leather backpack with brass buckles.",
                "search_query": "brown leather backpack",
                "attributes": ["brown", "leather"],
                "confidence": 0.55,
                "detected": True,
            }
        )
        + "\n```"
    )

    class FakeResponse:
        status_code = 200
        text = "{}"

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": content}]}}]}

    captured: dict = {}

    async def fake_post(_client, url, json=None, headers=None, **_kwargs):
        captured["url"] = url
        captured["headers"] = headers
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    provider = vision_service.GeminiVisionProvider("AIza-test", "gemini-2.0-flash", "")
    attributes = asyncio.run(provider.analyse(prepared_image))

    assert attributes.product_name == "Leather backpack"
    assert attributes.brand is None
    assert attributes.search_query == "brown leather backpack"
    assert captured["headers"]["x-goog-api-key"] == "AIza-test"
    assert ":generateContent" in captured["url"]


def test_provider_reports_non_product_images(monkeypatch, prepared_image):
    import asyncio

    class FakeResponse:
        status_code = 200
        text = "{}"

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "product_name": "",
                                    "search_query": "",
                                    "detected": False,
                                    "confidence": 0.1,
                                }
                            )
                        }
                    }
                ]
            }

    async def fake_post(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    provider = vision_service.OpenAIVisionProvider("key")
    with pytest.raises(NoProductDetectedError):
        asyncio.run(provider.analyse(prepared_image))


def test_provider_surfaces_http_errors(monkeypatch, prepared_image):
    import asyncio

    class FakeResponse:
        status_code = 500
        text = "boom"

    async def fake_post(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    provider = vision_service.OpenAIVisionProvider("key")
    with pytest.raises(VisionProviderError):
        asyncio.run(provider.analyse(prepared_image))


def test_provider_handles_unparseable_model_output(monkeypatch, prepared_image):
    import asyncio

    class FakeResponse:
        status_code = 200
        text = "{}"

        def json(self):
            return {"choices": [{"message": {"content": "I could not do that, sorry!"}}]}

    async def fake_post(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    provider = vision_service.OpenAIVisionProvider("key")
    with pytest.raises(VisionProviderError):
        asyncio.run(provider.analyse(prepared_image))


def test_provider_factory_selects_by_configuration(monkeypatch):
    monkeypatch.setattr("app.config.settings.vision_api_key", "")
    monkeypatch.setattr("app.config.settings.vision_provider", "")
    assert isinstance(vision_service.get_vision_provider(), vision_service.LocalVisionProvider)

    monkeypatch.setattr("app.config.settings.vision_api_key", "sk-test")
    monkeypatch.setattr("app.config.settings.vision_provider", "openai")
    assert isinstance(vision_service.get_vision_provider(), vision_service.OpenAIVisionProvider)

    monkeypatch.setattr("app.config.settings.vision_provider", "gemini")
    assert isinstance(vision_service.get_vision_provider(), vision_service.GeminiVisionProvider)


def test_local_provider_uses_the_local_classifier(monkeypatch, prepared_image):
    import asyncio

    expected = VisionAttributes(
        product_name="Estimated category: Backpack",
        category="backpack",
        search_query="black backpack",
        provider="local-clip",
        is_demo=False,
    )

    async def fake_analyse(image):
        assert image is prepared_image
        return expected

    monkeypatch.setattr(vision_service.owlvit_service, "analyse_image", fake_analyse)
    assert asyncio.run(vision_service.LocalVisionProvider().analyse(prepared_image)) is expected


def test_local_model_failure_is_a_retryable_503_for_manual_search(client, jpeg_image, monkeypatch):
    """A missing model must not be presented as an upstream 502 failure."""
    import asyncio

    monkeypatch.setattr("app.config.settings.vision_provider", "local")

    async def unavailable(_image):
        raise LocalVisionUnavailableError(detail="connection reset while downloading model")

    monkeypatch.setattr(vision_service.owlvit_service, "analyse_image", unavailable)
    response = client.post(
        "/api/analyze-image",
        files={"file": ("product.jpg", jpeg_image, "image/jpeg")},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "local_vision_unavailable"
    assert "manual" in response.json()["error"]["message"].lower()


def test_local_model_failed_load_uses_cooldown(monkeypatch):
    """One outage must not trigger a fresh Hub download for every upload."""
    import sys
    import types

    from app.services import local_vision_service

    calls = {"processor": 0}

    class BrokenProcessor:
        @classmethod
        def from_pretrained(cls, *_args, **_kwargs):
            calls["processor"] += 1
            raise OSError("connection reset")

    class BrokenModel:
        @classmethod
        def from_pretrained(cls, *_args, **_kwargs):
            raise AssertionError("model should not load after processor failure")

    monkeypatch.setitem(
        sys.modules,
        "transformers",
        types.SimpleNamespace(CLIPModel=BrokenModel, CLIPProcessor=BrokenProcessor),
    )
    monkeypatch.setattr("app.config.settings.local_vision_model", "missing-model")
    monkeypatch.setattr("app.config.settings.local_vision_load_attempts", 2)
    monkeypatch.setattr("app.config.settings.local_vision_retry_seconds", 60)
    local_vision_service.reset_model_cache()
    with pytest.raises(LocalVisionUnavailableError):
        local_vision_service._load_model()
    with pytest.raises(LocalVisionUnavailableError):
        local_vision_service._load_model()
    # one cached-only check + two bounded download attempts; the second call is cooled down
    assert calls["processor"] == 3
    local_vision_service.reset_model_cache()


def test_explicit_gemini_key_is_auto_detected(monkeypatch):
    monkeypatch.setattr("app.config.settings.vision_provider", "")
    monkeypatch.setattr("app.config.settings.vision_api_key", "AIzaSyExampleKey")
    assert settings.resolved_vision_provider == "gemini"


def test_openai_provider_falls_back_when_a_model_is_retired(monkeypatch, prepared_image):
    """Model IDs get retired (GPT-4o, Gemini 2.0 Flash) - the provider recovers."""
    import asyncio

    content = json.dumps(
        {
            "product_name": "Coffee maker",
            "search_query": "stainless steel coffee maker",
            "attributes": ["steel"],
            "confidence": 0.6,
            "detected": True,
        }
    )
    seen_models: list[str] = []

    class FakeResponse:
        """Mimics httpx.Response: `.json()` for parsing, `.text` for error logs."""

        def __init__(self, status_code: int, payload=None, text: str = ""):
            self.status_code = status_code
            self._payload = payload
            self.text = text or json.dumps(payload or {})

        def json(self):
            return self._payload

    async def fake_post(_client, url, json=None, headers=None, **_kwargs):
        model = (json or {}).get("model", "")
        seen_models.append(model)
        if len(seen_models) == 1:
            return FakeResponse(404, {"error": {"message": "The model `retired-model` does not exist"}})
        return FakeResponse(200, {"choices": [{"message": {"content": content}}]})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    provider = vision_service.OpenAIVisionProvider("key", "retired-model")
    attributes = asyncio.run(provider.analyse(prepared_image))

    assert attributes.product_name == "Coffee maker"
    assert len(seen_models) == 2
    assert seen_models[0] == "retired-model"
    assert seen_models[1] in vision_service.OpenAIVisionProvider.candidate_models


def test_provider_does_not_retry_on_non_model_errors(monkeypatch, prepared_image):
    import asyncio

    calls = {"count": 0}

    class FakeResponse:
        status_code = 500
        text = "internal server error"

        def json(self):
            return {}

    async def fake_post(*_args, **_kwargs):
        calls["count"] += 1
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    provider = vision_service.OpenAIVisionProvider("key", "gpt-5.2-mini")
    with pytest.raises(VisionProviderError):
        asyncio.run(provider.analyse(prepared_image))
    assert calls["count"] == 1


def test_provider_reports_exhausted_openai_credits(monkeypatch, prepared_image):
    import asyncio

    class FakeResponse:
        status_code = 429
        text = '{"error":{"code":"credit_balance_exhausted"}}'

        def json(self):
            return {}

    async def fake_post(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    provider = vision_service.OpenAIVisionProvider("key")
    with pytest.raises(VisionQuotaError):
        asyncio.run(provider.analyse(prepared_image))


def test_gemini_provider_falls_back_when_a_model_is_retired(monkeypatch, prepared_image):
    import asyncio

    content = json.dumps(
        {"product_name": "Desk lamp", "search_query": "white desk lamp", "attributes": ["white"]}
    )
    seen_urls: list[str] = []

    class FakeResponse:
        """Mimics httpx.Response: `.json()` for parsing, `.text` for error logs."""

        def __init__(self, status_code: int, payload=None, text: str = ""):
            self.status_code = status_code
            self._payload = payload
            self.text = text or json.dumps(payload or {})

        def json(self):
            return self._payload

    async def fake_post(_client, url, json=None, headers=None, **_kwargs):
        seen_urls.append(url)
        if len(seen_urls) == 1:
            return FakeResponse(404, {"error": {"message": "models/gemini-2.0-flash is not found"}})
        return FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": content}]}}]})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    provider = vision_service.GeminiVisionProvider("AIza-key", "gemini-2.0-flash")
    attributes = asyncio.run(provider.analyse(prepared_image))

    assert attributes.product_name == "Desk lamp"
    assert len(seen_urls) == 2
    assert "gemini-2.0-flash" in seen_urls[0]
    assert "gemini-3.8-flash" in seen_urls[1]

# ---------------------------------------------------------------------------
# OWL-ViT specific: confidence=None when no type label exceeds threshold
# ---------------------------------------------------------------------------


def test_owlvit_returns_none_confidence_when_no_label_exceeds_threshold(monkeypatch):
    """When OWL-ViT finds no type label above threshold, confidence must be
    None (not 0.0). A 0.0 would render a deceptive red 0% progress bar.
    """
    import asyncio

    import PIL.Image as PilImage

    from app.services import owlvit_service
    from app.utils.images import PreparedImage

    class _FakeImage:
        height = 100
        width = 100
        mode = "RGB"

        def convert(self, _mode):
            return self

        def crop(self, _box):
            return self

        def resize(self, _size, _resample=None):
            return self

        def tobytes(self):
            return b"\x80" * (100 * 100 * 3)

    monkeypatch.setattr(PilImage, "open", lambda _buf: _FakeImage())

    class _FakeProcessor:
        def __call__(self, text, images, return_tensors):
            return {}

        def post_process_object_detection(self, outputs, target_sizes, threshold):
            import torch
            return [{"scores": torch.tensor([]), "labels": torch.tensor([], dtype=torch.long)}]

    class _FakeModel:
        def eval(self):
            return self

        def __call__(self, **_kwargs):
            return object()

    monkeypatch.setattr(owlvit_service, "_MODEL", _FakeModel())
    monkeypatch.setattr(owlvit_service, "_PROCESSOR", _FakeProcessor())

    fake_bytes = b"\xff\xd8\xff\xe0fake-jpeg"
    prepared = PreparedImage(fake_bytes, "image/jpeg", 100, 100, len(fake_bytes))
    result = asyncio.run(owlvit_service.analyse_image(prepared))

    assert result.confidence is None, f"Expected None, got {result.confidence}"
    assert result.detected is False
    assert result.product_name == "Product not confidently identified"
    assert any("Google Lens" in n or "threshold" in n for n in result.notes)


def test_owlvit_detected_true_has_positive_confidence(monkeypatch):
    """When a type label is detected above threshold, confidence > 0 and detected=True."""
    import asyncio

    import PIL.Image as PilImage

    from app.services import owlvit_service
    from app.utils.images import PreparedImage

    class _FakeImage:
        height = 100
        width = 100
        mode = "RGB"
        size = (100, 100)

        def convert(self, _mode):
            return self

        def crop(self, _box):
            return self

        def resize(self, _size, _resample=None):
            return self

        def tobytes(self):
            return b"\x20" * (100 * 100 * 3)

        def getpixel(self, _xy):
            # Return a neutral grey so colour heuristics don't branch unexpectedly
            return (128, 128, 128)

    monkeypatch.setattr(PilImage, "open", lambda _buf: _FakeImage())

    class _FakeProcessor:
        def __call__(self, text, images, return_tensors):
            return {}

        def post_process_object_detection(self, outputs, target_sizes, threshold):
            import torch
            first_type = next(iter(owlvit_service.TYPE_LABELS))
            idx = list(owlvit_service.PROMPTS).index(first_type)
            return [{"scores": torch.tensor([0.85]), "labels": torch.tensor([idx], dtype=torch.long)}]

    class _FakeModel:
        def eval(self):
            return self

        def __call__(self, **_kwargs):
            return object()

    monkeypatch.setattr(owlvit_service, "_MODEL", _FakeModel())
    monkeypatch.setattr(owlvit_service, "_PROCESSOR", _FakeProcessor())

    fake_bytes = b"\xff\xd8\xff\xe0fake"
    prepared = PreparedImage(fake_bytes, "image/jpeg", 100, 100, len(fake_bytes))
    result = asyncio.run(owlvit_service.analyse_image(prepared))

    assert result.detected is True
    assert result.confidence is not None
    assert result.confidence > 0
