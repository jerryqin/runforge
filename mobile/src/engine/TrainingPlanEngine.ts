/**
 * TrainingPlanEngine - 周期化训练计划生成
 *
 * 基于 Lydiard 周期化模型 + Jack Daniels 配速区间
 * 生成: 基础期 → 提升期 → 巅峰期 → 减量期
 */

import { formatPace } from './AnalysisEngine';
import i18n from '../i18n';
import { calcTrainingZones, PaceZone, TrainingType, TrainingTypeLabel } from './VDOTEngine';

// ===== 类型定义 =====

export enum PlanPhase {
  BASE = 'BASE',
  BUILD = 'BUILD',
  PEAK = 'PEAK',
  TAPER = 'TAPER',
}

export const PlanPhaseLabel: Record<PlanPhase, string> = {
  [PlanPhase.BASE]: 'BASE',
  [PlanPhase.BUILD]: 'BUILD',
  [PlanPhase.PEAK]: 'PEAK',
  [PlanPhase.TAPER]: 'TAPER',
};

export function getPlanPhaseLabel(phase: PlanPhase): string {
  switch (phase) {
    case PlanPhase.BASE: return i18n.t('trainingPlan.phaseBase');
    case PlanPhase.BUILD: return i18n.t('trainingPlan.phaseBuild');
    case PlanPhase.PEAK: return i18n.t('trainingPlan.phasePeak');
    case PlanPhase.TAPER: return i18n.t('trainingPlan.phaseTaper');
  }
}

export const PlanPhaseDescription: Record<PlanPhase, string> = {
  [PlanPhase.BASE]: 'BASE_DESC',
  [PlanPhase.BUILD]: 'BUILD_DESC',
  [PlanPhase.PEAK]: 'PEAK_DESC',
  [PlanPhase.TAPER]: 'TAPER_DESC',
};

export function getPlanPhaseDescription(phase: PlanPhase): string {
  switch (phase) {
    case PlanPhase.BASE: return i18n.t('trainingPlan.phaseBaseDesc');
    case PlanPhase.BUILD: return i18n.t('trainingPlan.phaseBuildDesc');
    case PlanPhase.PEAK: return i18n.t('trainingPlan.phasePeakDesc');
    case PlanPhase.TAPER: return i18n.t('trainingPlan.phaseTaperDesc');
  }
}

export interface DayPlan {
  dayOfWeek: number;       // 1=周一 ... 7=周日
  dayLabel: string;        // "周一"
  type: TrainingType;
  label: string;           // "轻松跑 8km"
  distance?: number;       // km
  zone: string;            // E/M/T/I/R
  paceRange?: string;      // "5'30\" ~ 6'10\""
  note?: string;           // 额外说明
}

export interface WeekPlan {
  weekNumber: number;      // 第几周
  phase: PlanPhase;
  phaseLabel: string;
  weeklyKm: number;        // 本周总跑量
  days: DayPlan[];
  focus: string;           // 本周重点
}

export interface TrainingPlan {
  totalWeeks: number;
  raceDate: string;
  targetVDOT: number;
  weeklyPeakKm: number;
  phases: {
    phase: PlanPhase;
    label: string;
    startWeek: number;
    endWeek: number;
    description: string;
  }[];
  weeks: WeekPlan[];
  zones: PaceZone[];
}

export interface PlanInput {
  raceDate: string;          // "2026-10-18"
  currentVDOT: number;       // 当前跑力
  currentWeeklyKm: number;   // 当前周跑量
  targetVDOT?: number;       // 目标跑力（可选）
}

// ===== 工具函数 =====

const DAY_LABELS = ['', 1, 2, 3, 4, 5, 6, 7] as const;

function getDayLabel(dayOfWeek: number): string {
  const keys = ['', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];
  return i18n.t(`trainingPlan.${keys[dayOfWeek]}`);
}

function weeksUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  const diffMs = target.getTime() - today.getTime();
  return Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)));
}

function formatZonePace(zones: PaceZone[], zoneKey: string): string {
  const z = zones.find(p => p.zone === zoneKey);
  if (!z) return '';
  return `${formatPace(z.paceMinSec)} ~ ${formatPace(z.paceMaxSec)}`;
}

// ===== 周期分配 =====

