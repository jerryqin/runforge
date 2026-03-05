"""
RunForge FastAPI 主应用
Python 3.12 + FastAPI
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import ocr, analysis

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="RunForge 跑步数据分析 API",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS（开发阶段允许所有来源）─────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 路由注册 ────────────────────────────────────────────
app.include_router(ocr.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")


@app.get("/", tags=["健康检查"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["健康检查"])
async def health():
    return {"status": "ok"}
