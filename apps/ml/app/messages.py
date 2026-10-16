"""Confirmation copy in Hindi, Hinglish, and English.

Voice scripts sent onward to a closed TTS API must not contain a phone number
or a street address. Templates below follow that rule. Gemma may draft the
WhatsApp text; the voice line is rewritten to the safe template.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.address import _llm, _parse_json
from app.config import settings

log = logging.getLogger("rto.ml")

_PHONE = re.compile(r"(\+?\d[\d\-\s]{8,}\d)")


def safe_voice_script(shop: str, amount: int) -> str:
    shop_clean = re.sub(r"\s+", " ", shop).strip()[:40] or "hamari dukaan"
    return (
        f"नमस्ते। {shop_clean} से {amount} रुपये के कैश ऑन डिलीवरी ऑर्डर की पुष्टि करनी है। "
        "डिलीवरी लेनी हो तो हाँ बोलिए। रद्द करना हो तो ना बोलिए।"
    )


def template_messages(shop: str, order: dict[str, Any]) -> dict[str, str]:
    name = (order.get("first_name") or "ji").strip()[:40] or "ji"
    amount = int(round(float(order.get("order_value") or 0)))
    product = (order.get("product_name") or "order").strip()[:40]
    shop_clean = shop.strip()[:40] or "our shop"
    hindi = (
        f"नमस्ते {name} जी, {shop_clean} से। आपका ₹{amount} का कैश ऑन डिलीवरी ऑर्डर "
        f"({product}) पैक हो गया है। डिलीवरी स्वीकार करेंगे तो YES लिखें, रद्द करना हो तो NO।"
    )
    hinglish = (
        f"Namaste {name} ji, {shop_clean} se. Aapka COD order ₹{amount} ({product}) pack ho gaya hai. "
        "Delivery accept karoge toh YES reply kijiye, cancel karna ho toh NO."
    )
    english = (
        f"Hi {name}, this is {shop_clean}. Your cash-on-delivery order of ₹{amount} ({product}) is packed. "
        "Reply YES to accept delivery or NO to cancel, so we don't ship an order that would come back."
    )
    nudge = (
        f"Optional: pay ₹{amount} by UPI now and we will mark this order prepaid so it is not refused at the door. "
        f"Reply PREPAID and {shop_clean} will share the UPI id."
    )
    return {
        "hindi": hindi,
        "hinglish": hinglish,
        "english": english,
        "prepaid_nudge": nudge,
        "voice_script_hi": safe_voice_script(shop_clean, amount),
        "source": "template",
    }


def _scrub(text: str, fallback: str) -> str:
    if _PHONE.search(text or ""):
        return fallback
    return (text or fallback).strip()[:500]


async def generate_messages(shop: str, orders: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str, list[str]]:
    warnings: list[str] = []
    templates = {str(order["id"]): template_messages(shop, order) for order in orders}
    if not orders:
        return [], "template", warnings
    if not (settings.ollama_base_url or settings.gemini_api_key):
        warnings.append(
            "Confirmation text used built-in templates. Set OLLAMA_BASE_URL or GEMINI_API_KEY for Gemma."
        )
        return [_with_id(oid, msg) for oid, msg in templates.items()], "template", warnings

    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    source = "template"
    # Small batches so a long completion is not cut off mid-JSON.
    for start in range(0, len(orders), 6):
        chunk = orders[start : start + 6]
        rows = [
            {k: order.get(k) for k in ("id", "first_name", "order_value", "product_name", "payment_type")}
            for order in chunk
        ]
        prompt = (
            "Write short WhatsApp messages for an Indian seller confirming cash-on-delivery. "
            "Return ONLY a JSON array of objects with keys id, hindi, hinglish, english, prepaid_nudge. "
            "Each message under 320 characters. Ask for YES to accept or NO to cancel. "
            "Do not include phone numbers or street addresses. No markdown.\n"
            f"Shop: {shop}\n"
            f"Orders: {json.dumps(rows, ensure_ascii=False)}"
        )
        try:
            text, origin = await _llm(prompt, "confirmation_messages")
            try:
                parsed = _parse_json(text)
            except json.JSONDecodeError:
                text, origin = await _llm(prompt + "\nReturn ONLY the JSON array.", "confirmation_messages")
                parsed = _parse_json(text)
            if isinstance(parsed, dict):
                parsed = parsed.get("messages") or parsed.get("orders") or []
            items = [item for item in parsed if isinstance(item, dict)]
            paired: list[tuple[str, dict[str, Any]]] = []
            for item in items:
                if "id" not in item:
                    continue
                oid = str(item["id"])
                if oid in templates:
                    paired.append((oid, item))
            if not paired and len(items) == len(chunk):
                paired = [(str(order["id"]), item) for order, item in zip(chunk, items, strict=True)]
            for oid, item in paired:
                base = templates[oid]
                amount = int(round(float(next(order["order_value"] for order in orders if str(order["id"]) == oid))))
                seen.add(oid)
                source = origin
                merged.append(
                    {
                        "id": oid,
                        "hindi": _scrub(str(item.get("hindi") or ""), base["hindi"]),
                        "hinglish": _scrub(str(item.get("hinglish") or ""), base["hinglish"]),
                        "english": _scrub(str(item.get("english") or ""), base["english"]),
                        "prepaid_nudge": _scrub(str(item.get("prepaid_nudge") or ""), base["prepaid_nudge"]),
                        "voice_script_hi": safe_voice_script(shop, amount),
                        "source": origin,
                    }
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("message_llm_failed %s", type(exc).__name__)
            warnings.append(f"Gemma message draft failed ({type(exc).__name__}); used templates.")
    for oid, base in templates.items():
        if oid not in seen:
            merged.append(_with_id(oid, base))
    return merged, source, warnings


def _with_id(oid: str, msg: dict[str, str]) -> dict[str, Any]:
    return {"id": oid, **msg}
