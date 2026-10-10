# ShopLens Backend

FastAPI service that powers ShopLens: image upload, AI product recognition, SerpApi shopping search,
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
│   ├── lens.py              GET|POST /api/visual-similar (Google Lens)
│   └── search.py            GET|POST /api/search · POST /api/search-with-image
├── services/
│   ├── vision_service.py    provider abstraction (local / OpenAI / Gemini / demo)
│   ├── owlvit_service.py    OWL-ViT zero-shot object detection
│   ├── visual_rerank_service.py CLIP cosine similarity reranker
│   ├── lens_service.py      SerpApi Google Lens client (image upload & visual matches)
│   ├── serpapi_service.py   SerpApi Google Shopping client: cache & fallback
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
| POST   | `/api/visual-similar`| Multipart image to SerpApi Image API and Google Lens                |
| GET    | `/api/visual-similar`| Public image URL to Google Lens matches                              |
| POST   | `/api/search`        | `{"query": "..."}` → `SearchResponse`                               |
| GET    | `/api/search?q=...`  | Same search, query-string form                                      |
| POST   | `/api/search-with-image`| Multipart `file` + optional `query` → Lens matches + Shopping      |

All errors return `{"error": {"code": "...", "message": "..."}}` with a user-friendly message; the
frontend surfaces the message directly without needing to translate HTTP status codes.

## Test

```powershell
pytest backend/tests
```
