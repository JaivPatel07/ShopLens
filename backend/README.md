# SnapBuy Backend

FastAPI service that powers SnapBuy: image upload, AI product recognition, SerpApi shopping search,
result normalisation, price comparison and recommendation.

No API key ever leaves this process — the frontend only learns *whether* a provider is configured.

## Run

```powershell
# Run from the repository root.
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
Set-Location backend
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
| POST   | `/api/visual-similar`| Multipart image to SerpApi Image API and Google Lens                |
| GET    | `/api/visual-similar`| Public image URL to Google Lens matches                              |

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
| `local_vision_unavailable` | 503 | Local CLIP is absent/unavailable; use a manual query |
| `search_authentication_failed` | 503 | SerpApi key was rejected; update server configuration |
| `search_timeout`         | 504  | SerpApi exceeded `SERPAPI_TIMEOUT_SECONDS`  |
| `*_not_configured`       | 503  | `DEMO_MODE=off` and the key is missing      |

## Vision providers

Selected via `VISION_PROVIDER`; local CLIP is the default.

| Provider | Default model chain                              | Notes                                        |
| -------- | ------------------------------------------------ | -------------------------------------------- |
| `local`  | `openai/clip-vit-base-patch32` | Estimates a broad category locally; never claims an exact SKU or brand. |
| `openai` | `gpt-4o-mini` | Chat completions with an inline image; JSON mode with a plain retry |
| `gemini` | `gemini-3.8-flash` → `gemini-2.5-flash` → `gemini-flash-latest` | `generateContent` with an inline data part   |
| `demo`   | —                                                | Fixture result, flagged `is_demo: true`       |

Model IDs are retired frequently (GPT-4o and Gemini 2.0 Flash were both shut down in 2026), so the
providers auto-detect *model* rejections and retry the next candidate in the chain. Set
`VISION_MODEL` to pin an exact model — reported first in the chain.

Add a provider by implementing `VisionProvider.analyse()` in `app/services/vision_service.py` and
registering it in `get_vision_provider()`. Every provider returns the same `VisionAttributes`
structure, so nothing else in the app changes.

### Local CLIP cache and offline operation

At startup the backend logs the selected local source but does not download model files. On the first image analysis it tries the configured local directory or Hugging Face cache first. On a cache miss it makes at most `LOCAL_VISION_LOAD_ATTEMPTS` (1-3, default 2) download attempts, then returns `local_vision_unavailable` for `LOCAL_VISION_RETRY_SECONDS` (default 60) instead of retrying every upload.

To cache the model on Windows, run this from the repository root while internet access is available:

```powershell
New-Item -ItemType Directory -Force backend\models\clip-vit-base-patch32 | Out-Null
python -c "from transformers import CLIPModel, CLIPProcessor; source='openai/clip-vit-base-patch32'; target='backend/models/clip-vit-base-patch32'; CLIPProcessor.from_pretrained(source).save_pretrained(target); CLIPModel.from_pretrained(source).save_pretrained(target)"
```

Start the backend from `backend/` with `LOCAL_VISION_MODEL_DIR=./models/clip-vit-base-patch32` in `.env`. The directory must contain the files from the command; SnapBuy does not claim offline availability if it is missing or incomplete. When local recognition is unavailable, the frontend preserves the uploaded image and provides a manual text query that still searches live SerpApi Google Shopping results.

## SerpApi usage

`app/services/serpapi_service.py`

* `engine=google_shopping`, `gl=in`, `hl=en`, `location=India`, `num` capped at 60 results
  (Google Shopping's current layout returns a fixed first page of ~40 items; the list is trimmed
  after normalisation).
* Automatic fallback to `engine=google&tbm=shop` when the shopping engine returns nothing.
* In-memory TTL cache (`SEARCH_CACHE_TTL_SECONDS`, default 15 min) so repeat searches don't spend
  credits; `POST /api/search` with `"force_refresh": true` bypasses both that cache and SerpApi's own
  1-hour cache via `no_cache=true`.
* A missing key maps to `503 search_not_configured`; a rejected key maps to `503 search_authentication_failed`; quota/rate limits map to 429; timeouts map to 504; and genuine upstream failures map to 502.
* Local-image Lens matching uploads to SerpApi's Image API and then uses its short-lived `image_id` with `engine=google_lens`; it does not depend on CLIP.
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
pytest            # 84 tests, no network access required
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
| `VISION_PROVIDER`         | `local`          | `local` / `openai` / `gemini` / `demo`           |
| `LOCAL_VISION_MODEL`      | `openai/clip-vit-base-patch32` | Hugging Face model ID or local path       |
| `LOCAL_VISION_MODEL_DIR`  | empty            | Existing local model directory; disables downloads |
| `LOCAL_VISION_LOAD_ATTEMPTS` | `2`            | Bounded cache-miss download attempts (1-3)        |
| `LOCAL_VISION_RETRY_SECONDS` | `60`          | Cooldown after failed local-model initialization   |
| `VISION_API_KEY`          | —                | Required only for OpenAI or Gemini                |
| `DEMO_MODE`               | `auto`           | `auto` / `on` / `off` demo data behaviour         |
| `MAX_UPLOAD_MB`           | `10`             | Upload size limit                                |
| `MAX_IMAGE_DIMENSION`     | `1280`           | Downscale target for vision calls                |
| `FRONTEND_URL`            | `http://localhost:5173` | Primary CORS origin                       |
