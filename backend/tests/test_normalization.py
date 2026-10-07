"""Price parsing and SerpApi payload normalisation."""

from __future__ import annotations

import pytest

from app.utils.normalization import (
    discount_percent,
    format_price,
    normalize_serpapi_payload,
    normalize_serpapi_result,
    parse_float,
    parse_int,
    parse_price,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("₹8,499", 8499.0),
        ("₹1,49,990.00", 149990.0),
        ("Rs. 1,299", 1299.0),
        ("$1,299.99", 1299.99),
        ("1234", 1234.0),
        ("8 499", 8499.0),
        ("₹8,499.50", 8499.5),
        ("8499,50", 8499.5),  # european decimal comma
        ("", None),
        ("out of stock", None),
        (None, None),
        ("₹0", None),
    ],
)
def test_parse_price(raw, expected):
    value, _currency = parse_price(raw)
    assert value == expected


def test_parse_price_detects_currency():
    assert parse_price("₹1,000")[1] == "INR"
    assert parse_price("$1,000")[1] == "USD"
    assert parse_price("€1.000,50")[1] == "EUR"


def test_format_price_uses_indian_grouping():
    assert format_price(8499, "INR") == "₹8,499"
    assert format_price(149990, "INR") == "₹1,49,990"
    assert format_price(8499.5, "INR") == "₹8,499.50"
    assert format_price(None) is None


def test_parse_helpers_are_defensive():
    assert parse_int("1,234 reviews") == 1234
    assert parse_int("no reviews") is None
    assert parse_int(True) is None
    assert parse_float("4.6") == 4.6
    assert parse_float("9.9") is None  # outside the 0-5 rating range
    assert parse_float("bad") is None


def test_discount_only_when_original_is_higher():
    assert discount_percent(8499, 9999) == 15.0
    assert discount_percent(9999, 8499) is None
    assert discount_percent(None, 9999) is None


def test_normalize_full_result():
    product = normalize_serpapi_result(
        {
            "title": "Nike Air Max 270 Black (Men's)",
            "extracted_price": 8499,
            "old_price": "₹9,999",
            "source": "Myntra",
            "rating": 4.6,
            "reviews": 1234,
            "thumbnail": "https://example.com/thumb.jpg",
            "link": "https://example.com/p",
            "delivery": "Free delivery",
        },
        position=1,
    )
    assert product is not None
    assert product.title == "Nike Air Max 270 Black (Men's)"
    assert product.price == 8499
    assert product.price_formatted == "₹8,499"
    assert product.original_price == 9999
    assert product.discount_percent == 15.0
    assert product.source == "Myntra"
    assert product.rating == 4.6
    assert product.reviews == 1234
    assert product.currency == "INR"


def test_normalize_handles_missing_fields():
    product = normalize_serpapi_result({"title": "Some product"}, position=3)
    assert product is not None
    assert product.price is None
    assert product.rating is None
    assert product.reviews is None
    assert product.thumbnail is None
    assert product.source is None
    # A missing merchant link falls back to a real, working search URL.
    assert product.link and "google.com/search" in product.link


def test_normalize_skips_results_without_a_title():
    assert normalize_serpapi_result({"price": "₹10"}, position=1) is None


def test_old_price_lower_than_price_is_discarded():
    product = normalize_serpapi_result(
        {"title": "Thing", "extracted_price": 500, "old_price": "₹400"}, position=1
    )
    assert product is not None
    assert product.original_price is None
    assert product.discount_percent is None


def test_malformed_payloads_do_not_raise():
    assert normalize_serpapi_payload({}) == []
    assert normalize_serpapi_payload({"shopping_results": "not-a-list"}) == []
    assert normalize_serpapi_payload({"shopping_results": [None, 42, {"no_title": True}]}) == []
    products = normalize_serpapi_payload(
        {"shopping_results": [{"title": "A", "price": "not a price", "rating": "abc"}]}
    )
    assert len(products) == 1
    assert products[0].price is None
    assert products[0].rating is None


def test_normalize_deduplicates_and_respects_limit():
    payload = {
        "shopping_results": [
            {"title": "Same", "source": "Amazon", "extracted_price": 100},
            {"title": "Same", "source": "Amazon", "extracted_price": 100},
            {"title": "Different", "source": "Flipkart", "extracted_price": 200},
            {"title": "Third", "source": "Ajio", "extracted_price": 300},
        ]
    }
    products = normalize_serpapi_payload(payload)
    assert len(products) == 3
    assert len(normalize_serpapi_payload(payload, limit=2)) == 2


def test_indian_price_with_rupee_and_lakh_grouping():
    product = normalize_serpapi_result(
        {"title": "iPhone 15 Pro", "price": "₹1,34,900", "source": "Flipkart"}, position=1
    )
    assert product is not None
    assert product.price == 134900.0
    assert product.price_formatted == "₹1,34,900"
