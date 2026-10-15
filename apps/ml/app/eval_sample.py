"""Re-score the synthetic dataset and write metrics.

Run from apps/ml:

    python -m app.eval_sample
"""

from __future__ import annotations

import json
from pathlib import Path

from app.predictors import score_orders
from app.sample import generate, outcome_rates


def evaluate() -> dict:
    data = generate(360, 24, seed=42)
    # Eval uses the planted address flags. Passing them through avoids a second heuristic pass.
    for row in data["history"] + data["pending"]:
        row["address_quality"] = {
            "quality_score": row["addr_quality"],
            "incomplete": bool(row["addr_incomplete"]),
            "landmark_only": bool(row["addr_landmark"]),
            "junk": bool(row["addr_junk"]),
            "pincode_mismatch": bool(row["addr_mismatch"]),
            "notes": "synthetic",
            "source": "synthetic",
        }
    # Blank the address so a future change cannot require Gemma for the scheduled job.
    for row in data["history"] + data["pending"]:
        row["address"] = ""
    result = score_orders(data["history"], data["pending"])
    bands = {"Low": 0, "Medium": 0, "High": 0}
    for row in result["predictions"]:
        bands[row["band"]] = bands.get(row["band"], 0) + 1
    summary = {
        "model": result["model"],
        "model_label": result["model_label"],
        "metrics": result["metrics"],
        "pending_bands": bands,
        "generator_rates": outcome_rates(data["history"]),
        "warnings": result["warnings"],
        "n_history": len(data["history"]),
        "n_pending": len(data["pending"]),
        "feature_columns": result["feature_columns"],
    }
    return summary


def main() -> None:
    summary = evaluate()
    out = Path(__file__).resolve().parents[1] / "eval-results.json"
    out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    metrics = summary.get("metrics") or {}
    auc = metrics.get("auc")
    if auc is None or auc < 0.7:
        raise SystemExit(f"AUC {auc} is below 0.70 on the synthetic set")


if __name__ == "__main__":
    main()
