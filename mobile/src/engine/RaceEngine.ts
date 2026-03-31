/**
 * RaceEngine - 比赛备赛助手（全马专用）
 * 纯函数，无副作用
 */

import i18n from '../i18n';
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
      note: i18n.t('analysis.conservativeStartNote'),
    },
    {
      segment: '10–30km',
      paceSec: targetPaceSec,
      paceLabel: formatPace(targetPaceSec),
      note: i18n.t('analysis.maintainPaceNote'),
    },
    {
      segment: '30km+',
      paceSec: targetPaceSec + 5,
      paceLabel: formatPace(targetPaceSec + 5),
      note: i18n.t('analysis.conservativeFinishNote'),
    },
  ];
}

// ===== 补给策略 =====
export function buildGelStrategy(): GelStrategy[] {
  return [
    { km: 10, note: i18n.t('analysis.gel1Note') },
    { km: 20, note: i18n.t('analysis.gel2Note') },
    { km: 30, note: i18n.t('analysis.gel3Note') },
  ];
}

// ===== 赛前 10 天计划 =====
export function buildPreRacePlan(): PreRacePlan[] {
  return [
    { days: i18n.t('analysis.preRaceDays10_7'), plan: i18n.t('analysis.preRacePlan10_7') },
    { days: i18n.t('analysis.preRaceDays6_3'), plan: i18n.t('analysis.preRacePlan6_3') },
    { days: i18n.t('analysis.preRaceDays2_1'), plan: i18n.t('analysis.preRacePlan2_1') },
    { days: i18n.t('analysis.preRaceDayRace'), plan: i18n.t('analysis.preRacePlanRace') },
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
