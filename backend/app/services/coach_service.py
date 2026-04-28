"""
CoachService - 跑步教练 LLM 解读
主力：DeepSeek-V3（OpenAI 兼容接口）
降级：规则引擎文案（fallback_conclusion + fallback_suggest）
"""
from __future__ import annotations
import asyncio
import logging
from typing import Optional

from openai import AsyncOpenAI, APIError, APITimeoutError

from app.core.config import get_settings
from app.models.schemas import CoachInsightRequest, CoachInsightResponse

logger = logging.getLogger(__name__)

_INTENSITY_LABEL = {1: "轻松跑", 2: "中等强度", 3: "高强度", 4: "过度训练"}


def _build_prompt(req: CoachInsightRequest) -> str:
    """将结构化数据组装成 LLM 用户消息。"""

    def fmt_pace(sec: float) -> str:
        m = int(sec // 60)
        s = int(sec % 60)
        return f"{m}'{s:02d}\""

    lines = [
        f"- 距离：{req.distance:.2f} km",
        f"- 配速：{fmt_pace(req.avg_pace)}/km",
        f"- 平均心率：{req.avg_hr} bpm",
        f"- 强度等级：{_INTENSITY_LABEL.get(req.intensity, '未知')}",
    ]

    if req.vdot:
        lines.append(f"- VDOT 跑力：{req.vdot:.1f}")
    if req.tss:
        lines.append(f"- TSS（训练压力分）：{req.tss:.0f}")
    if req.rpe:
        lines.append(f"- 主观疲劳 RPE：{req.rpe}/10")

    # 历史对比
    if req.pace_pct_diff is not None:
        direction = "快" if req.pace_pct_diff < 0 else "慢"
        lines.append(f"- 配速比近期均值{direction} {abs(req.pace_pct_diff):.1f}%")
    if req.vdot_diff is not None:
        trend = "提升" if req.vdot_diff > 0 else "下降"
        lines.append(f"- VDOT 较近期中位值{trend} {abs(req.vdot_diff):.1f}")
    if req.hr_efficiency_variant:
        eff_map = {"good": "优秀", "normal": "正常", "low": "偏低"}
        lines.append(f"- 心率效率：{eff_map.get(req.hr_efficiency_variant, req.hr_efficiency_variant)}")

    data_block = "\n".join(lines)

    return (
        f"本次跑步数据如下：\n{data_block}\n\n"
        "请结合以上数据，给出 2～3 句话的个性化教练点评，包含：\n"
        "1. 对本次训练表现的评价（结合配速/心率/历史对比）\n"
        "2. 明日的具体训练建议（类型+大致距离）\n"
        "语言简洁、口语化，像一位专业跑步教练在和跑者对话。"
    )


_SYSTEM_PROMPT = (
    "你是一名专业跑步教练，擅长基于数据给出针对性训练建议。"
    "回答必须：使用中文、不超过 4 句话、不用列表、不重复数据原文。"
)


async def get_coach_insight(req: CoachInsightRequest) -> CoachInsightResponse:
    """
    调用 DeepSeek-V3 生成教练点评。
    任何异常（超时、无 API Key、API 错误）均降级返回规则引擎文案。
    """
    settings = get_settings()

    fallback_text = req.fallback_conclusion + req.fallback_suggest
    if req.fallback_risk:
        fallback_text += f" {req.fallback_risk}"

    if not settings.DEEPSEEK_API_KEY:
        logger.info("DEEPSEEK_API_KEY 未配置，使用规则引擎兜底")
        return CoachInsightResponse(coach_text=fallback_text, source="fallback")

    client = AsyncOpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        timeout=settings.COACH_TIMEOUT_SEC,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _build_prompt(req)},
            ],
            max_tokens=200,
            temperature=0.7,
        )
        text = response.choices[0].message.content or ""
        text = text.strip()
        if not text:
            raise ValueError("LLM 返回空内容")
        return CoachInsightResponse(coach_text=text, source="llm")

    except APITimeoutError:
        logger.warning("DeepSeek 超时，降级到规则引擎")
    except APIError as e:
        logger.warning("DeepSeek API 错误 %s，降级到规则引擎", e)
    except Exception as e:
        logger.warning("coach_service 未知异常 %s，降级到规则引擎", e)

    return CoachInsightResponse(coach_text=fallback_text, source="fallback")
