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
  currentVDOT?: number;  // 当前跑力值，用于显示配速区间
}

export function calcWeeklyProgress(
  records: RunRecord[],
  weeklyTargetKm: number,
  referenceDate: Date | string = new Date()
): WeeklyProgress {
  const start = getStartOfWeek(referenceDate);
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
    record => record.distance >= 25  // 至少25公里才算长距离
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
    parts.push(`还需完成 ${progress.remainingQuality} 次强度课`);
  }

  if (!progress.longRunDone) {
    parts.push('长距离训练仍未完成');
  }

  return parts.join('，') || '本周训练节奏良好';
}

export function buildWeeklyImpact(
  progress: WeeklyProgress,
  referenceDate: Date | string = new Date()
): string {
  const { title } = getWeeklyContext(referenceDate);
  return `${title}：${progress.completedKm.toFixed(1)}/${progress.targetKm} km（${progress.completionRate}%）\n强度课：${progress.qualityDone}/${progress.qualityTarget}｜长距离：${progress.longRunDone ? '已完成' : '未完成'}`;
}

export function buildTrainingMomentum(
  record: RunRecord,
  progress: WeeklyProgress,
  referenceDate: Date | string = new Date()
): string {
  const { weekLabel } = getWeeklyContext(referenceDate);

  if (progress.completionRate >= 100) {
    return `这次训练已帮助你完成${weekLabel}公里目标，后续以维持节奏和恢复为主。`;
  }

  if (!progress.longRunDone && record.distance >= 25) {
    return `这次训练已经补上了${weekLabel}关键长距离。`;
  }

  if (record.intensity >= Intensity.HIGH && progress.qualityDone >= progress.qualityTarget) {
    return `这次训练已经满足${weekLabel}强度课目标。`;
  }

  if (record.intensity >= Intensity.HIGH) {
    return `这次训练正在推进${weekLabel}强度课目标。`;
  }

  if (progress.remainingKm > 0) {
    return `这次训练后，你距离${weekLabel}公里目标还差 ${progress.remainingKm.toFixed(1)} km。`;
  }

  return `这次训练帮助你继续维持${weekLabel}训练节奏。`;
}

export function getWeeklyContext(referenceDate: Date | string = new Date()) {
  const refStart = getStartOfWeek(referenceDate);
  const currentStart = getStartOfWeek(new Date());
  const isCurrentWeek = refStart.getTime() === currentStart.getTime();

  return {
    isCurrentWeek,
    title: isCurrentWeek ? '本周推进' : '对应周推进',
    weekLabel: isCurrentWeek ? '本周' : '对应周',
    feedbackTitle: isCurrentWeek ? '今天这次训练，已经计入你的本周推进' : '这次训练，已经计入对应周推进',
    feedbackSubtitle: isCurrentWeek ? '这次训练已计入你的本周推进' : '这次训练已计入对应周推进',
  };
}

function getStartOfWeek(dateInput: Date | string): Date {
  const result = parseDateInput(dateInput);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function parseDateInput(dateInput: Date | string): Date {
  if (dateInput instanceof Date) {
    return new Date(dateInput);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return new Date(dateInput);
}
