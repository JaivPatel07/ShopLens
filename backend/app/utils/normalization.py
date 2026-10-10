"""Normalisation helpers.

Two responsibilities, both about turning untrusted external strings into clean
values the rest of the app can rely on:

1. Price / number / text parsing (``parse_price``, ``format_price``, ...).
2. Mapping a raw SerpApi payload onto the :class:`~app.models.product.Product`
   model (``normalize_serpapi_payload``).

The frontend never receives a raw SerpApi response.
"""

from __future__ import annotations

import re
from urllib.parse import quote_plus

from app.models.product import Product, VisualMatch

# --------------------------------------------------------------------------- #
# Currency / number parsing
# --------------------------------------------------------------------------- #

CURRENCY_SYMBOLS: dict[str, str] = {
    "₹": "INR",
    "rs": "INR",
    "rs.": "INR",
    "inr": "INR",
    "$": "USD",
    "usd": "USD",
    "us$": "USD",
    "€": "EUR",
    "eur": "EUR",
    "£": "GBP",
    "gbp": "GBP",
    "¥": "JPY",
    "jpy": "JPY",
    "aed": "AED",
    "sar": "SAR",
    "cad": "CAD",
    "aud": "AUD",
    "sgd": "SGD",
}

SYMBOL_FOR_CURRENCY: dict[str, str] = {
    "INR": "₹",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "JPY": "¥",
    "AED": "AED ",
    "SAR": "SAR ",
    "CAD": "C$",
    "AUD": "A$",
    "SGD": "S$",
}

_PRICE_RE = re.compile(r"(\d[\d\s.,\u00a0\u202f]*)")
_NON_NUMERIC = re.compile(r"[^\d]")


def detect_currency(raw: str, default: str = "INR") -> str:
    """Best-effort currency detection from a price string."""
    if not raw:
        return default
    lowered = raw.lower()
    if "$" in lowered:
        return "USD"
    for token, code in CURRENCY_SYMBOLS.items():
        if token in lowered:
            return code
    return default


def parse_price(raw: object, default_currency: str = "INR") -> tuple[float | None, str]:
    """Parse ``"₹1,49,990.00"`` -> ``(149990.0, "INR")``.

    Handles Indian digit grouping, dot/comma decimals and stray whitespace.
    Returns ``(None, currency)`` when no usable number is present.
    """
    if raw is None:
        return None, default_currency
    if isinstance(raw, bool):
        return None, default_currency
    if isinstance(raw, (int, float)):
        value = float(raw)
        return (value if value > 0 else None), default_currency

    text = str(raw).strip()
    if not text:
        return None, default_currency

    currency = detect_currency(text, default_currency)
    match = _PRICE_RE.search(text)
    if not match:
        return None, currency

    cleaned = match.group(1).replace("\u00a0", "").replace("\u202f", "").replace(" ", "")

    if "," in cleaned and "." in cleaned:
        # Whichever separator comes last is the decimal separator.
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        parts = cleaned.split(",")
        if len(parts) == 2 and len(parts[-1]) == 2 and len(parts[0]) <= 4:
            # European style decimal comma, e.g. "8499,50"
            cleaned = cleaned.replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif cleaned.count(".") > 1:
        cleaned = cleaned.replace(".", "")

    if "." not in cleaned:
        cleaned = _NON_NUMERIC.sub("", cleaned)

    try:
        value = float(cleaned)
    except ValueError:
        return None, currency
    if value <= 0:
        return None, currency
    return value, currency


def _indian_grouping(digits: str) -> str:
    """``149990`` -> ``"1,49,990"`` (lakh/crore grouping used in India)."""
    if len(digits) <= 3:
        return digits
    head, tail = digits[:-3], digits[-3:]
    groups: list[str] = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ",".join([*groups, tail])


def format_price(value: float | None, currency: str = "INR") -> str | None:
    """Format ``8499`` as ``"₹8,499"`` using Indian digit grouping for INR."""
    if value is None:
        return None
    code = (currency or "INR").upper()
    symbol = SYMBOL_FOR_CURRENCY.get(code, f"{code} ")

    negative = value < 0
    absolute = abs(float(value))
    if absolute.is_integer():
        whole, fraction = f"{int(absolute)}", ""
    else:
        whole, _, decimals = f"{absolute:.2f}".partition(".")
        fraction = f".{decimals}"

    body = _indian_grouping(whole) if code == "INR" else f"{int(whole):,}"
    return f"{'-' if negative else ''}{symbol}{body}{fraction}"


