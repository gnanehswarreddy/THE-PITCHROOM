import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "PitchRoom AI Backend")
    app_env: str = os.getenv("APP_ENV", "development")
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8002"))

    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
    mongodb_db: str = os.getenv("MONGODB_DB", "pitchroom")

    jwt_secret: str = os.getenv("JWT_SECRET", "change-me")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_exp_minutes: int = int(os.getenv("JWT_EXP_MINUTES", "1440"))

    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_base_url: str = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    gemini_embedding_model: str = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")

    vector_dim: int = int(os.getenv("VECTOR_DIM", "768"))
    near_duplicate_threshold: float = float(os.getenv("NEAR_DUPLICATE_THRESHOLD", "0.95"))

    upload_rate_limit_count: int = int(os.getenv("UPLOAD_RATE_LIMIT_COUNT", "5"))
    upload_rate_limit_window_sec: int = int(os.getenv("UPLOAD_RATE_LIMIT_WINDOW_SEC", "3600"))


settings = Settings()
