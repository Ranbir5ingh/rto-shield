"""Address quality. Gemma when configured, otherwise a documented heuristic.

Priority: local Ollama (privacy-max) → Gemma on AI Studio → local rules.
Phone numbers are never part of this payload. The caller must not send them.
"""

from __future__ import annotations

import asyncio
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


# Last real call. /health uses this so the shop notice tracks whether Gemma answers,
# not only whether GEMINI_API_KEY is non-empty.
gemma_status: dict[str, Any] = {"state": "pending"}
_working_model: str | None = None
_listed_models: list[str] | None = None

# Gemini API hosts Gemma 4 under these ids. gemma-3-27b-it 404s on current keys,
# which used to leave every note on the local template.
_FALLBACK_MODELS = (
    "gemma-4-26b-a4b-it",
    "gemma-4-31b-it",
    "gemma-3-27b-it",
    "gemma-3-12b-it",
)


def note_gemma(state: str, **fields: Any) -> None:
    gemma_status.clear()
    gemma_status.update(state=state, **fields)


def gemma_ready() -> bool | None:
    """True after a call answered, False when Gemma cannot, None while the probe is in flight."""
    if not (settings.gemini_api_key or settings.ollama_base_url):
        return False
    state = gemma_status.get("state")
    if state == "ok":
        return True
    if state == "error":
        return False
    return None


def _status_of(exc: Exception) -> int | None:
    response = getattr(exc, "response", None)
    code = getattr(response, "status_code", None)
    return code if isinstance(code, int) else None


