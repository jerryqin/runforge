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

export const BODY_STATUS_THRESHOLDS = {
  longDistanceKm: LONG_DISTANCE_KM,
  restConsecutiveHighDays: 2,
} as const;

export const RECOVERY_LOAD_THRESHOLDS = {
  peakReadyTsb: 15,
  readyTsb: 0,
  tiredTsb: -10,
  restTsb: -30,
  recoveryRunTsb: -15,
} as const;

// ===== 个性化修正系数 =====

/** 年龄修正系数：年龄越大，恢复越慢 */
export function calcAgeModifier(age: number): number {
  if (age < 30) return 1.0;      // 基准
  if (age < 40) return 0.95;     // 30-39岁，恢复慢5%
  if (age < 50) return 0.85;     // 40-49岁，恢复慢15%
  return 0.75;                    // 50+，恢复慢25%
}

/** 跑龄修正系数：跑龄越长，疲劳耐受越好 */
export function calcRunningYearsModifier(years: number): number {
  if (years < 1) return 0.85;    // 新手，疲劳耐受低
  if (years < 3) return 0.95;    // 进阶者
  if (years < 5) return 1.0;     // 基准
  return 1.1;                     // 5年+老鸟，疲劳耐受高10%
}

/** 体能修正系数：CTL越高，疲劳耐受越好 */
export function calcCTLModifier(ctl: number): number {
  if (ctl < 30) return 0.9;      // 低体能，对负TSB敏感
  if (ctl < 50) return 1.0;      // 基准
  if (ctl < 70) return 1.1;      // 高体能，疲劳耐受好
  return 1.15;                    // 超高体能
}

export interface DynamicThresholds {
  peakReadyTsb: number;
  readyTsb: number;
  tiredTsb: number;
  restTsb: number;
  recoveryRunTsb: number;
  modifier: number;              // 综合修正系数
}

/** 计算个性化动态阈值 */
export function calcDynamicThresholds(
  profile: UserProfile | null,
  metrics: FitnessMetrics
): DynamicThresholds {
  // 无档案或数据不足，使用默认阈值
  if (!profile) {
    return {
      ...RECOVERY_LOAD_THRESHOLDS,
      modifier: 1.0,
    };
  }

  const currentYear = new Date().getFullYear();
  const age = profile.birth_year ? currentYear - profile.birth_year : 30;
  const runningYears = profile.running_start_year ? currentYear - profile.running_start_year : 1;

  const ageMod = calcAgeModifier(age);
  const yearsMod = calcRunningYearsModifier(runningYears);
  const ctlMod = calcCTLModifier(metrics.ctl);

  // 综合修正系数（近期训练和TSB是高权重，年龄/跑龄是低权重修正）
  const modifier = ageMod * yearsMod * ctlMod;

  return {
    peakReadyTsb: RECOVERY_LOAD_THRESHOLDS.peakReadyTsb * modifier,
    readyTsb: RECOVERY_LOAD_THRESHOLDS.readyTsb * modifier,
    tiredTsb: RECOVERY_LOAD_THRESHOLDS.tiredTsb * modifier,
    restTsb: RECOVERY_LOAD_THRESHOLDS.restTsb * modifier,
    recoveryRunTsb: RECOVERY_LOAD_THRESHOLDS.recoveryRunTsb * modifier,
    modifier,
  };
}

const BODY_STATUS_COPY: Record<BodyStatus, { subtitle: string; todayReason: string }> = {
  [BodyStatus.READY]: {
    subtitle: '恢复状态不错，可以按计划推进今天的训练。',
    todayReason: '你的本周推进在正常范围内，今天按建议训练即可继续维持节奏。',
  },
  [BodyStatus.NORMAL]: {
    subtitle: '身体状态稳定，按今日行动推进即可。',
    todayReason: '你的本周推进在正常范围内，今天按建议训练即可继续维持节奏。',
  },
  [BodyStatus.TIRED]: {
    subtitle: '近期有疲劳累积，今天以控制强度、稳住节奏为主。',
    todayReason: '你本周已有训练积累，今天以恢复和稳住节奏为主。',
  },
  [BodyStatus.REST]: {
    subtitle: '当前恢复压力偏高，今天优先休息或只做非常轻松的恢复活动。',
    todayReason: '当前疲劳偏高，今天先恢复，比继续堆跑量更重要。',
  },
};

const RECOVERY_LOAD_DETAIL_COPY = {
  peak: {
    detail: '巅峰窗口',
    tip: '恢复非常充分，适合比赛或一次高质量训练。',
  },
  ready: {
    detail: '恢复良好',
  },
  normal: {
    detail: '负荷可控',
    tip: '负荷仍在可控区间，适合保持训练节奏。',
  },
  tired: {
    detail: '疲劳积累',
  },
  rest: {
    detail: '恢复不足',
  },
} as const;

// ===== 强度判断 =====
// 基于 %HRmax，比固定绝对值更准确
export function calcIntensity(avgHr: number, profile: UserProfile): Intensity {
  const pct = avgHr / profile.max_hr;
  if (pct <= 0.81) return Intensity.EASY;       // ≤ 81% HRmax
  if (pct <= 0.84) return Intensity.NORMAL;     // 82–84%
  if (pct <= 0.93) return Intensity.HIGH;       // 85–93% (含乳酸阈值)
  return Intensity.OVER;                         // > 93%
}

