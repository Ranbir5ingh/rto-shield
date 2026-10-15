"""Plain-language reasons. These describe the order, not a pincode blacklist."""

from __future__ import annotations

from app.features import feature_dict


def band_for(score: int) -> str:
    if score >= 70:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def reasons_for(order: dict, score: int) -> list[str]:
    row = feature_dict(order)
    found: list[str] = []
    value = int(round(row["order_value"]))
    if row["is_cod"] and row["is_new_buyer"]:
        found.append("Cash on delivery from a first-time buyer")
    elif row["high_value_cod"]:
        found.append(f"High-value cash-on-delivery order (₹{value})")
    elif row["is_cod"]:
        found.append("Cash on delivery, which comes back more often than prepaid")
    if row["prior_orders"] >= 1 and row["prior_rto_rate"] >= 0.34:
        pct = int(round(row["prior_rto_rate"] * 100))
        n = int(row["prior_orders"])
        found.append(f"This buyer refused {pct}% of {n} earlier orders")
    if row["addr_junk"]:
        found.append("Address looks junk or too short to deliver")
    elif row["addr_landmark"]:
        found.append("Address is only a landmark, with no house or street number")
    elif row["addr_incomplete"]:
        found.append("Address looks incomplete")
    if row["addr_mismatch"]:
        found.append("The address text and pincode disagree")
    if row["late_night"] and row["is_cod"]:
        found.append("Placed late at night, when buyers confirm less often")

    if score < 40:
        calm: list[str] = []
        if not row["is_cod"]:
            calm.append("Prepaid order — the buyer has already paid")
        if row["prior_orders"] >= 2 and row["prior_rto_rate"] < 0.2:
            calm.append("Repeat buyer with a clean delivery history")
        if row["addr_quality"] >= 0.75 and not row["addr_incomplete"]:
            calm.append("Address looks complete enough to ship")
        found = calm or found

    if not found:
        found.append("Mixed signals from payment type, order value, and buyer history")
    return found[:3]
