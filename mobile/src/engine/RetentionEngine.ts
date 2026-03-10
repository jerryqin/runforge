import { Intensity, RunRecord } from '../types';

export interface WeeklyProgress {
  targetKm: number;
  completedKm: number;
  remainingKm: number;
  qualityDone: number;
  qualityTarget: number;
  remainingQuality: number;
  longRunDone: boolean;
  completionRate: number;
}

export function calcWeeklyProgress(records: RunRecord[], weeklyTargetKm: number): WeeklyProgress {
  const start = getStartOfWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const weeklyRecords = records.filter(record => {
    const date = new Date(record.run_date);
    return date >= start && date < end;
  });

  const completedKm = weeklyRecords.reduce((sum, record) => sum + record.distance, 0);
  const qualityDone = weeklyRecords.filter(record => record.intensity >= Intensity.HIGH).length;
  const qualityTarget = weeklyTargetKm >= 40 ? 2 : 1;
  const longRunDone = weeklyRecords.some(
    record => record.distance >= Math.max(12, weeklyTargetKm * 0.25)
  );
  const completionRate = Math.min(100, Math.round((completedKm / Math.max(weeklyTargetKm, 1)) * 100));

  return {
    targetKm: weeklyTargetKm,
    completedKm,
    remainingKm: Math.max(0, Number((weeklyTargetKm - completedKm).toFixed(1))),
    qualityDone,
    qualityTarget,
    remainingQuality: Math.max(0, qualityTarget - qualityDone),
    longRunDone,
    completionRate,
  };
}

export function buildWeeklyProgressSummary(progress: WeeklyProgress): string {
  const parts: string[] = [];

  if (progress.remainingKm > 0) {
    parts.push(`本周还差 ${progress.remainingKm.toFixed(1)} km`);
  } else {
    parts.push('本周公里目标已完成');
  }

  if (progress.remainingQuality > 0) {
    parts.push(`还需完成 ${progress.remainingQuality} 次质量课`);
  }

  if (!progress.longRunDone) {
    parts.push('长距离训练仍未完成');
  }

  return parts.join('，') || '本周训练节奏良好';
}

export function buildWeeklyImpact(progress: WeeklyProgress): string {
  return `本周推进：${progress.completedKm.toFixed(1)}/${progress.targetKm} km（${progress.completionRate}%）\n质量课：${progress.qualityDone}/${progress.qualityTarget}｜长距离：${progress.longRunDone ? '已完成' : '未完成'}`;
}

export function buildTrainingMomentum(record: RunRecord, progress: WeeklyProgress): string {
  if (progress.completionRate >= 100) {
    return '这次训练已帮助你完成本周公里目标，后续以维持节奏和恢复为主。';
  }

  if (!progress.longRunDone && record.distance >= Math.max(12, progress.targetKm * 0.25)) {
    return '这次训练已经补上了本周关键长距离。';
  }

  if (record.intensity >= Intensity.HIGH && progress.qualityDone >= progress.qualityTarget) {
    return '这次训练已经满足本周质量课目标。';
  }

  if (record.intensity >= Intensity.HIGH) {
    return '这次训练正在推进本周质量课目标。';
  }

  if (progress.remainingKm > 0) {
    return `这次训练后，你距离本周公里目标还差 ${progress.remainingKm.toFixed(1)} km。`;
  }

  return '这次训练帮助你继续维持本周训练节奏。';
}

function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}
