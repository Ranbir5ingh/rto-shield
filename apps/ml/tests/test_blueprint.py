from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]


def test_render_blueprint_has_api_and_ml_on_free():
    doc = yaml.safe_load((ROOT / "render.yaml").read_text(encoding="utf-8"))
    services = doc["services"]
    names = {item["name"] for item in services}
    assert names == {"rto-shield-api", "rto-shield-ml"}
    assert "rto-shield-web" not in names
    by_name = {item["name"]: item for item in services}
    assert by_name["rto-shield-api"]["runtime"] == "node"
    assert by_name["rto-shield-api"]["plan"] == "free"
    assert by_name["rto-shield-ml"]["runtime"] == "python"
    assert by_name["rto-shield-ml"]["plan"] == "free"
    assert by_name["rto-shield-ml"]["healthCheckPath"] == "/health"
    assert by_name["rto-shield-api"]["healthCheckPath"] == "/api/health"
    api_keys = {item["key"] for item in by_name["rto-shield-api"]["envVars"]}
    for key in ("MONGODB_URI", "JWT_SECRET", "ENCRYPTION_KEY", "ML_SERVICE_URL", "WEB_ORIGIN", "SENTRY_DSN"):
        assert key in api_keys
    ml_keys = {item["key"] for item in by_name["rto-shield-ml"]["envVars"]}
    for key in ("TABPFN_TOKEN", "GEMINI_API_KEY", "OLLAMA_BASE_URL", "SENTRY_DSN"):
        assert key in ml_keys
    requirements = (ROOT / "apps/ml/requirements.txt").read_text(encoding="utf-8")
    names = []
    for line in requirements.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        names.append(stripped.split("==")[0].split(">=")[0].split("[")[0].strip())
    assert "tabpfn-client" in names
    assert "tabpfn" not in names