function allocatePhases(totalWeeks: number): { phase: PlanPhase; weeks: number }[] {
  if (totalWeeks <= 4) {
    // 时间太短，只做减量
    return [{ phase: PlanPhase.TAPER, weeks: totalWeeks }];
  }
  if (totalWeeks <= 8) {
    const taper = 2;
    const peak = 1;
    const build = Math.floor((totalWeeks - taper - peak) / 2);
    const base = totalWeeks - taper - peak - build;
    return [
      { phase: PlanPhase.BASE, weeks: base },
      { phase: PlanPhase.BUILD, weeks: build },
      { phase: PlanPhase.PEAK, weeks: peak },
      { phase: PlanPhase.TAPER, weeks: taper },
    ].filter(p => p.weeks > 0);
  }

  // 标准 12-20 周计划
  const taper = Math.min(3, Math.floor(totalWeeks * 0.15));
  const peak = Math.min(3, Math.floor(totalWeeks * 0.15));
  const build = Math.min(6, Math.floor(totalWeeks * 0.3));
  const base = totalWeeks - taper - peak - build;

  return [
    { phase: PlanPhase.BASE, weeks: base },
    { phase: PlanPhase.BUILD, weeks: build },
    { phase: PlanPhase.PEAK, weeks: peak },
    { phase: PlanPhase.TAPER, weeks: taper },
  ].filter(p => p.weeks > 0);
}

// ===== 单周计划生成 =====

function generateWeekDays(
  phase: PlanPhase,
  weeklyKm: number,
  zones: PaceZone[],
  weekInPhase: number,
): DayPlan[] {
  const days: DayPlan[] = [];

  // 按阶段分配训练类型
  switch (phase) {
    case PlanPhase.BASE:
      // 基础期: 全部Easy + 1次长距离
      days.push(day(1, TrainingType.EASY, round(weeklyKm * 0.12), 'E', zones));
      days.push(day(2, TrainingType.EASY, round(weeklyKm * 0.15), 'E', zones));
      days.push(day(3, TrainingType.REST, 0, '-', zones));
      days.push(day(4, TrainingType.EASY, round(weeklyKm * 0.15), 'E', zones));
      days.push(day(5, TrainingType.EASY, round(weeklyKm * 0.12), 'E', zones));
      days.push(day(6, TrainingType.LONG_RUN, round(weeklyKm * 0.30), 'E', zones, i18n.t('trainingPlan.longRunNote')));
      days.push(day(7, TrainingType.REST, 0, '-', zones));
      break;

    case PlanPhase.BUILD:
      // 提升期: Easy + 1次Tempo + 1次长距离
      days.push(day(1, TrainingType.EASY, round(weeklyKm * 0.12), 'E', zones));
      days.push(day(2, TrainingType.TEMPO, round(weeklyKm * 0.15), 'T', zones,
        i18n.t('trainingPlan.tempoNote')));
      days.push(day(3, TrainingType.REST, 0, '-', zones));
      days.push(day(4, TrainingType.EASY, round(weeklyKm * 0.13), 'E', zones));
      days.push(day(5, TrainingType.EASY, round(weeklyKm * 0.12), 'E', zones));
      days.push(day(6, TrainingType.LONG_RUN, round(weeklyKm * 0.28), 'E', zones,
        i18n.t('trainingPlan.longRunMNote')));
      days.push(day(7, TrainingType.REST, 0, '-', zones));
      break;

    case PlanPhase.PEAK:
      // 巅峰期: Tempo + Interval + 长距离
      days.push(day(1, TrainingType.EASY, round(weeklyKm * 0.10), 'E', zones));
      days.push(day(2, TrainingType.INTERVAL, round(weeklyKm * 0.13), 'I', zones,
        i18n.t('trainingPlan.intervalNote')));
      days.push(day(3, TrainingType.EASY, round(weeklyKm * 0.10), 'E', zones));
      days.push(day(4, TrainingType.TEMPO, round(weeklyKm * 0.15), 'T', zones,
        i18n.t('trainingPlan.peakTempoNote')));
      days.push(day(5, TrainingType.REST, 0, '-', zones));
      days.push(day(6, TrainingType.LONG_RUN, round(weeklyKm * 0.28), 'E', zones,
        i18n.t('trainingPlan.peakLongRunNote')));
      days.push(day(7, TrainingType.REST, 0, '-', zones));
      break;

    case PlanPhase.TAPER:
      // 减量期: 大幅减量，保持少量强度课
      days.push(day(1, TrainingType.EASY, round(weeklyKm * 0.15), 'E', zones));
      days.push(day(2, TrainingType.TEMPO, round(weeklyKm * 0.20), 'T', zones,
        i18n.t('trainingPlan.taperTempoNote')));
      days.push(day(3, TrainingType.REST, 0, '-', zones));
      days.push(day(4, TrainingType.EASY, round(weeklyKm * 0.15), 'E', zones));
      days.push(day(5, TrainingType.REST, 0, '-', zones));
      days.push(day(6, TrainingType.EASY, round(weeklyKm * 0.15), 'E', zones, i18n.t('trainingPlan.taperEasyNote')));
      days.push(day(7, TrainingType.REST, 0, '-', zones));
      break;
  }

  return days;
}

function getTrainingTypeLabelStr(type: TrainingType): string {
  switch (type) {
    case TrainingType.REST: return i18n.t('trainingPlan.typeRest');
    case TrainingType.EASY: return i18n.t('trainingPlan.typeEasy');
    case TrainingType.LONG_RUN: return i18n.t('trainingPlan.typeLongRun');
    case TrainingType.TEMPO: return i18n.t('trainingPlan.typeTempo');
    case TrainingType.INTERVAL: return i18n.t('trainingPlan.typeInterval');
    case TrainingType.RECOVERY: return i18n.t('trainingPlan.typeRecovery');
  }
}

