"""Free, local image-to-shopping-query analysis using CLIP.

CLIP is used only to estimate a broad product category. It cannot reliably
identify an exact retail SKU, so every response is explicitly labelled as an
estimate and remains editable before a SerpApi shopping search is made.
"""

from __future__ import annotations

import logging
import threading
import time
from pathlib import Path
from typing import Any

from PIL import Image

from app.config import settings
from app.models.search import VisionAttributes
from app.utils.errors import LocalVisionUnavailableError
from app.utils.images import PreparedImage

_MODEL_LOCK = threading.Lock()
_MODEL: Any | None = None
_PROCESSOR: Any | None = None
_LOAD_FAILURE_UNTIL = 0.0
_LOAD_FAILURE_DETAIL = ""

logger = logging.getLogger("snapbuy.local_vision")

# Product categories deliberately favour useful shopping queries over claims of
# exact product identification.
_CATEGORIES = (
    "running shoes",
    "sneakers",
    "smartphone",
    "laptop computer",
    "wireless headphones",
    "smart watch",
    "backpack",
    "handbag",
    "t-shirt",
    "jeans",
    "jacket",
    "sunglasses",
    "wrist watch",
    "digital camera",
    "coffee maker",
    "water bottle",
    "office chair",
    "table lamp",
    "keyboard",
    "computer mouse",
)


def _configured_model_source() -> tuple[str, bool]:
    """Return the model source and whether it must be loaded offline."""
    model_dir = settings.local_vision_model_dir
    if model_dir:
        resolved = Path(model_dir).expanduser()
        if not resolved.is_dir():
            raise LocalVisionUnavailableError(
                detail=f"LOCAL_VISION_MODEL_DIR does not exist: {resolved}"
            )
        return str(resolved), True

    configured = Path(settings.local_vision_model).expanduser()
    if configured.is_dir():
        return str(configured), True
    return settings.local_vision_model, False


def startup_diagnostics() -> None:
    """Log the load plan without downloading model files during application startup."""
    try:
        source, offline_only = _configured_model_source()
        logger.info(
            "Local CLIP configured source=%s mode=%s attempts=%s retry_cooldown=%ss",
            source,
            "local-directory" if offline_only else "cache-then-network",
            settings.local_vision_load_attempts,
            settings.local_vision_retry_seconds,
        )
    except LocalVisionUnavailableError as exc:
        logger.warning("Local CLIP is unavailable at startup: %s", exc.detail)


def _load_model() -> tuple[Any, Any]:
    """Load CLIP once, preferring cached/local files before bounded downloads.

    A failed network download is remembered briefly so simultaneous uploads do
    not each start another large Hugging Face download.
    """
    global _MODEL, _PROCESSOR, _LOAD_FAILURE_DETAIL, _LOAD_FAILURE_UNTIL
    if _MODEL is not None and _PROCESSOR is not None:
        return _MODEL, _PROCESSOR

    with _MODEL_LOCK:
        if _MODEL is not None and _PROCESSOR is not None:
            return _MODEL, _PROCESSOR
        if time.monotonic() < _LOAD_FAILURE_UNTIL:
            raise LocalVisionUnavailableError(detail=_LOAD_FAILURE_DETAIL)

        try:
            from transformers import CLIPModel, CLIPProcessor

            source, offline_only = _configured_model_source()
            # Cache/local-directory loading is always tried first. This makes
            # normal requests fully offline after a successful download.
            try:
                processor = CLIPProcessor.from_pretrained(source, local_files_only=True)
                model = CLIPModel.from_pretrained(source, local_files_only=True)
                logger.info("Loaded local CLIP from cached/local files: %s", source)
            except Exception as cache_error:
                if offline_only:
                    raise cache_error

                attempts = max(1, min(settings.local_vision_load_attempts, 3))
                last_error: Exception = cache_error
                for attempt in range(1, attempts + 1):
                    try:
                        logger.info(
                            "Local CLIP cache miss; downloading %s (attempt %s/%s)",
                            source,
                            attempt,
                            attempts,
                        )
                        processor = CLIPProcessor.from_pretrained(source)
                        model = CLIPModel.from_pretrained(source)
                        break
                    except Exception as exc:  # network, Hub, or incomplete-download errors
                        last_error = exc
                        if attempt < attempts:
                            time.sleep(attempt)
                else:
                    raise last_error

            model.eval()
            _PROCESSOR, _MODEL = processor, model
            _LOAD_FAILURE_DETAIL = ""
            _LOAD_FAILURE_UNTIL = 0.0
        except Exception as exc:  # model download/cache/device errors
            _LOAD_FAILURE_DETAIL = str(exc)
            _LOAD_FAILURE_UNTIL = time.monotonic() + max(settings.local_vision_retry_seconds, 1)
            logger.warning(
                "Local CLIP failed to load; suppressing retries for %ss: %s",
                settings.local_vision_retry_seconds,
                exc,
            )
            raise LocalVisionUnavailableError(detail=str(exc)) from exc
    return _MODEL, _PROCESSOR


def reset_model_cache() -> None:
    """Reset process state for tests or an explicit operator reload."""
    global _MODEL, _PROCESSOR, _LOAD_FAILURE_DETAIL, _LOAD_FAILURE_UNTIL
    with _MODEL_LOCK:
        _MODEL = _PROCESSOR = None
        _LOAD_FAILURE_DETAIL = ""
        _LOAD_FAILURE_UNTIL = 0.0


def _colour_name(image: Image.Image) -> str:
    """Return a conservative dominant-colour cue for a more useful query."""
    sample = image.convert("RGB").resize((1, 1))
    red, green, blue = sample.getpixel((0, 0))
    if max(red, green, blue) < 55:
        return "black"
    if min(red, green, blue) > 205:
        return "white"
    if max(red, green, blue) - min(red, green, blue) < 24:
        return "grey"
    if red > blue * 1.3 and red > green * 1.15:
        return "red"
    if blue > red * 1.2 and blue > green * 1.1:
        return "blue"
    if green > red * 1.15 and green > blue * 1.1:
        return "green"
    if red > 120 and green > 90 and blue < 100:
        return "brown"
    return ""


def _analyse_sync(image: PreparedImage) -> VisionAttributes:
    import io

    model, processor = _load_model()
    try:
        import torch
    except ImportError as exc:
        raise LocalVisionUnavailableError(detail="PyTorch is not installed") from exc
    picture = Image.open(io.BytesIO(image.data)).convert("RGB")
    inputs = processor(text=list(_CATEGORIES), images=picture, return_tensors="pt", padding=True)
    with torch.inference_mode():
        scores = model(**inputs).logits_per_image[0].softmax(dim=0)

    top_index = int(scores.argmax().item())
    category = _CATEGORIES[top_index]
    confidence = float(scores[top_index].item())
    colour = _colour_name(picture)
    search_query = " ".join(part for part in (colour, category) if part)
    attributes = [category]
    if colour:
        attributes.insert(0, colour)

    return VisionAttributes(
        product_name=f"Estimated category: {category.title()}",
        category=category,
        description=(
            f"A local image model estimates that this photo is most similar to {category}. "
            "Confirm or edit the search query before searching."
        ),
        search_query=search_query,
        attributes=attributes,
        confidence=round(confidence, 2),
        detected=True,
        provider="local-clip",
        is_demo=False,
        notes=[
            "Estimated locally with CLIP; this is a category suggestion, not verified product or brand data."
        ],
    )


async def analyse_image(image: PreparedImage) -> VisionAttributes:
    """Run CPU-safe local analysis without blocking FastAPI's event loop."""
    import asyncio

    return await asyncio.to_thread(_analyse_sync, image)
