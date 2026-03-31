/**
 * VDOTEngine - VDOT跑力计算 & 训练配速区间
 *
 * 基于 Jack Daniels / Jimmy Gilbert 公式
 * 纯函数实现，无副作用
 */

import i18n from '../i18n';
import { RECOVERY_LOAD_THRESHOLDS } from './AnalysisEngine';

// ===== 基础公式 =====

/** 跑步速度对应的摄氧量 (ml/kg/min)，v 单位: m/min */
function oxygenCost(v: number): number {
  return -4.60 + 0.182258 * v + 0.000104 * v * v;
}

/** 给定运动时间 t(分钟) 能维持的 %VO2max */
function vo2maxFraction(t: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
}

// ===== VDOT 计算 =====

/**
 * 从跑步表现计算 VDOT
 * @param distanceKm 距离(公里)
 * @param durationSec 用时(秒)
 * @returns VDOT 值 (通常 30-85)
 */
export function calcVDOT(distanceKm: number, durationSec: number): number {
  if (distanceKm <= 0 || durationSec <= 0) return 0;

  const distanceMeters = distanceKm * 1000;
  const timeMinutes = durationSec / 60;
  const velocity = distanceMeters / timeMinutes; // m/min

  const vo2 = oxygenCost(velocity);
  const fraction = vo2maxFraction(timeMinutes);

  if (fraction <= 0) return 0;
  const vdot = vo2 / fraction;

  // 合理范围裁剪
  return Math.max(20, Math.min(85, Math.round(vdot * 10) / 10));
}

// ===== 赛事成绩预测 =====

/** 二分搜索预测给定VDOT在指定距离的完赛时间(秒) */
export function predictTime(vdot: number, distanceKm: number): number {
  if (vdot <= 0 || distanceKm <= 0) return 0;

  const distM = distanceKm * 1000;
  let lo = 1;   // 1 分钟
  let hi = 600;  // 10 小时

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = distM / mid;
    const vo2 = oxygenCost(v);
    const frac = vo2maxFraction(mid);
    const est = vo2 / frac;

    if (est > vdot) {
      lo = mid; // 速度太快 → 增加时间
    } else {
      hi = mid;
    }
  }

  return Math.round(((lo + hi) / 2) * 60); // 转为秒
}

/** 标准赛事距离(km) */
export const RACE_DISTANCES = {
  '5K': 5,
  '10K': 10,
  '半马': 21.0975,
  '全马': 42.195,
} as const;

export type RaceDistanceName = keyof typeof RACE_DISTANCES;

/** 预测所有标准赛事成绩 */
export function predictAllRaces(vdot: number): Record<RaceDistanceName, number> {
  const result = {} as Record<RaceDistanceName, number>;
  for (const [name, dist] of Object.entries(RACE_DISTANCES)) {
    result[name as RaceDistanceName] = predictTime(vdot, dist);
  }
  return result;
}

// ===== 训练配速区间 =====

export interface PaceZone {
  zone: string;         // E / M / T / I / R
  label: string;        // 中文名
  description: string;  // 简要说明
  paceMinSec: number;   // 区间快端 (sec/km)
  paceMaxSec: number;   // 区间慢端 (sec/km)
  hrPercent: [number, number]; // %HRmax 范围
}

/**
 * 从 VDOT 或 %VO2max 逆推配速 (sec/km)
 * @param vdot VDOT值
 * @param pctVO2 目标 %VO2max (0-1)
 * @param durationMin 预估运动时长(分)，用于修正
 */
function paceAtVO2Percent(vdot: number, pctVO2: number): number {
  const vo2 = vdot * pctVO2;
  // 解方程 vo2 = -4.60 + 0.182258*v + 0.000104*v²
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.60 - vo2;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 0;
  const v = (-b + Math.sqrt(discriminant)) / (2 * a); // m/min
  if (v <= 0) return 0;
  return (1000 / v) * 60; // sec/km
}

