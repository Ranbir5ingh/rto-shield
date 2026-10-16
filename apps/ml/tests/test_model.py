import math

from fastapi.testclient import TestClient

from app.address import heuristic_address
from app.config import settings
from app.features import FEATURE_COLUMNS, rules_probability
from app.main import app
from app.messages import safe_voice_script, template_messages
from app.metrics import precision_at_top_fraction, roc_auc
from app.predictors import score_orders
from app.reasons import band_for
from app.sample import generate, outcome_rates


def test_feature_columns_exclude_pincode_and_phone():
    blob = " ".join(FEATURE_COLUMNS)
    assert "pincode" not in blob
    assert "phone" not in blob
    assert "address" not in blob


def test_bands():
    assert band_for(0) == "Low"
    assert band_for(40) == "Medium"
    assert band_for(70) == "High"
    assert band_for(100) == "High"


def test_address_heuristic_cases():
    good = heuristic_address("H.No 12, Lane 4, Andheri West", "400058", "Mumbai", "Maharashtra")
    assert good["quality_score"] > 0.7
    assert not good["junk"]
    landmark = heuristic_address("near Hanuman mandir", "226010", "Lucknow", "Uttar Pradesh")
    assert landmark["landmark_only"]
    junk = heuristic_address("asdf", "560001", "Bengaluru", "Karnataka")
    assert junk["junk"]
    nagar = heuristic_address("H.No 12, Lane 4, Shastri Nagar, Patna", "800001", "Patna", "Bihar")
    assert not nagar["junk"]
    assert nagar["quality_score"] > 0.7
    purana = heuristic_address("near purana bus stand", "226010", "Lucknow", "Uttar Pradesh")
    assert not purana["junk"]
    assert purana["landmark_only"]
    mismatch = heuristic_address("H.No 9, Park Street, Kolkata 700019", "560001", "Bengaluru", "Karnataka")
    assert mismatch["pincode_mismatch"]


def test_rules_rank_risky_above_safe():
    risky = rules_probability(
        {
            "order_value": 2499,
            "is_cod": True,
            "hour": 23,
            "prior_orders": 0,
            "prior_rtos": 0,
            "addr_quality": 0.1,
            "addr_incomplete": 1,
            "addr_landmark": 0,
            "addr_junk": 1,
            "addr_mismatch": 0,
        }
    )
    safe = rules_probability(
        {
            "order_value": 499,
            "is_cod": False,
            "hour": 14,
            "prior_orders": 5,
            "prior_rtos": 0,
            "addr_quality": 0.95,
            "addr_incomplete": 0,
            "addr_landmark": 0,
            "addr_junk": 0,
            "addr_mismatch": 0,
        }
    )
    assert risky > 0.7
    assert safe < 0.25
    assert risky > safe


def _with_heuristic(rows):
    done = []
    for row in rows:
        quality = heuristic_address(row["address"], row["pincode"], row["city"], row["state"])
        item = dict(row)
        item["addr_quality"] = quality["quality_score"]
        item["addr_incomplete"] = quality["incomplete"]
        item["addr_landmark"] = quality["landmark_only"]
        item["addr_junk"] = quality["junk"]
        item["addr_mismatch"] = quality["pincode_mismatch"]
        item["seller_pin_rto_rate"] = 0.3
        done.append(item)
    return done


def test_pending_demo_mix_has_a_middle_band():
    data = generate(180, 24, seed=42)
    pending = _with_heuristic(data["pending"])
    rules = {"Low": 0, "Medium": 0, "High": 0}
    for row in pending:
        score = int(round(rules_probability(row) * 100))
        rules[band_for(score)] += 1
    assert rules == {"Low": 10, "Medium": 8, "High": 6}


def test_sample_cod_returns_more_than_prepaid():
    data = generate(360, 24, seed=42)
    rates = outcome_rates(data["history"])
    assert rates["cod_rto_rate"] > rates["prepaid_rto_rate"] + 0.15
    overall = sum(int(row["label"] or 0) for row in data["history"]) / len(data["history"])
    assert 0.25 <= overall <= 0.35
    result = score_orders(data["history"], data["pending"], fast=True)
    cod_low = [
        pred
        for pred, order in zip(result["predictions"], data["pending"], strict=False)
        if order["is_cod"] and pred["band"] == "Low"
    ]
    assert cod_low
    assert any(pred["band"] in {"Medium", "High"} for pred in result["predictions"])


