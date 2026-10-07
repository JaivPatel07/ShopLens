"""SerpApi client.

SerpApi is the data source for every shopping result in SnapBuy.  This module
owns the HTTP communication, retries/fallbacks, caching and error translation;
normalisation happens in :mod:`app.utils.normalization`.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from app.config import settings
from app.models.product import Product
from app.utils.errors import (
    RateLimitError,
    SearchNotConfiguredError,
    SearchProviderError,
    SearchTimeoutError,
)
from app.utils.normalization import normalize_serpapi_payload

logger = logging.getLogger("snapbuy.serpapi")

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"

# HTTP statuses SerpApi uses to signal quota / plan problems.
_RATE_LIMIT_STATUSES = {401, 429}


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
    logger.warning("SerpApi reported an error: %s", error)
    if "run out of searches" in lowered or "plan" in lowered or "api key" in lowered:
        raise RateLimitError(
            "The SerpApi account has no searches left for now. Please try again later."
        )
    raise SearchProviderError(detail=str(error))


async def _request(params: dict[str, Any]) -> dict:
    if not settings.serpapi_configured:
        raise SearchNotConfiguredError()

    query = dict(params, api_key=settings.serpapi_api_key)
    try:
        async with httpx.AsyncClient(timeout=settings.serpapi_timeout_seconds) as client:
            response = await client.get(SERPAPI_ENDPOINT, params=query)
    except httpx.TimeoutException as exc:
        logger.warning("SerpApi timeout for %s: %s", params.get("q"), exc)
        raise SearchTimeoutError() from exc
    except httpx.HTTPError as exc:
        logger.error("SerpApi transport error for %s: %s", params.get("q"), exc)
        raise SearchProviderError(detail=str(exc)) from exc

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
) -> SerpApiResult:
    """Run a Google Shopping search through SerpApi.

    Falls back to ``engine=google&tbm=shop`` when the shopping engine returns
    nothing, which happens occasionally for very long-tail queries.
    """
    limit = limit or settings.serpapi_max_results
    cache_key = f"shopping::{query.lower()}::{gl or settings.serpapi_gl}::{limit}"

    if not force_refresh:
        cached = _cache.get(cache_key)
        if cached is not None:
            return SerpApiResult(cached, engine=settings.serpapi_engine, notes=[], cached=True)

    notes: list[str] = []
    params: dict[str, Any] = {
        "engine": settings.serpapi_engine,
        "q": query,
        "gl": gl or settings.serpapi_gl,
        "hl": hl or settings.serpapi_hl,
        "location": settings.serpapi_location,
        # Google Shopping's current layout returns a fixed first page (~40
        # items); `num` is still forwarded, and the final list is trimmed by
        # `limit` after normalisation.
        "num": min(limit, 100),
    }
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
            fallback_payload = await _request(
                {
                    "engine": "google",
                    "q": query,
                    "tbm": "shop",
                    "gl": params["gl"],
                    "hl": params["hl"],
                    "num": min(limit, 100),
                }
            )
            products = normalize_serpapi_payload(
                fallback_payload, default_currency="INR", limit=limit
            )
            if products:
                notes.append("Shopping results came from Google's shop tab (fallback engine).")
        except (SearchProviderError, SearchTimeoutError, RateLimitError) as exc:
            logger.warning("Fallback shop search failed: %s", exc)

    _cache.set(cache_key, products)
    return SerpApiResult(products, engine=params["engine"], notes=notes)


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
