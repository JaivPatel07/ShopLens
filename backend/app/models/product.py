"""Pydantic models describing the normalised product payload.

The frontend never sees a raw SerpApi response: every result is mapped into
:class:`Product` here first.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


class Product(BaseModel):
    """A single shopping result, normalised across merchants."""

    id: str
    title: str
    price: float | None = None
    currency: str = "INR"
    price_formatted: str | None = None
    original_price: float | None = None
    original_price_formatted: str | None = None
    discount_percent: float | None = None
    source: str | None = None
    rating: float | None = None
    reviews: int | None = None
    thumbnail: str | None = None
    link: str | None = None
    position: int = 0
    snippet: str | None = None
    delivery: str | None = None
    extensions: list[str] = Field(default_factory=list)
    #: Transparent recommendation score in the 0-100 range (``None`` when there
    #: is not enough data to compute one).
    value_score: float | None = None
    is_demo: bool = False


class VisualMatch(BaseModel):
    """A Google Lens visual match - a product found by pixels, not keywords."""

    id: str
    title: str
    source: str | None = None
    link: str | None = None
    thumbnail: str | None = None
    price: float | None = None
    currency: str = "INR"
    price_formatted: str | None = None
    rating: float | None = None
    reviews: int | None = None
    in_stock: bool | None = None
    is_demo: bool = False


class VisualSimilarResponse(BaseModel):
    matches: list[VisualMatch] = Field(default_factory=list)
    engine: str = "google_lens"
    count: int = 0
    is_demo: bool = False
    notes: list[str] = Field(default_factory=list)


class PriceSummary(BaseModel):
    count: int = 0
    priced_count: int = 0
    lowest_price: float | None = None
    highest_price: float | None = None
    average_price: float | None = None
    median_price: float | None = None
    currency: str = "INR"
    lowest_price_formatted: str | None = None
    highest_price_formatted: str | None = None
    average_price_formatted: str | None = None
    median_price_formatted: str | None = None
    potential_saving: float | None = None
    potential_saving_formatted: str | None = None
    seller_count: int = 0
    rated_count: int = 0


class SellerOffer(BaseModel):
    """Cheapest offer for one merchant - powers the comparison chart."""

    source: str
    price: float
    currency: str = "INR"
    price_formatted: str | None = None
    title: str | None = None
    link: str | None = None
    rating: float | None = None
    reviews: int | None = None
    is_lowest: bool = False
    delta_from_lowest: float | None = None
    delta_from_lowest_formatted: str | None = None


RecommendationReason = Literal[
    "best_value",
    "lowest_price",
    "best_rating",
    "insufficient_data",
]


class Recommendation(BaseModel):
    """The "best deal" card, with the reasoning made explicit."""

    product: Product | None = None
    reason: RecommendationReason = "insufficient_data"
    headline: str = "Not enough data to pick a winner"
    explanation: str
    savings: float | None = None
    savings_formatted: str | None = None
    value_score: float | None = None
    confidence: Literal["high", "medium", "low"] = "low"
    alternatives: list[Product] = Field(default_factory=list)


class SearchResponse(BaseModel):
    query: str
    engine: str = "google_shopping"
    products: list[Product] = Field(default_factory=list)
    summary: PriceSummary = Field(default_factory=PriceSummary)
    sellers: list[SellerOffer] = Field(default_factory=list)
    best_deal: Recommendation | None = None
    best_rated: Product | None = None
    is_demo: bool = False
    notes: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    elapsed_ms: int | None = None
