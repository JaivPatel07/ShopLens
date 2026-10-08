"""Demo fixtures.

These are used **only** when a provider is not configured (or when
``DEMO_MODE=on``) so the app stays presentable during a live hackathon demo.
Anything produced from this module is flagged with ``is_demo=True`` and shown in
the UI behind a clear "Demo Data" badge - demo values are never mixed silently
with real API results.
"""

from __future__ import annotations

from typing import Any

DEMO_VISION_RESULT: dict[str, Any] = {
    "product_name": "Nike Air Max 270",
    "brand": "Nike",
    "category": "Running shoes",
    "description": (
        "Black and white athletic sneaker with a large visible Air unit in the heel, "
        "white foam midsole and a black mesh upper."
    ),
    "search_query": "Nike Air Max 270 black men's running shoes",
    "attributes": ["black", "white midsole", "athletic", "Air Max", "Nike", "sneaker"],
    "confidence": 0.72,
}

#: Google Shopping shaped payload - the same shape SerpApi returns, so it flows
#: through the exact same normalisation code path as live data.
DEMO_SERPAPI_PAYLOAD: dict[str, Any] = {
    "search_metadata": {"status": "Success (demo fixture)"},
    "search_parameters": {"engine": "google_shopping", "q": DEMO_VISION_RESULT["search_query"]},
    "shopping_results": [
        {
            "position": 1,
            "title": "Nike Air Max 270 Black Anthracite (Men's)",
            "price": "₹8,499",
            "extracted_price": 8499,
            "old_price": "₹9,999",
            "extracted_old_price": 9999,
            "source": "Myntra",
            "link": "https://www.google.com/search?tbm=shop&q=Nike+Air+Max+270+Myntra",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemo1",
            "rating": 4.6,
            "reviews": 1234,
            "delivery": "Free delivery",
        },
        {
            "position": 2,
            "title": "Nike Air Max 270 Running Shoes - Black/White",
            "price": "₹8,999",
            "extracted_price": 8999,
            "source": "Amazon.in",
            "link": "https://www.google.com/search?tbm=shop&q=Nike+Air+Max+270+Amazon",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemo2",
            "rating": 4.4,
            "reviews": 8642,
            "delivery": "FREE delivery Tue, 14 Oct",
        },
        {
            "position": 3,
            "title": "Nike Air Max 270 Sneakers For Men",
            "price": "₹9,299",
            "extracted_price": 9299,
            "source": "Flipkart",
            "link": "https://www.google.com/search?tbm=shop&q=Nike+Air+Max+270+Flipkart",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemo3",
            "rating": 4.2,
            "reviews": 540,
        },
        {
            "position": 4,
            "title": "Nike Air Max 270 (GS) Black",
            "price": "₹8,799",
            "extracted_price": 8799,
            "old_price": "₹9,499",
            "extracted_old_price": 9499,
            "source": "Ajio",
            "link": "https://www.google.com/search?tbm=shop&q=Nike+Air+Max+270+Ajio",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemo4",
            "rating": 4.5,
            "reviews": 218,
        },
        {
            "position": 5,
            "title": "Nike Air Max 270 Essential - Men's Lifestyle Shoe",
            "price": "₹9,999",
            "extracted_price": 9999,
            "source": "Nike India",
            "link": "https://www.google.com/search?tbm=shop&q=Nike+Air+Max+270+Nike+India",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemo5",
            "rating": 4.7,
            "reviews": 96,
        },
        {
            "position": 6,
            "title": "Nike Air Max 270 Black Running Shoes (Unisex)",
            "price": "₹8,650",
            "extracted_price": 8650,
            "source": "Tata CLiQ",
            "link": "https://www.google.com/search?tbm=shop&q=Nike+Air+Max+270+Tata+CliQ",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemo6",
            "rating": 4.1,
            "reviews": 73,
        },
        {
            "position": 7,
            "title": "Nike Air Max 270 Trainers Black White",
            "price": "₹9,150",
            "extracted_price": 9150,
            "source": "VegNonVeg",
            "link": "https://www.google.com/search?tbm=shop&q=Nike+Air+Max+270+VegNonVeg",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemo7",
        },
        {
            "position": 8,
            "title": "Nike Air Max 270 Fresh Breeze Pack",
            "price": "₹9,899",
            "extracted_price": 9899,
            "source": "Superkicks",
            "link": "https://www.google.com/search?tbm=shop&q=Nike+Air+Max+270+Superkicks",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemo8",
            "rating": 4.3,
            "reviews": 41,
        },
    ],
    "demo": True,
}

#: Google Lens shaped payload - visual matches as returned by engine=google_lens.
DEMO_LENS_PAYLOAD: dict[str, Any] = {
    "search_metadata": {"status": "Success (demo fixture)"},
    "search_parameters": {"engine": "google_lens", "type": "products"},
    "visual_matches": [
        {
            "position": 1,
            "title": "Nike Air Max 270 Black Anthracite Sneakers",
            "link": "https://www.myntra.com/shoes/nike-air-max-270-demo-1",
            "source": "Myntra",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens1",
            "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens1",
            "price": {"value": "₹8,499", "extracted_value": 8499, "currency": "INR"},
            "rating": 4.6,
            "reviews": 1234,
            "in_stock": True,
        },
        {
            "position": 2,
            "title": "Nike Air Max 270 Running Shoes - Black/White",
            "link": "https://www.amazon.in/nike-air-max-270-demo-2",
            "source": "Amazon.in",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens2",
            "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens2",
            "price": {"value": "₹8,999", "extracted_value": 8999, "currency": "INR"},
            "rating": 4.4,
            "reviews": 8642,
            "in_stock": True,
        },
        {
            "position": 3,
            "title": "Nike Air Max 270 SE Black Volt (Similar Style)",
            "link": "https://www.flipkart.com/nike-air-max-270-se-demo-3",
            "source": "Flipkart",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens3",
            "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens3",
            "price": {"value": "₹7,999", "extracted_value": 7999, "currency": "INR"},
            "in_stock": True,
        },
        {
            "position": 4,
            "title": "Nike Air Max 270 White Black Trainers",
            "link": "https://www.ajio.com/nike-air-max-270-demo-4",
            "source": "AJIO",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens4",
            "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens4",
            "price": {"value": "₹9,495", "extracted_value": 9495, "currency": "INR"},
            "rating": 4.2,
            "reviews": 210,
            "in_stock": False,
        },
        {
            "position": 5,
            "title": "Nike Air Max 270 React Black Sneakers",
            "link": "https://www.tatacliq.com/nike-air-max-270-react-demo-5",
            "source": "Tata CLiQ",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens5",
            "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens5",
            "price": {"value": "₹10,295", "extracted_value": 10295, "currency": "INR"},
            "rating": 4.5,
            "reviews": 88,
            "in_stock": True,
        },
        {
            "position": 6,
            "title": "Nike Air Max 270 SI Black (Visual Match)",
            "link": "https://www.superkicks.in/nike-air-max-270-si-demo-6",
            "source": "Superkicks",
            "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens6",
            "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNapBuyDemoLens6",
            "price": {"value": "₹11,495", "extracted_value": 11495, "currency": "INR"},
            "in_stock": True,
        },
    ],
    "demo": True,
}
