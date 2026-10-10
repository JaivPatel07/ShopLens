"""Conservative open-vocabulary product detection with OWL-ViT.

OWL-ViT can score only the text prompts it is given.  It is therefore used to
identify visible product type and construction cues, never to assert a brand or
model which is not legible in the photograph.

Design decisions
----------------
* PROMPTS are grouped into TYPE_LABELS (what the product is) and
  ATTRIBUTE_LABELS (how it looks).  The query is built as
  ``<colour> <material> <type>`` so SerpApi's keyword engine puts most weight
  on the product type.
* Colour comes from a pixel heuristic (centre crop) rather than OWL-ViT
  because the detector's colour prompts are less reliable than a direct RGB
  inspection for a single dominant colour.
* ATTRIBUTE_THRESHOLD is higher than the detection threshold to keep noisy
  attributes out of the search query.
* A ``buy`` suffix is appended so Google Shopping weights the query as a
  transactional intent rather than an informational one.
"""
from __future__ import annotations

import asyncio
import io
import logging
import threading
from pathlib import Path
from typing import Any

from PIL import Image

from app.config import settings
from app.models.search import DetectionDebug, VisionAttributes
from app.utils.errors import LocalVisionUnavailableError
from app.utils.images import PreparedImage

logger = logging.getLogger("snapbuy.owlvit")
_LOCK = threading.Lock()
_MODEL: Any | None = None
_PROCESSOR: Any | None = None

# ---------------------------------------------------------------------------
# Prompts: TYPE_LABELS identify *what* the product is; ATTRIBUTE_LABELS
# describe *how* it looks.  Prompts are deliberately footwear-focused for this
# use-case but are general enough that other product types can score too.
# ---------------------------------------------------------------------------

# Common product types (perfume, cosmetics, footwear, accessories, electronics)
_PRODUCT_TYPES = (
    # Fragrance & cosmetics
    "perfume",
    "fragrance",
    "cologne",
    "eau de parfum",
    "scent bottle",
    "cosmetics",
    "lipstick",
    "lotion bottle",
    # Footwear
    "ankle boot",
    "chelsea boot",
    "combat boot",
    "hiking boot",
    "work boot",
    "knee high boot",
    "cowboy boot",
    "rain boot",
    "platform boot",
    "running shoe",
    "sneaker",
    "trainer",
    "loafer",
    "sandal",
    "high heel",
    "stiletto heel",
    "wedge shoe",
    "mule shoe",
    "oxford shoe",
    "derby shoe",
    "slipper",
    "flip flop",
    # Fashion & accessories
    "handbag",
    "backpack",
    "wallet",
    "wrist watch",
    "smartwatch",
    "sunglasses",
    "jacket",
    "hoodie",
    "t-shirt",
    # Electronics
    "headphones",
    "wireless earbuds",
    "smartphone",
    "tablet",
    "laptop",
    "water bottle",
)

# Construction / material attributes that OWL-ViT can plausibly score
_PRODUCT_ATTRIBUTES = (
    # Fragrance & packaging
    "glass bottle",
    "spray bottle",
    "luxury bottle",
    "gold bottle",
    "black bottle",
    "clear bottle",
    # Footwear & apparel
    "leather boot",
    "suede boot",
    "canvas shoe",
    "rubber sole shoe",
    "chunky sole boot",
    "pointed toe shoe",
    "round toe shoe",
    "square toe shoe",
    "lace-up boot",
    "zipper boot",
    "slip-on shoe",
    "buckle boot",
    "fur lined boot",
    "waterproof boot",
)

PROMPTS: tuple[str, ...] = _PRODUCT_TYPES + _PRODUCT_ATTRIBUTES

TYPE_LABELS: set[str] = set(_PRODUCT_TYPES)
ATTRIBUTE_LABELS: set[str] = set(_PRODUCT_ATTRIBUTES)

# OWL-ViT detection gate: boxes below this are discarded outright.
_DETECT_THRESHOLD: float = 0.12
# Minimum score for a TYPE label to be accepted as the product type.
_TYPE_THRESHOLD: float = 0.20
# Minimum score for an ATTRIBUTE label to be included in the query.
# Higher than _TYPE_THRESHOLD to keep noisy qualifiers out.
_ATTRIBUTE_THRESHOLD: float = 0.22
# Maximum number of attribute tokens to include in the search query.
_MAX_ATTRS: int = 3


