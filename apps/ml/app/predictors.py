"""TabPFN first, then local TabPFN, then scikit-learn, then a rules prior.

The active model name is always returned so the UI can say which one ran.
"""

from __future__ import annotations

import importlib.util
import logging
from typing import Any, Sequence

import numpy as np

from app.config import settings
from app.features import FEATURE_COLUMNS, rules_probability, vector
from app.metrics import held_out_split, precision_at_top_fraction, roc_auc
from app.reasons import band_for, reasons_for
from app.tracing import traced

log = logging.getLogger("rto.ml")


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def _positive_proba(clf: Any, proba: np.ndarray) -> np.ndarray:
    classes = list(getattr(clf, "classes_", [0, 1]))
    if proba.ndim == 1:
        return proba
    if 1 in classes:
        return proba[:, classes.index(1)]
    # Only the negative class was present.
    return np.zeros(len(proba))


def _subsample(X: np.ndarray, y: np.ndarray, limit: int, seed: int = 0) -> tuple[np.ndarray, np.ndarray]:
    if len(X) <= limit:
        return X, y
    rng = np.random.default_rng(seed)
    pos = np.flatnonzero(y == 1)
    neg = np.flatnonzero(y == 0)
    n_pos = min(len(pos), max(1, limit // 2))
    n_neg = min(len(neg), limit - n_pos)
    chosen = np.concatenate(
        [
            rng.choice(pos, size=n_pos, replace=False) if len(pos) else np.array([], dtype=int),
            rng.choice(neg, size=n_neg, replace=False) if len(neg) else np.array([], dtype=int),
        ]
    )
    rng.shuffle(chosen)
    return X[chosen], y[chosen]


def _try_tabpfn_client(X_train: np.ndarray, y_train: np.ndarray, X_test: np.ndarray) -> np.ndarray:
    """Score with the Prior Labs API. Never prompts and never loads local torch weights."""
    import os

    import tabpfn_client

    token = settings.tabpfn_token.strip()
    # The client reads TABPFN_TOKEN itself. Set it here so a token that arrived
    # only through settings is visible, and so nothing falls through to a browser login.
    os.environ["TABPFN_TOKEN"] = token
    if hasattr(tabpfn_client, "set_access_token"):
        # In-process only. This does not write the token to disk.
        tabpfn_client.set_access_token(token)
    if hasattr(tabpfn_client, "init"):
        # set_access_token marks the client initialized without turning server mode on.
        # fit() refuses to run unless use_server is true, and local mode is unsupported.
        tabpfn_client.init(use_server=True)
    from tabpfn_client import TabPFNClassifier

    clf = TabPFNClassifier()
    clf.fit(X_train, y_train)
    return _positive_proba(clf, np.asarray(clf.predict_proba(X_test)))


def _try_tabpfn_local(X_train: np.ndarray, y_train: np.ndarray, X_test: np.ndarray) -> np.ndarray:
    from tabpfn import TabPFNClassifier

    try:
        clf = TabPFNClassifier(device="cpu", ignore_pretraining_limits=True)
    except TypeError:
        clf = TabPFNClassifier(device="cpu")
    clf.fit(X_train, y_train)
    return _positive_proba(clf, np.asarray(clf.predict_proba(X_test)))


def _sklearn(X_train: np.ndarray, y_train: np.ndarray, X_test: np.ndarray) -> np.ndarray:
    from sklearn.ensemble import GradientBoostingClassifier

    if len(set(y_train.tolist())) < 2:
        constant = float(y_train[0]) if len(y_train) else 0.5
        return np.full(len(X_test), constant)
    clf = GradientBoostingClassifier(
        random_state=42,
        max_depth=3,
        n_estimators=80,
        learning_rate=0.08,
        subsample=0.9,
    )
    clf.fit(X_train, y_train)
    return _positive_proba(clf, clf.predict_proba(X_test))


def _fit_predict(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_test: np.ndarray,
    *,
    fast: bool = False,
) -> tuple[np.ndarray, str, str]:
    X_fit, y_fit = _subsample(X_train, y_train, settings.tabpfn_max_rows)
    # The demo shop must return inside the web proxy budget. TabPFN is two
    # remote fits (held-out, then full) and is reserved for an explicit Score.
    if not fast and settings.tabpfn_token and module_available("tabpfn_client"):
        try:
            with traced(
                "ai.tabpfn",
                "tabpfn.client.predict",
                rows_train=int(len(X_fit)),
                rows_predict=int(len(X_test)),
                model="tabpfn-client",
            ) as box:
                probs = _try_tabpfn_client(X_fit, y_fit, X_test)
                box["gen_ai.usage.input_tokens"] = None
                box["gen_ai.usage.output_tokens"] = None
            return probs, "tabpfn-client", "TabPFN (Prior Labs) trained in-context on this shop's history."
        except Exception as exc:  # noqa: BLE001
            log.warning("tabpfn_client_failed %s", type(exc).__name__)
    elif not fast and settings.tabpfn_token and not module_available("tabpfn_client"):
        log.info("tabpfn_token_set_but_client_missing")

    if not fast and module_available("tabpfn"):
        try:
            with traced(
                "ai.tabpfn",
                "tabpfn.local.predict",
                rows_train=int(len(X_fit)),
                rows_predict=int(len(X_test)),
                model="tabpfn-local",
            ) as box:
                probs = _try_tabpfn_local(X_fit, y_fit, X_test)
                box["gen_ai.usage.input_tokens"] = None
                box["gen_ai.usage.output_tokens"] = None
            return (
                probs,
                "tabpfn-local",
                "TabPFN open weights running locally on this shop's history.",
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("tabpfn_local_failed %s", type(exc).__name__)

    with traced(
        "ai.sklearn",
        "sklearn.gradient_boosting.predict",
        rows_train=int(len(X_train)),
        rows_predict=int(len(X_test)),
        model="sklearn-gradient-boosting",
    ):
        probs = _sklearn(X_train, y_train, X_test)
    if fast:
        label = (
            "Fast score (scikit-learn gradient boosting). "
            "Press Score for the full model. TabPFN runs then when a token is set."
        )
    else:
        label = (
            "Deterministic fallback (scikit-learn gradient boosting). "
            "TabPFN was not used — set TABPFN_TOKEN for the Prior Labs API, or install the local tabpfn package."
        )
    return probs, "sklearn-gradient-boosting", label


def score_orders(
    history: Sequence[dict[str, Any]],
    pending: Sequence[dict[str, Any]],
    *,
    fast: bool = False,
) -> dict[str, Any]:
    warnings: list[str] = []
    labeled = [row for row in history if row.get("label") in (0, 1)]
    if len(labeled) < settings.min_train_rows or len({int(row["label"]) for row in labeled}) < 2:
        warnings.append(
            "Not enough labelled history to train. Showing a transparent rules prior "
            "(COD, new buyer, weak address, late night). Upload more delivered and RTO orders."
        )
        predictions = [_pack(row, rules_probability(row), "rules-prior") for row in pending]
        return {
            "model": "rules-prior",
            "model_label": "Rules prior — not a trained model. Add at least 30 delivered and RTO outcomes.",
            "metrics": None,
            "predictions": predictions,
            "warnings": warnings,
            "feature_columns": FEATURE_COLUMNS,
        }

    y_all = [int(row["label"]) for row in labeled]
    train_idx, test_idx = held_out_split(len(labeled), y_all)
    metrics = None
    if test_idx:
        X_train = np.asarray([vector(labeled[i]) for i in train_idx], dtype=float)
        y_train = np.asarray([y_all[i] for i in train_idx], dtype=int)
        X_test = np.asarray([vector(labeled[i]) for i in test_idx], dtype=float)
        y_test = [y_all[i] for i in test_idx]
        test_probs, model_name, model_label = _fit_predict(X_train, y_train, X_test, fast=fast)
        metrics = {
            "auc": roc_auc(y_test, test_probs.tolist()),
            "precision_at_top_10pct": precision_at_top_fraction(y_test, test_probs.tolist(), 0.1),
            "n_train": len(train_idx),
            "n_test": len(test_idx),
            "positive_rate_test": round(sum(y_test) / len(y_test), 4),
        }
    else:
        # Enough labelled rows to train. A holdout this thin is not a stable metric,
        # and it is not a sign that the history itself is too small.
        model_name = ""
        model_label = ""

    X_full = np.asarray([vector(row) for row in labeled], dtype=float)
    y_full = np.asarray(y_all, dtype=int)
    X_pending = np.asarray([vector(row) for row in pending], dtype=float) if pending else np.zeros((0, len(FEATURE_COLUMNS)))
    probs, model_name, model_label = _fit_predict(
        X_full,
        y_full,
        X_pending if len(X_pending) else np.zeros((1, len(FEATURE_COLUMNS))),
        fast=fast,
    )
    if not len(X_pending):
        probs = np.asarray([])
    predictions = [_pack(row, float(p), model_name) for row, p in zip(pending, probs, strict=False)]
    return {
        "model": model_name,
        "model_label": model_label,
        "metrics": metrics,
        "predictions": predictions,
        "warnings": warnings,
        "feature_columns": FEATURE_COLUMNS,
    }


def _pack(row: dict[str, Any], probability: float, model: str) -> dict[str, Any]:
    probability = max(0.0, min(1.0, float(probability)))
    score = int(round(probability * 100))
    quality = row.get("address_quality") or {
        "quality_score": row.get("addr_quality", 0.5),
        "incomplete": bool(row.get("addr_incomplete")),
        "landmark_only": bool(row.get("addr_landmark")),
        "junk": bool(row.get("addr_junk")),
        "pincode_mismatch": bool(row.get("addr_mismatch")),
        "notes": "",
        "source": "heuristic",
    }
    return {
        "id": str(row["id"]),
        "score": score,
        "probability": round(probability, 4),
        "band": band_for(score),
        "reasons": reasons_for(row, score),
        "address_quality": quality,
        "model": model,
    }


def active_predictor_name() -> str:
    """Which scorer /health should name. A token plus the API client means TabPFN."""
    if settings.tabpfn_token and module_available("tabpfn_client"):
        return "tabpfn-client"
    if module_available("tabpfn"):
        return "tabpfn-local"
    return "sklearn-gradient-boosting"


def health_payload() -> dict[str, Any]:
    return {
        "ok": True,
        "tabpfn_token": bool(settings.tabpfn_token),
        "tabpfn_client_installed": module_available("tabpfn_client"),
        "tabpfn_local_installed": module_available("tabpfn"),
        "gemini": bool(settings.gemini_api_key),
        "ollama_configured": bool(settings.ollama_base_url),
        "sentry": bool(settings.sentry_dsn),
        "active_predictor": active_predictor_name(),
        "privacy": "Pincode is not a model feature. Phone numbers are not accepted by this service.",
    }
