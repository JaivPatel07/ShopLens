# SnapBuy

**Snap it. Compare it. Buy smarter.**

Upload a photo of a product. AI identifies it, SnapBuy searches Google Shopping through
**SerpApi**, and you get a price comparison across sellers with a transparent best-value pick.

Built for the **SerpApi India Hackathon**.

---

## Problem

People constantly see products they want to buy — in a photo, a shop window, a video — but turning
that into a purchase means guessing the product name, then searching store after store to work out
who is cheapest. Comparing prices manually is slow, and it is easy to miss a better listing.

## Solution

```
Upload a photo  →  identify the product  →  search shopping results  →  compare prices  →  find the best deal
```

* **AI vision** identifies the product and writes a search query (brand, model, colour, category).
* **SerpApi** retrieves structured Google Shopping results for that query.
* **SnapBuy** normalises every result, calculates the price spread, groups offers per seller and
  scores the best value — and says so when the data is too thin to recommend anything.

## Features

* 📷 **Drag & drop image upload** — JPG/PNG/WEBP up to 10 MB, click, drop, paste or use the demo image.
* 🤖 **AI product identification** — product name, brand, category, description, visual attributes
  and a generated search query, with a low-confidence warning when recognition is uncertain.
* ✏️ **Editable search query** — recognition is never assumed to be perfect; fix the query before searching.
* 🛒 **Live shopping search via SerpApi** (`google_shopping`, India/INR by default) with an automatic
  `tbm=shop` fallback and a short-lived result cache.
* 🔀 **Normalised results** — title, price, original price, discount, seller, rating, review count,
  image and link, with every optional field tolerated when missing.
* 📊 **Price intelligence** — lowest / average / median / highest price, potential saving, seller
  spread and a per-merchant comparison chart built only from real returned data.
* 🏆 **Best-deal recommendation** — transparent scoring (`price 55% + rating 30% + reviews 15%`,
  re-weighted when a value is missing) with the reasoning shown in the UI.
* 🎛 **Sort & filter** — best match, lowest/highest price, highest rating, price range, minimum
  rating and seller filters (filters become a bottom-sheet drawer on mobile).
* 🔎 **Refine search** — add plain-language qualifiers and run another SerpApi search without
  re-uploading the photo.
* 🕘 **Recent searches** — stored in `localStorage` (query + tiny thumbnail only), one click to re-run.
* 🧪 **Clearly labelled demo mode** — if an API key is missing the app still demos end-to-end, with a
  visible "Demo Data" badge. Demo data is never blended into live results.
* ♿ **Accessible & responsive** — semantic HTML, keyboard-operable upload, alt text, visible focus
  rings, reduced-motion support and layouts for desktop, tablet and mobile.

## Architecture

```
React (Vite + TypeScript)
  ↓  relative /api/* requests (no keys in the browser)
FastAPI
  ↓
AI Vision            → product name, attributes, search query
  ↓
SerpApi              → google_shopping results (JSON)
  ↓
Product Normalization→ one product shape, missing fields tolerated
  ↓
Price Comparison     → summary, seller spread, value score
  ↓
React UI             → results dashboard, filters, best deal
```

## Tech Stack

| Layer     | Technology                                                       |
| --------- | ---------------------------------------------------------------- |
| Frontend  | React 19, Vite, TypeScript, Tailwind CSS v4, React Router, Lucide |
| Backend   | Python, FastAPI, Pydantic v2, httpx, python-dotenv, Pillow        |
| AI vision | Configurable provider: OpenAI or Google Gemini (model + fallbacks configurable) |
| Search    | **SerpApi** — `engine=google_shopping`                            |
| Tests     | Vitest + Testing Library (frontend), pytest (backend)             |

## Environment Variables

