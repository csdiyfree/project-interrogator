from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings(BaseSettings):
    llm_base_url: str = "https://api.highwayapi.ai/openai"
    llm_api_key: str = "sk_xxx"
    llm_models_raw: str = Field(
        "claude-opus-4-6,gpt-5.5,gemini-2.5-pro",
        validation_alias="LLM_MODELS",
    )
    llm_default_model: str = "claude-opus-4-6"
    doc2x_api_key: str = "sk-xxx"
    database_url: str = "sqlite:///./data/app.db"
    cors_origins_raw: str = Field(
        "http://localhost:5173",
        validation_alias="CORS_ORIGINS",
    )

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def llm_models(self) -> list[str]:
        return _split_csv(self.llm_models_raw)

    @property
    def cors_origins(self) -> list[str]:
        return _split_csv(self.cors_origins_raw)


settings = Settings()
