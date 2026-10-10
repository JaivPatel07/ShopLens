"""SerpApi client.
SerpApi is the data source for every shopping result in SnapBuy.  This module
owns the HTTP communication, retries/fallbacks, caching and error translation;
normalisation happens in :mod:`app.utils.normalization`.
"""
from __future__ import annotations
import asyncio
import logging
import ssl
import time
from typing import Any
import httpx
import re
import truststore
from app.config import settings
from app.models.product import Product, VisualMatch
from app.utils.errors import (
    RateLimitError,
    SearchAuthenticationError,
    SearchNotConfiguredError,
    SearchProviderError,
    SearchTimeoutError,
)
from app.utils.normalization import normalize_serpapi_payload, normalize_visual_matches
logger = logging.getLogger("snapbuy.serpapi")
def _redact_api_key(text: str | None) -> str:
    """Ensure secret SerpApi credentials never leak into logs or error details."""
    if not text:
        return ""
    cleaned = str(text)
    if settings.serpapi_api_key:
        cleaned = cleaned.replace(settings.serpapi_api_key, "[REDACTED_API_KEY]")
    return re.sub(
        r"(api_key[=\s:]+)[^\s&\"]+",
        r"\1[REDACTED_API_KEY]",
        cleaned,
        flags=re.IGNORECASE,
    )
SERPAPI_ENDPOINT = "https://serpapi.com/search.json"
SERPAPI_IMAGE_ENDPOINT = "https://serpapi.com/image"
# HTTP statuses SerpApi uses to signal quota / plan problems.
_RATE_LIMIT_STATUSES = {429}
def _http_client(*, timeout: float) -> httpx.AsyncClient:
    """Create a client that honours the host operating system's trusted CAs.
    This is important on managed Windows networks, where an HTTPS inspection
    certificate is trusted by Windows but is not present in Python's bundled
    certificate file.  Verification remains enabled.
    """
    return httpx.AsyncClient(
        timeout=timeout,
        verify=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT),
    )
class _TTLCache:
    """Tiny in-memory cache so repeated searches don't burn SerpApi credits."""
    def __init__(self, ttl_seconds: int, max_entries: int = 128) -> None:
        self._ttl = ttl_seconds
        self._max = max_entries
        self._store: dict[str, tuple[float, Any]] = {}
    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if not entry:
            return None
        stored_at, value = entry
        if time.time() - stored_at > self._ttl:
            self._store.pop(key, None)
            return None
        return value
    def set(self, key: str, value: Any) -> None:
        if len(self._store) >= self._max:
            oldest = min(self._store, key=lambda k: self._store[k][0])
            self._store.pop(oldest, None)
        self._store[key] = (time.time(), value)
    def clear(self) -> None:
        self._store.clear()
_cache = _TTLCache(settings.search_cache_ttl_seconds)
class SerpApiResult:
    """Outcome of a shopping search."""
    def __init__(
        self,
        products: list[Product],
        *,
        engine: str,
        notes: list[str] | None = None,
        cached: bool = False,
    ) -> None:
        self.products = products
        self.engine = engine
        self.notes = notes or []
        self.cached = cached
def _check_payload_errors(payload: dict) -> None:
    """SerpApi reports problems inside a 200 response - inspect them."""
    error = payload.get("error")
    if not error:
        return
    lowered = str(error).lower()
    redacted = _redact_api_key(str(error))
    logger.warning("SerpApi reported an error: %s", redacted)
    if "invalid api key" in lowered or "api key is invalid" in lowered:
        raise SearchAuthenticationError(detail=redacted)
    if "run out of searches" in lowered or "quota" in lowered or "plan" in lowered:
        raise RateLimitError(
            "The SerpApi account has no searches left for now. Please try again later."
        )
    raise SearchProviderError(detail=redacted)
async def _request(params: dict[str, Any]) -> dict:
    if not settings.serpapi_configured:
        raise SearchNotConfiguredError()
    query = dict(params, api_key=settings.serpapi_api_key)
    try:
        async with _http_client(timeout=settings.serpapi_timeout_seconds) as client:
            response = await client.get(SERPAPI_ENDPOINT, params=query)
    except httpx.TimeoutException as exc:
        logger.warning("SerpApi timeout for %s: %s", params.get("q"), exc)
        raise SearchTimeoutError() from exc
    except httpx.HTTPError as exc:
        logger.error("SerpApi transport error for %s: %s", params.get("q"), exc)
        raise SearchProviderError(detail=str(exc)) from exc
    if response.status_code == 401:
        logger.warning("SerpApi authentication failed: %s", response.text[:300])
        raise SearchAuthenticationError(detail=response.text[:300])
    if response.status_code in _RATE_LIMIT_STATUSES:
        logger.warning("SerpApi rejected the request (%s): %s", response.status_code, response.text[:300])
        raise RateLimitError()
    if response.status_code >= 400:
        logger.error("SerpApi HTTP %s: %s", response.status_code, response.text[:300])
        raise SearchProviderError(detail=f"HTTP {response.status_code}")
    try:
        payload = response.json()
    except ValueError as exc:
        logger.error("SerpApi returned malformed JSON: %s", response.text[:300])
        raise SearchProviderError(detail="malformed JSON") from exc
    if not isinstance(payload, dict):
        logger.error("SerpApi returned an unexpected payload type: %s", type(payload))
        raise SearchProviderError(detail="unexpected payload type")
    _check_payload_errors(payload)
    return payload
