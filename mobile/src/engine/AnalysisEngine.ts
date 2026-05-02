/**
 * AnalysisEngine - 训练分析核心
 * 纯函数实现，无副作用，无数据库依赖
 * 未来迁移 Python/FastAPI 时，逻辑可直接对照翻译
 */

import { BodyStatus, FitnessMetrics, Intensity, RunRecord, UserProfile } from '../types';
import i18n from '../i18n';
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
    get subtitle() { return i18n.t('analysis.readySubtitle'); },
    get todayReason() { return i18n.t('analysis.normalSubtitle'); },
  },
  [BodyStatus.NORMAL]: {
    get subtitle() { return i18n.t('analysis.normalSubtitle'); },
    get todayReason() { return i18n.t('analysis.normalSubtitle'); },
  },
  [BodyStatus.TIRED]: {
    get subtitle() { return i18n.t('analysis.tiredSubtitle'); },
    get todayReason() { return i18n.t('analysis.tiredSubtitle'); },
  },
  [BodyStatus.REST]: {
    get subtitle() { return i18n.t('analysis.restSubtitle'); },
    get todayReason() { return i18n.t('analysis.currentRecoveryHigh'); },
  },
};

const RECOVERY_LOAD_DETAIL_COPY = {
  get peak() {
    return {
      detail: i18n.t('analysis.peakDetail'),
      tip: i18n.t('analysis.peakTip'),
    };
  },
  get ready() {
    return {
      detail: i18n.t('analysis.readyDetail'),
    };
  },
  get normal() {
    return {
      detail: i18n.t('analysis.normalDetail'),
      tip: i18n.t('analysis.normalTip'),
    };
  },
  get tired() {
    return {
      detail: i18n.t('analysis.tiredDetail'),
    };
  },
  get rest() {
    return {
      detail: i18n.t('analysis.restDetail'),
    };
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

// ===== 日期差（天） =====
function daysBetween(dateA: string, dateB: string): number {
  return Math.round(
    (new Date(dateB).getTime() - new Date(dateA).getTime()) / (24 * 60 * 60 * 1000)
  );
}

// ===== ATL / CTL / TSB =====
// 使用指数移动平均（EMA），正确处理休息日（无记录日）的衰减
// ATL/CTL 每天都在衰减，无训练日 TSS=0，恢复时疲劳(ATL)下降而体能(CTL)缓慢下降
export function calcFitnessMetrics(
  records: RunRecord[],
  profile: UserProfile,
  asOfDate?: string  // 默认为今天，可用于历史回测
): FitnessMetrics {
  if (records.length === 0) return { atl: 0, ctl: 0, tsb: 0 };

  const kAtl = 1 - Math.exp(-1 / ATL_DAYS);
  const kCtl = 1 - Math.exp(-1 / CTL_DAYS);
  // 每天的自然衰减系数（TSS=0时）
  const decayAtl = Math.exp(-1 / ATL_DAYS);  // = 1 - kAtl
  const decayCtl = Math.exp(-1 / CTL_DAYS);  // = 1 - kCtl

  // 将同日多条记录的 TSS 合并
  const tssByDate = new Map<string, number>();
  for (const record of records) {
    const tss = record.tss ?? calcTSS(record.duration_sec, record.avg_hr, profile.hr_threshold);
    tssByDate.set(record.run_date, (tssByDate.get(record.run_date) ?? 0) + tss);
  }

  const dates = [...tssByDate.keys()].sort();

  let atl = 0;
  let ctl = 0;
  let prevDate: string | null = null;

  for (const date of dates) {
    if (prevDate !== null) {
      const gap = daysBetween(prevDate, date);
      // 在本次训练日之前，先将上次训练后的休息日（gap-1天）衰减掉
      if (gap > 1) {
        atl *= Math.pow(decayAtl, gap - 1);
        ctl *= Math.pow(decayCtl, gap - 1);
      }
    }
    // 应用本日训练 TSS
    const tss = tssByDate.get(date)!;
    atl = atl + kAtl * (tss - atl);
    ctl = ctl + kCtl * (tss - ctl);
    prevDate = date;
  }

  // 将最后一次训练日到今天（或 asOfDate）之间的休息日继续衰减
  const today = asOfDate ?? new Date().toISOString().split('T')[0];
  if (prevDate && today > prevDate) {
    const gapToToday = daysBetween(prevDate, today);
    atl *= Math.pow(decayAtl, gapToToday);
    ctl *= Math.pow(decayCtl, gapToToday);
  }

  return { atl, ctl, tsb: ctl - atl };
}

// ===== 一句话结论 =====
export function buildConclusion(intensity: Intensity): string {
  const map: Record<Intensity, string> = {
    [Intensity.EASY]: i18n.t('analysis.conclusionEasy'),
    [Intensity.NORMAL]: i18n.t('analysis.conclusionNormal'),
    [Intensity.HIGH]: i18n.t('analysis.conclusionHigh'),
    [Intensity.OVER]: i18n.t('analysis.conclusionOver'),
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
    return i18n.t('analysis.suggestLongRun');
  }

  const base: Record<Intensity, string> = {
    [Intensity.EASY]: i18n.t('analysis.suggestEasy'),
    [Intensity.NORMAL]: i18n.t('analysis.suggestNormal'),
    [Intensity.HIGH]: i18n.t('analysis.suggestHigh'),
    [Intensity.OVER]: i18n.t('analysis.suggestOver'),
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
    risks.push(i18n.t('analysis.riskHighHR'));
  }

  // 近2天连续高强度
  const recent2 = recentRecords.slice(0, 2);
  const consecutive = recent2.every(r => r.intensity >= Intensity.HIGH);
  if (consecutive && recent2.length >= 2) {
    risks.push(i18n.t('analysis.riskConsecutive'));
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

// ===== 丰富训练反馈 =====

export interface RichFeedbackInsight {
  key: string;
  icon: string;
  title: string;
  detail: string;
  variant: 'positive' | 'neutral' | 'warning';
}

export interface TomorrowRecommendation {
  type: string;       // 训练类型名称
  distanceRange: string; // 建议距离，如 "8–10 km"
  paceHint: string;   // 配速建议
  reason: string;     // 原因说明
}

export interface RichFeedback {
  insights: RichFeedbackInsight[];
  tomorrow: TomorrowRecommendation;
}

/** E 区配速辅助（内联，避免循环依赖 VDOTEngine） */
function eZonePace(vdot: number): { min: number; max: number } {
  const paceAtPct = (pct: number): number => {
    const vo2 = vdot * pct;
    const a = 0.000104, b = 0.182258, c = -4.60 - vo2;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return 480;
    const speed = (-b + Math.sqrt(disc)) / (2 * a);
    return speed > 0 ? (1000 / speed) * 60 : 480;
  };
  return { min: paceAtPct(0.74), max: paceAtPct(0.59) };
}

function fmtPaceSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}'${s.toString().padStart(2, '0')}"`;
}

function buildPaceComparisonInsight(
  record: RunRecord,
  history: RunRecord[]
): RichFeedbackInsight | null {
  const validHistory = history.filter(r => r.distance >= 3 && r.avg_pace > 0).slice(0, 15);
  if (validHistory.length < 3 || record.distance < 3) return null;

  const totalDist = validHistory.reduce((s, r) => s + r.distance, 0);
  const weightedAvgPace = validHistory.reduce((s, r) => s + r.avg_pace * r.distance, 0) / totalDist;
  const pctDiff = (record.avg_pace - weightedAvgPace) / weightedAvgPace * 100;
  const abs = Math.abs(pctDiff).toFixed(1);

  if (pctDiff < -5) return { key: 'pace', icon: '🚀', title: `配速比近期快 ${abs}%`, detail: '今日状态出色，跑出了高水平表现', variant: 'positive' };
  if (pctDiff < -2) return { key: 'pace', icon: '📈', title: `配速快于近期均值 ${abs}%`, detail: '发挥稳定，训练效果持续体现', variant: 'positive' };
  if (pctDiff <= 2)  return { key: 'pace', icon: '➡️', title: '配速与近期水平相当', detail: '节奏稳定，训练连贯性良好', variant: 'neutral' };
  if (pctDiff <= 5)  return { key: 'pace', icon: '🌡️', title: `配速比近期慢 ${abs}%`, detail: '轻度偏慢，可能是气候或轻度疲劳', variant: 'neutral' };
  return { key: 'pace', icon: '⚠️', title: `配速比近期慢 ${abs}%`, detail: '明显偏慢，注意是否有睡眠不足或过度疲劳', variant: 'warning' };
}

function buildVDOTTrendInsight(
  record: RunRecord,
  history: RunRecord[]
): RichFeedbackInsight | null {
  const currentVDOT = record.vdot;
  if (!currentVDOT || currentVDOT <= 0 || record.distance < 3) return null;

  const validHistory = history.filter(r => r.distance >= 3 && r.vdot && r.vdot > 0).slice(0, 5);
  if (validHistory.length < 2) {
    return { key: 'vdot', icon: '🏃', title: `跑力 VDOT ${currentVDOT.toFixed(1)}`, detail: '继续积累数据，即可看到跑力变化趋势', variant: 'neutral' };
  }

  const sorted = [...validHistory.map(r => r.vdot!)].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const diff = currentVDOT - median;

  if (diff >= 1.5) return { key: 'vdot', icon: '🔥', title: `跑力 VDOT ${currentVDOT.toFixed(1)}，近期最佳`, detail: `较近期中位值提升 ${diff.toFixed(1)}，有氧能力显著成长`, variant: 'positive' };
  if (diff >= 0.5) return { key: 'vdot', icon: '📈', title: `跑力 VDOT ${currentVDOT.toFixed(1)}，稳步提升`, detail: `较近期高 ${diff.toFixed(1)}，训练效果持续显现`, variant: 'positive' };
  if (diff >= -0.5) return { key: 'vdot', icon: '⚖️', title: `跑力 VDOT ${currentVDOT.toFixed(1)}，稳定发挥`, detail: '与近期水平相当，基础扎实', variant: 'neutral' };
  return { key: 'vdot', icon: '📉', title: `跑力 VDOT ${currentVDOT.toFixed(1)}`, detail: `较近期低 ${Math.abs(diff).toFixed(1)}，可能受疲劳或距离较短影响`, variant: 'neutral' };
}

function buildHREfficiencyInsight(
  record: RunRecord,
  history: RunRecord[]
): RichFeedbackInsight | null {
  if (record.avg_hr <= 0 || record.avg_pace <= 0 || record.distance < 0.1) return null;
  const validHistory = history.filter(r => r.avg_hr > 0 && r.avg_pace > 0 && r.distance >= 0.1).slice(0, 10);
  if (validHistory.length < 2) return null;

  const currentEff = record.avg_pace / record.avg_hr;
  const avgEff = validHistory.reduce((s, r) => s + r.avg_pace / r.avg_hr, 0) / validHistory.length;
  const pctDiff = (currentEff - avgEff) / avgEff * 100;

  if (pctDiff < -5) return { key: 'efficiency', icon: '💚', title: '心率效率优秀', detail: '同等心率跑出更快配速，心肺适应性提升', variant: 'positive' };
  if (pctDiff <= 5)  return { key: 'efficiency', icon: '💙', title: '心率效率正常', detail: '心肺负荷与配速匹配良好', variant: 'neutral' };
  return { key: 'efficiency', icon: '🫀', title: '心率效率偏低', detail: '相同配速下心率偏高，注意疲劳或脱水状态', variant: 'warning' };
}

function buildRPEInsight(record: RunRecord): RichFeedbackInsight | null {
  if (!record.rpe || record.rpe < 1) return null;
  const objectiveRpe: Record<number, number> = {
    [Intensity.EASY]: 3,
    [Intensity.NORMAL]: 5,
    [Intensity.HIGH]: 7.5,
    [Intensity.OVER]: 10,
  };
  const expected = objectiveRpe[record.intensity as Intensity] ?? 5;
  const diff = record.rpe - expected;

  if (diff >= 3) return { key: 'rpe', icon: '😮‍💨', title: `主观感受比心率更累（RPE ${record.rpe}）`, detail: '可能有睡眠不足、精神压力或隐性疲劳，建议今晚早睡', variant: 'warning' };
  if (diff <= -3) return { key: 'rpe', icon: '😎', title: `感觉比心率轻松（RPE ${record.rpe}）`, detail: '状态良好，有氧基础在提升，身体适应性增强', variant: 'positive' };
  return null;
}

function buildTomorrowRecommendation(
  record: RunRecord,
  profile: UserProfile
): TomorrowRecommendation {
  const { intensity, distance, vdot } = record;

  let ePaceHint = '轻松对话配速';
  let ePaceExtreme = '极松（可轻松说完整句子）';
  if (vdot && vdot > 0) {
    const zone = eZonePace(vdot);
    ePaceHint = `E区 ${fmtPaceSec(zone.min)}–${fmtPaceSec(zone.max)}/km`;
    ePaceExtreme = `极松 >${fmtPaceSec(zone.max)}/km`;
  }

  if (intensity >= Intensity.OVER) {
    return { type: '完全休息', distanceRange: '0 km', paceHint: '', reason: '今日强度超过乳酸阈值，建议 48 小时内不跑，补充碳水和睡眠是关键。' };
  }
  if (intensity === Intensity.HIGH) {
    if (distance >= 15) {
      return { type: '完全休息', distanceRange: '0 km', paceHint: '', reason: '高强度长距离消耗大，肌糖原需要 24–48 小时恢复，明天完全休息。' };
    }
    return { type: '恢复跑', distanceRange: '4–6 km', paceHint: ePaceExtreme, reason: '高强度后肌肉微损伤，明天只能极松恢复跑，心率控制在 140 以下。' };
  }
  if (intensity === Intensity.NORMAL) {
    return { type: '轻松跑', distanceRange: '6–8 km', paceHint: ePaceHint, reason: '中等强度后约 24 小时恢复，明天轻松有氧促进血液循环和肌肉修复。' };
  }
  // EASY
  if (distance >= 20) {
    return { type: '轻松跑', distanceRange: '6–8 km', paceHint: ePaceHint, reason: '今日完成长距离，明天保持短距离轻松跑，让肌肉得到充分恢复。' };
  }
  if (distance >= 10) {
    return { type: '轻松跑', distanceRange: '8–12 km', paceHint: ePaceHint, reason: '今日轻松跑状态良好，明天可继续积累有氧里程，或最后 2km 微加速。' };
  }
  return { type: '轻松跑或质量课', distanceRange: '8–12 km', paceHint: ePaceHint, reason: '今日训练量偏少，体能恢复充分，明天可加强训练或补充有氧里程。' };
}

/**
 * 生成丰富的训练后反馈，包含多维数据对比与明日处方
 */
export function buildRichFeedback(
  record: RunRecord,
  allRecords: RunRecord[],
  profile: UserProfile
): RichFeedback {
  const history = allRecords.filter(r => r.id !== record.id);
  const insights: RichFeedbackInsight[] = [];

  const pace = buildPaceComparisonInsight(record, history);
  if (pace) insights.push(pace);

  const vdot = buildVDOTTrendInsight(record, history);
  if (vdot) insights.push(vdot);

  const eff = buildHREfficiencyInsight(record, history);
  if (eff) insights.push(eff);

  const rpe = buildRPEInsight(record);
  if (rpe) insights.push(rpe);

  return { insights, tomorrow: buildTomorrowRecommendation(record, profile) };
}

// ===== 恢复计划（TSB < -30 时自动生成） =====

export interface RecoveryDayPlan {
  day: number;        // 第几天（1-7）
  label: string;      // 训练类型标签，如 "完全休息" / "恢复跑" / "轻松跑"
  tasks: string[];    // 具体活动描述
  objective: string;  // 核心目的
  isRunDay: boolean;  // 是否跑步日
}

export interface RecoveryWeekPlan {
  weekNumber: number;
  weekTitle: string;    // "压疲劳周" / "重建周"
  weekSubtitle: string; // "总跑量约 Xkm"
  days: RecoveryDayPlan[];
}

export interface RecoveryPlan {
  weeks: RecoveryWeekPlan[];
  summary: string; // 整体说明，说明为什么需要恢复及预期效果
}

/**
 * 根据用户真实数据智能生成 1-4 周恢复计划
 * 周数根据 TSB 深度动态决定：
 * - TSB >= -30: 无需计划
 * - -50 < TSB < -30: 1周压疲劳计划
 * - -70 < TSB <= -50: 2周（1周压疲劳 + 1周重建）
 * - TSB <= -70: 3周（1周压疲劳 + 2周重建）
 * @param tsb  当前 TSB（TSB < -30 才会生成计划）
 * @param ctl  当前 CTL（体能水平，影响建议跑量）
 * @param vdot 当前 VDOT（影响配速描述）
 */
export function generateRecoveryPlan(
  tsb: number,
  ctl: number = 0,
  vdot: number = 0
): RecoveryPlan | null {
  if (tsb >= -30) return null;

  // ── 配速描述辅助函数 ──────────────────────────────────
  const fmtPace = (secPerKm: number): string => {
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}'${s.toString().padStart(2, '0')}"`;
  };

  // 轻松跑配速：E 区慢端（约 59% VO2max），无 VDOT 时用文字兜底
  let easyPaceDesc = '比平时配速慢 30-40 秒';
  let recoPaceDesc = '极慢，可以轻松说话';
  let tempoKm = 5;
  let easyKmWeek1 = 6;  // 第1周单次轻松跑距离
  let easyKmWeek2 = 10; // 第2周单次轻松跑距离

  if (vdot > 0) {
    // E 区：约 59-74% VO2max → 慢端（59%）用于恢复周
    const v = vdot;
    const paceAtPct = (pct: number): number => {
      const vo2 = v * pct;
      const a = 0.000104, b = 0.182258, c = -4.60 - vo2;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return 480;
      const speed = (-b + Math.sqrt(disc)) / (2 * a);
      return speed > 0 ? (1000 / speed) * 60 : 480;
    };
    const ePaceSlow = paceAtPct(0.59);   // E 区慢端，恢复跑用
    const ePaceFast = paceAtPct(0.70);   // E 区中段，轻松跑用
    easyPaceDesc = `E区 ${fmtPace(ePaceFast)} /km`;
    recoPaceDesc = `极松 ${fmtPace(ePaceSlow)} /km`;
    tempoKm = Math.min(8, Math.max(4, Math.round(ctl * 0.08)));
  }

  // 基于 CTL 调整第1周跑量（CTL 越高体能越好，恢复期也能跑多一点）
  easyKmWeek1 = Math.min(10, Math.max(4, Math.round(ctl * 0.10)));
  easyKmWeek2 = Math.min(16, Math.max(8, Math.round(ctl * 0.16)));
  const week1TotalKm = Math.round(easyKmWeek1 * 2 + 2); // 约两次轻松跑
  const week2TotalKm = Math.round(easyKmWeek2 * 2 + tempoKm + 4); // 逐步重建

  // ── 第 1 周：压疲劳 ──────────────────────────────────
  const week1: RecoveryWeekPlan = {
    weekNumber: 1,
    weekTitle: '压疲劳周',
    weekSubtitle: `总跑量约 ${week1TotalKm}km`,
    days: [
      {
        day: 1,
        label: '完全休息',
        tasks: ['完全休息或 2km 以内散步', '保证 7-9 小时睡眠'],
        objective: '让 ATL（急性疲劳）快速开始下降',
        isRunDay: false,
      },
      {
        day: 2,
        label: '完全休息',
        tasks: ['完全休息', '热水泡脚或肌肉热敷 15 分钟'],
        objective: '深度修复，缓解肌肉酸痛',
        isRunDay: false,
      },
      {
        day: 3,
        label: '恢复跑',
        tasks: [
          `${easyKmWeek1}km 极轻松跑（${recoPaceDesc}）`,
          '跑完全身拉伸 10 分钟',
        ],
        objective: '维持跑步路感，不堆积新疲劳',
        isRunDay: true,
      },
      {
        day: 4,
        label: '主动恢复',
        tasks: ['完全休息或瑜伽 20 分钟', '泡沫轴放松腿部 10 分钟'],
        objective: '放松筋膜，加速代谢废物排出',
        isRunDay: false,
      },
      {
        day: 5,
        label: '轻松跑',
        tasks: [
          `${easyKmWeek1}km 轻松跑（${easyPaceDesc}）`,
          '跑前动态热身，跑后静态拉伸',
        ],
        objective: '保住体能基础，让身体感知训练刺激',
        isRunDay: true,
      },
      {
        day: 6,
        label: '完全休息',
        tasks: ['完全休息', '充足碳水摄入，为明天蓄能'],
        objective: '蓄能，准备小测试跑',
        isRunDay: false,
      },
      {
        day: 7,
        label: '测试跑',
        tasks: [
          `2km 慢跑热身 + ${tempoKm}km 轻松有氧（${easyPaceDesc}）`,
          '2km 慢走冷身',
        ],
        objective: '感受恢复进度，不追速度，只管感觉',
        isRunDay: true,
      },
    ],
  };

  // 根据 TSB 深度决定需要几周
  if (tsb > -50) {
    return {
      weeks: [week1],
      summary: `当前疲劳指数 TSB ${tsb.toFixed(0)}，超出安全阈值（-30）。本计划帮助你在 1 周内将 TSB 提升至 -10 以上，同时尽量保住体能（CTL）。`,
    };
  }

  // ── 第 2 周：重建 ──────────────────────────────────
  const week2: RecoveryWeekPlan = {
    weekNumber: 2,
    weekTitle: '重建周',
    weekSubtitle: `总跑量约 ${week2TotalKm}km`,
    days: [
      {
        day: 1,
        label: '轻松跑',
        tasks: [
          `${Math.round(easyKmWeek2 * 0.7)}km 轻松跑（${easyPaceDesc}）`,
          '轻微拉伸',
        ],
        objective: '低强度重建训练节奏',
        isRunDay: true,
      },
      {
        day: 2,
        label: '主动恢复',
        tasks: ['完全休息或散步', '泡沫轴放松 15 分钟'],
        objective: '维持恢复节奏，不过度积累负荷',
        isRunDay: false,
      },
      {
        day: 3,
        label: '轻松跑',
        tasks: [
          `${easyKmWeek2}km 轻松跑（${easyPaceDesc}）`,
          '跑完全身拉伸',
        ],
        objective: '逐步恢复训练量，感受体能回升',
        isRunDay: true,
      },
      {
        day: 4,
        label: '主动恢复',
        tasks: ['完全休息或低强度交叉训练（骑车 / 游泳 30 分钟）'],
        objective: '保持心肺活跃，不给腿部增加冲击',
        isRunDay: false,
      },
      {
        day: 5,
        label: '有氧强化',
        tasks: [
          `${easyKmWeek2}km 轻松跑（${easyPaceDesc}）`,
          '最后 2km 加速至马拉松配速收尾',
        ],
        objective: '在有氧范围内恢复训练刺激感',
        isRunDay: true,
      },
      {
        day: 6,
        label: '完全休息',
        tasks: ['休息', '碳水补充，充足睡眠'],
        objective: '为长距离做准备',
        isRunDay: false,
      },
      {
        day: 7,
        label: '长距离',
        tasks: [
          `${tempoKm + 4}km 轻松长跑（${easyPaceDesc}）`,
          '2km 慢走冷身 + 拉伸',
        ],
        objective: '重建有氧基础，检验恢复效果',
        isRunDay: true,
      },
    ],
  };

  // TSB <= -50: 2周恢复计划
  if (tsb > -70) {
    return {
      weeks: [week1, week2],
      summary: `当前疲劳指数 TSB ${tsb.toFixed(0)}，严重超出安全阈值。本计划 2 周内循序渐进恢复训练，预计第 1 周末 TSB 回升至 -25，第 2 周末恢复至 -5 左右。`,
    };
  }

  // ── 第 3 周：正常化重建 ──────────────────────────────────
  const week3: RecoveryWeekPlan = {
    weekNumber: 3,
    weekTitle: '正常化重建周',
    weekSubtitle: `总跑量约 ${Math.round(week2TotalKm * 1.2)}km`,
    days: [
      {
        day: 1,
        label: '轻松跑',
        tasks: [
          `${easyKmWeek2}km 轻松跑（${easyPaceDesc}）`,
          '跑后全身拉伸',
        ],
        objective: '恢复正常训练节奏',
        isRunDay: true,
      },
      {
        day: 2,
        label: '主动恢复',
        tasks: ['完全休息或交叉训练'],
        objective: '维持恢复质量',
        isRunDay: false,
      },
      {
        day: 3,
        label: '有氧跑',
        tasks: [
          `${Math.round(easyKmWeek2 * 1.2)}km 轻松跑（${easyPaceDesc}）`,
          '最后 1km 提速至马拉松配速',
        ],
        objective: '重建有氧能力，恢复配速感',
        isRunDay: true,
      },
      {
        day: 4,
        label: '完全休息',
        tasks: ['休息', '充足睡眠'],
        objective: '准备质量课',
        isRunDay: false,
      },
      {
        day: 5,
        label: '节奏跑',
        tasks: [
          `${Math.round(tempoKm * 1.2)}km 节奏跑（略快于${easyPaceDesc}）`,
          '跑前充分热身，跑后拉伸',
        ],
        objective: '恢复乳酸阈值刺激',
        isRunDay: true,
      },
      {
        day: 6,
        label: '完全休息',
        tasks: ['休息', '碳水补充'],
        objective: '为长距离做准备',
        isRunDay: false,
      },
      {
        day: 7,
        label: '长距离',
        tasks: [
          `${Math.round((tempoKm + 4) * 1.3)}km 长距离（${easyPaceDesc}）`,
          '2km 慢走冷身',
        ],
        objective: '完全恢复有氧基础能力',
        isRunDay: true,
      },
    ],
  };

  // TSB <= -70: 3周恢复计划
  return {
    weeks: [week1, week2, week3],
    summary: `当前疲劳指数 TSB ${tsb.toFixed(0)}，非常严重超标。本计划 3 周系统性恢复，预计第 1 周末 TSB 回升至 -40，第 2 周末至 -20，第 3 周末恢复至 0 附近。`,
  };
}
