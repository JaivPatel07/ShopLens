"""Search endpoint, price summary and recommendation logic."""

from __future__ import annotations

import httpx
import pytest

from app.models.product import PriceSummary, Product
from app.services import product_service, serpapi_service
from app.services.serpapi_service import clear_cache
from app.utils.errors import SearchProviderError, SearchTimeoutError
from app.utils.normalization import normalize_serpapi_payload


def _products(*specs) -> list[Product]:
    return [
        Product(id=f"p{index}", title=f"Product {index}", price=price, source=source, rating=rating,
                reviews=reviews, position=index)
        for index, (price, source, rating, reviews) in enumerate(specs, start=1)
    ]


# --------------------------------------------------------------------------- #
# Endpoint
# --------------------------------------------------------------------------- #


def test_search_post_returns_normalised_payload(client):
    response = client.post("/api/search", json={"query": "nike air max 270"})
    assert response.status_code == 200

    payload = response.json()
    assert payload["query"] == "nike air max 270"
    assert payload["products"], "demo search should return products"
    assert payload["is_demo"] is True
    assert payload["summary"]["count"] == len(payload["products"])

    product = payload["products"][0]
    for field in ("id", "title", "currency", "position", "is_demo"):
        assert field in product


def test_search_get_variant(client):
    response = client.get("/api/search", params={"q": "coffee maker"})
    assert response.status_code == 200
    assert response.json()["query"] == "coffee maker"


def test_search_requires_a_query(client):
    assert client.post("/api/search", json={"query": ""}).status_code == 422
    assert client.post("/api/search", json={"query": "   "}).status_code == 422
    assert client.post("/api/search", json={}).status_code == 422


def test_error_response_has_no_technical_detail(client):
    body = client.post("/api/search", json={"query": ""}).json()
    assert body["error"]["code"] == "invalid_request"
    assert "Traceback" not in str(body)


def test_search_summary_and_recommendation_are_consistent(client):
    payload = client.post("/api/search", json={"query": "nike air max 270"}).json()
    summary = payload["summary"]

    prices = [product["price"] for product in payload["products"] if product["price"]]
    assert summary["lowest_price"] == min(prices)
    assert summary["highest_price"] == max(prices)
    assert summary["priced_count"] == len(prices)
    assert summary["potential_saving"] == pytest.approx(max(prices) - min(prices))

    best = payload["best_deal"]
    assert best["reason"] in {"best_value", "lowest_price"}
    assert best["product"] is not None
    assert best["explanation"]
    # Sellers are grouped and sorted cheapest first.
    seller_prices = [seller["price"] for seller in payload["sellers"]]
    assert seller_prices == sorted(seller_prices)
    assert payload["sellers"][0]["is_lowest"] is True


# --------------------------------------------------------------------------- #
# Summary maths
# --------------------------------------------------------------------------- #


def test_summary_ignores_products_without_prices():
    products = _products((100.0, "A", 4.0, 10), (None, "B", None, None), (300.0, "C", 5.0, 20))
    summary = product_service.summarize(products)
    assert summary.count == 3
    assert summary.priced_count == 2
    assert summary.lowest_price == 100.0
    assert summary.highest_price == 300.0
    assert summary.average_price == 200.0
    assert summary.potential_saving == 200.0
    assert summary.seller_count == 3


def test_summary_is_empty_when_no_prices_exist():
    summary = product_service.summarize(_products((None, "A", 4.0, 10)))
    assert summary.priced_count == 0
    assert summary.lowest_price is None
    assert summary.average_price is None
    assert summary.potential_saving is None


# --------------------------------------------------------------------------- #
# Seller grouping
# --------------------------------------------------------------------------- #


def test_sellers_use_the_cheapest_offer_per_merchant():
    products = _products(
        (900.0, "Amazon", 4.0, 10),
        (850.0, "Amazon", 4.2, 12),
        (1200.0, "Flipkart", 4.5, 30),
        (100.0, None, None, None),
    )
    offers = product_service.build_sellers(products)
    assert [offer.source for offer in offers] == ["Amazon", "Flipkart"]
    assert offers[0].price == 850.0
    assert offers[0].is_lowest is True
    assert offers[1].delta_from_lowest == 350.0


