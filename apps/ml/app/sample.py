"""Synthetic Indian COD history with planted, plausible RTO correlations.

Used by the offline eval. The API has a matching generator so the product works
when this service is down; the numbers in the README come from this file.
"""

from __future__ import annotations

import math
import random
from typing import Any

from app.features import probability_from_logit

FIRST = [
    "Aarav", "Ananya", "Rohan", "Priya", "Mohammed", "Fatima", "Sneha", "Vikram",
    "Pooja", "Amit", "Kavya", "Rahul", "Neha", "Arjun", "Divya", "Imran", "Kiran",
    "Meera", "Sanjay", "Lakshmi", "Harsh", "Iqra", "Nikhil", "Ayesha", "Deepak",
]
LAST = [
    "Sharma", "Verma", "Patel", "Reddy", "Iyer", "Khan", "Singh", "Gupta", "Nair",
    "Das", "Joshi", "Chowdhury", "Bose", "Yadav", "Kulkarni", "Sheikh", "Banerjee",
]
PLACES = [
    ("Mumbai", "Maharashtra", ["400001", "400014", "400058", "400092"]),
    ("Delhi", "Delhi", ["110001", "110059", "110085", "110092"]),
    ("Bengaluru", "Karnataka", ["560001", "560038", "560076", "560100"]),
    ("Jaipur", "Rajasthan", ["302001", "302012", "302017", "302021"]),
    ("Lucknow", "Uttar Pradesh", ["226001", "226010", "226016", "226024"]),
    ("Kolkata", "West Bengal", ["700001", "700019", "700091", "700156"]),
    ("Hyderabad", "Telangana", ["500001", "500028", "500081", "500090"]),
    ("Ahmedabad", "Gujarat", ["380001", "380015", "380054", "380061"]),
    ("Patna", "Bihar", ["800001", "800014", "800020", "800025"]),
    ("Indore", "Madhya Pradesh", ["452001", "452010", "452016", "453331"]),
]
PRODUCTS = ["Cotton kurti", "Daily saree", "Mobile cover", "Oxidised earrings", "Steel tiffin", "Kids frock"]
LANDMARKS = ["Hanuman mandir", "SBI ATM", "purana bus stand", "paani ki tanki", "red gate", "Shiv mandir"]
STREETS = ["Gali no 4", "Lane 2, Shastri Nagar", "Main Market", "Sector 7", "Teachers Colony", "Rajiv Chowk"]


def _logit(order: dict[str, Any]) -> float:
    is_cod = 1.0 if order["is_cod"] else 0.0
    prior = order["prior_orders"]
    rate = (order["prior_rtos"] / prior) if prior else 0.0
    value = order["order_value"]
    z = -1.55
    z += 1.45 * is_cod
    z += 0.95 * (1.0 if is_cod and value >= 1500 else 0.0)
    z += 0.85 * (1.0 if prior == 0 and is_cod else 0.0)
    z += 1.15 * rate * (1.0 if prior else 0.0)
    z += 0.85 * float(order["addr_incomplete"])
    z += 0.75 * float(order["addr_landmark"])
    z += 1.25 * float(order["addr_junk"])
    z += 0.55 * float(order["addr_mismatch"])
    hour = order["hour"]
    z += 0.35 * (1.0 if hour >= 22 or hour <= 5 else 0.0)
    z -= 1.1 * (1 - is_cod)
    if prior >= 3 and rate < 0.15 and order["addr_quality"] >= 0.7:
        z -= 0.45
    return z


def generate(n_history: int = 360, n_pending: int = 24, seed: int = 42) -> dict[str, list[dict[str, Any]]]:
    rng = random.Random(seed)
    rows: list[dict[str, Any]] = []
    total = n_history + n_pending
    for i in range(total):
        place = PLACES[i % len(PLACES)]
        city, state, pins = place
        kind_roll = rng.random()
        # Address mix: mostly usable, some weak, a few junk. Weak addresses correlate with RTO via the logit.
        if kind_roll < 0.62:
            house = rng.randint(1, 240)
            address = f"H.No {house}, {rng.choice(STREETS)}, {city}"
            flags = dict(addr_quality=0.9, addr_incomplete=0, addr_landmark=0, addr_junk=0, addr_mismatch=0)
        elif kind_roll < 0.78:
            address = f"near {rng.choice(LANDMARKS)}"
            flags = dict(addr_quality=0.35, addr_incomplete=1, addr_landmark=1, addr_junk=0, addr_mismatch=0)
        elif kind_roll < 0.9:
            address = rng.choice(["asdf", "test", "xxx", city[:4]])
            flags = dict(addr_quality=0.08, addr_incomplete=1, addr_landmark=0, addr_junk=1, addr_mismatch=0)
        else:
            other = PLACES[(i + 3) % len(PLACES)]
            address = f"H.No {rng.randint(1, 80)}, {rng.choice(STREETS)}, {other[0]}"
            flags = dict(addr_quality=0.45, addr_incomplete=0, addr_landmark=0, addr_junk=0, addr_mismatch=1)
        is_cod = rng.random() < 0.78
        if rng.random() < 0.45:
            prior_orders = 0
            prior_rtos = 0
        else:
            prior_orders = rng.randint(1, 8)
            # Some buyers are repeat refusers.
            base = 0.55 if rng.random() < 0.18 else 0.12
            prior_rtos = sum(1 for _ in range(prior_orders) if rng.random() < base)
        value = rng.choice([299, 399, 499, 649, 799, 999, 1299, 1599, 1899, 2499, 3499])
        hour_pool = [11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 0, 1]
        hour = rng.choice(hour_pool)
        order = {
            "id": f"S{i:04d}",
            "buyer_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
            "phone": f"9{rng.randint(100000000, 999999999)}",
            "address": address,
            "city": city,
            "state": state,
            "pincode": rng.choice(pins),
            "order_value": value,
            "is_cod": is_cod,
            "payment_type": "cod" if is_cod else "prepaid",
            "hour": hour,
            "prior_orders": prior_orders,
            "prior_rtos": prior_rtos,
            "product_name": rng.choice(PRODUCTS),
            "stage": "history" if i < n_history else "pending",
            **flags,
        }
        p = probability_from_logit(_logit(order))
        order["rto_probability"] = round(p, 4)
        if order["stage"] == "history":
            order["label"] = 1 if rng.random() < p else 0
        else:
            order["label"] = None
        rows.append(order)
    return {
        "history": [r for r in rows if r["stage"] == "history"],
        "pending": [r for r in rows if r["stage"] == "pending"],
    }


def outcome_rates(history: list[dict[str, Any]]) -> dict[str, float]:
    def rate(rows: list[dict[str, Any]]) -> float:
        if not rows:
            return 0.0
        return sum(int(r["label"] or 0) for r in rows) / len(rows)

    cod = [r for r in history if r["is_cod"]]
    prepaid = [r for r in history if not r["is_cod"]]
    return {"cod_rto_rate": rate(cod), "prepaid_rto_rate": rate(prepaid), "n": float(len(history))}


def sigmoid_check() -> float:
    return 1 / (1 + math.exp(-0))
