"""Price comparison and recommendation intelligence.

Everything in this module is deterministic and explainable: the UI shows the
same reasoning that is computed here.  No recommendation is invented when the
data does not support one.
"""

from __future__ import annotations

import logging
import statistics
import time

from app.config import settings
from app.data.demo_data import DEMO_SERPAPI_PAYLOAD
from app.models.product import (
    PriceSummary,
    Product,
    Recommendation,
    SearchResponse,
    SellerOffer,
)
from app.services import serpapi_service
from app.utils.errors import SearchNotConfiguredError
from app.utils.normalization import format_price, normalize_serpapi_payload
from app.utils.scoring import compute_value_scores

logger = logging.getLogger("snapbuy.products")

# Field names that are not real merchants.
_PSEUDO_SELLERS = {"", "google", "google shopping", "shopping", "google.com"}


# --------------------------------------------------------------------------- #
# Summary / sellers / recommendation
# --------------------------------------------------------------------------- #


def summarize(products: list[Product], currency: str = "INR") -> PriceSummary:
    """Aggregate price statistics from *valid* numeric prices only."""
    priced = [p for p in products if p.price is not None and p.price > 0]
    summary = PriceSummary(count=len(products), priced_count=len(priced), currency=currency)
    if not priced:
        return summary

    prices = [float(p.price) for p in priced]
    summary.lowest_price = min(prices)
    summary.highest_price = max(prices)
    summary.average_price = round(sum(prices) / len(prices), 2)
    summary.median_price = round(statistics.median(prices), 2)

    summary.lowest_price_formatted = format_price(summary.lowest_price, currency)
    summary.highest_price_formatted = format_price(summary.highest_price, currency)
    summary.average_price_formatted = format_price(summary.average_price, currency)
    summary.median_price_formatted = format_price(summary.median_price, currency)

    if summary.highest_price and summary.lowest_price < summary.highest_price:
        summary.potential_saving = round(summary.highest_price - summary.lowest_price, 2)
        summary.potential_saving_formatted = format_price(summary.potential_saving, currency)

    sellers = {p.source for p in products if p.source and p.source.strip().lower() not in _PSEUDO_SELLERS}
    summary.seller_count = len(sellers)
    summary.rated_count = len([p for p in products if p.rating is not None])
    return summary


def build_sellers(products: list[Product], currency: str = "INR") -> list[SellerOffer]:
    """One row per merchant holding its cheapest offer, sorted low -> high."""
    cheapest: dict[str, Product] = {}
    for product in products:
        if product.price is None or not product.source:
            continue
        key = product.source.strip()
        if key.lower() in _PSEUDO_SELLERS:
            continue
        current = cheapest.get(key)
        if current is None or (current.price or 0) > product.price:
            cheapest[key] = product

    offers: list[SellerOffer] = []
    for source, product in cheapest.items():
        offers.append(
            SellerOffer(
                source=source,
                price=float(product.price or 0),
                currency=currency,
                price_formatted=format_price(product.price, currency),
                title=product.title,
                link=product.link,
                rating=product.rating,
                reviews=product.reviews,
            )
        )

    offers.sort(key=lambda offer: offer.price)
    if offers:
        lowest = offers[0].price
        offers[0].is_lowest = True
        for offer in offers:
            offer.delta_from_lowest = round(offer.price - lowest, 2)
            offer.delta_from_lowest_formatted = (
                format_price(offer.delta_from_lowest, currency) if offer.delta_from_lowest else None
            )
    return offers


def pick_best_rated(products: list[Product]) -> Product | None:
    """Highest rating, breaking ties with the larger review count."""
    rated = [p for p in products if p.rating is not None]
    if not rated:
        return None
    rated.sort(key=lambda p: (p.rating or 0, p.reviews or 0, -(p.price or 0)), reverse=True)
    best = rated[0]
    if best.rating is None:
        return None
    return best


def _insufficient(explanation: str, product: Product | None = None) -> Recommendation:
    return Recommendation(
        product=product,
        reason="insufficient_data",
        headline="Not enough data for a confident pick",
        explanation=explanation,
        confidence="low",
    )