Copy the templates and fill in the keys you have:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env    # optional, defaults are fine
```

`backend/.env`:

```env
SERPAPI_API_KEY=your_serpapi_key_here     # https://serpapi.com/manage-api-key
VISION_PROVIDER=                          # openai | gemini | empty = auto-detect
VISION_API_KEY=your_vision_api_key_here
DEMO_MODE=auto                            # auto | on | off
```

* `DEMO_MODE=auto` (default): real APIs when keys exist, clearly-labelled demo data otherwise.
* `DEMO_MODE=on`: always demo data — the hackathon safety net for a live presentation.
* `DEMO_MODE=off`: never demo data; a missing key becomes a real error.

**Keys live only on the backend.** The frontend talks to relative `/api/*` paths, and the Vite dev
server proxies those to FastAPI, so no secret ever reaches the browser bundle.

## Installation

### Backend

```bash
cd backend
python -m venv ../.venv && source ../.venv/Scripts/activate   # optional
pip install -r requirements.txt
cp .env.example .env        # add your keys
uvicorn app.main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs> · health: <http://localhost:8000/api/health>

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: <http://localhost:5173> (the dev server proxies `/api` to `http://127.0.0.1:8000`).

> Run the backend first — otherwise the UI shows a friendly "we could not reach the SnapBuy server"
> message instead of results.

Production build:

```bash
cd frontend && npm run build      # outputs frontend/dist
```

Serve `frontend/dist` behind any static host and reverse-proxy `/api` to the FastAPI service.

## API

| Method | Endpoint             | Description                                                        |
| ------ | -------------------- | ------------------------------------------------------------------ |
| GET    | `/api/health`        | Service status + which providers are configured (never returns keys) |
| GET    | `/api/config`        | Non-secret runtime config used to label demo data in the UI         |
| POST   | `/api/analyze-image` | Multipart image upload → identified product + generated search query |
| POST   | `/api/search`        | `{"query": "..."}` → normalised products, price summary, best deal  |
| GET    | `/api/search?q=...`  | Same search via query string                                        |

`POST /api/analyze-image` response:

```json
{
  "product_name": "Nike Air Max 270",
  "brand": "Nike",
  "category": "Running shoes",
  "description": "Black athletic sneaker with a white midsole.",
  "search_query": "Nike Air Max 270 black men's shoes",
  "attributes": ["black", "athletic", "Nike", "Air Max"],
  "confidence": 0.72,
  "detected": true,
  "provider": "gemini",
  "is_demo": false
}
```

`POST /api/search` response (abridged):

```json
{
  "query": "Nike Air Max 270 black men's shoes",
  "engine": "google_shopping",
  "products": [
    {
      "title": "Nike Air Max 270",
      "price": 8499,
      "price_formatted": "₹8,499",
      "original_price": 9999,
      "discount_percent": 15.0,
      "source": "Myntra",
      "rating": 4.6,
      "reviews": 1234,
      "thumbnail": "https://...",
      "link": "https://...",
      "position": 1,
      "value_score": 82.1
    }
  ],
  "summary": {
    "count": 8,
    "priced_count": 8,
    "lowest_price": 8499,
    "average_price": 9161.75,
    "highest_price": 9999,
    "potential_saving": 1500
  },
  "sellers": [{ "source": "Myntra", "price": 8499, "is_lowest": true }],
  "best_deal": { "reason": "best_value", "confidence": "high" },
  "is_demo": false,
  "notes": []
}
```

Errors always use the same shape and never leak stack traces:

```json
{ "error": { "code": "invalid_image", "message": "That file doesn't look like a supported image." } }
```

## Tests

```bash
# Backend (59 tests)
cd backend && pytest

# Frontend (37 tests)
cd frontend && npm test
```

Coverage includes: valid/invalid/oversized uploads, recognition failure, empty and malformed SerpApi
payloads, timeouts, rate limits, fallback engine, caching, summary maths, recommendation edge cases
(insufficient data, missing ratings, equal prices), filtering/sorting, localStorage history and
rendering with missing optional fields.

## Hackathon: how SerpApi is used

SerpApi is the data source for **every** shopping result in SnapBuy — remove it and the product has
nothing to compare.

1. The AI produces a search query such as `Nike Air Max 270 black men's shoes`.
2. `app/services/serpapi_service.py` calls
   `https://serpapi.com/search.json?engine=google_shopping&q=<query>&gl=in&hl=en&location=India`.
3. The payload is normalised (`app/utils/normalization.py`) into SnapBuy's own product model — the
   frontend never receives raw SerpApi JSON.
4. SnapBuy computes the price summary, the per-seller spread, a transparent value score and the
   best-deal recommendation.

Why it matters: building this data layer by hand would mean maintaining headless browsers, proxies,
HTML parsers and CAPTCHA handling. SerpApi reduces that to one HTTP call, which is what makes a
one-week hackathon project like this possible. SerpApi does **not** do the image recognition — the
AI vision provider does.

## Limitations

* Prices are a snapshot of live search results; they can change on the seller's site.
* Merchant links land on the seller's page — SnapBuy does not host checkout or track stock.
* Product identification may return a product *type* rather than an exact model for generic items;
  the editable query exists for exactly that reason.
* Demo mode returns a fixed sample dataset (clearly labelled) when no API keys are configured.
* Vision model IDs are pinned via `VISION_MODEL`; the provider walks a small fallback chain when a
  model has been retired upstream.
* Nothing is persisted server-side: uploaded images are processed in memory only.

## Documentation

* [`backend/README.md`](backend/README.md) — backend architecture, services and configuration details.

## License

Built for the SerpApi India Hackathon. Not affiliated with SerpApi, Google, or any listed merchant.