def _source() -> tuple[str, bool]:
    directory = settings.local_vision_model_dir
    if directory:
        path = Path(directory).expanduser()
        if not path.is_dir():
            raise LocalVisionUnavailableError(detail="LOCAL_VISION_MODEL_DIR does not exist")
        return str(path), True
    path = Path(settings.local_vision_model).expanduser()
    return (str(path), True) if path.is_dir() else (settings.local_vision_model, False)


def _load() -> tuple[Any, Any]:
    global _MODEL, _PROCESSOR
    if _MODEL is not None:
        return _MODEL, _PROCESSOR
    with _LOCK:
        if _MODEL is not None:
            return _MODEL, _PROCESSOR
        try:
            from transformers import OwlViTForObjectDetection, OwlViTProcessor
            source, offline = _source()
            kwargs: dict[str, Any] = {"local_files_only": True}
            try:
                processor = OwlViTProcessor.from_pretrained(source, **kwargs)
                model = OwlViTForObjectDetection.from_pretrained(source, **kwargs)
            except Exception:
                if offline:
                    raise
                processor = OwlViTProcessor.from_pretrained(source)
                model = OwlViTForObjectDetection.from_pretrained(source)
            model.eval()
            _MODEL, _PROCESSOR = model, processor
            logger.info("Loaded OWL-ViT model source=%s", source)
        except Exception as exc:
            logger.warning("OWL-ViT unavailable: %s", exc)
            raise LocalVisionUnavailableError(
                detail="The local OWL-ViT model could not be loaded."
            ) from exc
    return _MODEL, _PROCESSOR