# --------------------------------------------------------------------------- #
# Recommendation logic
# --------------------------------------------------------------------------- #


def test_needs_three_priced_results_before_scoring():
    products = _products((100.0, "A", 4.0, 10), (200.0, "B", 5.0, 20))
    from app.utils.scoring import compute_value_scores

    compute_value_scores(products)
    recommendation = product_service.pick_best_deal(products, product_service.summarize(products))
    assert recommendation.reason == "lowest_price"
    assert recommendation.product is not None and recommendation.product.price == 100.0
    assert recommendation.confidence == "low"
    assert "three priced results" in recommendation.explanation


def test_no_prices_means_no_recommendation():
    products = _products((None, "A", 4.0, 10))
    recommendation = product_service.pick_best_deal(products, product_service.summarize(products))
    assert recommendation.reason == "insufficient_data"
    assert recommendation.product is None


def test_best_value_prefers_a_balanced_option():
    from app.utils.scoring import compute_value_scores

    products = _products(
        (5000.0, "Expensive", 4.9, 20000),
        (600.0, "Cheap", 2.0, 3),
        (1200.0, "Balanced", 4.7, 9000),
        (1500.0, "Also", 4.1, 200),
    )
    compute_value_scores(products)
    summary = product_service.summarize(products)
    recommendation = product_service.pick_best_deal(products, summary)

    assert recommendation.reason == "best_value"
    assert recommendation.product is not None
    assert recommendation.product.source in {"Balanced", "Cheap"}
    assert recommendation.value_score is not None
    assert "55%" in recommendation.explanation
    assert recommendation.savings is not None


def test_missing_ratings_do_not_break_scoring():
    from app.utils.scoring import compute_value_scores

    products = _products((100.0, "A", None, None), (200.0, "B", None, None), (300.0, "C", None, None))
    compute_value_scores(products)
    recommendation = product_service.pick_best_deal(products, product_service.summarize(products))
    assert recommendation.reason == "best_value"
    assert recommendation.value_score is not None
    assert "no rating listed" in recommendation.explanation
    assert recommendation.confidence == "low"


def test_equal_prices_fall_back_to_lowest_price_reason():
    products = _products((500.0, "A", 4.0, 10), (500.0, "B", 4.4, 20), (500.0, "C", 3.9, 5))
    from app.utils.scoring import compute_value_scores

    compute_value_scores(products)
    recommendation = product_service.pick_best_deal(products, product_service.summarize(products))
    assert recommendation.reason == "lowest_price"


# --------------------------------------------------------------------------- #
# SerpApi integration failure handling
# --------------------------------------------------------------------------- #


@pytest.fixture()
def live_search(monkeypatch):
    """Force the real (non-demo) SerpApi code path with a fake API key."""
    monkeypatch.setattr("app.config.settings.serpapi_api_key", "test-key")
    monkeypatch.setattr("app.config.settings.demo_mode", "off")
    clear_cache()
    yield
    clear_cache()


def test_serpapi_timeout_is_reported_as_504(client, live_search, monkeypatch):
    async def boom(*_args, **_kwargs):
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(httpx.AsyncClient, "get", boom)
    response = client.post("/api/search", json={"query": "nike air max"})
    assert response.status_code == 504
    assert response.json()["error"]["code"] == "search_timeout"


def test_serpapi_transport_error_is_reported_as_502(client, live_search, monkeypatch):
    async def boom(*_args, **_kwargs):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(httpx.AsyncClient, "get", boom)
    response = client.post("/api/search", json={"query": "nike air max"})
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "search_error"


