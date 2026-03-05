"""
OCR 路由
POST /api/ocr/image   上传图片（v2.0 GPT-4o Vision）
POST /api/ocr/text    上传识别文本（v1.0 移动端本地OCR后传文本）
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from app.services.ocr_service import analyze_image, parse_ocr_text
from app.models.schemas import OCRResult

router = APIRouter(prefix="/ocr", tags=["OCR"])


class TextOCRRequest(BaseModel):
    raw_text: str


@router.post("/image", response_model=OCRResult, summary="图片 OCR（v2.0）")
async def ocr_image(file: UploadFile = File(...)):
    """
    上传跑步截图，返回结构化跑步数据。
    需要配置 OPENAI_API_KEY。
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "请上传图片文件（jpg/png）")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:   # 10MB 上限
        raise HTTPException(413, "图片文件过大，请压缩后重试")

    result = await analyze_image(image_bytes, file.content_type)
    return result


@router.post("/text", response_model=OCRResult, summary="文本解析 OCR（v1.0）")
async def ocr_text(body: TextOCRRequest):
    """
    v1.0：移动端用 Vision.framework 识别图片后，
    将原始文本传到此接口，后端做结构化解析。
    """
    if not body.raw_text.strip():
        raise HTTPException(400, "文本不能为空")

    result = parse_ocr_text(body.raw_text)
    return result
