import math

from fastapi.testclient import TestClient

from app.address import heuristic_address
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


def test_sample_cod_returns_more_than_prepaid():
    data = generate(360, 10, seed=42)
    rates = outcome_rates(data["history"])
    assert rates["cod_rto_rate"] > rates["prepaid_rto_rate"] + 0.15


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


def test_predict_endpoint_labels_fallback():
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
    allowed = client.post(
        "/v1/messages",
        headers={"x-internal-token": "secret"},
        json={"shop_name": "A", "orders": []},
    )
    assert allowed.status_code == 200


def test_auc_ties_stay_finite():
    score = roc_auc([0, 1, 0, 1], [0.4, 0.4, 0.6, 0.6])
    assert score is not None
    assert 0 <= score <= 1
    assert not math.isnan(score)
