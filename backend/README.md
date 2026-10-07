# SnapBuy Backend

FastAPI service that powers SnapBuy: image upload, AI product recognition, SerpApi shopping search,
result normalisation, price comparison and recommendation.

No API key ever leaves this process — the frontend only learns *whether* a provider is configured.

## Run

```bash
cd backend
python -m venv ../.venv && source ../.venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                     # add SERPAPI_API_KEY (and a vision key if you have one)
uvicorn app.main:app --reload --port 8000
```

* Swagger UI: <http://localhost:8000/docs>
* Health: <http://localhost:8000/api/health>

## Layout

```
app/
├── main.py                  FastAPI app, CORS, logging, error handlers
├── config.py                env-driven settings (SerpApi, vision provider, demo mode, limits)
├── routes/
│   ├── health.py            GET  /api/health · GET /api/config
│   ├── image.py             POST /api/analyze-image
│   └── search.py            GET|POST /api/search
├── services/
│   ├── vision_service.py    provider abstraction (OpenAI / Gemini / demo) + prompt + parsing
│   ├── serpapi_service.py   SerpApi client: cache, fallback engine, error translation
│   └── product_service.py   price summary, seller grouping, value scoring, best deal
├── models/
│   ├── product.py           Product, PriceSummary, SellerOffer, Recommendation, SearchResponse
│   └── search.py            request/response models (vision attributes, search request, config)
├── utils/
│   ├── normalization.py     price parsing + SerpApi payload → Product mapping
│   ├── images.py            upload validation, auto-orient, resize, re-encode
│   ├── scoring.py           transparent value_score calculation
│   └── errors.py            user-safe exceptions (friendly message + HTTP status)
└── data/demo_data.py        clearly-labelled demo fixtures (SerpApi-shaped)
```

## Endpoints

| Method | Path                 | Notes                                                              |
| ------ | -------------------- | ------------------------------------------------------------------ |
| GET    | `/api/health`        | `{status, version, demo_mode, serpapi_configured, vision_provider…}` |
| GET    | `/api/config`        | Non-secret runtime config for the UI (currency, market, limits)      |
| POST   | `/api/analyze-image` | multipart `file=@photo.jpg` → `VisionAttributes`                    |
| POST   | `/api/search`        | `{"query": "..."}` → `SearchResponse`                               |
| GET    | `/api/search?q=...`  | Same search, query-string form                                      |

All errors return `{"error": {"code": "...", "message": "..."}}` with a user-friendly message; the
technical detail is only written to the server log.

| Code                     | HTTP | Meaning                                     |
| ------------------------ | ---- | ------------------------------------------- |
| `invalid_image`          | 400  | Not a usable image file                     |
| `image_too_large`        | 413  | Above `MAX_UPLOAD_MB`                       |
| `no_product_detected`    | 422  | Vision provider could not find a product    |
| `invalid_request`        | 422  | Missing/blank query or file                 |
| `rate_limited`           | 429  | SerpApi quota / plan limits                 |
| `search_error`           | 502  | SerpApi transport or malformed response     |
| `vision_error`           | 502  | Vision provider failure                     |
| `search_timeout`         | 504  | SerpApi exceeded `SERPAPI_TIMEOUT_SECONDS`  |
| `*_not_configured`       | 503  | `DEMO_MODE=off` and the key is missing      |

## Vision providers

Selected via `VISION_PROVIDER` + `VISION_API_KEY` (auto-detected when the provider is left empty):

| Provider | Default model chain                              | Notes                                        |
| -------- | ------------------------------------------------ | -------------------------------------------- |
| `openai` | `gpt-5.2-mini` → `gpt-5.2-chat-latest` → `gpt-4o-mini` | Chat completions with an inline image; JSON mode with a plain retry |
| `gemini` | `gemini-3.8-flash` → `gemini-2.5-flash` → `gemini-flash-latest` | `generateContent` with an inline data part   |
| `demo`   | —                                                | Fixture result, flagged `is_demo: true`       |

