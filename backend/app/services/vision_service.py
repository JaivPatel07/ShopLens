"""Image recognition abstraction.

SnapBuy does not depend on a single AI vendor.  A provider is selected through
configuration and every provider returns the same structured payload:

.. code-block:: json

    {
      "product_name": "Nike Air Max 270",
      "brand": "Nike",
      "category": "shoes",
      "description": "Black and white athletic sneaker",
      "search_query": "Nike Air Max 270 black men's shoes",
      "attributes": ["black", "athletic", "Nike", "Air Max"]
    }

Supported providers
-------------------
``openai``  GPT-4o class models via the OpenAI chat-completions API.
``gemini``  Google Gemini via ``generateContent``.
``demo``    Fixture data, clearly flagged as demo (used when no key is set).

The purpose of vision here is narrow: identify the product and produce a *good
search query*.  Retrieving shopping results is SerpApi's job.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import ssl
from typing import Any, Protocol

import httpx
import truststore

from app.config import settings
from app.data.demo_data import DEMO_VISION_RESULT
from app.models.search import VisionAttributes
from app.utils.errors import (
    NoProductDetectedError,
    VisionNotConfiguredError,
    VisionProviderError,
)
from app.utils.images import PreparedImage

logger = logging.getLogger("snapbuy.vision")


def _http_client(*, timeout: float) -> httpx.AsyncClient:
    """Use the operating system trust store while retaining TLS validation."""
    return httpx.AsyncClient(
        timeout=timeout,
        verify=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT),
    )

PROMPT = """You are a product recognition assistant inside a shopping app.

Look at the photo and identify the single most likely product a shopper would
search for. Base every field only on what is visible in the image.

Rules:
- "product_name": a specific, searchable product name (include model/line when
  it is legible or strongly recognisable, e.g. "Nike Air Max 270").
- "brand": the brand if it is visible or unmistakable, otherwise null.
- "category": a short human category such as "running shoes", "smartphone",
  "coffee maker", "backpack".
- "description": one sentence describing colour, shape and visible details.
- "search_query": the query a shopper should type to find this product in an
  online store. Keep it under 12 words, include brand/model/colour/type and a
  gender or size qualifier only when visible. Never include prices or store
  names.
- "attributes": 3 to 6 short visual keywords (colour, material, style, model).
- "confidence": 0.0-1.0. Use below 0.35 if the image is unclear or does not
  show a shoppable product.
- "detected": false when the image is not a product photo (a person's face, a
  landscape, a screenshot, a document, a blank/unreadable picture).

