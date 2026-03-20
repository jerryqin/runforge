import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FitnessGauge } from '../../src/components/FitnessGauge';
import { PrescriptionCard } from '../../src/components/PrescriptionCard';
import { RunSummaryCard } from '../../src/components/RunSummaryCard';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Spacing,
} from '../../src/constants/theme';
import { runRecordRepo } from '../../src/db/repositories/RunRecordRepository';
import { userProfileRepo } from '../../src/db/repositories/UserProfileRepository';
import { calcCompositeBodyStatus, calcIntensity, buildConclusion, buildSuggest, buildRisk, calcFitnessMetrics } from '../../src/engine/AnalysisEngine';
import { buildTrainingMomentum, buildWeeklyImpact, buildWeeklyProgressSummary, calcWeeklyProgress, WeeklyProgress } from '../../src/engine/RetentionEngine';
import { generatePrescription, calcTrainingZones, TrainingPrescription, TrainingType } from '../../src/engine/VDOTEngine';
import { calcVDOT } from '../../src/engine/VDOTEngine';
import { BodyStatus, RunRecord, Intensity } from '../../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allRecords, setAllRecords] = useState<RunRecord[]>([]);
  const [recentRecords, setRecentRecords] = useState<RunRecord[]>([]);
  const [bodyStatus, setBodyStatus] = useState<BodyStatus>(BodyStatus.NORMAL);
  const [currentVDOT, setCurrentVDOT] = useState(0);
  const [profile, setProfile] = useState<any>(null);

  const load = useCallback(async () => {
    const [records, prof] = await Promise.all([
      runRecordRepo.fetchAll(),
      userProfileRepo.get(),
    ]);
    
    setProfile(prof);
    setAllRecords(records);

    // 计算当前 VDOT（最近5条查询）
    const validRecords = records
      .filter(r => r.distance >= 3 && r.duration_sec > 0)
      .slice(0, 5);
    
    if (validRecords.length > 0) {
      const vdots = validRecords.map(r => r.vdot ?? calcVDOT(r.distance, r.duration_sec));
      const sorted = [...vdots].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      setCurrentVDOT(median);
    }

    // 根据最新 max_hr 重新计算每条记录的强度和相关文案
    const updated = records.map((record, idx) => {
      const intensity = calcIntensity(record.avg_hr, prof);
      const recentForRisk = records.slice(0, idx);
      return {
        ...record,
        intensity,
        conclusion: buildConclusion(intensity),
        suggest: buildSuggest(intensity, record.distance, recentForRisk),
        risk: buildRisk(intensity, recentForRisk),
      };
    });
    
    const fitnessMetrics = prof && records.length > 0 ? calcFitnessMetrics(records, prof) : null;

    setRecentRecords(updated.slice(0, 7));
    setBodyStatus(calcCompositeBodyStatus(updated, fitnessMetrics, prof));
  }, []);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const latest = recentRecords[0];
  const weeklyProgress = profile
    ? calcWeeklyProgress(allRecords, profile.weekly_km ?? 30)
    : null;
  const todayPrescription = currentVDOT > 0 && allRecords.length > 0 && profile
    ? (() => {
        const metrics = calcFitnessMetrics(allRecords, profile);
        const now = new Date();
        const weekday = now.getDay() === 0 ? 7 : now.getDay();

        let consecutiveHighDays = 0;
        for (const record of allRecords) {
          const recordDate = new Date(record.run_date);
          const daysAgo = Math.floor((now.getTime() - recordDate.getTime()) / (24 * 60 * 60 * 1000));
          if (daysAgo > 7) break;
          if (record.intensity === Intensity.HIGH || record.intensity === Intensity.OVER) consecutiveHighDays++;
          else if (record.intensity === Intensity.EASY) consecutiveHighDays = 0;
        }

        const daysSinceLastRun = allRecords.length > 0
          ? Math.floor((now.getTime() - new Date(allRecords[0].run_date).getTime()) / (24 * 60 * 60 * 1000))
          : 999;

        return generatePrescription({
          tsb: metrics.tsb,
          ctl: metrics.ctl,
          consecutiveHighDays,
          daysSinceLastRun,
          weeklyKm: weeklyProgress?.completedKm ?? 0,
          weeklyTargetKm: profile.weekly_km ?? 30,
          zones: calcTrainingZones(currentVDOT),
          weekday,
        });
      })()
    : null;
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });

  // 新用户判断：无记录且档案未完善
  const isNewUser = allRecords.length === 0 && (!profile || !profile.max_hr || profile.max_hr === 185);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  // 新用户整页引导
  if (isNewUser) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.onboardingPage}>
          <View style={styles.onboardingHeader}>
            <Text style={styles.brand}>RunForge</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingTitle}>开始你的第一步</Text>
            <Text style={styles.onboardingBody}>
              完成以下两步，首页就能为你生成今日行动、本周推进和身体状态分析。
            </Text>
            <View style={styles.onboardingSteps}>
              <View style={styles.onboardingStep}>
                <View style={styles.onboardingStepNum}><Text style={styles.onboardingStepNumText}>1</Text></View>
                <Text style={styles.onboardingStepText}>录入第一次跑步记录（3km 以上）</Text>
              </View>
              <View style={styles.onboardingStep}>
                <View style={styles.onboardingStepNum}><Text style={styles.onboardingStepNumText}>2</Text></View>
                <Text style={styles.onboardingStepText}>完善个人档案（最大心率、每周跑量）</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.onboardingPrimaryBtn}
              onPress={() => router.push('/(tabs)/input')}
              activeOpacity={0.85}
            >
              <Text style={styles.onboardingPrimaryBtnText}>去录入第一次跑步</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.onboardingSecondaryBtn}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.75}
            >
              <Text style={styles.onboardingSecondaryBtnText}>先完善个人档案</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* 标题栏 */}
        <View style={styles.header}>
          <Text style={styles.brand}>RunForge</Text>
          <Text style={styles.date}>{today}</Text>
        </View>

        {/* 快捷操作 */}
        <View style={styles.actionGrid}>
          <ActionButton
            label="📝 开始记录"
            onPress={() => router.push('/(tabs)/input')}
            primary
          />
          <ActionButton
            label="📚 查看历史"
            onPress={() => router.push('/(tabs)/history')}
          />
        </View>

        {/* 今日行动（单卡：处方 + CTA 合并） */}
        <Section title="今日行动">
          {todayPrescription ? (
            <TodayActionCard
              prescription={todayPrescription}
              weeklyProgress={weeklyProgress}
              onPrimaryPress={() =>
                router.push(
                  todayPrescription.type === TrainingType.REST
                    ? '/(tabs)/history?focus=current-week'
                    : '/(tabs)/input'
                )
              }
              onSecondaryPress={() => router.push('/(tabs)/history?focus=current-week')}
            />
          ) : (
            <EmptyState message="先录入至少一条 3km 以上跑步记录，系统才能生成今日行动" />
          )}
        </Section>

        {/* 恢复与负荷（紧接今日行动，作为数据支撑） */}
        {allRecords.length > 0 && profile && (
          <Section title="身体状态">
            <FitnessGauge metrics={calcFitnessMetrics(allRecords, profile)} profile={profile} />
          </Section>
        )}

        {/* 本周推进 */}
        <Section title="本周推进">
          {weeklyProgress ? (
            <WeeklyProgressCard
              progress={weeklyProgress}
              onPress={() => router.push('/(tabs)/history?focus=current-week')}
            />
          ) : (
            <EmptyState message="保存个人档案后，这里会显示你的周目标完成情况" />
          )}
        </Section>

        {/* 最近一次训练 */}
        {latest && (
          <Section title="最近训练">
            <RunSummaryCard
              record={latest}
              onPress={() => router.push(`/record/${latest.id}`)}
            />
            <FeedbackCard record={latest} weeklyProgress={weeklyProgress} />
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== 子组件 =====
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

// 今日行动单卡：PrescriptionCard + CTA 合并
function TodayActionCard({
  prescription,
  weeklyProgress,
  onPrimaryPress,
  onSecondaryPress,
}: {
  prescription: TrainingPrescription;
  weeklyProgress: WeeklyProgress | null;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
}) {
  const isRest = prescription.type === TrainingType.REST;
  const primaryLabel = isRest ? '查看本周推进' : '去完成今天训练';
  const secondaryLabel = isRest ? '回顾最近训练' : '先看本周推进';

  // 辅助文字：训练日显示进度揞进，休息日显示恢复提示
  let ctaNote = '';
  if (!isRest && weeklyProgress) {
    if (weeklyProgress.remainingKm > 0) {
      ctaNote = `完成后本周还差 ${weeklyProgress.remainingKm.toFixed(1)} km`;
    } else {
      ctaNote = '本周公里目标已达成';
    }
  } else if (isRest && weeklyProgress?.remainingKm) {
    ctaNote = `本周还差 ${weeklyProgress.remainingKm.toFixed(1)} km，可在后续几天完成`;
  }

  return (
    <View style={styles.todayCard}>
      <PrescriptionCard prescription={prescription} />
      <View style={styles.todayCTA}>
        {ctaNote ? <Text style={styles.todayCTANote}>{ctaNote}</Text> : null}
        <TouchableOpacity
          style={[styles.todayPrimaryBtn, isRest && styles.todayPrimaryBtnRest]}
          onPress={onPrimaryPress}
          activeOpacity={0.85}
        >
          <Text style={styles.todayPrimaryBtnText}>{primaryLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.todaySecondaryBtn} onPress={onSecondaryPress} activeOpacity={0.75}>
          <Text style={styles.todaySecondaryBtnText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function WeeklyProgressCard({
  progress,
  onPress,
}: {
  progress: WeeklyProgress;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.progressCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.progressHeader}>
        <View>
          <Text style={styles.progressLabel}>已完成</Text>
          <Text style={styles.progressValue}>
            {progress.completedKm.toFixed(1)} / {progress.targetKm.toFixed(0)} km
          </Text>
        </View>
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>{progress.completionRate}%</Text>
        </View>
      </View>

      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${progress.completionRate}%` }]} />
      </View>

      <View style={styles.progressStats}>
        <StatPill
          label="质量课"
          value={`${progress.qualityDone}/${progress.qualityTarget}`}
          positive={progress.qualityDone >= progress.qualityTarget}
        />
        <StatPill
          label="长距离"
          value={progress.longRunDone ? '已完成' : '未完成'}
          positive={progress.longRunDone}
        />
      </View>

      <View style={styles.progressSummaryCard}>
        <Text style={styles.progressSummaryTitle}>{buildWeeklyProgressSummary(progress)}</Text>
        <Text style={styles.progressSummaryMeta}>{buildWeeklyCompletionMeta(progress)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function FeedbackCard({
  record,
  weeklyProgress,
}: {
  record: RunRecord;
  weeklyProgress: WeeklyProgress | null;
}) {
  return (
    <View style={styles.feedbackCard}>
      <Text style={styles.feedbackTitle}>这次训练反馈</Text>
      <Text style={styles.feedbackBody}>{record.conclusion}</Text>

      {weeklyProgress ? (
        <>
          <View style={styles.feedbackDivider} />
          <Text style={styles.feedbackSubTitle}>本周节奏</Text>
          <Text style={styles.feedbackBody}>{buildWeeklyImpact(weeklyProgress)}</Text>
          <Text style={styles.feedbackMomentum}>{buildTrainingMomentum(record, weeklyProgress)}</Text>
        </>
      ) : null}

      {record.risk ? <Text style={styles.riskText}>⚠️ {record.risk}</Text> : null}
    </View>
  );
}

function StatPill({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <View style={[styles.statPill, positive && styles.statPillPositive]}>
      <Text style={styles.statPillLabel}>{label}</Text>
      <Text style={[styles.statPillValue, positive && styles.statPillValuePositive]}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, primary && styles.actionBtnPrimary]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.actionBtnText, primary && styles.actionBtnTextPrimary]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}


function buildWeeklyCompletionMeta(progress: WeeklyProgress): string {
  if (progress.completionRate >= 100) {
    return '本周公里目标已达成，点按查看是否还需要维持节奏。';
  }
  if (progress.remainingKm <= 5) {
    return '离本周目标很近了，点按查看剩余训练安排。';
  }
  return '点按查看本周训练记录与推进情况';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
  },
  brand: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  date: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.gray3,
    letterSpacing: 1,
  },
  // 今日行动单卡
  todayCard: {
    gap: Spacing.sm,
  },
  todayCTA: {
    gap: Spacing.xs,
  },
  todayCTANote: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    textAlign: 'center',
    paddingBottom: Spacing.xs,
  },
  todayPrimaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  todayPrimaryBtnRest: {
    backgroundColor: Colors.gray2,
  },
  todayPrimaryBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  todaySecondaryBtn: {
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  todaySecondaryBtnText: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    fontWeight: FontWeight.medium,
  },
  // 旧版 coachCard 保留（空状态备用）
  coachCard: {
    backgroundColor: Colors.gray1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  coachTitle: {
    fontSize: FontSize.caption,
    color: Colors.white + 'CC',
    letterSpacing: 0.5,
  },
  coachBody: {
    fontSize: FontSize.body,
    color: Colors.white,
    lineHeight: 22,
  },
  coachPrimaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  coachPrimaryBtnRest: {
    backgroundColor: Colors.gray2,
  },
  coachPrimaryBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  coachSecondaryBtn: {
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  coachSecondaryBtnText: {
    fontSize: FontSize.caption,
    color: Colors.white + 'CC',
    fontWeight: FontWeight.medium,
  },
  riskText: {
    fontSize: FontSize.body,
    color: Colors.statusOrange,
  },
  progressCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
  },
  progressValue: {
    marginTop: 2,
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  progressBadge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  progressBadgeText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  progressBarTrack: {
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.separator,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  progressStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  progressSummaryCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: 2,
  },
  progressSummaryTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  progressSummaryMeta: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
  },
  statPill: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: 2,
  },
  statPillPositive: {
    borderWidth: 1,
    borderColor: Colors.statusGreen + '50',
  },
  statPillLabel: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
  },
  statPillValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  statPillValuePositive: {
    color: Colors.statusGreen,
  },
  actionBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.black,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  actionBtnTextPrimary: {
    color: Colors.white,
  },
  emptyState: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.body,
    color: Colors.gray3,
    textAlign: 'center',
  },
  feedbackCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  feedbackTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  feedbackSubTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.gray2,
    letterSpacing: 0.5,
  },
  feedbackBody: {
    fontSize: FontSize.body,
    color: Colors.gray1,
    lineHeight: 22,
  },
  feedbackMomentum: {
    fontSize: FontSize.caption,
    color: Colors.primary,
    lineHeight: 20,
  },
  feedbackDivider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginVertical: Spacing.xs,
  },
  // 新用户引导整页
  onboardingPage: {
    flex: 1,
    padding: Spacing.md,
  },
  onboardingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.lg,
  },
  onboardingCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  onboardingTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  onboardingBody: {
    fontSize: FontSize.body,
    color: Colors.gray1,
    lineHeight: 22,
  },
  onboardingSteps: {
    gap: Spacing.sm,
  },
  onboardingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  onboardingStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingStepNumText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  onboardingStepText: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.black,
  },
  onboardingPrimaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  onboardingPrimaryBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  onboardingSecondaryBtn: {
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  onboardingSecondaryBtnText: {
    fontSize: FontSize.body,
    color: Colors.gray2,
  },
});
