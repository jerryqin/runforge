/**
 * VDOTEngine - VDOT跑力计算 & 训练配速区间
 *
 * 基于 Jack Daniels / Jimmy Gilbert 公式
 * 纯函数实现，无副作用
 */

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
      label: '轻松跑',
      description: '有氧基础，可轻松对话',
      paceMinSec: paceAtVO2Percent(vdot, 0.74),   // 快端 74%
      paceMaxSec: paceAtVO2Percent(vdot, 0.59),   // 慢端 59%
      hrPercent: [65, 79],
    },
    {
      zone: 'M',
      label: '马拉松配速',
      description: '比赛配速，稳定持久',
      paceMinSec: paceAtVO2Percent(vdot, 0.84),
      paceMaxSec: paceAtVO2Percent(vdot, 0.75),
      hrPercent: [80, 85],
    },
    {
      zone: 'T',
      label: '乳酸阈值',
      description: '节奏跑，刚好能坚持的难度',
      paceMinSec: paceAtVO2Percent(vdot, 0.88),
      paceMaxSec: paceAtVO2Percent(vdot, 0.83),
      hrPercent: [85, 90],
    },
    {
      zone: 'I',
      label: '间歇跑',
      description: '提升最大摄氧量，3-5分钟组',
      paceMinSec: paceAtVO2Percent(vdot, 1.0),
      paceMaxSec: paceAtVO2Percent(vdot, 0.95),
      hrPercent: [95, 100],
    },
    {
      zone: 'R',
      label: '重复跑',
      description: '改善跑步经济性，200-400m短冲',
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

export const TrainingTypeLabel: Record<TrainingType, string> = {
  [TrainingType.REST]: '休息',
  [TrainingType.EASY]: '轻松跑',
  [TrainingType.LONG_RUN]: '长距离',
  [TrainingType.TEMPO]: '节奏跑',
  [TrainingType.INTERVAL]: '间歇跑',
  [TrainingType.RECOVERY]: '恢复跑',
};

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
      label: '休息日',
      zone: '-',
      description: '连续高强度训练后必须休息，让身体充分恢复。',
    };
  }

  if (tsb < -30) {
    return {
      type: TrainingType.REST,
      label: '休息日',
      zone: '-',
      description: '身体疲劳指数较高(TSB < -30)，建议完全休息或极轻松散步。',
    };
  }

  // ===== 恢复日 =====
  if (tsb < -15) {
    return {
      type: TrainingType.RECOVERY,
      label: '恢复跑',
      distance: 4,
      zone: 'E',
      paceRange: formatPaceRange(eZone),
      description: '身体仍在恢复中，以极低强度慢跑促进血液循环。',
      warmup: '步行 5 分钟',
    };
  }

  // ===== 正常训练节奏 =====

  // 周六: 长距离
  if (weekday === 6) {
    const longDist = Math.max(12, Math.round(weeklyTargetKm * 0.3));
    return {
      type: TrainingType.LONG_RUN,
      label: '长距离跑',
      distance: Math.min(longDist, 32),
      zone: 'E',
      paceRange: formatPaceRange(eZone),
      description: '本周长距离训练，保持轻松配速，建立有氧耐力。',
      warmup: '慢跑 10 分钟热身',
      cooldown: '慢跑 5 分钟 + 拉伸',
    };
  }

  // 周二: 节奏跑 / 间歇跑（交替）
  if (weekday === 2) {
    if (tsb > 0) {
      // 状态好 → 间歇
      return {
        type: TrainingType.INTERVAL,
        label: '间歇训练',
        distance: 8,
        zone: 'I',
        paceRange: formatPaceRange(iZone),
        description: '状态良好，进行间歇训练提升最大摄氧量。\n建议: 1km×5 组，组间慢跑 400m 恢复。',
        warmup: '慢跑 15 分钟 + 动态拉伸',
        cooldown: '慢跑 10 分钟 + 静态拉伸',
      };
    } else {
      // 状态一般 → 节奏跑
      return {
        type: TrainingType.TEMPO,
        label: '节奏跑',
        distance: 8,
        zone: 'T',
        paceRange: formatPaceRange(tZone),
        description: '进行乳酸阈值训练，提升持续配速能力。\n建议: 热身后连续跑 20-30 分钟。',
        warmup: '慢跑 15 分钟',
        cooldown: '慢跑 10 分钟',
      };
    }
  }

  // 周四: 马拉松配速或节奏跑
  if (weekday === 4) {
    return {
      type: TrainingType.TEMPO,
      label: '马拉松配速跑',
      distance: 10,
      zone: 'M',
      paceRange: formatPaceRange(mZone),
      description: '按马拉松比赛配速进行专项训练。\n建议: 热身后以 M 配速跑 30-40 分钟。',
      warmup: '慢跑 10 分钟',
      cooldown: '慢跑 10 分钟',
    };
  }

  // 其余天: 轻松跑 or 休息
  if (weekday === 1 || weekday === 5) {
    // 周一/周五: 轻松跑
    return {
      type: TrainingType.EASY,
      label: '轻松跑',
      distance: Math.round(weeklyTargetKm * 0.12),
      zone: 'E',
      paceRange: formatPaceRange(eZone),
      description: '轻松有氧跑，保持跑量但不增加疲劳。可轻松对话。',
    };
  }

  // 周日/周三: 休息或恢复
  if (daysSinceLastRun <= 0) {
    return {
      type: TrainingType.REST,
      label: '休息日',
      zone: '-',
      description: '主动恢复日，完全休息或散步、瑜伽等交叉训练。',
    };
  }

  return {
    type: TrainingType.EASY,
    label: '轻松跑',
    distance: 6,
    zone: 'E',
    paceRange: formatPaceRange(eZone),
    description: '轻松有氧跑，以舒适的节奏享受跑步。',
  };
}
