"""
RunForge OCR 服务
v1.0：正则解析（处理 Keep / Apple Watch 等规则截图）
v2.0：多模型 Vision OCR（通义千问优先，GPT-4o 备份）
接口保持不变，切换只需改环境变量
"""
from __future__ import annotations
import re
import base64
import logging
from typing import Optional

from app.models.schemas import OCRResult
from app.core.config import get_settings

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════
# 协议（Interface）：所有OCR实现必须实现此函数签名
# ════════════════════════════════════════════════════
async def analyze_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> OCRResult:
    """
    统一入口：根据配置自动选择 OCR 实现
    优先级：通义千问 > GPT-4o > 降级提示
    """
    settings = get_settings()
    
    # 优先使用通义千问
    if settings.DASHSCOPE_API_KEY:
        logger.info("使用通义千问 VL OCR（优先）")
        result = await _qwen_vision_ocr(image_bytes, mime_type)
        if result.confidence > 0:
            return result
        logger.warning("通义千问 OCR 失败，降级到 GPT-4o")
    
    # 降级到 GPT-4o
    if settings.OPENAI_API_KEY:
        logger.info("使用 GPT-4o Vision OCR")
        return await _gpt_vision_ocr(image_bytes, mime_type)
    
    # 都没配置
    logger.warning("未配置任何 Vision OCR 引擎")
    return _regex_ocr_not_available()


# ════════════════════════════════════════════════════
# v1.0：正则解析（移动端识别后传文本，后端做结构化）
# ════════════════════════════════════════════════════
def parse_ocr_text(raw_text: str) -> OCRResult:
    """
    从 OCR 识别的原始文本中提取跑步数据
    支持 Keep / Apple Watch / Garmin 截图格式
    """
    result = OCRResult(raw_text=raw_text)
    confidence_score = 0.0

    # 距离：10.16 公里 / 10.16km
    m = re.search(r"(\d+\.?\d*)\s*(?:公里|km)", raw_text, re.IGNORECASE)
    if m:
        result.distance = float(m.group(1))
        confidence_score += 0.25

    # 配速：6'27" 或 6:27/KM 或 6分27秒
    m = re.search(r"(\d+)'(\d{2})\"", raw_text)
    if not m:
        m = re.search(r"(\d+):(\d{2})\s*/?\s*[kK][mM]", raw_text)
    if not m:
        m = re.search(r"(\d+)分(\d{2})秒", raw_text)
    if m:
        pace_min, pace_sec = int(m.group(1)), int(m.group(2))
        result.avg_pace = pace_min * 60 + pace_sec
        result.avg_pace_str = f"{pace_min}'{pace_sec:02d}\""
        confidence_score += 0.2

    # 时长：01:05:33 / 1小时5分33秒
    m = re.search(r"(\d{1,2}):(\d{2}):(\d{2})", raw_text)
    if m:
        h, mn, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
        result.duration_sec = h * 3600 + mn * 60 + s
        result.duration_str = f"{h:02d}:{mn:02d}:{s:02d}"
        confidence_score += 0.2

    # 心率：131 bpm / 平均心率 131 / 131\n平均心率（Keep 格式：数字在标签前）
    m = re.search(r"(?:平均心率|心率)\D{0,5}(\d{2,3})", raw_text)
    if not m:
        m = re.search(r"(\d{2,3})\s*\n?\s*(?:平均心率|心率)", raw_text)
    if not m:
        m = re.search(r"(\d{2,3})\s*(?:bpm|BPM)", raw_text)
    if m:
        hr = int(m.group(1))
        if 40 <= hr <= 220:
            result.avg_hr = hr
            confidence_score += 0.2

    # 日期：2026年2月22日 / 2026-02-22
    m = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", raw_text)
    if not m:
        m = re.search(r"(\d{4})-(\d{2})-(\d{2})", raw_text)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        result.run_date = f"{y}-{mo:02d}-{d:02d}"
        confidence_score += 0.1

    # 步频：178 步/分钟 / 178\n平均步频（Keep 格式）
    m = re.search(r"(\d{2,3})\s*(?:步/分钟|spm|SPM)", raw_text)
    if not m:
        m = re.search(r"(\d{2,3})\s*\n?\s*(?:平均步频|步频)", raw_text)
    if m:
        result.cadence = int(m.group(1))

    # 卡路里
    m = re.search(r"(\d+\.?\d*)\s*千卡", raw_text)
    if m:
        result.calories = float(m.group(1))

    result.confidence = round(min(confidence_score, 1.0), 2)
    return result


def _regex_ocr_not_available() -> OCRResult:
    """当移动端没有传文本，只传图片，但未配置 GPT 时的降级处理"""
    return OCRResult(confidence=0.0, raw_text="请配置 OPENAI_API_KEY 以启用图片 OCR")


