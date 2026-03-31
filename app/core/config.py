from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "WatchTowerX"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/watchtowerx"
    REDIS_URL: str = "redis://localhost:6379"

    DEFAULT_CHECK_INTERVAL_MINUTES: int = 5

    class Config:
        env_file = ".env"


settings = Settings()
