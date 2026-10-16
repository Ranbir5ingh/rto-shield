"""Address quality. Gemma when configured, otherwise a documented heuristic.

Priority: local Ollama (privacy-max) → Gemma on AI Studio → local rules.
Phone numbers are never part of this payload. The caller must not send them.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import settings
from app.tracing import traced

log = logging.getLogger("rto.ml")

_JUNK = ("asdf", "qwerty", "test", "xxx", "fake", "none", "n/a", "na", "abc123", "null")


def _junk_token(low: str) -> bool:
    """Match junk as a whole token. 'na' must not fire inside nagar, patna, or purana."""
    tokens = set(re.findall(r"[a-z0-9]+", low))
    if any(token in tokens for token in _JUNK):
        return True
    return "n/a" in low


_LANDMARK = ("near ", "opp ", "opp.", "opposite", "behind", "ke paas", "ke pass", "ke samne", "samne", "nearby")
_KNOWN_CITIES = {
    "mumbai": "maharashtra",
    "delhi": "delhi",
    "new delhi": "delhi",
    "bengaluru": "karnataka",
    "bangalore": "karnataka",
    "jaipur": "rajasthan",
    "lucknow": "uttar pradesh",
    "kolkata": "west bengal",
    "hyderabad": "telangana",
    "ahmedabad": "gujarat",
    "patna": "bihar",
    "indore": "madhya pradesh",
    "pune": "maharashtra",
    "chennai": "tamil nadu",
    "surat": "gujarat",
}


def heuristic_address(address: str, pincode: str, city: str, state: str) -> dict[str, Any]:
    text = (address or "").strip()
    low = re.sub(r"\s+", " ", text.lower())
    has_number = bool(re.search(r"\d", text))
    junk = (
        len(text) < 4
        or text.isdigit()
        or _junk_token(low)
        or len(set(low.replace(" ", ""))) <= 2
    )
    landmark_only = (not has_number) and any(w in low for w in _LANDMARK)
    word_count = len([w for w in low.split(" ") if w])
    incomplete = (not junk) and (len(text) < 18 or (not has_number and word_count < 4 and not landmark_only))
    pins = re.findall(r"\b[1-9][0-9]{5}\b", text)
    mismatch = any(p != (pincode or "") for p in pins)
    city_l = (city or "").strip().lower()
    state_l = (state or "").strip().lower()
    # If the address names a different well-known city than the city field, flag it.
    for known, known_state in _KNOWN_CITIES.items():
        if known in low and city_l and known not in city_l and city_l not in known:
            mismatch = True
            break
        if known == city_l and state_l and known_state not in state_l and state_l not in known_state:
            # State field disagrees with the city the seller typed. Data quality, not a region score.
            if len(state_l) > 1:
                mismatch = True
    quality = 1.0
    if junk:
        quality -= 0.75
    if incomplete:
        quality -= 0.35
    if landmark_only:
        quality -= 0.3
    if mismatch:
        quality -= 0.25
    if not text:
        quality = 0.05
        incomplete = True
    quality = max(0.0, min(1.0, quality))
    notes = []
    if junk:
        notes.append("junk")
    if incomplete:
        notes.append("incomplete")
    if landmark_only:
        notes.append("landmark")
    if mismatch:
        notes.append("mismatch")
    return {
        "quality_score": round(quality, 3),
        "incomplete": bool(incomplete or junk),
        "landmark_only": bool(landmark_only),
        "junk": bool(junk),
        "pincode_mismatch": bool(mismatch),
        "notes": ", ".join(notes) or "ok",
        "source": "heuristic",
    }


def _parse_json(text: str) -> Any:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"(\[.*\]|\{.*\})", cleaned, re.S)
        if not match:
            raise
        return json.loads(match.group(1))


async def _ollama(prompt: str) -> tuple[str, dict[str, Any]]:
    url = f"{settings.ollama_base_url}/api/chat"
    body = {
        "model": settings.ollama_model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.1},
    }
    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(url, json=body)
        response.raise_for_status()
        data = response.json()
    text = (data.get("message") or {}).get("content") or ""
    tokens = {
        "gen_ai.usage.input_tokens": data.get("prompt_eval_count"),
        "gen_ai.usage.output_tokens": data.get("eval_count"),
        "gen_ai.request.model": settings.ollama_model,
        "gen_ai.system": "ollama",
    }
    return text, tokens


async def _gemini(prompt: str) -> tuple[str, dict[str, Any]]:
    model = settings.gemma_model or "gemma-3-27b-it"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    # Gemma on AI Studio accepts a plain user turn. generationConfig is optional and
    # some Gemma builds reject it, so a 400 retries without it.
    bodies = [
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048},
        },
        {"contents": [{"parts": [{"text": prompt}]}]},
    ]
    headers = {"x-goog-api-key": settings.gemini_api_key}
    async with httpx.AsyncClient(timeout=45) as client:
        response = None
        for body in bodies:
            response = await client.post(url, params={"key": settings.gemini_api_key}, headers=headers, json=body)
            if response.status_code != 400:
                break
        assert response is not None
        response.raise_for_status()
        data = response.json()
    parts = data["candidates"][0]["content"]["parts"]
    text = "".join(part.get("text", "") for part in parts)
    usage = data.get("usageMetadata") or {}
    tokens = {
        "gen_ai.usage.input_tokens": usage.get("promptTokenCount"),
        "gen_ai.usage.output_tokens": usage.get("candidatesTokenCount"),
        "gen_ai.request.model": model,
        "gen_ai.system": "google-ai-studio",
    }
    return text, tokens


async def _llm(prompt: str, purpose: str) -> tuple[str, str]:
    if settings.ollama_base_url:
        with traced("gen_ai.chat", f"gemma.{purpose}", provider="ollama") as box:
            text, tokens = await _ollama(prompt)
            box.update(tokens)
        return text, "ollama"
    if settings.gemini_api_key:
        with traced("gen_ai.chat", f"gemma.{purpose}", provider="google-ai-studio") as box:
            text, tokens = await _gemini(prompt)
            box.update(tokens)
        return text, "gemini"
    raise RuntimeError("no gemma provider")


def _address_prompt(rows: list[dict[str, Any]]) -> str:
    payload = [
        {
            "id": row["id"],
            "address": (row.get("address") or "")[:400],
            "city": row.get("city") or "",
            "state": row.get("state") or "",
            "pincode": row.get("pincode") or "",
        }
        for row in rows
    ]
    return (
        "You score Indian COD delivery addresses for whether a courier can find the door. "
        "Return ONLY a JSON array with one object per id: "
        '{"id": string, "quality_score": number between 0 and 1, "incomplete": boolean, '
        '"landmark_only": boolean, "junk": boolean, "pincode_mismatch": boolean, "notes": short}. '
        "junk = empty, keyboard mash, or not an address. landmark_only = only 'near X' with no house number. "
        "pincode_mismatch = the text contains a different PIN or a different city than the fields. "
        "Do not repeat the raw address in notes. No markdown.\n"
        f"Addresses:\n{json.dumps(payload, ensure_ascii=False)}"
    )


def apply_quality(order: dict[str, Any], quality: dict[str, Any]) -> dict[str, Any]:
    merged = dict(order)
    merged["addr_quality"] = float(quality["quality_score"])
    merged["addr_incomplete"] = bool(quality["incomplete"])
    merged["addr_landmark"] = bool(quality["landmark_only"])
    merged["addr_junk"] = bool(quality["junk"])
    merged["addr_mismatch"] = bool(quality["pincode_mismatch"])
    merged["address_quality"] = quality
    return merged


async def annotate(
    orders: list[dict[str, Any]],
    *,
    llm: bool | None = None,
) -> tuple[list[dict[str, Any]], str, list[str]]:
    warnings: list[str] = []
    if not orders:
        return [], "heuristic", warnings
    # llm=False is the fast path: never wait on Gemma while the shop is waiting.
    configured = bool(settings.ollama_base_url or settings.gemini_api_key)
    use_llm = configured if llm is None else bool(llm and configured)
    if not use_llm:
        done = [apply_quality(order, heuristic_address(order.get("address", ""), order.get("pincode", ""), order.get("city", ""), order.get("state", ""))) for order in orders]
        note = (
            "Address quality used local rules."
            if llm is False
            else "Address quality used local rules. Set OLLAMA_BASE_URL (privacy-max) or GEMINI_API_KEY for Gemma."
        )
        return done, "heuristic", [note]

    by_id: dict[str, dict[str, Any]] = {}
    source = "ollama" if settings.ollama_base_url else "gemini"
    batch_size = 12
    for start in range(0, len(orders), batch_size):
        chunk = orders[start : start + batch_size]
        try:
            text, origin = await _llm(_address_prompt(chunk), "address_quality")
            source = origin
            parsed = _parse_json(text)
            if isinstance(parsed, dict):
                parsed = parsed.get("addresses") or parsed.get("results") or [parsed]
            for item in parsed:
                if isinstance(item, dict) and "id" in item:
                    by_id[str(item["id"])] = {
                        "quality_score": float(item.get("quality_score", 0.5)),
                        "incomplete": bool(item.get("incomplete")),
                        "landmark_only": bool(item.get("landmark_only")),
                        "junk": bool(item.get("junk")),
                        "pincode_mismatch": bool(item.get("pincode_mismatch")),
                        "notes": str(item.get("notes") or "")[:180],
                        "source": origin,
                    }
        except Exception as exc:  # noqa: BLE001 — degrade per batch
            log.warning("address_llm_failed %s", type(exc).__name__)
            warnings.append(f"Gemma address scoring failed ({type(exc).__name__}); used local rules for a batch.")

    done = []
    for order in orders:
        quality = by_id.get(str(order["id"]))
        if quality is None:
            quality = heuristic_address(
                order.get("address", ""),
                order.get("pincode", ""),
                order.get("city", ""),
                order.get("state", ""),
            )
        else:
            # Clamp model output so a bad completion cannot explode the score.
            quality["quality_score"] = max(0.0, min(1.0, float(quality["quality_score"])))
        done.append(apply_quality(order, quality))
    return done, source, warnings