# ════════════════════════════════════════════════════
# v2.0：GPT-4o Vision OCR
# ════════════════════════════════════════════════════
async def _gpt_vision_ocr(image_bytes: bytes, mime_type: str) -> OCRResult:
    """
    调用 GPT-4o Vision 识别跑步截图
    返回结构化数据
    """
    import openai
    settings = get_settings()

    client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    prompt = """
    这是一张跑步 App 的运动记录截图。请提取以下信息，以 JSON 格式返回：
    {
      "distance_km": 数字或null,
      "duration_str": "HH:MM:SS" 或 null,
      "avg_pace_str": "M'SS\"" 格式 或 null,
      "avg_hr": 整数 或 null,
      "run_date": "YYYY-MM-DD" 或 null,
      "cadence": 步频整数 或 null,
      "calories": 卡路里数字 或 null
    }
    只返回 JSON，不要其他解释。
    """

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {
                        "url": f"data:{mime_type};base64,{b64}",
                        "detail": "low"   # 节省 token，截图不需要高清
                    }}
                ]
            }],
            max_tokens=300,
        )

        import json
        content = response.choices[0].message.content.strip()
        # 清理可能的 markdown 代码块
        content = re.sub(r"^```json\s*|\s*```$", "", content, flags=re.MULTILINE)
        data = json.loads(content)

        result = OCRResult(confidence=0.95)
        result.distance = data.get("distance_km")
        result.duration_str = data.get("duration_str")
        result.avg_pace_str = data.get("avg_pace_str")
        result.avg_hr = data.get("avg_hr")
        result.run_date = data.get("run_date")
        result.cadence = data.get("cadence")
        result.calories = data.get("calories")

        # 转换配速字符串到秒
        if result.avg_pace_str:
            m = re.match(r"(\d+)'(\d{2})\"?", result.avg_pace_str)
            if m:
                result.avg_pace = int(m.group(1)) * 60 + int(m.group(2))

        # 转换时长字符串到秒
        if result.duration_str:
            parts = result.duration_str.split(":")
            if len(parts) == 3:
                result.duration_sec = (
                    int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                )

        return result

    except Exception as e:
        err_str = str(e)
        logger.error(f"GPT-4o Vision OCR 失败: {err_str}")
        if "insufficient_quota" in err_str or "429" in err_str:
            user_msg = "OpenAI 账户额度不足，请前往 platform.openai.com/settings/billing 充值"
        elif "invalid_api_key" in err_str or "401" in err_str:
            user_msg = "API Key 无效，请检查 .env 配置"
        else:
            user_msg = f"OCR 失败: {err_str}"
        return OCRResult(confidence=0.0, raw_text=user_msg)


# ════════════════════════════════════════════════════
# v3.0：通义千问 VL OCR（优先使用）
# ════════════════════════════════════════════════════
async def _qwen_vision_ocr(image_bytes: bytes, mime_type: str) -> OCRResult:
    """
    调用阿里云通义千问 VL 识别跑步截图
    成本更低，速度更快
    """
    try:
        from dashscope import MultiModalConversation
        import dashscope
        import json
        
        settings = get_settings()
        dashscope.api_key = settings.DASHSCOPE_API_KEY
        
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        
        prompt = """这是一张跑步 App 的运动记录截图。请提取以下信息，以 JSON 格式返回：
{
  "distance_km": 数字或null,
  "duration_str": "HH:MM:SS" 或 null,
  "avg_pace_str": "M'SS\"" 格式 或 null,
  "avg_hr": 整数 或 null,
  "run_date": "YYYY-MM-DD" 或 null,
  "cadence": 步频整数 或 null,
  "calories": 卡路里数字 或 null
}
只返回 JSON，不要其他解释。"""

        messages = [{
            'role': 'user',
            'content': [
                {'text': prompt},
                {'image': f'data:{mime_type};base64,{b64}'}
            ]
        }]

        response = MultiModalConversation.call(
            model='qwen-vl-max',
            messages=messages
        )
        
        if response.status_code != 200 or not response.output:
            logger.error(f"通义千问 API 请求失败: {response}")
            return OCRResult(confidence=0.0, raw_text="通义千问 API 调用失败")
        
        content = response.output.choices[0].message.content[0]['text'].strip()
        # 清理可能的 markdown 代码块
        content = re.sub(r"^```json\s*|\s*```$", "", content, flags=re.MULTILINE)
        data = json.loads(content)

        result = OCRResult(confidence=0.95)
        result.distance = data.get("distance_km")
        result.duration_str = data.get("duration_str")
        result.avg_pace_str = data.get("avg_pace_str")
        result.avg_hr = data.get("avg_hr")
        result.run_date = data.get("run_date")
        result.cadence = data.get("cadence")
        result.calories = data.get("calories")

        # 转换配速字符串到秒
        if result.avg_pace_str:
            m = re.match(r"(\d+)'(\d{2})\"?", result.avg_pace_str)
            if m:
                result.avg_pace = int(m.group(1)) * 60 + int(m.group(2))

        # 转换时长字符串到秒
        if result.duration_str:
            parts = result.duration_str.split(":")
            if len(parts) == 3:
                result.duration_sec = (
                    int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                )

        logger.info(f"通义千问 OCR 成功，置信度: {result.confidence}")
        return result

    except ImportError:
        logger.warning("dashscope SDK 未安装，无法使用通义千问")
        return OCRResult(confidence=0.0, raw_text="请安装 dashscope SDK: pip install dashscope")
    except Exception as e:
        err_str = str(e)
        logger.error(f"通义千问 Vision OCR 失败: {err_str}")
        if "Invalid API-key" in err_str or "InvalidApiKey" in err_str:
            user_msg = "通义千问 API Key 无效，请检查 DASHSCOPE_API_KEY"
        else:
            user_msg = f"通义千问 OCR 失败: {err_str}"
        return OCRResult(confidence=0.0, raw_text=user_msg)
