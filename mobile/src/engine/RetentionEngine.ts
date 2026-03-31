import { Intensity, RunRecord } from '../types';
import i18n from '../i18n';

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
    parts.push(i18n.t('retention.remaining', { km: progress.remainingKm.toFixed(1) }));
  } else {
    parts.push(i18n.t('retention.goalComplete'));
  }

  if (progress.remainingQuality > 0) {
    parts.push(i18n.t('retention.qualityRemaining', { count: progress.remainingQuality }));
  }

  if (!progress.longRunDone) {
    parts.push(i18n.t('retention.longRunRemaining'));
  }

  return parts.join('') || i18n.t('retention.rhythmGood');
}

export function buildWeeklyImpact(
  progress: WeeklyProgress,
  referenceDate: Date | string = new Date()
): string {
  const { title } = getWeeklyContext(referenceDate);
  const longRunStatus = progress.longRunDone ? i18n.t('weeklyProgress.completed') : i18n.t('weeklyProgress.notCompleted');
  return `${title}\uff1a${progress.completedKm.toFixed(1)}/${progress.targetKm} km\uff08${progress.completionRate}%\uff09\n${i18n.t('weeklyProgress.intensityWorkouts')}\uff1a${progress.qualityDone}/${progress.qualityTarget}\uff5c${i18n.t('weeklyProgress.longRuns')}\uff1a${longRunStatus}`;
}

export function buildTrainingMomentum(
  record: RunRecord,
  progress: WeeklyProgress,
  referenceDate: Date | string = new Date()
): string {
  const { weekLabel } = getWeeklyContext(referenceDate);

  if (progress.completionRate >= 100) {
    return i18n.t('retention.goalCompletedMsg', { weekLabel });
  }

  if (!progress.longRunDone && record.distance >= 25) {
    return i18n.t('retention.longRunCompletedMsg', { weekLabel });
  }

  if (record.intensity >= Intensity.HIGH && progress.qualityDone >= progress.qualityTarget) {
    return i18n.t('retention.qualityMetMsg', { weekLabel });
  }

  if (record.intensity >= Intensity.HIGH) {
    return i18n.t('retention.qualityProgressMsg', { weekLabel });
  }

  if (progress.remainingKm > 0) {
    return i18n.t('retention.remainingMsg', { weekLabel, km: progress.remainingKm.toFixed(1) });
  }

  return i18n.t('retention.maintainMsg', { weekLabel });
}

export function getWeeklyContext(referenceDate: Date | string = new Date()) {
  const refStart = getStartOfWeek(referenceDate);
  const currentStart = getStartOfWeek(new Date());
  const isCurrentWeek = refStart.getTime() === currentStart.getTime();

  return {
    isCurrentWeek,
    title: isCurrentWeek ? i18n.t('retention.weeklyProgress') : i18n.t('retention.correspondingWeekProgress'),
    weekLabel: isCurrentWeek ? i18n.t('retention.thisWeek') : i18n.t('retention.correspondingWeek'),
    feedbackTitle: isCurrentWeek ? i18n.t('weeklyProgress.trainingFeedback') : i18n.t('weeklyProgress.trainingFeedback'),
    feedbackSubtitle: isCurrentWeek ? i18n.t('weeklyProgress.trainingFeedback') : i18n.t('weeklyProgress.trainingFeedback'),
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