/** 从 VDOT 生成训练配速区间 */
export function calcTrainingZones(vdot: number): PaceZone[] {
  if (vdot <= 0) return [];

  return [
    {
      zone: 'E',
      label: i18n.t('trainingPlan.paceZoneEasyLabel'),
      description: i18n.t('trainingPlan.paceZoneEasyDesc'),
      paceMinSec: paceAtVO2Percent(vdot, 0.74),   // 快端 74%
      paceMaxSec: paceAtVO2Percent(vdot, 0.59),   // 慢端 59%
      hrPercent: [65, 79],
    },
    {
      zone: 'M',
      label: i18n.t('trainingPlan.paceZoneMarathonLabel'),
      description: i18n.t('trainingPlan.paceZoneMarathonDesc'),
      paceMinSec: paceAtVO2Percent(vdot, 0.84),
      paceMaxSec: paceAtVO2Percent(vdot, 0.75),
      hrPercent: [80, 85],
    },
    {
      zone: 'T',
      label: i18n.t('trainingPlan.paceZoneThresholdLabel'),
      description: i18n.t('trainingPlan.paceZoneThresholdDesc'),
      paceMinSec: paceAtVO2Percent(vdot, 0.88),
      paceMaxSec: paceAtVO2Percent(vdot, 0.83),
      hrPercent: [85, 90],
    },
    {
      zone: 'I',
      label: i18n.t('trainingPlan.paceZoneIntervalLabel'),
      description: i18n.t('trainingPlan.paceZoneIntervalDesc'),
      paceMinSec: paceAtVO2Percent(vdot, 1.0),
      paceMaxSec: paceAtVO2Percent(vdot, 0.95),
      hrPercent: [95, 100],
    },
    {
      zone: 'R',
      label: i18n.t('trainingPlan.paceZoneRepLabel'),
      description: i18n.t('trainingPlan.paceZoneRepDesc'),
      paceMinSec: paceAtVO2Percent(vdot, 1.10),
      paceMaxSec: paceAtVO2Percent(vdot, 1.05),
      hrPercent: [100, 100],
    },
  ];
}

// ===== 每日训练处方 =====

export enum TrainingType {
  REST = 'REST',
  EASY = 'EASY',
  LONG_RUN = 'LONG_RUN',
  TEMPO = 'TEMPO',
  INTERVAL = 'INTERVAL',
  RECOVERY = 'RECOVERY',
}

/** @deprecated Use getTrainingTypeLabel() for lazy i18n evaluation */
export const TrainingTypeLabel: Record<TrainingType, string> = {
  [TrainingType.REST]: TrainingType.REST,
  [TrainingType.EASY]: TrainingType.EASY,
  [TrainingType.LONG_RUN]: TrainingType.LONG_RUN,
  [TrainingType.TEMPO]: TrainingType.TEMPO,
  [TrainingType.INTERVAL]: TrainingType.INTERVAL,
  [TrainingType.RECOVERY]: TrainingType.RECOVERY,
};

export function getTrainingTypeLabel(type: TrainingType): string {
  switch (type) {
    case TrainingType.REST: return i18n.t('trainingPlan.typeRest');
    case TrainingType.EASY: return i18n.t('trainingPlan.typeEasy');
    case TrainingType.LONG_RUN: return i18n.t('trainingPlan.typeLongRun');
    case TrainingType.TEMPO: return i18n.t('trainingPlan.typeTempo');
    case TrainingType.INTERVAL: return i18n.t('trainingPlan.typeInterval');
    case TrainingType.RECOVERY: return i18n.t('trainingPlan.typeRecovery');
  }
}

export interface TrainingPrescription {
  type: TrainingType;
  label: string;
  distance?: number;       // 建议距离(km)
  zone: string;            // 推荐配速区间 E/M/T/I
  paceRange?: string;      // 配速范围文字
  description: string;     // 详细说明
  warmup?: string;         // 热身建议
  cooldown?: string;       // 放松建议
}

/**
 * 生成每日训练处方
 * @param tsb 训练压力平衡
 * @param ctl 慢性训练负荷(体能)
 * @param consecutiveHighDays 连续高强度天数
 * @param daysSinceLastRun 距上次跑步天数
 * @param weeklyKm 本周已跑公里数
 * @param zones 训练配速区间
 * @param weekday 星期几 (0=周日, 1=周一...)
 */