Respond with JSON only, matching exactly this schema:
{
  "product_name": string,
  "brand": string | null,
  "category": string | null,
  "description": string | null,
  "search_query": string,
  "attributes": string[],
  "confidence": number,
  "detected": boolean
}"""


class VisionProvider(Protocol):
    name: str

    async def analyse(self, image: PreparedImage) -> VisionAttributes: ...


# --------------------------------------------------------------------------- #
# Parsing helpers
# --------------------------------------------------------------------------- #


def _extract_json(text: str) -> dict[str, Any]:
    """Pull a JSON object out of an LLM response, tolerating extra prose."""
    if not text:
        raise VisionProviderError(detail="empty model response")
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?|```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            parsed = json.loads(cleaned[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError as exc:
            raise VisionProviderError(detail=f"unparseable JSON: {exc}") from exc
    raise VisionProviderError(detail="no JSON object in model response")


def _coerce_attributes(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("attributes") or payload.get("tags") or []
    if isinstance(raw, str):
        raw = [part.strip() for part in re.split(r"[,\n]", raw)]
    attributes: list[str] = []
    for item in raw if isinstance(raw, list) else []:
        text = " ".join(str(item).split())[:40]
        if text and text.lower() not in {a.lower() for a in attributes}:
            attributes.append(text)
    return attributes[:8]


def _coerce_detected(payload: dict[str, Any]) -> bool:
    value = payload.get("detected")
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() not in {"false", "no", "0", "none"}
    return True


def _to_attributes(payload: dict[str, Any], provider: str, *, is_demo: bool) -> VisionAttributes:
    product_name = " ".join(str(payload.get("product_name") or payload.get("name") or "").split())
    brand = payload.get("brand")
    category = payload.get("category")
    description = payload.get("description")
    search_query = " ".join(str(payload.get("search_query") or "").split())
    confidence = payload.get("confidence")
    try:
        confidence_value = float(confidence) if confidence is not None else None
    except (TypeError, ValueError):
        confidence_value = None
    if confidence_value is not None:
        confidence_value = max(0.0, min(1.0, confidence_value))

    attributes = _coerce_attributes(payload)
    detected = _coerce_detected(payload)

    if not product_name and not search_query:
        detected = False

    if not detected or (confidence_value is not None and confidence_value < 0.2 and not product_name):
        raise NoProductDetectedError()

    # A usable search query is mandatory for the rest of the flow: build one from
    # the identified product when the model omitted it.
    if not search_query:
        parts = [str(p) for p in (brand, product_name, category) if p]
        search_query = " ".join(dict.fromkeys(parts))[:180] or "popular products"
    if not product_name:
        product_name = search_query.title()

    notes: list[str] = []
    if confidence_value is not None and confidence_value < 0.45:
        notes.append(
            "Recognition confidence was low - check the search query before searching."
        )

    return VisionAttributes(
        product_name=product_name[:160],
        brand=(" ".join(str(brand).split())[:60] if brand else None),
        category=(" ".join(str(category).split())[:60] if category else None),
        description=(" ".join(str(description).split())[:400] if description else None),
        search_query=search_query[:200],
        attributes=attributes,
        confidence=confidence_value,
        detected=True,
        provider=provider,
        is_demo=is_demo,
        notes=notes,
    )


# --------------------------------------------------------------------------- #
# Providers
# --------------------------------------------------------------------------- #


class DemoVisionProvider:
    """Deterministic fixture provider - clearly labelled as demo data."""

    name = "demo"

    async def analyse(self, image: PreparedImage) -> VisionAttributes:
        await asyncio.sleep(0.6)  # keep the staged loading UI honest but snappy
        attributes = _to_attributes(DEMO_VISION_RESULT, self.name, is_demo=True)
        attributes.notes.append(
            "Demo recognition data: no VISION_API_KEY is configured, so a sample "
            "product (Nike Air Max 270) is used."
        )
        return attributes


class _HttpVisionProvider:
    """Shared retry/fallback plumbing for the hosted providers.

    Model IDs churn quickly (Gemini 2.0 Flash and GPT-4o were both retired in
    2026), so each provider tries the configured model first and then falls back
    through a short candidate list whenever the API rejects the *model* itself.
    Any other error surfaces immediately.
    """

    name = "provider"
    candidate_models: tuple[str, ...] = ()

    def __init__(self, api_key: str, model: str = "", base_url: str = "") -> None:
        self.api_key = api_key
        self.base_url = base_url
        configured = model.strip() if model else ""
        candidates = [configured] if configured else []
        candidates.extend(other for other in self.candidate_models if other not in candidates)
        self.models = tuple(candidates)

    async def _post(self, url: str, body: dict, headers: dict) -> httpx.Response:
        """POST JSON and return the raw :class:`httpx.Response`."""
        try:
            async with _http_client(timeout=settings.vision_timeout_seconds) as client:
                response = await client.post(url, json=body, headers=headers)
        except httpx.TimeoutException as exc:
            logger.warning("%s vision request timed out", self.name)
            raise VisionProviderError(
                "Image recognition timed out. Please try a smaller image or retry."
            ) from exc
        except httpx.HTTPError as exc:
            logger.error("%s vision transport error: %s", self.name, exc)
            raise VisionProviderError(detail=str(exc)) from exc
        return response

    @staticmethod
    def _looks_like_model_error(status: int, body: str) -> bool:
        if status not in (400, 403, 404):
            return False
        lowered = body.lower()
        return any(
            token in lowered
            for token in ("model", "not found", "not_found", "unsupported", "does not exist", "deprecated")
        )

    async def _request_json(self, url: str, body: dict, headers: dict) -> dict:
        """Send a request, walking the model fallback list on model errors."""
        last_detail = ""
        for index, model in enumerate(self.models):
            candidate_body = dict(body, **self._model_field(model))
            response = await self._post(url, candidate_body, headers)
            if response.status_code < 400:
                try:
                    return response.json()
                except ValueError as exc:
                    logger.error("%s returned malformed JSON: %s", self.name, response.text[:300])
                    raise VisionProviderError(detail="malformed JSON") from exc

            last_detail = f"HTTP {response.status_code}"
            is_last = index == len(self.models) - 1
            if self._looks_like_model_error(response.status_code, response.text) and not is_last:
                logger.warning(
                    "%s rejected model %r (%s) - trying the next candidate",
                    self.name,
                    model,
                    response.status_code,
                )
                continue
            logger.error("%s HTTP %s: %s", self.name, response.status_code, response.text[:300])
            raise VisionProviderError(detail=last_detail)
        raise VisionProviderError(detail=last_detail or "no model available")


class OpenAIVisionProvider(_HttpVisionProvider):
    """OpenAI chat completions with an inline image (GPT-5 class models)."""

    name = "openai"
    #: Tried in order when the configured model is unavailable.
    candidate_models = ("gpt-5.2-mini", "gpt-5.2-chat-latest", "gpt-4o-mini")

    def _model_field(self, model: str) -> dict:
        return {"model": model}

    async def analyse(self, image: PreparedImage) -> VisionAttributes:
        url = f"{(self.base_url or 'https://api.openai.com/v1').rstrip('/')}/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        # Only the broadly-supported fields are sent: some newer models reject
        # max_tokens / temperature, and the answer is a small JSON object anyway.
        body = {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {"type": "image_url", "image_url": {"url": image.data_uri}},
                    ],
                }
            ]
        }

        payload = await self._request_with_json_mode(url, body, headers)
        text = self._extract_choice_text(payload)
        return _to_attributes(_extract_json(text), self.name, is_demo=False)

    async def _request_with_json_mode(self, url: str, body: dict, headers: dict) -> dict:
        """Ask for a JSON object; models that reject the field get a plain retry.

        Only 4xx rejections are retried - a 5xx or a timeout means the request
        itself failed, and repeating it would just burn time and quota.
        """
        try:
            return await self._request_json(
                url, dict(body, response_format={"type": "json_object"}), headers
            )
        except VisionProviderError as exc:
            # A plain retry only helps when JSON mode itself is unsupported.
            # Never retry authentication, rate-limit, or exhausted-credit
            # failures: those cannot be fixed by changing the response format
            # and a second call only consumes more quota.
            if not (exc.detail or "").startswith(("HTTP 400", "HTTP 404")):
                raise
            logger.warning(
                "OpenAI JSON mode unavailable (%s) - retrying without response_format", exc.detail
            )
            return await self._request_json(url, body, headers)

    @staticmethod
    def _extract_choice_text(payload: dict) -> str:
        try:
            text = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            logger.error("Unexpected OpenAI payload: %s", str(payload)[:300])
            raise VisionProviderError(detail="unexpected payload") from exc
        if isinstance(text, list):  # some gateways return content parts
            text = " ".join(part.get("text", "") for part in text if isinstance(part, dict))
        return text or ""


class GeminiVisionProvider(_HttpVisionProvider):
    """Google Gemini ``generateContent`` with an inline image part."""

    name = "gemini"
    #: Tried in order when the configured model is unavailable.
    candidate_models = ("gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest")

    def _model_field(self, model: str) -> dict:
        # The model is part of the URL for Gemini, handled in analyse().
        return {}

    async def analyse(self, image: PreparedImage) -> VisionAttributes:
        import base64

        base_url = (self.base_url or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
        body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": PROMPT},
                        {
                            "inline_data": {
                                "mime_type": image.mime_type,
                                "data": base64.b64encode(image.data).decode("ascii"),
                            }
                        },
                    ],
                }
            ],
            "generationConfig": {"responseMimeType": "application/json"},
        }

        last_detail = ""
        for index, model in enumerate(self.models):
            response = await self._post(
                f"{base_url}/models/{model}:generateContent", body, headers
            )
            if response.status_code < 400:
                try:
                    payload = response.json()
                    parts = payload["candidates"][0]["content"]["parts"]
                    answer = " ".join(
                        part.get("text", "") for part in parts if isinstance(part, dict)
                    )
                except (KeyError, IndexError, TypeError, ValueError) as exc:
                    logger.error("Unexpected Gemini payload: %s", response.text[:300])
                    raise VisionProviderError(detail="unexpected payload") from exc
                return _to_attributes(_extract_json(answer), self.name, is_demo=False)

            last_detail = f"HTTP {response.status_code}"
            is_last = index == len(self.models) - 1
            if self._looks_like_model_error(response.status_code, response.text) and not is_last:
                logger.warning(
                    "Gemini rejected model %r (%s) - trying the next candidate",
                    model,
                    response.status_code,
                )
                continue
            logger.error("Gemini HTTP %s: %s", response.status_code, response.text[:300])
            raise VisionProviderError(detail=last_detail)

        raise VisionProviderError(detail=last_detail or "no model available")


# --------------------------------------------------------------------------- #
# Factory
# --------------------------------------------------------------------------- #


def get_vision_provider() -> VisionProvider:
    """Build the configured provider.

    ``DEMO_MODE=off`` without a key raises instead of quietly returning fixtures,
    so a misconfigured production deployment fails loudly.
    """
    provider = settings.resolved_vision_provider
    if provider == "openai" and settings.vision_configured:
        return OpenAIVisionProvider(
            settings.vision_api_key, settings.vision_model, settings.vision_base_url
        )
    if provider == "gemini" and settings.vision_configured:
        return GeminiVisionProvider(
            settings.vision_api_key, settings.vision_model, settings.vision_base_url
        )
    if settings.demo_mode == "off":
        raise VisionNotConfiguredError()
    return DemoVisionProvider()


async def analyse_image(image: PreparedImage) -> VisionAttributes:
    """Identify the product in ``image`` using the configured provider."""
    provider = get_vision_provider()
    logger.info("Analysing image with provider=%s (%sx%s)", provider.name, image.width, image.height)
    return await provider.analyse(image)
