"""
跑步分析路由
POST /api/analysis/run       分析单次跑步
GET  /api/analysis/load      获取当前训练负荷 (ATL/CTL/TSB)
POST /api/analysis/race-plan 生成比赛备赛计划
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.analysis_engine import (
    generate_analysis, calc_tss, calc_race_plan
)
from app.models.schemas import (
    AnalysisResult, TrainingLoad, RacePlanCreate, RaceAssistantResult
)

router = APIRouter(prefix="/analysis", tags=["分析"])


class RunAnalysisRequest(BaseModel):
    distance: float
    avg_hr: int
    duration_sec: int
    lthr: int = 165                         # 用户乳酸阈值心率，默认165
    recent_intensities: list[int] = []      # 近2天强度记录


class TrainingLoadRequest(BaseModel):
    """
    计算训练负荷需要提供历史 TSS 序列
    移动端从本地 DB 读取后传入
    前30天的 TSS 列表（按日期升序）
    """
    tss_history: list[float]   # 最近 60 天，无记录的天为 0.0


@router.post("/run", response_model=AnalysisResult, summary="分析单次跑步")
async def analyze_run(req: RunAnalysisRequest):
    if req.avg_hr < 40 or req.avg_hr > 220:
        raise HTTPException(400, "心率数值异常")
    if req.distance <= 0:
        raise HTTPException(400, "距离必须大于 0")

    result = generate_analysis(
        distance=req.distance,
        avg_hr=req.avg_hr,
        recent_intensities=req.recent_intensities,
    )
    # 附加 TSS
    result.tss = calc_tss(req.duration_sec, req.avg_hr, req.lthr)
    return result


@router.post("/load", response_model=TrainingLoad, summary="计算训练负荷 ATL/CTL/TSB")
async def calc_load(req: TrainingLoadRequest):
    """
    根据历史 TSS 序列计算当前 ATL/CTL/TSB
    移动端每次打开首页时调用，本地计算也可以
    """
    import math
    from app.services.analysis_engine import ATL_DECAY, CTL_DECAY, calc_body_status

    atl, ctl = 0.0, 0.0
    for tss in req.tss_history:
        atl = atl * ATL_DECAY + tss * (1 - ATL_DECAY)
        ctl = ctl * CTL_DECAY + tss * (1 - CTL_DECAY)

    atl = round(atl, 2)
    ctl = round(ctl, 2)
    tsb = round(ctl - atl, 2)
    body_status = calc_body_status(atl, ctl)

    return TrainingLoad(atl=atl, ctl=ctl, tsb=tsb, body_status=body_status)


@router.post("/race-plan", response_model=RaceAssistantResult, summary="生成全马备赛计划")
async def race_plan(req: RacePlanCreate):
    try:
        result = calc_race_plan(req.race_date, req.target_time_sec)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