def parse_int(raw: object) -> int | None:
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw if raw >= 0 else None
    if isinstance(raw, float):
        return int(raw) if raw >= 0 else None
    digits = _NON_NUMERIC.sub("", str(raw))
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def parse_float(raw: object, *, minimum: float = 0.0, maximum: float = 5.0) -> float | None:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        value = float(str(raw).replace(",", ".").strip())
    except (TypeError, ValueError):
        return None
    if value < minimum or value > maximum:
        return None
    return round(value, 2)


def discount_percent(price: float | None, original: float | None) -> float | None:
    """Percentage saved - only when the original price is genuinely higher."""
    if price is None or original is None or original <= price:
        return None
    return round((original - price) / original * 100, 1)


def clean_text(raw: object, *, limit: int = 400) -> str | None:
    if raw is None:
        return None
    text = " ".join(str(raw).split())
    if not text:
        return None
    return text[:limit]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")[:60]


# --------------------------------------------------------------------------- #
# SerpApi payload -> Product
# --------------------------------------------------------------------------- #

_LINK_KEYS = ("direct_link", "link", "product_link", "merchant_link", "serpapi_link")
_THUMBNAIL_KEYS = ("thumbnail", "image", "thumbnail_image", "serpapi_thumbnail", "image_url")
_PRICE_KEYS = ("extracted_price", "price")
_ORIGINAL_PRICE_KEYS = (
    "extracted_old_price",
    "extracted_original_price",
    "old_price",
    "original_price",
)


def _first(payload: dict, keys: tuple[str, ...]) -> object | None:
    for key in keys:
        value = payload.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def shopping_results_from_payload(payload: dict) -> list[dict]:
    """Return the shopping result list, whichever key the engine used."""
    for key in (
        "shopping_results",
        "inline_shopping_results",
        "shopping_ads",
        "products",
        "catalog_results",
    ):
        value = payload.get(key)
        if isinstance(value, list) and value:
            return [item for item in value if isinstance(item, dict)]
    return []


def google_shopping_fallback_url(title: str) -> str:
    """A real, always-valid destination when a merchant link is missing."""
    return f"https://www.google.com/search?tbm=shop&q={quote_plus(title)}"


def normalize_serpapi_result(
    raw: dict,
    *,
    position: int,
    default_currency: str = "INR",
    is_demo: bool = False,
) -> Product | None:
    """Map one raw result dict onto a :class:`Product` (``None`` if unusable)."""
    title = clean_text(raw.get("title") or raw.get("name"), limit=240)
    if not title:
        return None

    price_raw = _first(raw, _PRICE_KEYS)
    price, currency = parse_price(price_raw, default_currency)
    if price is None and isinstance(price_raw, (int, float)) and price_raw > 0:
        price = float(price_raw)
    currency = (currency or default_currency).upper()

    original_raw = _first(raw, _ORIGINAL_PRICE_KEYS)
    original_price, original_currency = parse_price(original_raw, currency)
    if original_price is not None and price is not None and original_price <= price:
        # Not a genuine "was" price.
        original_price = None
    if original_price is not None:
        currency = (original_currency or currency).upper()

    source = clean_text(
        raw.get("source") or raw.get("merchant") or raw.get("seller") or raw.get("store"),
        limit=60,
    )
    rating = parse_float(raw.get("rating"), minimum=0, maximum=5)
    reviews = parse_int(
        raw.get("reviews") if raw.get("reviews") is not None else raw.get("review_count")
    )

    thumbnail = _first(raw, _THUMBNAIL_KEYS)
    thumbnail = clean_text(thumbnail, limit=600) if isinstance(thumbnail, str) else None

    link = _first(raw, _LINK_KEYS)
    link = clean_text(link, limit=900) if isinstance(link, str) else None
    if not link:
        link = google_shopping_fallback_url(title)

    extensions_raw = raw.get("extensions") or raw.get("tags") or []
    extensions = [
        clean_text(item, limit=60)
        for item in (extensions_raw if isinstance(extensions_raw, list) else [])
    ]
    extensions = [item for item in extensions if item]

    identifier = f"{slug(source or 'store')}-{slug(title)[:40]}-{position}"
    product_id = raw.get("product_id") or raw.get("immersive_product_page_token")
    if product_id:
        identifier = f"{identifier}-{str(product_id)[:16]}"

    return Product(
        id=identifier,
        title=title,
        price=price,
        currency=currency,
        price_formatted=format_price(price, currency),
        original_price=original_price,
        original_price_formatted=format_price(original_price, currency),
        discount_percent=discount_percent(price, original_price),
        source=source,
        rating=rating,
        reviews=reviews,
        thumbnail=thumbnail,
        link=link,
        position=position,
        snippet=clean_text(raw.get("snippet") or raw.get("description"), limit=300),
        delivery=clean_text(raw.get("delivery") or raw.get("delivery_info"), limit=120),
        extensions=extensions[:6],
        is_demo=is_demo,
    )


