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
    if row["prior_orders"] >= 2 and row["prior_rto_rate"] < 0.15:
        found.append("Repeat buyer with a clean delivery history")
    elif row["prior_orders"] >= 1 and row["prior_rto_rate"] >= 0.34:
        pct = int(round(row["prior_rto_rate"] * 100))
        n = int(row["prior_orders"])
        found.append(f"This buyer refused {pct}% of {n} earlier orders")
    elif row["is_cod"] and row["is_new_buyer"]:
        found.append("Cash on delivery from a first-time buyer")
    if row["high_value_cod"]:
        found.append(f"High-value cash-on-delivery order (₹{value})")
    if row["addr_junk"]:
        found.append("Address looks junk or too short to deliver")
    elif row["addr_landmark"]:
        found.append("Address is only a landmark, with no house or street number")
    elif row["addr_incomplete"]:
        found.append("Address looks incomplete")
    elif row["addr_quality"] >= 0.75:
        found.append("Address looks complete enough to ship")
    if row["addr_mismatch"]:
        found.append("The address text and the typed pincode disagree")
    if row["late_night"] and row["is_cod"]:
        found.append("Placed late at night, when buyers confirm less often")
    elif row["is_cod"] and not row["late_night"] and row["order_value"] < 1500:
        found.append("Daytime order at a modest value")
    pin_n = int(row.get("seller_pin_n") or 0)
    pin_rate = float(row.get("seller_pin_rto_rate") or 0)
    if pin_n >= 6 and pin_rate >= 0.45:
        found.append(f"In your shop, {int(round(pin_rate * pin_n))} of {pin_n} earlier orders to this pincode came back")
    elif pin_n >= 6 and pin_rate <= 0.2:
        found.append(f"In your shop, orders to this pincode have mostly been delivered ({pin_n} earlier)")
    if not row["is_cod"]:
        found.append("Prepaid order — the buyer has already paid")

    if score < 40:
        calm = [item for item in found if "refused" not in item and "junk" not in item and "came back" not in item]
        found = calm or found

    if not found:
        found.append("Mixed signals from payment type, order value, and buyer history")
    return found[:3]