def _colour_name(image: Image.Image) -> str | None:
    """Infer a dominant colour from the central 50% of the image.

    Uses the centre crop to avoid misclassifying the (often white/grey)
    background as a product colour.  Returns ``None`` when the colour is
    ambiguous rather than guessing.
    """
    w, h = image.size
    crop = image.crop((w // 4, h // 4, w * 3 // 4, h * 3 // 4)).resize((1, 1)).convert("RGB")
    r, g, b = crop.getpixel((0, 0))

    # Achromatic heuristics first
    if max(r, g, b) < 55:
        return "black"
    if min(r, g, b) > 215:
        return "white"
    # Grey: low saturation.  Raise the chroma threshold to avoid classifying
    # tan/camel leather as grey (those colours have r-b gaps of 30-60).
    if max(r, g, b) - min(r, g, b) < 30:
        return "grey"

    # Chromatic heuristics
    if r > b * 1.25 and r > g * 1.12:
        return "red"
    if b > r * 1.18 and b > g * 1.08:
        return "blue"
    # Brown / tan / camel: common for leather boots.
    # Red channel dominant, green is moderate, blue is clearly lower.
    if r >= 110 and g >= 60 and b < r * 0.70 and r > g * 1.10:
        if g > 120:
            return "tan"      # camel / tan leather
        return "brown"        # dark brown leather
    # Olive / khaki
    if g >= r * 0.85 and g > b * 1.15 and r > 90:
        return "olive"
    return None


def _build_query(
    product_type: str,
    colour: str | None,
    material_attrs: list[str],
) -> str:
    """Assemble a Google Shopping query from the detected signals.

    Structure: ``<colour> <material/style> <product-type> buy``

    * Product type is always present and comes just before the intent keyword
      so Google's keyword model doesn't dilute its weight with adjectives.
    * Colour is placed first because it is the strongest visual discriminator
      for footwear.
    * Material/style attributes are mid-position: they refine the type without
      displacing it.
    * ``buy`` signals transactional intent to Google Shopping.
    """
    # Strip the generic "footwear" / "shoe" / "boot" suffix that some attribute
    # prompts carry (e.g. "leather boot" → "leather") so the query doesn't
    # repeat the product type.
    _TYPE_SUFFIXES = (" boot", " boots", " shoe", " shoes", " footwear")

    def _strip_type_suffix(attr: str) -> str:
        for suffix in _TYPE_SUFFIXES:
            if attr.endswith(suffix):
                return attr[: -len(suffix)].strip()
        return attr

    clean_attrs = [_strip_type_suffix(a) for a in material_attrs]
    # De-duplicate while preserving order
    seen: set[str] = set()
    unique_attrs: list[str] = []
    for a in clean_attrs:
        key = a.lower()
        if key and key not in seen:
            seen.add(key)
            unique_attrs.append(a)

    parts: list[str] = []
    if colour:
        parts.append(colour)
    parts.extend(unique_attrs[:_MAX_ATTRS])
    parts.append(product_type)
    parts.append("buy")  # transactional intent
    return " ".join(parts)


def _analyse_sync(prepared: PreparedImage) -> VisionAttributes:  # noqa: PLR0912
    import torch

    model, processor = _load()
    image = Image.open(io.BytesIO(prepared.data)).convert("RGB")

    inputs = processor(text=[list(PROMPTS)], images=image, return_tensors="pt")
    with torch.inference_mode():
        outputs = model(**inputs)

    result = processor.post_process_object_detection(
        outputs=outputs,
        target_sizes=torch.tensor([(image.height, image.width)]),
        threshold=_DETECT_THRESHOLD,
    )[0]

    # Aggregate: when the same label appears multiple times (multiple bounding
    # boxes) keep the highest score only.
    best_per_label: dict[str, float] = {}
    for score, label in zip(result["scores"], result["labels"]):
        prompt = PROMPTS[int(label)]
        s = float(score)
        if s > best_per_label.get(prompt, 0.0):
            best_per_label[prompt] = s

    candidates: list[tuple[str, float]] = sorted(
        best_per_label.items(), key=lambda item: item[1], reverse=True
    )

    # Debug payload: top-8 candidates (no secrets exposed)
    debug = [
        DetectionDebug(label=label, score=round(score, 3))
        for label, score in candidates[:8]
    ]
    logger.debug(
        "OWL-ViT top candidates: %s",
        [(lbl, round(sc, 3)) for lbl, sc in candidates[:8]],
    )

    # --- Product type selection ---
    product = next(
        ((label, score) for label, score in candidates if label in TYPE_LABELS),
        None,
    )
    if not product or product[1] < _TYPE_THRESHOLD:
        low_conf = product[1] if product else None
        logger.info(
            "OWL-ViT: no type label exceeded threshold %.2f (best=%s)",
            _TYPE_THRESHOLD,
            low_conf,
        )
        return VisionAttributes(
            product_name="Product not confidently identified",
            search_query="",
            detected=False,
            provider="owlvit",
            confidence=None,
            detection_debug=debug,
            notes=[
                (
                    f"OWL-ViT candidate score was {low_conf:.3f} (below threshold {_TYPE_THRESHOLD}). "
                    if low_conf is not None
                    else "No product type exceeded confidence threshold. "
                )
                + "Try a clearer photo, or use the visual matches found by Google Lens."
            ],
        )

    product_type, confidence = product

    # --- Attribute selection (material / construction style) ---
    # Only attributes whose score exceeds _ATTRIBUTE_THRESHOLD are kept.
    material_attrs: list[str] = [
        label
        for label, score in candidates
        if label in ATTRIBUTE_LABELS and score >= _ATTRIBUTE_THRESHOLD
    ][:_MAX_ATTRS]

    # --- Colour from pixel heuristic ---
    colour = _colour_name(image)

    logger.info(
        "OWL-ViT detection: type=%r conf=%.3f colour=%r attrs=%s",
        product_type,
        confidence,
        colour,
        material_attrs,
    )

    # --- Query assembly ---
    query = _build_query(product_type, colour, material_attrs)

    # Human-readable description
    desc_parts: list[str] = []
    if colour:
        desc_parts.append(colour)
    if material_attrs:
        desc_parts.extend(material_attrs)
    desc_parts.append(product_type)
    description = (
        "Visible product appears to be a "
        + " ".join(desc_parts)
        + ". Brand and model are not asserted unless legible in the image."
    )

    all_attrs = ([colour] if colour else []) + material_attrs
    notes = [
        "Closest visual matches shown — no exact brand or model was verified from this image.",
        f"Search query strategy: colour={colour!r}, material/style={material_attrs}, "
        f"type={product_type!r}, confidence={confidence:.3f}",
    ]

    return VisionAttributes(
        product_name=product_type.title(),
        category=product_type,
        description=description,
        search_query=query,
        attributes=[product_type, *all_attrs],
        confidence=round(confidence, 3),
        detected=True,
        provider="owlvit",
        detection_debug=debug,
        notes=notes,
    )


async def analyse_image(image: PreparedImage) -> VisionAttributes:
    return await asyncio.to_thread(_analyse_sync, image)
