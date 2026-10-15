"""Numeric features for RTO scoring.

Pincode is NOT a model feature. A pin code is context for the seller, never a ban
and never a geographic risk input. Address quality flags describe the text, not the place.
"""

from __future__ import annotations

import math
from typing import Any

FEATURE_COLUMNS: list[str] = [
    "log_order_value",
    "is_cod",
    "hour_sin",
    "hour_cos",
    "prior_orders_scaled",
    "prior_rto_rate",
    "is_new_buyer",
    "high_value_cod",
    "addr_quality",
    "addr_incomplete",
    "addr_landmark",
    "addr_junk",
    "addr_mismatch",
    "late_night",
]


def _flag(value: Any) -> float:
    return 1.0 if value else 0.0


def feature_dict(order: dict[str, Any]) -> dict[str, float]:
    value = float(order.get("order_value") or 0)
    is_cod = 1.0 if order.get("is_cod") else 0.0
    hour = int(order.get("hour") or 0) % 24
    prior_orders = max(0, int(order.get("prior_orders") or 0))
    prior_rtos = max(0, int(order.get("prior_rtos") or 0))
    rate = min(1.0, prior_rtos / prior_orders) if prior_orders else 0.0
    quality = order.get("addr_quality")
    if quality is None:
        quality = 0.5
    angle = 2 * math.pi * hour / 24
    high_value_cod = 1.0 if is_cod and value >= 1500 else 0.0
    late = 1.0 if hour >= 22 or hour <= 5 else 0.0
    return {
        "log_order_value": math.log1p(max(0.0, value)) / 10,
        "is_cod": is_cod,
        "hour_sin": math.sin(angle),
        "hour_cos": math.cos(angle),
        "prior_orders_scaled": min(prior_orders, 20) / 20,
        "prior_rto_rate": rate,
        "is_new_buyer": 1.0 if prior_orders == 0 else 0.0,
        "high_value_cod": high_value_cod,
        "addr_quality": float(quality),
        "addr_incomplete": _flag(order.get("addr_incomplete")),
        "addr_landmark": _flag(order.get("addr_landmark")),
        "addr_junk": _flag(order.get("addr_junk")),
        "addr_mismatch": _flag(order.get("addr_mismatch")),
        "late_night": late,
        # retained for reason text, not as extra columns
        "order_value": value,
        "prior_orders": float(prior_orders),
        "hour": float(hour),
    }


def vector(order: dict[str, Any]) -> list[float]:
    row = feature_dict(order)
    return [float(row[col]) for col in FEATURE_COLUMNS]


def prior_rto_logit(row: dict[str, float]) -> float:
    """Transparent cold-start score. Same signals the sample generator uses."""
    z = -1.55
    z += 1.45 * row["is_cod"]
    z += 0.95 * row["high_value_cod"]
    z += 0.85 * row["is_new_buyer"] * row["is_cod"]
    z += 1.15 * row["prior_rto_rate"] * (0 if row["prior_orders"] == 0 else 1)
    z += 0.85 * row["addr_incomplete"]
    z += 0.75 * row["addr_landmark"]
    z += 1.25 * row["addr_junk"]
    z += 0.55 * row["addr_mismatch"]
    z += 0.35 * row["late_night"]
    z -= 1.1 * (1 - row["is_cod"])
    if row["prior_orders"] >= 3 and row["prior_rto_rate"] < 0.15 and row["addr_quality"] >= 0.7:
        z -= 0.45
    return z


def probability_from_logit(z: float) -> float:
    if z >= 0:
        ez = math.exp(-z)
        return 1 / (1 + ez)
    ez = math.exp(z)
    return ez / (1 + ez)


def rules_probability(order: dict[str, Any]) -> float:
    return probability_from_logit(prior_rto_logit(feature_dict(order)))