def normalize_serpapi_payload(
    payload: dict,
    *,
    default_currency: str = "INR",
    limit: int = 40,
    is_demo: bool = False,
) -> list[Product]:
    """Map an entire SerpApi payload into a de-duplicated product list."""
    products: list[Product] = []
    seen: set[str] = set()

    for index, raw in enumerate(shopping_results_from_payload(payload)):
        product = normalize_serpapi_result(
            raw, position=index + 1, default_currency=default_currency, is_demo=is_demo
        )
        if product is None:
            continue
        key = f"{product.title.lower()}|{(product.source or '').lower()}|{product.price}"
        if key in seen:
            continue
        seen.add(key)
        products.append(product)
        if len(products) >= limit:
            break

    return products


def parse_payload_price(payload: dict) -> tuple[float | None, str]:
    """Convenience re-export used by tests and the demo fixtures."""
    return parse_price(_first(payload, _PRICE_KEYS), "INR")


# --------------------------------------------------------------------------- #
# Google Lens payload -> VisualMatch
# --------------------------------------------------------------------------- #

def _lens_price(raw: object, default_currency: str) -> tuple[float | None, str, str | None]:
    """Lens prices arrive as ``{"value": "₹8,499", "extracted_value": 8499, ...}``."""
    if isinstance(raw, dict):
        extracted = raw.get("extracted_value")
        value, currency = parse_price(extracted, default_currency)
        if value is None:
            value, currency = parse_price(raw.get("value"), default_currency)
        if isinstance(raw.get("currency"), str) and raw["currency"].strip():
            currency = detect_currency(raw["currency"], currency)
        return value, currency, clean_text(raw.get("value"), limit=40)
    value, currency = parse_price(raw, default_currency)
    return value, currency, None


def normalize_visual_matches(
    payload: dict,
    *,
    default_currency: str = "INR",
    limit: int = 12,
    is_demo: bool = False,
) -> list[VisualMatch]:
    """Map a ``engine=google_lens`` payload onto :class:`VisualMatch` rows."""
    matches: list[VisualMatch] = []
    seen: set[str] = set()

    raw_items = payload.get("visual_matches")
    if not isinstance(raw_items, list) or not raw_items:
        raw_items = payload.get("products")
    if not isinstance(raw_items, list) or not raw_items:
        rev = payload.get("reverse_image_search")
        if isinstance(rev, dict):
            raw_items = rev.get("organic_results")
    if not isinstance(raw_items, list):
        return []

    for index, raw in enumerate(raw_items):
        if not isinstance(raw, dict):
            continue
        title = clean_text(raw.get("title") or raw.get("name"), limit=200)
        if not title:
            continue
        link = clean_text(_first(raw, _LINK_KEYS), limit=500)
        if not link:
            link = google_shopping_fallback_url(title)

        source = clean_text(
            raw.get("source") or raw.get("merchant") or raw.get("seller") or raw.get("domain"),
            limit=80,
        )
        price_raw = raw.get("price") if raw.get("price") is not None else raw.get("extracted_price")
        price, currency, price_display = _lens_price(price_raw, default_currency)
        thumbnail = clean_text(_first(raw, _THUMBNAIL_KEYS), limit=500)

        key = f"{title.lower()}|{(link or '')}"
        if key in seen:
            continue
        seen.add(key)

        matches.append(
            VisualMatch(
                id=f"lens-{index + 1}-{slug(title)}",
                title=title,
                source=source,
                link=link,
                thumbnail=thumbnail,
                price=price,
                currency=currency,
                price_formatted=price_display or format_price(price, currency),
                rating=parse_float(raw.get("rating"), minimum=0, maximum=5),
                reviews=parse_int(raw.get("reviews") if raw.get("reviews") is not None else raw.get("review_count")),
                in_stock=raw.get("in_stock") if isinstance(raw.get("in_stock"), bool) else None,
                is_demo=is_demo,
            )
        )
        if len(matches) >= limit:
            break

    return matches
