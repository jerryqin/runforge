"""
RunForge 训练分析引擎
核心逻辑：强度判断 / ATL·CTL·TSB / 结论生成
纯函数实现，无副作用，便于单元测试
"""
from __future__ import annotations
import math
from datetime import date, timedelta, datetime
from typing import Optional

from app.models.schemas import (
    Intensity, BodyStatus, AnalysisResult, TrainingLoad
)

# ── 常量 ──────────────────────────────────────────────
LONG_RUN_KM = 25.0          # 长距离判定阈值
ATL_DECAY = math.exp(-1 / 7)
CTL_DECAY = math.exp(-1 / 42)
MARATHON_DISTANCE = 42.195


# ── TSS 计算（基于心率）──────────────────────────────────
def calc_tss(duration_sec: int, avg_hr: int, lthr: int = 165) -> float:
    """
    Training Stress Score
    TSS = (duration_sec × avg_hr²) / (lthr² × 3600) × 100
    """
    if lthr <= 0:
        return 0.0
    tss = (duration_sec * avg_hr ** 2) / (lthr ** 2 * 3600) * 100
    return round(tss, 1)


# ── 强度判断（默认规则，后续支持个性化 %LTHR）────────────────
def calc_intensity(avg_hr: int) -> Intensity:
    """
    默认基于绝对心率值（MVP阶段）
    后续版本：改为 %LTHR 个性化判断
    """
    if avg_hr <= 150:
        return Intensity.EASY
    elif avg_hr <= 160:
        return Intensity.NORMAL
    elif avg_hr <= 170:
        return Intensity.HIGH
    else:
        return Intensity.OVER


# ── 配速格式化 ──────────────────────────────────────────
def format_pace(pace_sec: float) -> str:
    """387.0 → '6\'27\"'"""
    minutes = int(pace_sec // 60)
    seconds = int(pace_sec % 60)
    return f"{minutes}'{seconds:02d}\""


def parse_pace_str(pace_str: str) -> float:
    """'6'27\"' → 387.0"""
    import re
    m = re.match(r"(\d+)'(\d{2})\"?", pace_str)
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))
    return 0.0


# ── 时长格式化 ──────────────────────────────────────────
def format_duration(duration_sec: int) -> str:
    """3933 → '01:05:33'"""
    h = duration_sec // 3600
    m = (duration_sec % 3600) // 60
    s = duration_sec % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


# ── 结论生成 ────────────────────────────────────────────
_CONCLUSION = {
    Intensity.EASY:   "本次为轻松跑，恢复良好。",
    Intensity.NORMAL: "本次强度适中，训练有效。",
    Intensity.HIGH:   "本次强度偏高，注意恢复。",
    Intensity.OVER:   "本次强度过大，存在疲劳风险。",
}

_SUGGEST = {
    Intensity.EASY:   "可正常训练。",
    Intensity.NORMAL: "建议轻松跑 5–8km。",
    Intensity.HIGH:   "建议休息 1 天。",
    Intensity.OVER:   "建议休息 1–2 天。",
}


def generate_analysis(
    distance: float,
    avg_hr: int,
    recent_intensities: list[int],   # 近2天的强度值列表
) -> AnalysisResult:
    """
    核心分析函数
    :param distance: 本次距离(km)
    :param avg_hr: 平均心率
    :param recent_intensities: 近2天已有记录的强度列表（不含本次）
    """
    intensity = calc_intensity(avg_hr)
    conclusion = _CONCLUSION[intensity]
    suggest = _SUGGEST[intensity]

    # 强制规则：长距离覆盖建议
    if distance >= LONG_RUN_KM:
        suggest = "长距离后优先恢复，建议休息或慢跑。"

    # 风险提示
    risk = ""
    if intensity >= Intensity.HIGH:
        risk = "心率偏高，注意减量。"
    recent_high = [i for i in recent_intensities if i >= Intensity.HIGH]
    if len(recent_high) >= 2:
        risk = "连续高强度，受伤风险上升。" if not risk else risk + " 连续高强度，受伤风险上升。"

    return AnalysisResult(
        intensity=intensity,
        conclusion=conclusion,
        suggest=suggest,
        risk=risk,
    )


# ── ATL / CTL / TSB ──────────────────────────────────
def update_training_load(
    prev_atl: float,
    prev_ctl: float,
    tss: float,
) -> tuple[float, float]:
    """
    指数加权滑动平均
    ATL: 7天窗口（疲劳）
    CTL: 42天窗口（体能）
    """
    atl = prev_atl * ATL_DECAY + tss * (1 - ATL_DECAY)
    ctl = prev_ctl * CTL_DECAY + tss * (1 - CTL_DECAY)
    return round(atl, 2), round(ctl, 2)


def calc_body_status(atl: float, ctl: float) -> BodyStatus:
    tsb = ctl - atl
    if tsb >= 5:
        return BodyStatus.GREAT
    elif tsb >= -10:
        return BodyStatus.NORMAL
    elif tsb >= -20:
        return BodyStatus.TIRED
    else:
        return BodyStatus.REST


# ── 比赛助手 ────────────────────────────────────────────
def calc_race_plan(
    race_date_str: str,
    target_time_sec: int,
) -> dict:
    """全马备赛计划生成"""
    from app.models.schemas import PaceStrategy, RaceAssistantResult

    target_pace_sec = target_time_sec / MARATHON_DISTANCE
    today = date.today()
    race_date = datetime.strptime(race_date_str, "%Y-%m-%d").date()
    days_until = (race_date - today).days

    # 分段配速策略
    slow_pace = target_pace_sec + 12   # 0-10km 保守：慢12秒
    pace_strategy = [
        PaceStrategy(
            segment="0–10km", pace_sec=slow_pace,
            pace_str=format_pace(slow_pace),
            note="保守起跑，比目标配速慢 10–15 秒"
        ),
        PaceStrategy(
            segment="10–30km", pace_sec=target_pace_sec,
            pace_str=format_pace(target_pace_sec),
            note="按目标配速匀速推进"
        ),
        PaceStrategy(
            segment="30km–终点", pace_sec=target_pace_sec,
            pace_str=format_pace(target_pace_sec),
            note="保守维持，优先完赛，按感觉调整"
        ),
    ]

    # 补给策略
    nutrition_plan = [
        "📍 10km：第 1 支能量胶",
        "📍 20km：第 2 支能量胶",
        "📍 30km：第 3 支能量胶",
        "💧 每个补给站少量多次补水，避免一次性大量饮水",
    ]

    # 赛前10天计划
    pre_race_plan = [
        "赛前 10–7 天：每天 6–8km 轻松跑",
        "赛前 6–3 天：每天 5km 以内慢跑",
        "赛前 2–1 天：完全休息，碳水补足",
        f"比赛日（{race_date_str}）：按上方配速策略执行",
    ]

    # 格式化目标时间
    h = target_time_sec // 3600
    m = (target_time_sec % 3600) // 60
    s = target_time_sec % 60
    target_time_str = f"{h}:{m:02d}:{s:02d}"

    return RaceAssistantResult(
        target_time_str=target_time_str,
        target_pace_str=format_pace(target_pace_sec),
        target_pace_sec=round(target_pace_sec, 1),
        days_until_race=days_until,
        pace_strategy=pace_strategy,
        nutrition_plan=nutrition_plan,
        pre_race_plan=pre_race_plan,
    )