// 兼容旧版绝对心率规则（用于无 profile 时的兜底）
export function calcIntensityByAbsHr(avgHr: number): Intensity {
  if (avgHr <= 150) return Intensity.EASY;
  if (avgHr <= 156) return Intensity.NORMAL;
  if (avgHr <= 172) return Intensity.HIGH;       // 含乳酸阈值(~157)
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
  if (distance >= BODY_STATUS_THRESHOLDS.longDistanceKm) {
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

  // 先处理最强风险信号：连续高强度应该高于单次长距离
  const consecutiveHigh =
    last2.length >= BODY_STATUS_THRESHOLDS.restConsecutiveHighDays &&
    last2.every(r => r.intensity >= Intensity.HIGH);
  if (consecutiveHigh) return BodyStatus.REST;

  // 近3天内有长距离
  const hasLongRun = last3.some(r => r.distance >= BODY_STATUS_THRESHOLDS.longDistanceKm);
  if (hasLongRun) return BodyStatus.TIRED;

  // 最近一次高强度
  if (last2[0]?.intensity >= Intensity.HIGH) return BodyStatus.NORMAL;

  return BodyStatus.READY;
}

// ===== 将 TSB 恢复负荷映射为身体状态 =====
export function mapFitnessMetricsToBodyStatus(
  metrics: FitnessMetrics,
  thresholds?: DynamicThresholds
): BodyStatus {
  const t = thresholds || {
    ...RECOVERY_LOAD_THRESHOLDS,
    modifier: 1.0,
  };

  if (metrics.tsb <= t.restTsb) return BodyStatus.REST;
  if (metrics.tsb <= t.tiredTsb) return BodyStatus.TIRED;
  if (metrics.tsb > t.readyTsb) return BodyStatus.READY;
  return BodyStatus.NORMAL;
}

// ===== 综合身体状态 =====
export function calcCompositeBodyStatus(
  recentRecords: RunRecord[],
  metrics?: FitnessMetrics | null,
  profile?: UserProfile | null
): BodyStatus {
  const recentStatus = calcBodyStatus(recentRecords);
  if (!metrics) return recentStatus;

  const thresholds = calcDynamicThresholds(profile || null, metrics);
  const loadStatus = mapFitnessMetricsToBodyStatus(metrics, thresholds);
  return Math.max(recentStatus, loadStatus) as BodyStatus;
}

// ===== 身体状态统一文案 =====
export function getBodyStatusSubtitle(status: BodyStatus): string {
  return BODY_STATUS_COPY[status].subtitle;
}

export interface TodayReasonOptions {
  hasWeeklyProgress: boolean;
  completionRate?: number;
  longRunDone?: boolean;
}

export function getTodayActionReason(
  status: BodyStatus,
  options: TodayReasonOptions
): string {
  if (!options.hasWeeklyProgress) {
    return '系统会结合你的训练记录与周目标，动态生成今天最合适的训练动作。';
  }

  if (status === BodyStatus.REST || status === BodyStatus.TIRED) {
    return BODY_STATUS_COPY[status].todayReason;
  }

  if ((options.completionRate ?? 0) < 40) {
    return '本周推进偏慢，今天这堂课会帮助你稳步追上周目标。';
  }

  if (options.longRunDone === false) {
    return '本周长距离还未完成，建议优先完成这类关键训练。';
  }

  return BODY_STATUS_COPY[status].todayReason;
}

export interface RecoveryLoadStatusInfo {
  bodyStatus: BodyStatus;
  detail: string;
  tip: string;
}

export function getRecoveryLoadStatusInfo(
  tsb: number,
  profile?: UserProfile | null,
  ctl?: number
): RecoveryLoadStatusInfo {
  const metrics = { atl: 0, ctl: ctl || 0, tsb };
  const thresholds = calcDynamicThresholds(profile || null, metrics);
  const bodyStatus = mapFitnessMetricsToBodyStatus(metrics, thresholds);

  if (tsb > thresholds.peakReadyTsb) {
    return {
      bodyStatus,
      detail: RECOVERY_LOAD_DETAIL_COPY.peak.detail,
      tip: RECOVERY_LOAD_DETAIL_COPY.peak.tip,
    };
  }

  if (tsb > thresholds.readyTsb) {
    return {
      bodyStatus,
      detail: RECOVERY_LOAD_DETAIL_COPY.ready.detail,
      tip: getBodyStatusSubtitle(bodyStatus),
    };
  }

  if (tsb > thresholds.tiredTsb) {
    return {
      bodyStatus,
      detail: RECOVERY_LOAD_DETAIL_COPY.normal.detail,
      tip: RECOVERY_LOAD_DETAIL_COPY.normal.tip,
    };
  }

  if (tsb > thresholds.restTsb) {
    return {
      bodyStatus,
      detail: RECOVERY_LOAD_DETAIL_COPY.tired.detail,
      tip: getBodyStatusSubtitle(bodyStatus),
    };
  }

  return {
    bodyStatus,
    detail: RECOVERY_LOAD_DETAIL_COPY.rest.detail,
    tip: getBodyStatusSubtitle(bodyStatus),
  };
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