def test_fast_score_does_not_call_tabpfn(monkeypatch):
    def boom(*_args, **_kwargs):
        raise AssertionError("TabPFN must not run on the fast path")

    monkeypatch.setattr("app.predictors._try_tabpfn_client", boom)
    monkeypatch.setattr("app.predictors._try_tabpfn_local", boom)
    monkeypatch.setattr(settings, "tabpfn_token", "present")
    monkeypatch.setattr("app.predictors.module_available", lambda name: name in {"tabpfn_client", "tabpfn"})
    data = generate(80, 6, seed=42)
    result = score_orders(data["history"], data["pending"], fast=True)
    assert result["model"] == "sklearn-gradient-boosting"
    assert "Fast demo score" in result["model_label"]
    assert len(result["predictions"]) == 6


def test_sklearn_held_out_auc_on_sample():
    data = generate(360, 20, seed=42)
    result = score_orders(data["history"], data["pending"])
    assert result["model"] == "sklearn-gradient-boosting"
    assert "scikit-learn" in result["model_label"]
    assert result["metrics"]["auc"] >= 0.7
    assert result["metrics"]["precision_at_top_10pct"] >= 0.5
    assert len(result["predictions"]) == 20
    assert all(0 <= row["score"] <= 100 for row in result["predictions"])
    assert any(row["band"] == "High" for row in result["predictions"])
    assert any(row["band"] == "Low" for row in result["predictions"])


def test_cold_start_rules_prior():
    history = [
        {"id": "h1", "label": 1, "order_value": 100, "is_cod": True, "hour": 12, "prior_orders": 0, "prior_rtos": 0},
    ]
    pending = [{"id": "p1", "order_value": 100, "is_cod": True, "hour": 12, "prior_orders": 0, "prior_rtos": 0}]
    result = score_orders(history, pending)
    assert result["model"] == "rules-prior"
    assert result["metrics"] is None


def test_auc_perfect_and_empty():
    assert roc_auc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9]) == 1
    assert roc_auc([1, 1], [0.2, 0.9]) is None
    assert precision_at_top_fraction([0, 1, 1, 0, 1, 0, 0, 0, 0, 0], [0.1, 0.95, 0.9, 0.2, 0.8, 0.1, 0.1, 0.1, 0.1, 0.1]) == 1


def test_voice_script_has_no_phone():
    script = safe_voice_script("Raju Stores", 799)
    assert "799" in script or "799" in script
    assert "98" not in script
    msg = template_messages("Raju Stores", {"first_name": "Aarav", "order_value": 799, "product_name": "kurti"})
    assert "YES" in msg["english"] or "YES" in msg["hinglish"]
    assert "हाँ" in msg["voice_script_hi"] or "हा" in msg["hindi"] or "हाँ" in msg["hindi"]


def test_predict_endpoint_labels_fallback(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "tabpfn_token", "")
    client = TestClient(app)
    data = generate(80, 3, seed=3)
    # Strip phone if present — the schema does not accept it, which is the point.
    def slim(rows, with_label: bool):
        out = []
        for row in rows:
            item = {
                "id": row["id"],
                "order_value": row["order_value"],
                "is_cod": row["is_cod"],
                "hour": row["hour"],
                "prior_orders": row["prior_orders"],
                "prior_rtos": row["prior_rtos"],
                "address": row["address"],
                "city": row["city"],
                "state": row["state"],
                "pincode": row["pincode"],
            }
            if with_label:
                item["label"] = row["label"]
            out.append(item)
        return out

    response = client.post("/v1/predict", json={"history": slim(data["history"], True), "pending": slim(data["pending"], False)})
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "sklearn-gradient-boosting"
    assert "fallback" in body["model_label"].lower() or "scikit-learn" in body["model_label"]
    assert body["address_source"] == "heuristic"
    assert "phone" not in response.text
    health = client.get("/health").json()
    assert health["active_predictor"] == "sklearn-gradient-boosting"
    assert health["tabpfn_token"] is False


