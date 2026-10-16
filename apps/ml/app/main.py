"""FastAPI ML service for RTO Shield."""

from __future__ import annotations

import logging
import os
from typing import Any, Literal

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.address import annotate
from app.config import settings
from app.messages import generate_messages
from app.predictors import health_payload, score_orders
from app.tracing import init_sentry, traced

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
init_sentry()

# Browser wake-up pings come from the web app. Predict and messages stay server-to-server.
DEFAULT_CORS_ORIGINS = (
    "https://www.rtoshield.tech",
    "https://rtoshield.tech",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)


def cors_origins() -> list[str]:
    extra = [part.strip() for part in os.getenv("ML_CORS_ORIGINS", "").split(",") if part.strip()]
    seen: list[str] = []
    for origin in [*DEFAULT_CORS_ORIGINS, *extra]:
        if origin not in seen:
            seen.append(origin)
    return seen


app = FastAPI(title="RTO Shield ML", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
)


class OrderIn(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    order_value: float = Field(ge=0, le=1_000_000)
    is_cod: bool
    hour: int = Field(ge=0, le=23)
    prior_orders: int = Field(ge=0, le=10_000)
    prior_rtos: int = Field(ge=0, le=10_000)
    address: str = Field(default="", max_length=500)
    city: str = Field(default="", max_length=80)
    state: str = Field(default="", max_length=80)
    pincode: str = Field(default="", max_length=12)
    seller_pin_rto_rate: float = Field(default=0.3, ge=0, le=1)
    seller_pin_n: int = Field(default=0, ge=0, le=100_000)
    label: int | None = Field(default=None, ge=0, le=1)


class PredictRequest(BaseModel):
    history: list[OrderIn] = Field(default_factory=list, max_length=5000)
    pending: list[OrderIn] = Field(default_factory=list, max_length=500)
    speed: Literal["full", "fast"] = "full"


class MessageOrder(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    first_name: str = Field(default="ji", max_length=40)
    order_value: float = Field(ge=0, le=1_000_000)
    product_name: str = Field(default="order", max_length=80)
    payment_type: str = Field(default="cod", max_length=20)


class MessageRequest(BaseModel):
    shop_name: str = Field(min_length=1, max_length=80)
    orders: list[MessageOrder] = Field(max_length=100)


def _guard(token: str | None) -> None:
    if settings.internal_token and token != settings.internal_token:
        raise HTTPException(status_code=401, detail="Invalid internal token")


@app.get("/health")
def health() -> dict[str, Any]:
    # Public and unauthenticated, even when ML_INTERNAL_TOKEN is set.
    # health_payload only checks whether optional packages exist. It does not import or fit a model.
    return health_payload()


@app.post("/v1/predict")
async def predict(
    body: PredictRequest,
    x_internal_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _guard(x_internal_token)
    history = [row.model_dump() for row in body.history]
    pending = [row.model_dump() for row in body.pending]
    with traced(
        "gen_ai.invoke_agent",
        "invoke_agent rto.score",
        **{
            "gen_ai.operation.name": "invoke_agent",
            "gen_ai.system": "rto-shield",
            "gen_ai.request.model": "tabpfn-or-fallback",
            "rows_history": len(history),
            "rows_pending": len(pending),
        },
    ):
        # Address text stays inside this service. Only quality flags enter the model matrix.
        fast = body.speed == "fast"
        annotated_history, source_h, warn_h = await annotate(history, llm=False if fast else None)
        annotated_pending, source_p, warn_p = await annotate(pending, llm=False if fast else None)
        result = score_orders(annotated_history, annotated_pending, fast=fast)
    result["address_source"] = source_p if pending else source_h
    result["warnings"] = [*warn_h, *warn_p, *result["warnings"]]
    # Do not echo raw addresses back.
    for row in result["predictions"]:
        quality = row.get("address_quality") or {}
        quality.pop("address", None)
    return result


@app.post("/v1/messages")
async def messages(
    body: MessageRequest,
    x_internal_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _guard(x_internal_token)
    rows, source, warnings = await generate_messages(body.shop_name, [o.model_dump() for o in body.orders])
    return {"source": source, "warnings": warnings, "messages": rows}
