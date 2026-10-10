"""Best-effort CLIP thumbnail reranking for SerpApi shopping products.

CLIP (openai/clip-vit-base-patch32) produces image embeddings.  We embed the
user's uploaded photo and every accessible product thumbnail, then sort by
cosine similarity.  Products whose thumbnail URL is unavailable are kept at
their original SerpApi position (they are not dropped from the results).

Ranking formula
---------------
``ranking_score = similarity * 80 + (1 - normalised_position) * 20``

This gives 80 % weight to visual similarity and 20 % to original shopping
relevance position, which guards against noise from tiny/cropped thumbnails.
"""
from __future__ import annotations

import asyncio
import io
import logging
import threading
from typing import Any

import httpx
from PIL import Image

from app.config import settings
from app.models.product import Product
from app.utils.images import PreparedImage

logger = logging.getLogger("snapbuy.visual_rerank")
_LOCK = threading.Lock()
_MODEL: Any | None = None
_PROCESSOR: Any | None = None

# Download timeout (seconds) per product thumbnail.  Short so a single
# slow CDN doesn't block the whole rerank step.
_DOWNLOAD_TIMEOUT: float = 6.0

# HTTP headers sent when fetching thumbnails.  Some CDNs reject bot UA strings.
_HEADERS = {"User-Agent": "ShopLens/1.0 (product-image-similarity)"}


def _load() -> tuple[Any, Any]:
    """Load CLIP once and cache the result (thread-safe)."""
    global _MODEL, _PROCESSOR  # noqa: PLW0603
    if _MODEL is not None:
        return _MODEL, _PROCESSOR
    with _LOCK:
        if _MODEL is not None:
            return _MODEL, _PROCESSOR
        from transformers import CLIPModel, CLIPProcessor

        model_id = settings.image_embedding_model
        try:
            _PROCESSOR = CLIPProcessor.from_pretrained(model_id, local_files_only=True)
            _MODEL = CLIPModel.from_pretrained(model_id, local_files_only=True)
        except Exception:
            logger.info("CLIP not cached locally — downloading %s", model_id)
            _PROCESSOR = CLIPProcessor.from_pretrained(model_id)
            _MODEL = CLIPModel.from_pretrained(model_id)
        _MODEL.eval()
        logger.info("Loaded CLIP model %s", model_id)
    return _MODEL, _PROCESSOR


async def _download(url: str) -> Image.Image | None:
    """Fetch one product thumbnail.

    Returns ``None`` on any error (connection refused, 404, decode failure, …)
    so a single broken URL never aborts the whole rerank step.
    """
    try:
        async with httpx.AsyncClient(
            timeout=_DOWNLOAD_TIMEOUT, follow_redirects=True
        ) as client:
            response = await client.get(url, headers=_HEADERS)
            response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert("RGB")
    except httpx.HTTPStatusError as exc:
        logger.debug("Thumbnail HTTP %s for %s", exc.response.status_code, url)
        return None
    except Exception as exc:
        logger.debug("Thumbnail fetch failed for %s: %s", url, exc)
        return None


def _embed_images(images: list[Image.Image]) -> "Any":
    """Return L2-normalised CLIP image embeddings as a (N, D) tensor."""
    import torch

    model, processor = _load()
    with torch.inference_mode():
        inputs = processor(images=images, return_tensors="pt")
        vectors = model.get_image_features(**inputs).float()
        vectors = vectors / vectors.norm(dim=-1, keepdim=True)
    return vectors


def _cosine_similarities(
    upload: Image.Image,
    candidates: list[tuple[Product, Image.Image]],
) -> list[tuple[Product, float]]:
    """Compute cosine similarity between the upload and each candidate image."""
    import torch

    all_images = [upload, *(img for _, img in candidates)]
    vectors = _embed_images(all_images)
    # vectors[0] is the upload; vectors[1:] are the candidates.
    sims: "torch.Tensor" = vectors[1:] @ vectors[0]
    return [
        (product, round(float(sim), 4))
        for (product, _), sim in zip(candidates, sims)
    ]


async def rerank(
    products: list[Product], image: PreparedImage
) -> tuple[list[Product], list[str]]:
    """Rerank *products* by CLIP visual similarity to *image*.

    Products without an accessible thumbnail retain their original position
    score instead of being dropped.  All scores are logged for debugging.

    Returns ``(reranked_products, notes)``.
    """
    if not products:
        return products, []

    # Select products that have a thumbnail URL (up to the configured max).
    candidates_raw = [p for p in products if p.thumbnail][
        : max(1, settings.visual_rerank_max_images)
    ]

    if not candidates_raw:
        return products, ["Visual reranking skipped: no product thumbnail URLs were available."]

    # Download all thumbnails concurrently.
    downloaded = await asyncio.gather(
        *[_download(p.thumbnail or "") for p in candidates_raw]
    )
    pairs: list[tuple[Product, Image.Image]] = [
        (product, img)
        for product, img in zip(candidates_raw, downloaded)
        if img is not None
    ]

    accessible = len(pairs)
    skipped = len(candidates_raw) - accessible
    if skipped:
        logger.info(
            "Visual rerank: %s/%s thumbnails inaccessible, proceeding with %s",
            skipped,
            len(candidates_raw),
            accessible,
        )

    if not pairs:
        return products, [
            "Visual reranking skipped: none of the product thumbnail URLs were accessible."
        ]

    # Run CLIP inference in a thread so the async loop stays free.
    try:
        upload_img = Image.open(io.BytesIO(image.data)).convert("RGB")
        scored: list[tuple[Product, float]] = await asyncio.to_thread(
            _cosine_similarities, upload_img, pairs
        )
    except Exception as exc:
        logger.info("Visual reranking failed during CLIP inference: %s", exc)
        return products, [
            "Visual reranking unavailable during inference; results ordered by shopping relevance."
        ]

    # Build a lookup from product id → similarity score and log it.
    similarity_by_id: dict[str, float] = {}
    for product, sim in scored:
        product.visual_similarity_score = sim
        product.match_label = "Visually Similar"
        similarity_by_id[product.id] = sim
        logger.debug("CLIP similarity product_id=%s score=%.4f title=%r", product.id, sim, product.title)

    # Normalise position into [0, 1] range (position 1 → 1.0, last → 0.0)
    n = max(len(products), 1)
    for product in products:
        if product.id in similarity_by_id:
            sim = similarity_by_id[product.id]
            # Position 1 = best ranking = high normalised value.
            norm_pos = 1.0 - (product.position - 1) / n
            # 80% similarity, 20% original position signal.
            product.ranking_score = round(sim * 80 + norm_pos * 20, 2)
        else:
            # No thumbnail / download failed: place after all scored products
            # but preserve relative ordering among unscored results.
            product.ranking_score = None

    scored_products = [p for p in products if p.ranking_score is not None]
    unscored_products = [p for p in products if p.ranking_score is None]

    reranked = sorted(
        scored_products,
        key=lambda p: p.ranking_score or 0,
        reverse=True,
    ) + unscored_products

    notes = [
        f"Results reranked by CLIP visual similarity "
        f"({accessible} product images scored, {skipped} thumbnails inaccessible). "
        f"Closest visual matches appear first.",
    ]
    if unscored_products:
        notes.append(
            f"{len(unscored_products)} result(s) without accessible images kept at the end."
        )

    logger.info(
        "Visual rerank complete: scored=%s unscored=%s top=%r sim=%.4f",
        len(scored_products),
        len(unscored_products),
        reranked[0].title if reranked else "(none)",
        reranked[0].visual_similarity_score if reranked and reranked[0].visual_similarity_score else 0,
    )

    return reranked, notes
