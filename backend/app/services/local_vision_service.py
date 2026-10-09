"""Free, local image-to-shopping-query analysis using CLIP.

CLIP is used only to estimate a broad product category. It cannot reliably
identify an exact retail SKU, so every response is explicitly labelled as an
estimate and remains editable before a SerpApi shopping search is made.
"""

from __future__ import annotations

import threading
from typing import Any

from PIL import Image

from app.config import settings
from app.models.search import VisionAttributes
from app.utils.errors import VisionProviderError
from app.utils.images import PreparedImage

_MODEL_LOCK = threading.Lock()
_MODEL: Any | None = None
_PROCESSOR: Any | None = None

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


def _load_model() -> tuple[Any, Any]:
    """Load model weights once per process, not once per upload."""
    global _MODEL, _PROCESSOR
    if _MODEL is not None and _PROCESSOR is not None:
        return _MODEL, _PROCESSOR

    with _MODEL_LOCK:
        if _MODEL is not None and _PROCESSOR is not None:
            return _MODEL, _PROCESSOR
        try:
            from transformers import CLIPModel, CLIPProcessor

            _PROCESSOR = CLIPProcessor.from_pretrained(settings.local_vision_model)
            _MODEL = CLIPModel.from_pretrained(settings.local_vision_model)
            _MODEL.eval()
        except Exception as exc:  # model download/cache/device errors
            raise VisionProviderError(
                "Local image analysis could not start. Enter a search query manually and try again.",
                detail=str(exc),
            ) from exc
    return _MODEL, _PROCESSOR


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
    import torch

    model, processor = _load_model()
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