async def search_google_shopping(
    query: str,
    *,
    limit: int | None = None,
    gl: str | None = None,
    hl: str | None = None,
    force_refresh: bool = False,
    sort_by: str | None = None,
) -> SerpApiResult:
    """Run a Google Shopping search through SerpApi.
    Falls back to ``engine=google&tbm=shop`` when the shopping engine returns
    nothing, which happens occasionally for very long-tail queries.
    Parameters
    ----------
    sort_by:
        Optional ordering hint forwarded to Google Shopping via the ``tbs``
        parameter.  Recognised values:
        * ``"review_count"``  - most reviewed first (``tbs=p_ord:rv``).
        * ``"price_low"``     - price low to high (``tbs=p_ord:p``).
        * ``"price_high"``    - price high to low (``tbs=p_ord:pd``).
        ``None`` (the default) lets Google decide (typically relevance).
    """
    limit = limit or settings.serpapi_max_results
    cache_key = f"shopping::{query.lower()}::{gl or settings.serpapi_gl}::{limit}::{sort_by}"
    if not force_refresh:
        cached = _cache.get(cache_key)
        if cached is not None:
            return SerpApiResult(cached, engine=settings.serpapi_engine, notes=[], cached=True)
    _TBS_MAP: dict[str, str] = {
        "review_count": "p_ord:rv",
        "price_low": "p_ord:p",
        "price_high": "p_ord:pd",
    }
    notes: list[str] = []
    params: dict[str, Any] = {
        "engine": settings.serpapi_engine,
        "q": query,
        "gl": gl or settings.serpapi_gl,
        "hl": hl or settings.serpapi_hl,
        "location": settings.serpapi_location,
        # Google Shopping returns a fixed first page (~40 items); `num` is
        # still forwarded and the final list is trimmed by `limit` after normalisation.
        "num": min(limit, 100),
    }
    if sort_by and sort_by in _TBS_MAP:
        params["tbs"] = _TBS_MAP[sort_by]
        logger.debug("Shopping sort_by=%r tbs=%r query=%r", sort_by, params["tbs"], query)
    if force_refresh:
        # `no_cache` also bypasses SerpApi's own 1h result cache so the
        # "Refresh results" action really re-queries Google.
        params["no_cache"] = "true"
    payload = await _request(params)
    products = normalize_serpapi_payload(
        payload, default_currency="INR", limit=limit
    )
    if not products and settings.serpapi_fallback_engine:
        logger.info("google_shopping returned no results for %r - trying google/tbm=shop", query)
        try:
            fallback_params: dict[str, Any] = {
                "engine": "google",
                "q": query,
                "tbm": "shop",
                "gl": params["gl"],
                "hl": params["hl"],
                "num": min(limit, 100),
            }
            if sort_by and sort_by in _TBS_MAP:
                fallback_params["tbs"] = _TBS_MAP[sort_by]
            fallback_payload = await _request(fallback_params)
            products = normalize_serpapi_payload(
                fallback_payload, default_currency="INR", limit=limit
            )
            if products:
                notes.append("Shopping results came from Google's shop tab (fallback engine).")
        except (SearchProviderError, SearchTimeoutError, RateLimitError) as exc:
            logger.warning("Fallback shop search failed: %s", exc)
    _cache.set(cache_key, products)
    return SerpApiResult(products, engine=params["engine"], notes=notes)
class LensResult:
    """Outcome of a Google Lens visual search."""
    def __init__(
        self,
        matches: list[VisualMatch],
        *,
        engine: str = "google_lens",
        notes: list[str] | None = None,
        cached: bool = False,
    ) -> None:
        self.matches = matches
        self.engine = engine
        self.notes = notes or []
        self.cached = cached
async def upload_image_for_lens(data: bytes) -> str:
    """Upload an image to SerpApi's Image API and get back a short-lived ``image_id``.
    This is how local photos (the user's own upload) reach Google Lens without
    being hosted anywhere - the id expires after 10 minutes on SerpApi's side.
    """
    if not settings.serpapi_configured:
        raise SearchNotConfiguredError()
    try:
        async with _http_client(timeout=settings.serpapi_timeout_seconds) as client:
            response = await client.post(
                SERPAPI_IMAGE_ENDPOINT,
                files={"image": ("photo.jpg", data, "image/jpeg")},
                data={"api_key": settings.serpapi_api_key},
            )
    except httpx.TimeoutException as exc:
        raise SearchTimeoutError() from exc
    except httpx.HTTPError as exc:
        raise SearchProviderError(detail=_redact_api_key(str(exc))) from exc
    if response.status_code == 401:
        redacted = _redact_api_key(response.text[:300])
        logger.warning("SerpApi Image API authentication failed: %s", redacted)
        raise SearchAuthenticationError(detail=redacted)
    if response.status_code in _RATE_LIMIT_STATUSES:
        raise RateLimitError()
    if response.status_code >= 400:
        redacted = _redact_api_key(response.text[:300])
        logger.error("SerpApi Image API HTTP %s: %s", response.status_code, redacted)
        raise SearchProviderError(detail=f"HTTP {response.status_code}")
    try:
        payload = response.json()
    except ValueError as exc:
        raise SearchProviderError(detail="malformed JSON") from exc
    if not isinstance(payload, dict):
        raise SearchProviderError(detail="unexpected Image API payload type")
    _check_payload_errors(payload)
    image_id = payload.get("image_id")
    if not image_id:
        raise SearchProviderError(detail="Image API response did not include image_id")
    return str(image_id)

