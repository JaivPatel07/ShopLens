"""Application configuration.

All secrets are read from environment variables (optionally via a local ``.env``
file).  Nothing sensitive is ever sent to the browser: the frontend only learns
*whether* a provider is configured, never the key itself.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DATA_DIR = Path(__file__).resolve().parent / "data"

DemoMode = Literal["auto", "on", "off"]


class Settings(BaseSettings):
    """Runtime settings for the SnapBuy backend."""

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SnapBuy API"
    app_version: str = "1.0.0"
    debug: bool = False

    @field_validator("debug", mode="before")
    @classmethod
    def normalise_debug(cls, value: object) -> object:
        """Accept common deployment labels as well as regular boolean values.

        Hosting templates frequently use ``DEBUG=release`` or
        ``DEBUG=development``.  Treating those values explicitly keeps a
        harmless logging preference from preventing the API from starting.
        """
        if isinstance(value, str):
            normalised = value.strip().lower()
            if normalised in {"release", "production", "prod", "info", "off"}:
                return False
            if normalised in {"development", "dev", "debug", "verbose", "on"}:
                return True
        return value

    # ---------------------------------------------------------------- SerpApi
    serpapi_api_key: str = ""
    serpapi_engine: str = "google_shopping"
    # Country/language/location used for Google Shopping.  Defaults are tuned
    # for the SerpApi India Hackathon (prices come back in INR and from Indian
    # merchants such as Flipkart, Myntra, Ajio, Tata CLiQ ...).
    serpapi_gl: str = "in"
    serpapi_hl: str = "en"
    serpapi_location: str = "India"
    serpapi_timeout_seconds: float = 25.0
    serpapi_max_results: int = 40
    # Automatic second attempt with engine=google&tbm=shop when google_shopping
    # returns nothing.  Costs one extra search, so it can be switched off.
    serpapi_fallback_engine: bool = True
    search_cache_ttl_seconds: int = 900

    # ------------------------------------------------------------ AI vision
    # provider: "local" | "openai" | "gemini" | "demo" | "" (local)
    vision_provider: str = "local"
    vision_api_key: str = ""
    vision_model: str = ""
    vision_base_url: str = ""
    vision_timeout_seconds: float = 45.0
    local_vision_model: str = "openai/clip-vit-base-patch32"

    # ------------------------------------------------------------- behaviour
    demo_mode: DemoMode = "auto"
    frontend_url: str = "http://localhost:5173"
    # Extra allowed CORS origins, comma separated.
    cors_origins: str = ""

    # ---------------------------------------------------------------- uploads
    max_upload_mb: float = 10.0
    max_image_dimension: int = 1280

    # ------------------------------------------------------------------ paths
    data_dir: Path = DATA_DIR

    # ------------------------------------------------------------- accessors
    @property
    def serpapi_configured(self) -> bool:
        return bool(self.serpapi_api_key.strip())

    @property
    def vision_configured(self) -> bool:
        # Local CLIP needs no credential. Avoid resolving the provider here:
        # `resolved_vision_provider` itself checks this property for hosted keys.
        return self.vision_provider.strip().lower() in {"", "local"} or bool(
            self.vision_api_key.strip()
        )

    @property
    def resolved_vision_provider(self) -> str:
        """Provider name that will actually be used to analyse images."""
        explicit = self.vision_provider.strip().lower()
        if explicit:
            if explicit == "local":
                return "local"
            if explicit == "demo":
                return "demo"
            if explicit in {"openai", "gemini"} and self.vision_configured:
                return explicit
            # Explicit provider requested but key missing -> demo (auto) or demo.
            return "demo" if self.demo_mode != "off" else explicit
        if self.vision_api_key.strip():
            # Default to Gemini when a Google-style key is supplied, else OpenAI.
            if self.vision_api_key.startswith("AIza") or self.vision_base_url.startswith(
                "https://generativelanguage"
            ):
                return "gemini"
            return "openai"
        return "local"

    def demo_active(self, capability: Literal["vision", "search"]) -> bool:
        """Should ``capability`` serve clearly-labelled demo data?"""
        if self.demo_mode == "on":
            return True
        if self.demo_mode == "off":
            return False
        configured = (
            self.vision_configured if capability == "vision" else self.serpapi_configured
        )
        return not configured

    @property
    def allowed_origins(self) -> list[str]:
        origins = {
            self.frontend_url.rstrip("/"),
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        }
        origins.update(o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip())
        return sorted(origins)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
