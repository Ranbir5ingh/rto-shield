from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]


def test_render_blueprint_has_three_services():
    doc = yaml.safe_load((ROOT / "render.yaml").read_text(encoding="utf-8"))
    services = doc["services"]
    names = {item["name"] for item in services}
    assert names == {"rto-shield-web", "rto-shield-api", "rto-shield-ml"}
    by_name = {item["name"]: item for item in services}
    assert by_name["rto-shield-web"]["runtime"] == "node"
    assert "@rto/web" in by_name["rto-shield-web"]["startCommand"]
    assert by_name["rto-shield-api"]["runtime"] == "node"
    assert by_name["rto-shield-ml"]["runtime"] == "python"
    assert by_name["rto-shield-ml"]["healthCheckPath"] == "/health"
    assert by_name["rto-shield-api"]["healthCheckPath"] == "/api/health"
    assert by_name["rto-shield-web"]["healthCheckPath"] == "/"
    api_keys = {item["key"] for item in by_name["rto-shield-api"]["envVars"]}
    for key in ("MONGODB_URI", "JWT_SECRET", "ENCRYPTION_KEY", "ML_SERVICE_URL", "WEB_ORIGIN", "SENTRY_DSN"):
        assert key in api_keys
    ml_keys = {item["key"] for item in by_name["rto-shield-ml"]["envVars"]}
    for key in ("TABPFN_TOKEN", "GEMINI_API_KEY", "OLLAMA_BASE_URL", "SENTRY_DSN"):
        assert key in ml_keys
