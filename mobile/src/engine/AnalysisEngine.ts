/**
 * AnalysisEngine - 训练分析核心
 * 纯函数实现，无副作用，无数据库依赖
 * 未来迁移 Python/FastAPI 时，逻辑可直接对照翻译
 */

import { BodyStatus, FitnessMetrics, Intensity, RunRecord, UserProfile } from '../types';
import { calcVDOT } from './VDOTEngine';

// ===== 常量 =====
const LONG_DISTANCE_KM = 25;
const ATL_DAYS = 7;    // 急性训练负荷窗口
const CTL_DAYS = 42;   // 慢性训练负荷窗口

// ===== 强度判断 =====
// 基于 %HRmax，比固定绝对值更准确
export function calcIntensity(avgHr: number, profile: UserProfile): Intensity {
  const pct = avgHr / profile.max_hr;
  if (pct <= 0.81) return Intensity.EASY;       // ≤ 81% HRmax
  if (pct <= 0.87) return Intensity.NORMAL;     // 82–87%
  if (pct <= 0.93) return Intensity.HIGH;       // 88–93%
  return Intensity.OVER;                         // > 93%
}

// 兼容旧版绝对心率规则（用于无 profile 时的兜底）
export function calcIntensityByAbsHr(avgHr: number): Intensity {
  if (avgHr <= 150) return Intensity.EASY;
  if (avgHr <= 160) return Intensity.NORMAL;
  if (avgHr <= 170) return Intensity.HIGH;
  return Intensity.OVER;
}

// ===== TSS 计算 =====
// TSS = (duration_sec × avgHR × avgHR) / (LTHR² × 3600) × 100
export function calcTSS(durationSec: number, avgHr: number, lthr: number): number {
  return (durationSec * avgHr * avgHr) / (lthr * lthr * 3600) * 100;
}

// ===== ATL / CTL / TSB =====
// 使用指数移动平均（EMA）
export function calcFitnessMetrics(
  records: RunRecord[],
  profile: UserProfile
): FitnessMetrics {
  if (records.length === 0) return { atl: 0, ctl: 0, tsb: 0 };

  // 按日期升序排列
  const sorted = [...records].sort((a, b) => a.run_date.localeCompare(b.run_date));

  let atl = 0;
  let ctl = 0;

  const kAtl = 1 - Math.exp(-1 / ATL_DAYS);
  const kCtl = 1 - Math.exp(-1 / CTL_DAYS);

  for (const record of sorted) {
    const tss = record.tss ?? calcTSS(record.duration_sec, record.avg_hr, profile.hr_threshold);
    atl = atl + kAtl * (tss - atl);
    ctl = ctl + kCtl * (tss - ctl);
  }

  return { atl, ctl, tsb: ctl - atl };
}

// ===== 一句话结论 =====
export function buildConclusion(intensity: Intensity): string {
  const map: Record<Intensity, string> = {
    [Intensity.EASY]: '本次为轻松跑，恢复良好。',
    [Intensity.NORMAL]: '本次强度适中，训练有效。',
    [Intensity.HIGH]: '本次强度偏高，注意恢复。',
    [Intensity.OVER]: '本次强度过大，存在疲劳风险。',
  };
  return map[intensity];
}

// ===== 明日行动 =====
export function buildSuggest(
  intensity: Intensity,
  distance: number,
  recentRecords: RunRecord[]
): string {
  // 强制规则：长距离后优先恢复
  if (distance >= LONG_DISTANCE_KM) {
    return '长距离后优先恢复，建议休息或慢跑。';
  }

  const base: Record<Intensity, string> = {
    [Intensity.EASY]: '可正常训练。',
    [Intensity.NORMAL]: '建议轻松跑 5–8km。',
    [Intensity.HIGH]: '建议休息 1 天。',
    [Intensity.OVER]: '建议休息 1–2 天。',
  };
  return base[intensity];
}

// ===== 风险提示 =====
export function buildRisk(
  intensity: Intensity,
  recentRecords: RunRecord[]
): string {
  const risks: string[] = [];

  if (intensity >= Intensity.HIGH) {
    risks.push('心率偏高，注意减量。');
  }

  // 近2天连续高强度
  const recent2 = recentRecords.slice(0, 2);
  const consecutive = recent2.every(r => r.intensity >= Intensity.HIGH);
  if (consecutive && recent2.length >= 2) {
    risks.push('连续高强度，受伤风险上升。');
  }

  return risks.join('');
}

// ===== 今日身体状态 =====
export function calcBodyStatus(recentRecords: RunRecord[]): BodyStatus {
  if (recentRecords.length === 0) return BodyStatus.NORMAL;

  const last3 = recentRecords.slice(0, 3);
  const last2 = recentRecords.slice(0, 2);

  // 近3天内有长距离
  const hasLongRun = last3.some(r => r.distance >= LONG_DISTANCE_KM);
  if (hasLongRun) return BodyStatus.TIRED;

  // 近2天连续高强度
  const consecutiveHigh = last2.length >= 2 && last2.every(r => r.intensity >= Intensity.HIGH);
  if (consecutiveHigh) return BodyStatus.REST;

  // 最近一次高强度
  if (last2[0]?.intensity >= Intensity.HIGH) return BodyStatus.NORMAL;

  return BodyStatus.READY;
}

// ===== 配速格式化 =====
// 387秒/km → "6'27\""
export function formatPace(paceSec: number): string {
  const m = Math.floor(paceSec / 60);
  const s = Math.round(paceSec % 60);
  return `${m}'${s.toString().padStart(2, '0')}"`;
}

// ===== 时长格式化 =====
// 3933秒 → "01:05:33"
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

// ===== 时长解析 =====
// "01:05:33" → 3933
export function parseDuration(str: string): number {
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

// ===== 一次性分析入口 =====
export interface AnalysisInput {
  distance: number;
  durationSec: number;
  avgHr: number;
  runDate: string;
  profile: UserProfile;
  recentRecords: RunRecord[];
  rpe?: number;          // 主观疲劳(1-10)
  cadence?: number;      // 步频
}

export interface AnalysisOutput {
  intensity: Intensity;
  avgPace: number;
  conclusion: string;
  suggest: string;
  risk: string;
  tss: number;
  vdot: number;
  rpe?: number;
  cadence?: number;
}

export function analyze(input: AnalysisInput): AnalysisOutput {
  const { distance, durationSec, avgHr, profile, recentRecords, rpe, cadence } = input;
  const avgPace = durationSec / distance;
  const intensity = calcIntensity(avgHr, profile);
  let tss = calcTSS(durationSec, avgHr, profile.hr_threshold);

  // RPE 修正 TSS: 如果 RPE 偏离客观评估 ±2 分以上，做修正
  if (rpe != null && rpe >= 1 && rpe <= 10) {
    const objectiveRpe = intensity * 2.5; // 大致映射: EASY=2.5, NORMAL=5, HIGH=7.5, OVER=10
    const rpeRatio = rpe / objectiveRpe;
    // 用 RPE 比值小幅修正 TSS（权重30%）
    tss = tss * (0.7 + 0.3 * rpeRatio);
  }

  const vdot = calcVDOT(distance, durationSec);
  const conclusion = buildConclusion(intensity);
  const suggest = buildSuggest(intensity, distance, recentRecords);
  const risk = buildRisk(intensity, recentRecords);
  return { intensity, avgPace, conclusion, suggest, risk, tss, vdot, rpe, cadence };
}
