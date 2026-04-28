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

    # 阿里云通义千问（OCR 优先使用）
    DASHSCOPE_API_KEY: str = ""

    # DeepSeek（教练解读 LLM）
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-chat"   # deepseek-chat = V3
    COACH_TIMEOUT_SEC: float = 8.0           # 超时后降级到规则引擎文案

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