export function generatePrescription(params: {
  tsb: number;
  ctl: number;
  consecutiveHighDays: number;
  daysSinceLastRun: number;
  weeklyKm: number;
  weeklyTargetKm: number;
  zones: PaceZone[];
  weekday: number;
}): TrainingPrescription {
  const { tsb, ctl, consecutiveHighDays, daysSinceLastRun, weeklyKm, weeklyTargetKm, zones, weekday } = params;

  const eZone = zones.find(z => z.zone === 'E');
  const tZone = zones.find(z => z.zone === 'T');
  const iZone = zones.find(z => z.zone === 'I');
  const mZone = zones.find(z => z.zone === 'M');

  const formatPaceRange = (z: PaceZone | undefined): string => {
    if (!z) return '';
    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.round(s % 60);
      return `${m}'${sec.toString().padStart(2, '0')}"`;
    };
    return `${fmt(z.paceMinSec)} ~ ${fmt(z.paceMaxSec)}`;
  };

  // ===== 强制休息规则 =====
  if (consecutiveHighDays >= 2) {
    return {
      type: TrainingType.REST,
      label: i18n.t('analysis.restDayLabel'),
      zone: '-',
      description: i18n.t('analysis.restAfterHighDays'),
    };
  }

  if (tsb < RECOVERY_LOAD_THRESHOLDS.restTsb) {
    return {
      type: TrainingType.REST,
      label: i18n.t('analysis.restDayLabel'),
      zone: '-',
      description: i18n.t('analysis.restHighFatigue', { threshold: RECOVERY_LOAD_THRESHOLDS.restTsb }),
    };
  }

  // ===== 恢复日 =====
  if (tsb < RECOVERY_LOAD_THRESHOLDS.recoveryRunTsb) {
    return {
      type: TrainingType.RECOVERY,
      label: i18n.t('analysis.recoveryRunLabel'),
      distance: 4,
      zone: 'E',
      paceRange: formatPaceRange(eZone),
      description: i18n.t('analysis.bodyRecovering'),
      warmup: i18n.t('analysis.recoveryRunWarmup'),
    };
  }

  // ===== 正常训练节奏 =====

  // 周六: 长距离
  if (weekday === 6) {
    const longDist = Math.max(12, Math.round(weeklyTargetKm * 0.3));
    return {
      type: TrainingType.LONG_RUN,
      label: i18n.t('analysis.longRunLabel'),
      distance: Math.min(longDist, 32),
      zone: 'E',
      paceRange: formatPaceRange(eZone),
      description: i18n.t('analysis.longRunDesc'),
      warmup: i18n.t('analysis.longRunWarmup'),
      cooldown: i18n.t('analysis.longRunCooldown'),
    };
  }

  // 周二: 节奏跑 / 间歇跑（交替）
  if (weekday === 2) {
    if (tsb > RECOVERY_LOAD_THRESHOLDS.readyTsb) {
      // 状态好 → 间歇
      return {
        type: TrainingType.INTERVAL,
        label: i18n.t('analysis.intervalLabel'),
        distance: 8,
        zone: 'I',
        paceRange: formatPaceRange(iZone),
        description: i18n.t('analysis.intervalDesc'),
        warmup: i18n.t('analysis.intervalWarmup'),
        cooldown: i18n.t('analysis.intervalCooldown'),
      };
    } else {
      // 状态一般 → 节奏跑
      return {
        type: TrainingType.TEMPO,
        label: i18n.t('analysis.tempoLabel'),
        distance: 8,
        zone: 'T',
        paceRange: formatPaceRange(tZone),
        description: i18n.t('analysis.tempoDesc'),
        warmup: i18n.t('analysis.tempoWarmup'),
        cooldown: i18n.t('analysis.tempoCooldown'),
      };
    }
  }

  // 周四: 马拉松配速或节奏跑
  if (weekday === 4) {
    return {
      type: TrainingType.TEMPO,
      label: i18n.t('analysis.marathonTempoLabel'),
      distance: 10,
      zone: 'M',
      paceRange: formatPaceRange(mZone),
      description: i18n.t('analysis.marathonTempoDesc'),
      warmup: i18n.t('analysis.marathonWarmup'),
      cooldown: i18n.t('analysis.marathonCooldown'),
    };
  }

  // 其余天: 轻松跑 or 休息
  if (weekday === 1 || weekday === 5) {
    // 周一/周五: 轻松跑
    return {
      type: TrainingType.EASY,
      label: i18n.t('analysis.easyRunLabel'),
      distance: Math.round(weeklyTargetKm * 0.12),
      zone: 'E',
      paceRange: formatPaceRange(eZone),
      description: i18n.t('analysis.easyRunDesc'),
    };
  }

  // 周日/周三: 休息或恢复
  if (daysSinceLastRun <= 0) {
    return {
      type: TrainingType.REST,
      label: i18n.t('analysis.restDayLabel'),
      zone: '-',
      description: i18n.t('analysis.activeRecoveryDesc'),
    };
  }

  return {
    type: TrainingType.EASY,
    label: i18n.t('analysis.easyRunLabel'),
    distance: 6,
    zone: 'E',
    paceRange: formatPaceRange(eZone),
    description: i18n.t('analysis.easyRunDesc2'),
  };
}