def pick_best_deal(products: list[Product], summary: PriceSummary) -> Recommendation:
    """Choose a winner using the documented, transparent scoring rule."""
    priced = [p for p in products if p.price is not None and p.price > 0]
    if not priced:
        return _insufficient(
            "None of the results returned a usable price, so no comparison was possible."
        )

    priced.sort(key=lambda p: p.price or float("inf"))
    cheapest = priced[0]

    if len(priced) < 3 or summary.highest_price == summary.lowest_price:
        reason = "only lowest price available" if len(priced) < 3 else "all prices match"
        savings = None
        if summary.highest_price and summary.lowest_price is not None:
            difference = summary.highest_price - summary.lowest_price
            savings = round(difference, 2) if difference > 0 else None
        return Recommendation(
            product=cheapest,
            reason="lowest_price",
            headline="Lowest price found",
            explanation=(
                f"Only {len(priced)} priced result(s) were available, so SnapBuy simply "
                f"shows the cheapest one ({reason}). Best-value scoring needs at least "
                "three priced results to be meaningful."
            ),
            savings=savings,
            savings_formatted=format_price(savings, summary.currency) if savings else None,
            value_score=cheapest.value_score,
            confidence="low",
            alternatives=[],
        )

    ranked = sorted(
        priced,
        key=lambda p: (p.value_score if p.value_score is not None else -1, -(p.price or 0)),
        reverse=True,
    )
    winner = ranked[0]

    rated_count = summary.rated_count
    if len(priced) >= 8 and rated_count >= 4:
        confidence = "high"
    elif len(priced) >= 4 and rated_count >= 1:
        confidence = "medium"
    else:
        confidence = "low"

    savings = None
    if summary.highest_price is not None and winner.price is not None and summary.highest_price > winner.price:
        savings = round(summary.highest_price - winner.price, 2)

    if winner.rating is not None:
        rating_note = (
            f"{winner.rating:.1f}★ from {winner.reviews:,} reviews"
            if winner.reviews
            else f"{winner.rating:.1f}★"
        )
    elif winner.reviews:
        rating_note = f"{winner.reviews:,} reviews"
    else:
        rating_note = "no rating listed"

    explanation = (
        f"Best value score of {winner.value_score:.0f}/100 across {len(priced)} priced results "
        f"and {rated_count} rated result(s) — 55% weight on price, 30% on rating, "
        f"15% on review volume ({rating_note})."
    )
    if savings:
        explanation += f" Costs {format_price(savings, summary.currency)} less than the highest listed price."

    return Recommendation(
        product=winner,
        reason="best_value",
        headline="Best value pick",
        explanation=explanation,
        savings=savings,
        savings_formatted=format_price(savings, summary.currency) if savings else None,
        value_score=winner.value_score,
        confidence=confidence,  # type: ignore[arg-type]
        alternatives=ranked[1:4],
    )


def build_search_response(
    query: str,
    products: list[Product],
    *,
    engine: str = "google_shopping",
    is_demo: bool = False,
    notes: list[str] | None = None,
    elapsed_ms: int | None = None,
) -> SearchResponse:
    """Assemble the full dashboard payload from normalised products."""
    currency = products[0].currency if products else "INR"
    compute_value_scores(products)
    summary = summarize(products, currency)
    sellers = build_sellers(products, currency)
    best_deal = pick_best_deal(products, summary)
    best_rated = pick_best_rated(products)

    all_notes = list(notes or [])
    if is_demo:
        all_notes.insert(
            0,
            "Demo data: no live SerpApi key is configured, so this comparison uses a "
            "sample dataset. Results are labelled 'Demo Data' in the UI.",
        )
    if not products:
        all_notes.append("No shopping results were returned for this query.")

    return SearchResponse(
        query=query,
        engine=engine,
        products=products,
        summary=summary,
        sellers=sellers,
        best_deal=best_deal,
        best_rated=best_rated,
        is_demo=is_demo,
        notes=all_notes,
        elapsed_ms=elapsed_ms,
    )


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #


def demo_search_response(query: str, *, limit: int = 40, elapsed_ms: int | None = None) -> SearchResponse:
    """Build a response from the SerpApi-shaped demo fixture."""
    products = normalize_serpapi_payload(
        DEMO_SERPAPI_PAYLOAD, default_currency="INR", limit=limit, is_demo=True
    )
    return build_search_response(
        query,
        products,
        engine="google_shopping (demo fixture)",
        is_demo=True,
        elapsed_ms=elapsed_ms,
    )


async def search_products(
    query: str,
    *,
    limit: int = 40,
    gl: str | None = None,
    hl: str | None = None,
    force_refresh: bool = False,
) -> SearchResponse:
    """Search for ``query`` and return a comparison-ready response.

    Uses SerpApi whenever a key is configured; otherwise (or with
    ``DEMO_MODE=on``) it falls back to clearly-labelled demo data.
    """
    started = time.perf_counter()

    if settings.demo_mode == "on" or settings.demo_active("search"):
        if settings.demo_mode == "off" and not settings.serpapi_configured:
            raise SearchNotConfiguredError()
        response = demo_search_response(
            query, limit=limit, elapsed_ms=int((time.perf_counter() - started) * 1000)
        )
        return response

    result = await serpapi_service.search_google_shopping(
        query, limit=limit, gl=gl, hl=hl, force_refresh=force_refresh
    )
    notes = list(result.notes)
    if result.cached:
        notes.append("Served from the backend cache (same query within 15 minutes).")

    return build_search_response(
        query,
        result.products,
        engine=result.engine,
        is_demo=False,
        notes=notes,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
    )