def _as_bool(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes"}
    return bool(value)


def _quality_from(item: dict[str, Any], origin: str) -> dict[str, Any]:
    try:
        score = float(item.get("quality_score", 0.5))
    except (TypeError, ValueError):
        score = 0.5
    return {
        "quality_score": score,
        "incomplete": _as_bool(item.get("incomplete")),
        "landmark_only": _as_bool(item.get("landmark_only")),
        "junk": _as_bool(item.get("junk")),
        "pincode_mismatch": _as_bool(item.get("pincode_mismatch")),
        "notes": str(item.get("notes") or "")[:180],
        "source": origin,
    }


async def _post(client: httpx.AsyncClient, url: str, headers: dict[str, str], body: dict[str, Any]) -> httpx.Response:
    """Retry a brief rate limit. A 429 used to drop the rest of a shop's notes."""
    response: httpx.Response | None = None
    for attempt in range(3):
        response = await client.post(url, headers=headers, json=body)
        if response.status_code not in (429, 500, 503) or attempt == 2:
            return response
        await asyncio.sleep(1.5 * (attempt + 1))
    assert response is not None
    return response


def _model_missing(response: httpx.Response) -> bool:
    if response.status_code == 404:
        return True
    if response.status_code != 400:
        return False
    try:
        error = response.json().get("error") or {}
    except Exception:  # noqa: BLE001 — a non-JSON 400 is a bad request, not a missing model
        return False
    blob = f"{error.get('status', '')} {error.get('message', '')}".lower()
    return "not found" in blob or "not supported" in blob


def _model_names() -> list[str]:
    preferred = (settings.gemma_model or "").split("/")[-1].strip()
    pool = [preferred]
    if _working_model:
        pool.insert(0, _working_model)
    pool.extend(_listed_models or [])
    pool.extend(_FALLBACK_MODELS)
    names: list[str] = []
    for name in pool:
        if name and name not in names:
            names.append(name)
    return names


def _bodies(prompt: str) -> list[dict[str, Any]]:
    # thinkingConfig keeps Gemma 4 from spending the whole budget on a hidden trace.
    # Older Gemma builds reject that field, so the next body is the documented plain turn.
    part = {"text": prompt}
    return [
        {
            "contents": [{"parts": [part]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 4096,
                "thinkingConfig": {"thinkingLevel": "minimal"},
            },
        },
        {"contents": [{"parts": [part]}]},
        {"contents": [{"role": "user", "parts": [part]}]},
    ]


def _text_from(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("empty gemma response")
    parts = ((candidates[0].get("content") or {}).get("parts")) or []
    visible = [part.get("text", "") for part in parts if part.get("text") and not part.get("thought")]
    text = "".join(visible).strip() or "".join(part.get("text", "") for part in parts).strip()
    if not text:
        raise RuntimeError("empty gemma response")
    return text


async def _list_gemma_models(client: httpx.AsyncClient) -> list[str]:
    """Models this key can call. Gemini Flash is ignored — address text stays on Gemma."""
    global _listed_models
    if _listed_models is not None:
        return _listed_models
    found: list[str] = []
    page: str | None = None
    try:
        for _ in range(4):
            params: dict[str, str] = {"pageSize": "100"}
            if page:
                params["pageToken"] = page
            response = await client.get(
                "https://generativelanguage.googleapis.com/v1beta/models",
                headers={"x-goog-api-key": settings.gemini_api_key},
                params=params,
            )
            if response.status_code != 200:
                break
            data = response.json()
            for model in data.get("models") or []:
                short = str(model.get("name") or "").split("/")[-1]
                methods = model.get("supportedGenerationMethods") or []
                if "gemma" not in short.lower():
                    continue
                if methods and "generateContent" not in methods:
                    continue
                if short not in found:
                    found.append(short)
            page = data.get("nextPageToken")
            if not page:
                break
    except Exception as exc:  # noqa: BLE001 — listing is a hint, the fallbacks still run
        log.warning("gemma_list_failed %s", type(exc).__name__)
    _listed_models = found
    return found


async def _gemini(prompt: str) -> tuple[str, dict[str, Any]]:
    global _working_model
    headers = {"x-goog-api-key": settings.gemini_api_key}
    bodies = _bodies(prompt)
    last: httpx.Response | None = None
    async with httpx.AsyncClient(timeout=45) as client:
        tried_list = _listed_models is not None
        names = _model_names()
        index = 0
        while index < len(names):
            model = names[index]
            index += 1
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            for body in bodies:
                response = await _post(client, url, headers, body)
                last = response
                if response.status_code == 400:
                    continue
                break
            assert last is not None
            if _model_missing(last):
                if not tried_list:
                    tried_list = True
                    for name in await _list_gemma_models(client):
                        if name not in names:
                            names.append(name)
                continue
            if last.status_code != 200:
                last.raise_for_status()
            data = last.json()
            text = _text_from(data)
            _working_model = model
            usage = data.get("usageMetadata") or {}
            tokens = {
                "gen_ai.usage.input_tokens": usage.get("promptTokenCount"),
                "gen_ai.usage.output_tokens": usage.get("candidatesTokenCount"),
                "gen_ai.request.model": model,
                "gen_ai.system": "google-ai-studio",
            }
            return text, tokens
    if last is not None:
        last.raise_for_status()
    raise RuntimeError("no gemma model")


async def _llm(prompt: str, purpose: str) -> tuple[str, str]:
    try:
        if settings.ollama_base_url:
            with traced("gen_ai.chat", f"gemma.{purpose}", provider="ollama") as box:
                text, tokens = await _ollama(prompt)
                box.update(tokens)
            note_gemma("ok", origin="ollama", model=settings.ollama_model)
            return text, "ollama"
        if settings.gemini_api_key:
            with traced("gen_ai.chat", f"gemma.{purpose}", provider="google-ai-studio") as box:
                text, tokens = await _gemini(prompt)
                box.update(tokens)
            note_gemma("ok", origin="gemini", model=tokens.get("gen_ai.request.model"))
            return text, "gemini"
        note_gemma("unconfigured")
        raise RuntimeError("no gemma provider")
    except Exception as exc:
        # A later batch can still succeed. Don't wipe a good probe, or the unconfigured state.
        if gemma_status.get("state") not in {"ok", "unconfigured"}:
            note_gemma("error", error=type(exc).__name__, status=_status_of(exc))
        raise


async def probe_gemma() -> None:
    """One cheap call so /health can say whether Gemma answers."""
    if not (settings.gemini_api_key or settings.ollama_base_url):
        note_gemma("unconfigured")
        return
    try:
        await _llm("Reply with the single word ok.", "probe")
    except Exception as exc:  # noqa: BLE001 — the status is the point of the probe
        log.warning("gemma_probe_failed %s status=%s", type(exc).__name__, _status_of(exc))


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
    source = "heuristic"
    batch_size = 8
    for start in range(0, len(orders), batch_size):
        chunk = orders[start : start + batch_size]
        try:
            text, origin = await _llm(_address_prompt(chunk), "address_quality")
            try:
                parsed = _parse_json(text)
            except json.JSONDecodeError:
                text, origin = await _llm(
                    _address_prompt(chunk) + "\nReturn ONLY the JSON array.",
                    "address_quality",
                )
                parsed = _parse_json(text)
            if isinstance(parsed, dict):
                parsed = parsed.get("addresses") or parsed.get("results") or [parsed]
            items = [item for item in parsed if isinstance(item, dict)]
            ids = {str(order["id"]) for order in chunk}
            matched: dict[str, dict[str, Any]] = {}
            for item in items:
                if "id" in item and str(item["id"]) in ids:
                    matched[str(item["id"])] = _quality_from(item, origin)
            # Some completions rewrite the id. Same length still lines up with the batch.
            if not matched and len(items) == len(chunk):
                for order, item in zip(chunk, items, strict=True):
                    matched[str(order["id"])] = _quality_from(item, origin)
            if matched:
                source = origin
                by_id.update(matched)
        except Exception as exc:  # noqa: BLE001 — degrade per batch
            log.warning("address_llm_failed %s status=%s", type(exc).__name__, _status_of(exc))
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
