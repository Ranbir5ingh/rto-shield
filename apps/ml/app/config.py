import os
from dataclasses import dataclass


@dataclass
class Settings:
    tabpfn_token: str
    tabpfn_max_rows: int
    gemini_api_key: str
    gemma_model: str
    ollama_base_url: str
    ollama_model: str
    sentry_dsn: str
    sentry_traces_sample_rate: float
    internal_token: str
    min_train_rows: int

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            tabpfn_token=os.getenv("TABPFN_TOKEN", "").strip(),
            tabpfn_max_rows=int(os.getenv("TABPFN_MAX_ROWS", "500")),
            gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
            gemma_model=os.getenv("GEMMA_MODEL", "gemma-3-27b-it").strip(),
            ollama_base_url=os.getenv("OLLAMA_BASE_URL", "").strip().rstrip("/"),
            ollama_model=os.getenv("OLLAMA_MODEL", "gemma3:4b").strip(),
            sentry_dsn=os.getenv("SENTRY_DSN", "").strip(),
            sentry_traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.2")),
            internal_token=os.getenv("ML_INTERNAL_TOKEN", "").strip(),
            min_train_rows=int(os.getenv("MIN_TRAIN_ROWS", "30")),
        )


settings = Settings.from_env()
