"""Health and configuration endpoints."""

from __future__ import annotations


def test_health_returns_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200

    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["version"]
    assert payload["demo_mode"] in {"auto", "on", "off"}
    assert isinstance(payload["serpapi_configured"], bool)
    assert isinstance(payload["vision_configured"], bool)


def test_health_never_leaks_keys(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.serpapi_api_key", "super-secret-key")
    body = client.get("/api/health").text
    assert "super-secret-key" not in body


def test_public_config_shape(client):
    payload = client.get("/api/config").json()
    assert payload["currency"] == "INR"
    assert "JPG" in payload["supported_image_types"]
    assert payload["max_upload_mb"] > 0
    assert isinstance(payload["demo_search"], bool)
    # No key material in the public config.
    assert "serpapi_api_key" not in str(payload).lower()


def test_root_endpoint(client):
    payload = client.get("/").json()
    assert payload["health"] == "/api/health"