def test_messages_endpoint_templates():
    client = TestClient(app)
    response = client.post(
        "/v1/messages",
        json={
            "shop_name": "Neem Studio",
            "orders": [{"id": "1", "first_name": "Priya", "order_value": 499, "product_name": "saree", "payment_type": "cod"}],
        },
    )
    assert response.status_code == 200
    msg = response.json()["messages"][0]
    assert msg["hinglish"]
    assert msg["hindi"]
    assert msg["english"]
    assert "499" in msg["voice_script_hi"]


def test_internal_token(monkeypatch):
    monkeypatch.setenv("ML_INTERNAL_TOKEN", "secret")
    # Settings are cached at import. Hit the guard by patching the settings object.
    from app import config, main

    monkeypatch.setattr(config.settings, "internal_token", "secret")
    monkeypatch.setattr(main.settings, "internal_token", "secret")
    client = TestClient(app)
    denied = client.post("/v1/messages", json={"shop_name": "A", "orders": []})
    assert denied.status_code == 401
    health = client.get("/health", headers={"origin": "https://www.rtoshield.tech"})
    assert health.status_code == 200
    assert health.json()["ok"] is True
    assert health.headers["access-control-allow-origin"] == "https://www.rtoshield.tech"
    allowed = client.post(
        "/v1/messages",
        headers={"x-internal-token": "secret"},
        json={"shop_name": "A", "orders": []},
    )
    assert allowed.status_code == 200


def test_health_reports_tabpfn_when_the_token_is_present(monkeypatch):
    import importlib.util

    import numpy as np

    from app.config import settings
    from app.predictors import _fit_predict, _try_tabpfn_client

    assert importlib.util.find_spec("tabpfn_client") is not None
    assert importlib.util.find_spec("tabpfn") is None
    monkeypatch.setattr(settings, "tabpfn_token", "present")
    client = TestClient(app)
    health = client.get("/health").json()
    assert health["ok"] is True
    assert health["tabpfn_token"] is True
    assert health["tabpfn_client_installed"] is True
    assert health["tabpfn_local_installed"] is False
    assert health["active_predictor"] == "tabpfn-client"
    if not settings.gemini_api_key and not settings.ollama_base_url:
        assert health["gemma_ready"] is False

    calls: list[tuple[str, object]] = []
    monkeypatch.setenv("TABPFN_TOKEN", "present")
    import tabpfn_client

    monkeypatch.setattr(tabpfn_client, "set_access_token", lambda token: calls.append(("set", token)))
    monkeypatch.setattr(tabpfn_client, "init", lambda use_server=True: calls.append(("init", use_server)))
    monkeypatch.setattr(tabpfn_client, "interactive_login", lambda *args, **kwargs: calls.append(("interactive", args)))

    class FakeClassifier:
        def fit(self, X, y):
            calls.append(("fit", X.shape[0]))
            return self

        def predict_proba(self, X):
            return np.tile(np.array([0.25, 0.75]), (len(X), 1))

    monkeypatch.setattr(tabpfn_client, "TabPFNClassifier", FakeClassifier)
    train = np.array([[0.0], [1.0], [0.2], [0.8]])
    labels = np.array([0, 1, 0, 1])
    probs = _try_tabpfn_client(train, labels, train[:2])
    assert probs.shape == (2,)
    assert ("set", "present") in calls
    assert ("init", True) in calls
    assert not any(item[0] == "interactive" for item in calls)

    def explode(*args, **kwargs):
        raise RuntimeError("tabpfn api down")

    monkeypatch.setattr("app.predictors._try_tabpfn_client", explode)
    monkeypatch.setattr("app.predictors.module_available", lambda name: name == "tabpfn_client")
    fallback, name, _label = _fit_predict(train, labels, train[:2])
    assert name == "sklearn-gradient-boosting"
    assert len(fallback) == 2


def test_auc_ties_stay_finite():
    score = roc_auc([0, 1, 0, 1], [0.4, 0.4, 0.6, 0.6])
    assert score is not None
    assert 0 <= score <= 1
    assert not math.isnan(score)
