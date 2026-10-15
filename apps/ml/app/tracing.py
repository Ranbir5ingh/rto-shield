"""Sentry spans for TabPFN and Gemma. Logs the same fields when no DSN is set."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Any, Iterator

import sentry_sdk

from app.config import settings

log = logging.getLogger("rto.ml")


def init_sentry() -> None:
    if not settings.sentry_dsn:
        log.info("sentry_disabled", extra={"reason": "SENTRY_DSN unset"})
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
    )
    log.info("sentry_enabled")


@contextmanager
def traced(op: str, name: str, **fields: Any) -> Iterator[dict[str, Any]]:
    """Record latency and token counts. Callers may add keys to the yielded dict."""
    box: dict[str, Any] = {}
    start = time.perf_counter()
    client = sentry_sdk.get_client()
    enabled = client is not None and client.is_active()
    if enabled:
        with sentry_sdk.start_span(op=op, name=name) as span:
            try:
                yield box
            finally:
                _finish(span, start, fields, box, name, op)
    else:
        try:
            yield box
        finally:
            _finish(None, start, fields, box, name, op)


def _finish(span: Any, start: float, fields: dict[str, Any], box: dict[str, Any], name: str, op: str) -> None:
    latency_ms = round((time.perf_counter() - start) * 1000, 2)
    payload = {"latency_ms": latency_ms, **fields, **box}
    if span is not None:
        for key, value in payload.items():
            if value is not None:
                span.set_data(key, value)
    # Never log prompts or addresses — only operational counters.
    log.info("span %s %s %s", op, name, {k: v for k, v in payload.items() if v is not None})
