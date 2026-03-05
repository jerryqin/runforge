/**
 * RaceEngine - 比赛备赛助手（全马专用）
 * 纯函数，无副作用
 */

import { formatPace } from './AnalysisEngine';

const MARATHON_KM = 42.195;

export interface RacePlanInput {
  raceDate: string;         // "2026-10-18"
  targetTimeSec: number;    // 目标完赛秒数
}

export interface SegmentStrategy {
  segment: string;
  paceSec: number;
  paceLabel: string;
  note: string;
}

export interface GelStrategy {
  km: number;
  note: string;
}

export interface PreRacePlan {
  days: string;
  plan: string;
}

export interface RacePlanOutput {
  targetTimeSec: number;
  targetTimeLabel: string;    // "4:00:00"
  targetPaceSec: number;
  targetPaceLabel: string;    // "5'41\""
  daysUntilRace: number;
  segments: SegmentStrategy[];
  gels: GelStrategy[];
  preRacePlan: PreRacePlan[];
  vdot: number;
}

// ===== 目标配速计算 =====
export function calcTargetPace(targetTimeSec: number): number {
  return targetTimeSec / MARATHON_KM;
}

// ===== VDOT 估算（Jack Daniels 简化公式）=====
// 基于全马完赛时间的近似估算
export function estimateVDOT(targetTimeSec: number): number {
  const hours = targetTimeSec / 3600;
  // 近似映射表插值
  if (hours <= 2.5) return 60;
  if (hours <= 3.0) return 54;
  if (hours <= 3.5) return 47;
  if (hours <= 4.0) return 42;
  if (hours <= 4.5) return 38;
  if (hours <= 5.0) return 34;
  return 30;
}

// ===== 分段配速策略 =====
export function buildSegments(targetPaceSec: number): SegmentStrategy[] {
  return [
    {
      segment: '0–10km',
      paceSec: targetPaceSec + 12,
      paceLabel: formatPace(targetPaceSec + 12),
      note: '保守起跑，比目标慢 10–15 秒，避免透支',
    },
    {
      segment: '10–30km',
      paceSec: targetPaceSec,
      paceLabel: formatPace(targetPaceSec),
      note: '按目标配速稳定推进',
    },
    {
      segment: '30km 后',
      paceSec: targetPaceSec + 5,
      paceLabel: formatPace(targetPaceSec + 5),
      note: '保守维持，优先完赛，不强求配速',
    },
  ];
}

// ===== 补给策略 =====
export function buildGelStrategy(): GelStrategy[] {
  return [
    { km: 10, note: '第 1 支能量胶，配水服下' },
    { km: 20, note: '第 2 支能量胶，补充碳水' },
    { km: 30, note: '第 3 支能量胶，最关键补给点' },
  ];
}

// ===== 赛前 10 天计划 =====
export function buildPreRacePlan(): PreRacePlan[] {
  return [
    { days: '赛前 10–7 天', plan: '每天 6–8km 轻松跑，保持状态，不加量' },
    { days: '赛前 6–3 天', plan: '每天 5km 以内慢跑，以恢复为主' },
    { days: '赛前 2–1 天', plan: '完全休息，碳水补足，早睡' },
    { days: '比赛日', plan: '起跑前 2 小时进食，按配速策略执行' },
  ];
}

// ===== 时长格式化 =====
export function formatTargetTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ===== 计算距离比赛天数 =====
export function calcDaysUntilRace(raceDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const race = new Date(raceDate);
  return Math.ceil((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ===== 一次性计划生成入口 =====
export function generateRacePlan(input: RacePlanInput): RacePlanOutput {
  const { raceDate, targetTimeSec } = input;
  const targetPaceSec = calcTargetPace(targetTimeSec);
  const vdot = estimateVDOT(targetTimeSec);
  const daysUntilRace = calcDaysUntilRace(raceDate);

  return {
    targetTimeSec,
    targetTimeLabel: formatTargetTime(targetTimeSec),
    targetPaceSec,
    targetPaceLabel: formatPace(targetPaceSec),
    daysUntilRace,
    segments: buildSegments(targetPaceSec),
    gels: buildGelStrategy(),
    preRacePlan: buildPreRacePlan(),
    vdot,
  };
}
