"""Transparent recommendation scoring.

``value_score = price_score * 0.55 + rating_score * 0.30 + review_score * 0.15``

Nothing is pretended to be objective: when a component is missing (for example
no merchant exposes a rating) the remaining weights are re-normalised, and the
score is flagged as lower confidence.  A product with no usable signals at all
gets ``value_score = None`` instead of a misleading number.
"""

from __future__ import annotations

BASE_WEIGHTS = {"price": 0.55, "rating": 0.30, "reviews": 0.15}


def _min_max(values: list[float]) -> tuple[float, float] | None:
    if not values:
        return None
    return min(values), max(values)


def _normalise(value: float, bounds: tuple[float, float], *, invert: bool) -> float:
    low, high = bounds
    if high <= low:
        return 1.0
    ratio = (value - low) / (high - low)
    return 1.0 - ratio if invert else ratio


def compute_value_scores(products: list) -> None:
    """Attach a 0-100 ``value_score`` (and confidence notes) to each product.

    Mutates the product objects in place; returns ``None``.
    """
    priced = [p for p in products if p.price is not None]
    if not priced:
        return

    price_bounds = _min_max([p.price for p in priced])
    rated = [p for p in priced if p.rating is not None]
    reviewed = [p for p in priced if p.reviews is not None]
    rating_bounds = _min_max([p.rating for p in rated])
    review_bounds = _min_max([float(p.reviews) for p in reviewed])

    for product in products:
        if product.price is None:
            product.value_score = None
            continue

        components: dict[str, tuple[float, float]] = {}
        if price_bounds:
            components["price"] = (
                _normalise(product.price, price_bounds, invert=True),
                BASE_WEIGHTS["price"],
            )
        if product.rating is not None and rating_bounds:
            components["rating"] = (
                _normalise(product.rating, rating_bounds, invert=False),
                BASE_WEIGHTS["rating"],
            )
        if product.reviews is not None and review_bounds:
            components["reviews"] = (
                _normalise(float(product.reviews), review_bounds, invert=False),
                BASE_WEIGHTS["reviews"],
            )

        total_weight = sum(weight for _, weight in components.values())
        if total_weight <= 0:
            product.value_score = None
            continue

        score = sum(value * weight for value, weight in components.values()) / total_weight
        product.value_score = round(score * 100, 1)