def _extract_lens_query(payload: dict) -> str | None:
    """Extract product title / query from Google Lens knowledge graph or search info."""
    if not isinstance(payload, dict):
        return None
    kg = payload.get("knowledge_graph")
    if isinstance(kg, list) and kg and isinstance(kg[0], dict):
        title = kg[0].get("title") or kg[0].get("subtitle")
        if title:
            return str(title).strip()
    elif isinstance(kg, dict):
        title = kg.get("title") or kg.get("subtitle")
        if title:
            return str(title).strip()
    info = payload.get("search_information", {})
    if isinstance(info, dict):
        query = info.get("query_displayed") or info.get("detected_text")
        if query:
            return str(query).strip()
    return None

async def search_google_lens(
    *,
    image_id: str | None = None,
    image_url: str | None = None,
    limit: int = 12,
    force_refresh: bool = False,
) -> LensResult:
    """Find visually similar products with ``engine=google_lens``.

    Accepts either an ``image_id`` (from :func:`upload_image_for_lens`) or a
    public ``image_url``. Uses ``type=visual_matches`` for visual matches.
    """
    if not image_id and not image_url:
        raise ValueError("image_id or image_url is required")

    cache_key = f"lens::{image_id or image_url}::{limit}"
    if not force_refresh:
        cached = _cache.get(cache_key)
        if cached is not None:
            return LensResult(cached, cached=True)

    notes: list[str] = []
    params: dict[str, Any] = {
        "engine": "google_lens",
        "type": "visual_matches",
        "hl": settings.serpapi_hl,
    }
    if image_id:
        params["image_id"] = image_id
    else:
        params["url"] = image_url

    try:
        payload = await _request(params)
    except SearchProviderError:
        # Fallback if type=visual_matches returns an HTTP error: try without type parameter
        params_no_type = dict(params)
        params_no_type.pop("type", None)
        payload = await _request(params_no_type)
        notes.append("Retrieved matches using default Google Lens mode.")

    matches = normalize_visual_matches(payload, default_currency="INR", limit=limit)

    if not matches:
        # Fallback 1: Try without type parameter if visual_matches returned nothing
        if "type" in params:
            params_no_type = dict(params)
            params_no_type.pop("type", None)
            try:
                fallback_payload = await _request(params_no_type)
                matches = normalize_visual_matches(fallback_payload, default_currency="INR", limit=limit)
                if matches:
                    notes.append("Matches retrieved from Google Lens default search.")
                else:
                    payload = fallback_payload
            except Exception as exc:
                logger.warning("Lens default query fallback failed: %s", exc)

    if not matches:
        # Fallback 2: Extract query from Lens knowledge_graph or search_information and search Google Shopping
        query = _extract_lens_query(payload)
        if query:
            try:
                shopping_res = await search_google_shopping(query, limit=limit)
                if shopping_res.products:
                    matches = [
                        VisualMatch(
                            id=f"lens-fallback-{p.id}",
                            title=p.title,
                            source=p.source,
                            link=p.link,
                            thumbnail=p.thumbnail,
                            price=p.price,
                            currency=p.currency,
                            price_formatted=p.price_formatted,
                            rating=p.rating,
                            reviews=p.reviews,
                            in_stock=getattr(p, "in_stock", None),
                        )
                        for p in shopping_res.products[:limit]
                    ]
                    notes.append(f"Retrieved visual products via Google Shopping fallback for '{query}'.")
            except Exception as exc:
                logger.warning("Lens Google Shopping fallback failed: %s", exc)

    _cache.set(cache_key, matches)
    return LensResult(matches, notes=notes)
async def warmup() -> None:
    """Cheap connectivity probe used at startup (never raises)."""
    if not settings.serpapi_configured:
        return
    try:
        await asyncio.wait_for(
            _request(
                {
                    "engine": "google_shopping",
                    "q": "nike air max",
                    "gl": settings.serpapi_gl,
                    "hl": settings.serpapi_hl,
                    "num": 5,
                }
            ),
            timeout=settings.serpapi_timeout_seconds + 5,
        )
        logger.info("SerpApi connectivity check passed.")
    except Exception as exc:  # noqa: BLE001 - startup probe must never crash the app
        logger.warning("SerpApi connectivity check failed: %s", exc)
def clear_cache() -> None:
    _cache.clear()
