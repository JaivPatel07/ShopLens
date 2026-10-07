"""``GET|POST /api/search`` - SerpApi powered shopping search."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Body, Depends, Query

from app.models.product import SearchResponse
from app.models.search import SearchRequest
from app.services import product_service
from app.services.serpapi_service import clear_cache

logger = logging.getLogger("snapbuy.routes.search")

router = APIRouter(tags=["search"])


async def _search(request: SearchRequest) -> SearchResponse:
    logger.info("Search query=%r limit=%s", request.query, request.limit)
    response = await product_service.search_products(
        request.query,
        limit=request.limit,
        gl=request.gl,
        hl=request.hl,
        force_refresh=request.force_refresh,
    )
    logger.info(
        "Search finished query=%r products=%s demo=%s in %sms",
        request.query,
        len(response.products),
        response.is_demo,
        response.elapsed_ms,
    )
    return response


@router.post("/search", response_model=SearchResponse, summary="Search shopping results")
async def search_post(
    request: SearchRequest = Body(
        ...,
        examples=[{"query": "Nike Air Max 270 black men's shoes"}],
    ),
) -> SearchResponse:
    return await _search(request)


@router.get("/search", response_model=SearchResponse, summary="Search shopping results (query string)")
async def search_get(
    q: str = Query(..., min_length=1, max_length=300, description="Product search query"),
    limit: int = Query(40, ge=1, le=60),
) -> SearchResponse:
    return await _search(SearchRequest(query=q, limit=limit))


@router.delete("/search/cache", summary="Clear the backend search cache", include_in_schema=False)
async def clear_search_cache() -> dict[str, str]:
    clear_cache()
    return {"status": "cleared"}
