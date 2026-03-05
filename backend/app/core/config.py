"""
RunForge 后端配置
Python 3.12
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 应用基础
    APP_NAME: str = "RunForge API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # OpenAI（OCR v2.0 使用）
    OPENAI_API_KEY: str = ""

    # Supabase（v2.0 引入云端DB时使用）
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # CORS 允许的前端来源
    ALLOWED_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
