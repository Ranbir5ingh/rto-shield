"""Gemma client: a retired model id must fall through, and notes must stay on the order id."""

import asyncio
import json

import httpx

from app import address


def _response(status: int, payload: dict, url: str) -> httpx.Response:
    return httpx.Response(status, json=payload, request=httpx.Request("POST", url))


def test_gemini_falls_through_when_gemma3_is_missing(monkeypatch):
    monkeypatch.setattr(address.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(address.settings, "gemma_model", "gemma-3-27b-it")
    monkeypatch.setattr(address.settings, "ollama_base_url", "")
    monkeypatch.setattr(address, "_working_model", None)
    monkeypatch.setattr(address, "_listed_models", None)
    posts: list[str] = []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, headers=None, json=None):
            posts.append(url)
            if "gemma-3-27b-it" in url:
                return _response(404, {"error": {"status": "NOT_FOUND"}}, url)
            config = (json or {}).get("generationConfig") or {}
            if "thinkingConfig" in config:
                return _response(400, {"error": {"status": "INVALID_ARGUMENT"}}, url)
            body = {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"thought": True, "text": "draft"},
                                {"text": "ok"},
                            ]
                        }
                    }
                ],
                "usageMetadata": {"promptTokenCount": 2, "candidatesTokenCount": 1},
            }
            return _response(200, body, url)

        async def get(self, url, headers=None, params=None):
            return httpx.Response(
                200,
                json={
                    "models": [
                        {
                            "name": "models/gemini-3.8-flash",
                            "supportedGenerationMethods": ["generateContent"],
                        },
                        {
                            "name": "models/gemma-4-26b-a4b-it",
                            "supportedGenerationMethods": ["generateContent"],
                        },
                    ]
                },
                request=httpx.Request("GET", url),
            )

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    text, tokens = asyncio.run(address._gemini("Reply with the single word ok."))
    assert text == "ok"
    assert tokens["gen_ai.request.model"] == "gemma-4-26b-a4b-it"
    assert any("gemma-3-27b-it" in url for url in posts)
    assert any("gemma-4-26b-a4b-it" in url for url in posts)
    assert not any("gemini-3.8-flash" in url for url in posts)


def test_annotate_keeps_notes_when_the_model_rewrites_ids(monkeypatch):
    monkeypatch.setattr(address.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(address.settings, "ollama_base_url", "")

    async def fake_llm(prompt, purpose):
        payload = [
            {
                "id": "rewritten",
                "quality_score": 0.42,
                "incomplete": False,
                "landmark_only": False,
                "junk": "false",
                "pincode_mismatch": False,
                "notes": "door",
            }
        ]
        return json.dumps(payload), "gemini"

    monkeypatch.setattr(address, "_llm", fake_llm)
    orders = [
        {
            "id": "order-1",
            "address": "H.No 12, Lane 4",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
        }
    ]
    done, source, warnings = asyncio.run(address.annotate(orders, llm=True))
    assert warnings == []
    assert source == "gemini"
    quality = done[0]["address_quality"]
    assert quality["source"] == "gemini"
    assert quality["quality_score"] == 0.42
    assert quality["junk"] is False


def test_gemma_ready_tracks_whether_a_call_answered(monkeypatch):
    monkeypatch.setattr(address.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(address.settings, "ollama_base_url", "")
    address.note_gemma("pending")
    assert address.gemma_ready() is None
    address.note_gemma("error", status=404)
    assert address.gemma_ready() is False
    address.note_gemma("ok", origin="gemini", model="gemma-4-26b-a4b-it")
    assert address.gemma_ready() is True
    address.note_gemma("pending")