function day(
  dayOfWeek: number,
  type: TrainingType,
  distance: number,
  zone: string,
  zones: PaceZone[],
  note?: string,
): DayPlan {
  const distLabel = distance > 0 ? ` ${distance}km` : '';
  return {
    dayOfWeek,
    dayLabel: getDayLabel(dayOfWeek),
    type,
    label: `${getTrainingTypeLabelStr(type)}${distLabel}`,
    distance: distance > 0 ? distance : undefined,
    zone,
    paceRange: zone !== '-' ? formatZonePace(zones, zone) : undefined,
    note,
  };
}

function round(n: number): number {
  return Math.round(n);
}

// ===== 主入口 =====

export function generateTrainingPlan(input: PlanInput): TrainingPlan | null {
  const totalWeeks = weeksUntil(input.raceDate);
  if (totalWeeks < 2) return null;

  const vdot = input.targetVDOT ?? input.currentVDOT;
  const zones = calcTrainingZones(vdot);

  // 峰值周跑量 = 当前周跑量 × 1.3 (不超过合理上限)
  const peakWeeklyKm = Math.min(
    Math.round(input.currentWeeklyKm * 1.3),
    100
  );

  const phaseAlloc = allocatePhases(Math.min(totalWeeks, 20));

  // 构建各阶段信息
  let cumWeek = 1;
  const phaseInfo = phaseAlloc.map(p => {
    const info = {
      phase: p.phase,
      label: getPlanPhaseLabel(p.phase),
      startWeek: cumWeek,
      endWeek: cumWeek + p.weeks - 1,
      description: getPlanPhaseDescription(p.phase),
    };
    cumWeek += p.weeks;
    return info;
  });

  // 生成每周计划
  const weeks: WeekPlan[] = [];
  let globalWeek = 1;

  for (const allocation of phaseAlloc) {
    for (let wi = 0; wi < allocation.weeks; wi++) {
      // 跑量递进逻辑
      let weeklyKm: number;
      const progress = wi / Math.max(1, allocation.weeks - 1);

      switch (allocation.phase) {
        case PlanPhase.BASE:
          // 从当前跑量逐步增加到峰值的80%
          weeklyKm = Math.round(
            input.currentWeeklyKm + (peakWeeklyKm * 0.8 - input.currentWeeklyKm) * progress
          );
          break;
        case PlanPhase.BUILD:
          // 从80%峰值增加到100%，每3周有1周恢复
          weeklyKm = Math.round(peakWeeklyKm * (0.8 + 0.2 * progress));
          if ((wi + 1) % 3 === 0) weeklyKm = Math.round(weeklyKm * 0.7); // 恢复周
          break;
        case PlanPhase.PEAK:
          // 维持峰值附近
          weeklyKm = Math.round(peakWeeklyKm * 0.95);
          break;
        case PlanPhase.TAPER:
          // 逐步减到50%
          weeklyKm = Math.round(peakWeeklyKm * (0.8 - 0.3 * progress));
          break;
      }

      const days = generateWeekDays(allocation.phase, weeklyKm, zones, wi);
      const actualKm = days.reduce((s, d) => s + (d.distance ?? 0), 0);

      weeks.push({
        weekNumber: globalWeek,
        phase: allocation.phase,
        phaseLabel: getPlanPhaseLabel(allocation.phase),
        weeklyKm: actualKm,
        days,
        focus: getFocusText(allocation.phase, wi, allocation.weeks),
      });

      globalWeek++;
    }
  }

  return {
    totalWeeks: weeks.length,
    raceDate: input.raceDate,
    targetVDOT: vdot,
    weeklyPeakKm: peakWeeklyKm,
    phases: phaseInfo,
    weeks,
    zones,
  };
}

function getFocusText(phase: PlanPhase, weekInPhase: number, totalPhaseWeeks: number): string {
  switch (phase) {
    case PlanPhase.BASE:
      if (weekInPhase < 2) return i18n.t('trainingPlan.focusBase1');
      if (weekInPhase < totalPhaseWeeks - 1) return i18n.t('trainingPlan.focusBase2');
      return i18n.t('trainingPlan.focusBase3');
    case PlanPhase.BUILD:
      if ((weekInPhase + 1) % 3 === 0) return i18n.t('trainingPlan.focusBuildRecovery');
      return i18n.t('trainingPlan.focusBuild');
    case PlanPhase.PEAK:
      return i18n.t('trainingPlan.focusPeak');
    case PlanPhase.TAPER:
      if (weekInPhase === totalPhaseWeeks - 1) return i18n.t('trainingPlan.focusTaperFinal');
      return i18n.t('trainingPlan.focusTaper');
  }
}
