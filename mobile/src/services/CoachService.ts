/**
 * CoachService - 调用后端 LLM 教练解读接口
 * 主力：DeepSeek-V3（后端转发）
 * 降级：后端自动降级到规则引擎，或网络失败时使用本地规则引擎文案
 */

import { API_ENDPOINTS } from '../constants/api';
import { RunRecord } from '../types';
import { RichFeedback } from '../engine/AnalysisEngine';

const NETWORK_TIMEOUT_MS = 10_000;

export interface CoachInsightResult {
  coachText: string;
  source: 'llm' | 'fallback' | 'local';
}

export interface CoachInsightPayload {
  // 本次训练数据
  distance: number;
  avg_hr: number;
  duration_sec: number;
  avg_pace: number;
  intensity: number;
  vdot?: number;
  tss?: number;
  rpe?: number;
  // 历史对比（从 RichFeedback insights 提取）
  pace_pct_diff?: number;
  vdot_diff?: number;
  hr_efficiency_variant?: string;
  // 规则引擎兜底文案
  fallback_conclusion: string;
  fallback_suggest: string;
  fallback_risk: string;
}

/** 从 RichFeedback insights 中提取量化字段，传给后端丰富 prompt */
function extractInsightFields(richFeedback: RichFeedback | null): Partial<CoachInsightPayload> {
  if (!richFeedback) return {};
  const result: Partial<CoachInsightPayload> = {};

  for (const insight of richFeedback.insights) {
    if (insight.key === 'pace') {
      // title 格式: "配速比近期快/慢 X.X%"
      const match = /([快慢])\s*([\d.]+)%/.exec(insight.title);
      if (match) {
        const sign = match[1] === '快' ? -1 : 1;
        result.pace_pct_diff = sign * parseFloat(match[2]);
      }
    }
    if (insight.key === 'vdot') {
      const match = /([提升下降])\s*([\d.]+)/.exec(insight.detail);
      if (match) {
        const sign = match[1] === '提升' ? 1 : -1;
        result.vdot_diff = sign * parseFloat(match[2]);
      }
    }
    if (insight.key === 'efficiency') {
      if (insight.variant === 'positive') result.hr_efficiency_variant = 'good';
      else if (insight.variant === 'warning') result.hr_efficiency_variant = 'low';
      else result.hr_efficiency_variant = 'normal';
    }
  }

  return result;
}

/**
 * 获取 LLM 教练解读
 * @param record   当前跑步记录
 * @param richFeedback  本地规则引擎结果（兜底文案 + 历史对比数据）
 * @param conclusion  规则引擎结论文案
 * @param suggest     规则引擎建议文案
 * @param risk        规则引擎风险文案
 */
export async function fetchCoachInsight(
  record: RunRecord,
  richFeedback: RichFeedback | null,
  conclusion: string,
  suggest: string,
  risk: string,
): Promise<CoachInsightResult> {
  const localFallback: CoachInsightResult = {
    coachText: [conclusion, suggest, risk].filter(Boolean).join(' '),
    source: 'local',
  };

  try {
    const insightFields = extractInsightFields(richFeedback);

    const payload: CoachInsightPayload = {
      distance: record.distance,
      avg_hr: record.avg_hr,
      duration_sec: record.duration_sec,
      avg_pace: record.avg_pace,
      intensity: record.intensity,
      vdot: record.vdot,
      tss: record.tss,
      rpe: record.rpe,
      fallback_conclusion: conclusion,
      fallback_suggest: suggest,
      fallback_risk: risk,
      ...insightFields,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

    const resp = await fetch(API_ENDPOINTS.coachInsight, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json() as { coach_text: string; source: string };
    return {
      coachText: data.coach_text,
      source: data.source === 'llm' ? 'llm' : 'fallback',
    };
  } catch {
    // 网络不通 / 超时 / 服务未部署 → 静默降级到本地文案
    return localFallback;
  }
}
