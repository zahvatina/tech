from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://rmo:rmo@localhost:5432/rmo"
    cors_origins: str = "*"  # comma-separated or *
    api_key: str = "dev-key"


settings = Settings()