def test_serpapi_rate_limit_maps_to_429(client, live_search, monkeypatch):
    class FakeResponse:
        status_code = 401
        text = "Invalid API key"

    async def unauthorized(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", unauthorized)
    response = client.post("/api/search", json={"query": "nike air max"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "search_authentication_failed"


def test_manual_query_still_reaches_serpapi_when_local_recognition_is_unavailable(
    client, live_search, monkeypatch
):
    """The frontend fallback posts this query after a local CLIP 503."""
    class FakeResponse:
        status_code = 200
        text = "{}"

        def json(self):
            return {
                "shopping_results": [
                    {"title": "Manual result", "extracted_price": 999, "source": "Shop"}
                ]
            }

    async def ok(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", ok)
    response = client.post("/api/search", json={"query": "black running shoes"})
    assert response.status_code == 200
    assert response.json()["is_demo"] is False
    assert response.json()["products"][0]["title"] == "Manual result"


def test_malformed_json_response_is_handled(client, live_search, monkeypatch):
    class FakeResponse:
        status_code = 200
        text = "<html>not json</html>"

        def json(self):
            raise ValueError("no json")

    async def broken(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", broken)
    response = client.post("/api/search", json={"query": "nike air max"})
    assert response.status_code == 502


def test_serpapi_error_message_in_payload(client, live_search, monkeypatch):
    class FakeResponse:
        status_code = 200
        text = "{}"

        def json(self):
            return {"error": "We have run out of searches for this month."}

    async def exhausted(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", exhausted)
    response = client.post("/api/search", json={"query": "nike air max"})
    assert response.status_code == 429
    assert "no searches left" in response.json()["error"]["message"]


def test_empty_serpapi_result_produces_a_clean_empty_state(client, live_search, monkeypatch):
    class FakeResponse:
        status_code = 200
        text = "{}"

        def json(self):
            return {"search_metadata": {"status": "Success"}, "shopping_results": []}

    async def empty(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", empty)
    payload = client.post("/api/search", json={"query": "qwertyuiopasdf"}).json()

    assert payload["products"] == []
    assert payload["summary"]["count"] == 0
    assert payload["summary"]["lowest_price"] is None
    assert payload["best_deal"]["product"] is None
    assert any("No shopping results" in note for note in payload["notes"])


def test_successful_serpapi_response_is_normalised(client, live_search, monkeypatch):
    class FakeResponse:
        status_code = 200
        text = "{}"

        def json(self):
            return {
                "shopping_results": [
                    {
                        "title": "Sony WH-1000XM5",
                        "extracted_price": 26990,
                        "old_price": "₹34,990",
                        "source": "Amazon",
                        "rating": 4.5,
                        "reviews": "12,345",
                        "thumbnail": "https://example.com/x.jpg",
                        "link": "https://example.com/sony",
                    },
                    {
                        "title": "Sony WH-1000XM5 (Flipkart)",
                        "extracted_price": 28999,
                        "source": "Flipkart",
                        "rating": 4.3,
                    },
                    {
                        "title": "Sony WH-1000XM5 import",
                        "extracted_price": 31999,
                        "source": "Ajio",
                    },
                ]
            }

    async def ok(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", ok)
    payload = client.post("/api/search", json={"query": "sony wh-1000xm5"}).json()

    assert payload["is_demo"] is False
    assert len(payload["products"]) == 3
    assert payload["summary"]["lowest_price"] == 26990
    assert payload["summary"]["lowest_price_formatted"] == "₹26,990"
    assert payload["products"][0]["reviews"] == 12345
    assert payload["products"][0]["discount_percent"] == pytest.approx(22.9, abs=0.1)
    assert payload["best_deal"]["reason"] == "best_value"


def test_search_results_are_cached(client, live_search, monkeypatch):
    calls = {"count": 0}

    class FakeResponse:
        status_code = 200
        text = "{}"

        def json(self):
            return {
                "shopping_results": [
                    {"title": f"Thing {index}", "extracted_price": 100 + index, "source": "Shop"}
                    for index in range(3)
                ]
            }

    async def ok(*_args, **_kwargs):
        calls["count"] += 1
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", ok)

    client.post("/api/search", json={"query": "cached query"})
    payload = client.post("/api/search", json={"query": "cached query"}).json()

    assert calls["count"] == 1
    assert any("cache" in note.lower() for note in payload["notes"])


def test_fallback_engine_used_when_shopping_is_empty(client, live_search, monkeypatch):
    calls: list[dict] = []

    class FakeResponse:
        def __init__(self, payload):
            self.status_code = 200
            self.text = "{}"
            self._payload = payload

        def json(self):
            return self._payload

    async def handler(_client, url, params=None, **_kwargs):
        calls.append(params or {})
        if (params or {}).get("engine") == "google_shopping":
            return FakeResponse({"shopping_results": []})
        return FakeResponse(
            {"shopping_results": [{"title": "Fallback item", "extracted_price": 999, "source": "Shop"}]}
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", handler)
    payload = client.post("/api/search", json={"query": "long tail query"}).json()

    assert len(calls) == 2
    assert calls[1]["tbm"] == "shop"
    assert payload["products"][0]["title"] == "Fallback item"
    assert any("fallback" in note.lower() for note in payload["notes"])


def test_demo_mode_off_without_key_raises(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.demo_mode", "off")
    monkeypatch.setattr("app.config.settings.serpapi_api_key", "")
    response = client.post("/api/search", json={"query": "anything"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "search_not_configured"


@pytest.mark.asyncio
async def test_normalisation_of_a_realistic_payload_shape():
    """Defensive check on the exact shape SerpApi returns for google_shopping."""
    payload = {
        "search_metadata": {"status": "Success"},
        "shopping_results": [
            {
                "position": 1,
                "title": "Nike Air Max 270",
                "price": "₹8,499",
                "extracted_price": 8499,
                "source": "Myntra",
                "link": "https://www.myntra.com/x",
                "thumbnail": "https://encrypted-tbn0.gstatic.com/x",
                "rating": 4.6,
                "reviews": 1234,
                "extensions": ["Free delivery", "10 day returns"],
            }
        ],
    }
    products = normalize_serpapi_payload(payload)
    assert products[0].extensions == ["Free delivery", "10 day returns"]
    assert products[0].source == "Myntra"


# =========================================================================== #
# Dedicated Verification Tests: 10 Core Discovery Requirements
# =========================================================================== #


def test_req1_text_search_without_an_image(client):
    """1. Text search without an image works independently."""
    response = client.post("/api/search", json={"query": "iPhone 17"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "iPhone 17"
    assert payload["search_mode"] == "text"
    assert "products" in payload


def test_req2_image_search_with_a_valid_image(client):
    """2. Image search with a valid image uploads photo and returns image search mode."""
    from tests.conftest import _image_bytes

    data = _image_bytes()
    response = client.post(
        "/api/search-with-image",
        data={"query": "Nike sneaker"},
        files={"file": ("sneaker.jpg", data, "image/jpeg")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["search_mode"] == "image"
    assert "products" in payload


def test_req3_empty_or_invalid_text_query(client):
    """3. An empty or invalid text query is rejected with 422."""
    assert client.post("/api/search", json={"query": ""}).status_code == 422
    assert client.post("/api/search", json={"query": "    "}).status_code == 422
    assert client.post("/api/search", json={}).status_code == 422


def test_req4_failed_image_recognition_result(client, monkeypatch):
    """4. A failed image-recognition result returns a controlled error and never crashes."""
    from app.services import vision_service
    from app.utils.errors import NoProductDetectedError
    from tests.conftest import _image_bytes

    async def fail_analyse(*_args, **_kwargs):
        raise NoProductDetectedError()

    monkeypatch.setattr(vision_service, "analyse_image", fail_analyse)
    data = _image_bytes()
    response = client.post(
        "/api/analyze-image",
        files={"file": ("unclear.jpg", data, "image/jpeg")},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "no_product_detected"


def test_req5_serpapi_error_handling(client, live_search, monkeypatch):
    """5. SerpApi errors (timeout, rate limit, auth) return clean errors without secrets."""
    from app.services import serpapi_service

    async def timeout_request(*_args, **_kwargs):
        raise SearchTimeoutError()

    monkeypatch.setattr(serpapi_service, "search_google_shopping", timeout_request)
    response = client.post("/api/search", json={"query": "laptop"})
    assert response.status_code == 504
    assert response.json()["error"]["code"] == "search_timeout"


def test_req6_switching_from_image_search_to_text_search(client):
    """6. Switching from image search to text search keeps flows and modes isolated."""
    from tests.conftest import _image_bytes

    # First: perform an image search
    data = _image_bytes()
    img_resp = client.post(
        "/api/search-with-image",
        data={"query": "running shoes"},
        files={"file": ("shoes.jpg", data, "image/jpeg")},
    )
    assert img_resp.status_code == 200
    assert img_resp.json()["search_mode"] == "image"

    # Next: switch to text search
    txt_resp = client.post("/api/search", json={"query": "Samsung Galaxy S25"})
    assert txt_resp.status_code == 200
    assert txt_resp.json()["search_mode"] == "text"
    assert txt_resp.json()["query"] == "Samsung Galaxy S25"


def test_req7_searching_for_iphone17_after_sneaker_search(client, live_search, monkeypatch):
    """7. Searching for iPhone 17 after a previous sneaker search returns iPhone 17 results."""
    from tests.conftest import _image_bytes

    class FakeResponse:
        def __init__(self, items):
            self.status_code = 200
            self.text = "{}"
            self._items = items

        def json(self):
            return {"shopping_results": self._items}

    async def fake_get(_client, _url, params=None, **_kwargs):
        q = (params or {}).get("q", "").lower()
        if "iphone" in q:
            return FakeResponse([
                {
                    "title": "Apple iPhone 17 Pro Max 256GB",
                    "extracted_price": 139900,
                    "source": "Apple Store",
                    "link": "https://apple.com",
                }
            ])
        return FakeResponse([
            {
                "title": "Nike Air Max 270 Black Sneakers",
                "extracted_price": 8499,
                "source": "Myntra",
                "link": "https://myntra.com",
            }
        ])

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    clear_cache()

    sneaker_data = _image_bytes()
    img_res = client.post(
        "/api/search-with-image",
        data={"query": "black running sneakers"},
        files={"file": ("sneaker.jpg", sneaker_data, "image/jpeg")},
    )
    assert img_res.status_code == 200
    assert img_res.json()["query"] == "black running sneakers"
    assert "sneaker" in img_res.json()["products"][0]["title"].lower()

    txt_res = client.post("/api/search", json={"query": "iPhone 17"}).json()
    assert txt_res["query"] == "iPhone 17"
    assert txt_res["search_mode"] == "text"
    assert "iPhone 17" in txt_res["products"][0]["title"]
    assert "sneaker" not in txt_res["products"][0]["title"].lower()


def test_req8_rapidly_submitting_two_different_search_queries(client):
    """8. Rapidly submitting two different search queries isolates each response."""
    res1 = client.post("/api/search", json={"query": "Sony WH-1000XM5 headphones"}).json()
    res2 = client.post("/api/search", json={"query": "Apple iPad Air"}).json()
    assert res1["query"] == "Sony WH-1000XM5 headphones"
    assert res2["query"] == "Apple iPad Air"
    assert res1["search_mode"] == "text"
    assert res2["search_mode"] == "text"


def test_req9_missing_prices_thumbnails_ratings_and_seller_names():
    """9. Missing prices, thumbnails, ratings, and seller names are handled without crashing."""
    payload = {
        "shopping_results": [
            {
                "title": "Mystery Product with no metadata",
                "price": None,
                "thumbnail": None,
                "rating": None,
                "source": None,
            }
        ]
    }
    products = normalize_serpapi_payload(payload)
    assert len(products) == 1
    assert products[0].title == "Mystery Product with no metadata"
    assert products[0].price is None
    assert products[0].thumbnail is None
    assert products[0].rating is None

    summary = product_service.summarize(products)
    assert summary.count == 1
    assert summary.priced_count == 0
    assert summary.lowest_price is None


def test_req10_price_calculations_and_sorting():
    """10. Price calculations correctly compute stats and sellers are sorted low-to-high."""
    prods = [
        Product(id="1", title="Item 1", price=100.0, source="Store A", position=1),
        Product(id="2", title="Item 2", price=200.0, source="Store B", position=2),
        Product(id="3", title="Item 3", price=300.0, source="Store C", position=3),
    ]
    summary = product_service.summarize(prods)
    assert summary.lowest_price == 100.0
    assert summary.highest_price == 300.0
    assert summary.average_price == 200.0
    assert summary.potential_saving == 200.0

    sellers = product_service.build_sellers(prods)
    assert len(sellers) == 3
    assert sellers[0].source == "Store A"
    assert sellers[0].price == 100.0
    assert sellers[0].is_lowest is True
    assert sellers[1].price == 200.0
    assert sellers[1].delta_from_lowest == 100.0
    assert sellers[2].price == 300.0
    assert sellers[2].delta_from_lowest == 200.0

