"""
RunForge 数据模型（Pydantic Schemas）
与移动端 TypeScript types 保持字段一一对应
"""
from pydantic import BaseModel, Field
from typing import Optional
from enum import IntEnum


# ── 枚举 ──────────────────────────────────────────────
class Intensity(IntEnum):
    EASY = 1    # 轻松跑
    NORMAL = 2  # 中等强度
    HIGH = 3    # 高强度
    OVER = 4    # 过度训练


class BodyStatus(IntEnum):
    GREAT = 1   # 适合训练
    NORMAL = 2  # 正常
    TIRED = 3   # 轻微疲劳
    REST = 4    # 建议休息


# ── 跑步记录 ───────────────────────────────────────────
class RunRecordCreate(BaseModel):
    run_date: str = Field(..., description="日期 2026-03-05")
    distance: float = Field(..., gt=0, description="距离(km)")
    duration_sec: int = Field(..., gt=0, description="时长(秒)")
    avg_pace: float = Field(..., gt=0, description="配速(秒/km)")
    avg_hr: int = Field(..., ge=40, le=220, description="平均心率(bpm)")
    # 可选扩展字段（为未来版本预留）
    elevation_gain: Optional[float] = None
    temperature: Optional[int] = None
    rpe: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = None


class RunRecordOut(RunRecordCreate):
    id: int
    create_time: int               # 毫秒时间戳
    intensity: Intensity
    conclusion: str
    suggest: str
    risk: str
    tss: Optional[float] = None

    class Config:
        from_attributes = True


# ── 分析结果 ───────────────────────────────────────────
class AnalysisResult(BaseModel):
    intensity: Intensity
    conclusion: str
    suggest: str
    risk: str
    tss: Optional[float] = None


# ── 教练解读 ───────────────────────────────────────────
class CoachInsightRequest(BaseModel):
    # 本次训练核心数据
    distance: float = Field(..., gt=0)
    avg_hr: int = Field(..., ge=40, le=220)
    duration_sec: int = Field(..., gt=0)
    avg_pace: float = Field(..., gt=0, description="配速（秒/km）")
    intensity: int = Field(..., ge=1, le=4)
    vdot: Optional[float] = None
    tss: Optional[float] = None
    rpe: Optional[int] = Field(None, ge=1, le=10)

    # 历史对比（由移动端规则引擎预计算后传入）
    pace_pct_diff: Optional[float] = Field(None, description="配速较近期均值差异%，负=更快")
    vdot_diff: Optional[float] = Field(None, description="本次VDOT与近期中位值差值")
    hr_efficiency_variant: Optional[str] = Field(None, description="good/normal/low")

    # 规则引擎兜底文案（LLM 失败时直接返回）
    fallback_conclusion: str
    fallback_suggest: str
    fallback_risk: str = ""


class CoachInsightResponse(BaseModel):
    coach_text: str          # 教练点评正文（2-4 句）
    source: str              # "llm" | "fallback"


# ── 训练负荷指标（ATL/CTL/TSB）──────────────────────────
class TrainingLoad(BaseModel):
    atl: float = Field(..., description="近期疲劳(7天)")
    ctl: float = Field(..., description="长期体能(42天)")
    tsb: float = Field(..., description="当日状态=CTL-ATL")
    body_status: BodyStatus


# ── OCR ────────────────────────────────────────────────
class OCRResult(BaseModel):
    distance: Optional[float] = None
    duration_str: Optional[str] = None   # "01:05:33"
    duration_sec: Optional[int] = None
    avg_pace_str: Optional[str] = None   # "6'27\""
    avg_pace: Optional[float] = None     # 秒/km
    avg_hr: Optional[int] = None
    run_date: Optional[str] = None
    cadence: Optional[int] = None
    calories: Optional[float] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    raw_text: Optional[str] = None       # 原始识别文本，调试用


# ── 比赛助手 ───────────────────────────────────────────
class RacePlanCreate(BaseModel):
    race_date: str = Field(..., description="比赛日期 2026-03-16")
    target_time_sec: int = Field(..., gt=0, description="目标完赛秒数")


class RacePlanOut(RacePlanCreate):
    id: int
    target_pace: float          # 秒/km
    plan_content: str

    class Config:
        from_attributes = True


class PaceStrategy(BaseModel):
    segment: str
    pace_sec: float
    pace_str: str
    note: str


class RaceAssistantResult(BaseModel):
    target_time_str: str
    target_pace_str: str
    target_pace_sec: float
    days_until_race: int
    pace_strategy: list[PaceStrategy]
    nutrition_plan: list[str]
    pre_race_plan: list[str]


# ── 用户档案 ───────────────────────────────────────────
class UserProfile(BaseModel):
    max_hr: int = Field(default=185, ge=140, le=220)
    resting_hr: int = Field(default=60, ge=30, le=100)
    lthr: int = Field(default=165, ge=120, le=210, description="乳酸阈值心率")
    birth_year: Optional[int] = None
    target_race_date: Optional[str] = None