Model IDs are retired frequently (GPT-4o and Gemini 2.0 Flash were both shut down in 2026), so the
providers auto-detect *model* rejections and retry the next candidate in the chain. Set
`VISION_MODEL` to pin an exact model — reported first in the chain.

Add a provider by implementing `VisionProvider.analyse()` in `app/services/vision_service.py` and
registering it in `get_vision_provider()`. Every provider returns the same `VisionAttributes`
structure, so nothing else in the app changes.

## SerpApi usage

`app/services/serpapi_service.py`

* `engine=google_shopping`, `gl=in`, `hl=en`, `location=India`, `num` capped at 60 results
  (Google Shopping's current layout returns a fixed first page of ~40 items; the list is trimmed
  after normalisation).
* Automatic fallback to `engine=google&tbm=shop` when the shopping engine returns nothing.
* In-memory TTL cache (`SEARCH_CACHE_TTL_SECONDS`, default 15 min) so repeat searches don't spend
  credits; `POST /api/search` with `"force_refresh": true` bypasses both that cache and SerpApi's own
  1-hour cache via `no_cache=true`.
* Timeouts, transport errors, HTTP 401/429, `{"error": ...}` payloads and malformed JSON are all
  translated into the friendly errors above.
* Optional startup connectivity probe (`warmup()`), which never blocks startup.

## Normalisation rules

* Prices: `₹1,49,990.00`, `Rs. 1,299`, `$1,299.99`, `8499,50` all parse; currency is detected from
  the symbol when present and formatted back with Indian digit grouping for INR.
* `old_price` is only kept when it is genuinely higher than the current price (otherwise the
  "discount" would be wrong).
* Ratings outside 0–5 and negative review counts are dropped rather than displayed.
* Results without a title are skipped; duplicates (title + seller + price) are removed.
* A missing merchant link falls back to a real Google Shopping search URL so "View Deal" never breaks.

## Recommendation logic

```
value_score = price_score × 0.55 + rating_score × 0.30 + review_score × 0.15
```

Each component is min-max normalised across the current result set (price inverted). Missing signals
are dropped and the remaining weights re-normalised; if nothing usable remains, `value_score` is
`null`. Fewer than three priced results (or all prices equal) short-circuit to a simple
"lowest price" recommendation with `confidence: low` — the UI shows the same reasoning.

## Tests

```bash
cd backend
pytest            # 59 tests, no network access required
```

`tests/conftest.py` clears the API keys before importing the app, so the suite always exercises the
demo/offline paths plus mocked SerpApi responses (success, empty, malformed, timeout, rate limit,
fallback engine, caching).

## Configuration reference

See [`.env.example`](.env.example) for every variable. Highlights:

| Variable                  | Default          | Purpose                                          |
| ------------------------- | ---------------- | ------------------------------------------------ |
| `SERPAPI_API_KEY`         | —                | Enables live shopping results                    |
| `SERPAPI_GL` / `_HL`      | `in` / `en`      | Market and language for Google Shopping          |
| `SERPAPI_LOCATION`        | `India`          | Location passed to SerpApi                       |
| `SERPAPI_FALLBACK_ENGINE` | `true`           | Retry with `tbm=shop` when shopping is empty      |
| `SEARCH_CACHE_TTL_SECONDS`| `900`            | Search result cache lifetime                     |
| `VISION_PROVIDER`         | auto             | `openai` / `gemini` / `demo`                     |
| `VISION_API_KEY`          | —                | Enables real recognition                         |
| `DEMO_MODE`               | `auto`           | `auto` / `on` / `off` demo data behaviour         |
| `MAX_UPLOAD_MB`           | `10`             | Upload size limit                                |
| `MAX_IMAGE_DIMENSION`     | `1280`           | Downscale target for vision calls                |
| `FRONTEND_URL`            | `http://localhost:5173` | Primary CORS origin                       |
