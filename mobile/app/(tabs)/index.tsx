import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
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
import { challengesRepo, Challenge } from '../../src/db/repositories/ChallengesRepository';
import { calcCompositeBodyStatus, calcIntensity, buildConclusion, buildSuggest, buildRisk, calcFitnessMetrics, generateRecoveryPlan, formatPace, buildRichFeedback, RichFeedback, RecoveryPlan } from '../../src/engine/AnalysisEngine';
import { buildTrainingMomentum, buildWeeklyProgressSummary, calcWeeklyProgress, WeeklyProgress } from '../../src/engine/RetentionEngine';
import { generatePrescription, calcTrainingZones, TrainingPrescription, TrainingType } from '../../src/engine/VDOTEngine';
import { calcVDOT } from '../../src/engine/VDOTEngine';
import { InsightsBlock, TomorrowCard } from '../../src/components/TrainingInsights';
import { BodyStatus, RunRecord, Intensity } from '../../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allRecords, setAllRecords] = useState<RunRecord[]>([]);
  const [recentRecords, setRecentRecords] = useState<RunRecord[]>([]);
  const [bodyStatus, setBodyStatus] = useState<BodyStatus>(BodyStatus.NORMAL);
  const [currentVDOT, setCurrentVDOT] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [fitnessMetrics, setFitnessMetrics] = useState<{ atl: number; ctl: number; tsb: number } | null>(null);
  const [recoveryPlan, setRecoveryPlan] = useState<RecoveryPlan | null>(null);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);

  const load = useCallback(async () => {
    const [records, prof, allChallenges] = await Promise.all([
      runRecordRepo.fetchAll(),
      userProfileRepo.get(),
      challengesRepo.fetchAll(),
    ]);
    setActiveChallenges(allChallenges.filter(c => !c.achieved));
    
    setProfile(prof);
    setAllRecords(records);

    // 计算当前 VDOT（最近5条查询）
    const validRecords = records
      .filter(r => r.distance >= 3 && r.duration_sec > 0)
      .slice(0, 5);
    
    let latestVDOT = 0;
    if (validRecords.length > 0) {
      const vdots = validRecords.map(r => r.vdot ?? calcVDOT(r.distance, r.duration_sec));
      const sorted = [...vdots].sort((a, b) => a - b);
      latestVDOT = sorted[Math.floor(sorted.length / 2)];
      setCurrentVDOT(latestVDOT);
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
    
    const metrics = prof && records.length > 0 ? calcFitnessMetrics(records, prof) : null;

    setFitnessMetrics(metrics);
    setRecentRecords(updated.slice(0, 7));
    setBodyStatus(calcCompositeBodyStatus(updated, metrics, prof));
    setRecoveryPlan(metrics ? generateRecoveryPlan(metrics.tsb, metrics.ctl, latestVDOT) : null);
  }, []);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // 最近一天的所有跑步记录
  const latestDate = recentRecords[0]?.run_date ?? null;
  const latestDayRecords = latestDate ? recentRecords.filter(r => r.run_date === latestDate) : [];

  const weeklyProgress = profile
    ? { ...calcWeeklyProgress(allRecords, profile.weekly_km ?? 30), currentVDOT }
    : null;
  const todayPrescription = currentVDOT > 0 && allRecords.length > 0 && profile && fitnessMetrics
    ? (() => {
        const metrics = fitnessMetrics;
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
  const today = new Date().toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
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
            <Text style={styles.onboardingTitle}>{t('home.newUserTitle')}</Text>
            <Text style={styles.onboardingBody}>
              {t('home.newUserDescription')}
            </Text>
            <View style={styles.onboardingSteps}>
              <View style={styles.onboardingStep}>
                <View style={styles.onboardingStepNum}><Text style={styles.onboardingStepNumText}>1</Text></View>
                <Text style={styles.onboardingStepText}>{t('home.newUserStep1')}</Text>
              </View>
              <View style={styles.onboardingStep}>
                <View style={styles.onboardingStepNum}><Text style={styles.onboardingStepNumText}>2</Text></View>
                <Text style={styles.onboardingStepText}>{t('home.newUserStep2')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.onboardingPrimaryBtn}
              onPress={() => router.push('/(tabs)/input')}
              activeOpacity={0.85}
            >
              <Text style={styles.onboardingPrimaryBtnText}>{t('home.newUserPrimaryBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.onboardingSecondaryBtn}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.75}
            >
              <Text style={styles.onboardingSecondaryBtnText}>{t('home.newUserSecondaryBtn')}</Text>
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
            label={t('home.actionRecord')}
            onPress={() => router.push('/(tabs)/input')}
            primary
          />
          <ActionButton
            label={t('home.actionHistory')}
            onPress={() => router.push('/(tabs)/history')}
          />
        </View>

        {/* 今日行动（单卡：处方 + CTA 合并） */}
        <Section title={t('home.todayAction')}>
          {todayPrescription ? (
            <TodayActionCard
              prescription={todayPrescription}
            />
          ) : (
            <EmptyState message={t('home.emptyTodayAction')} />
          )}
        </Section>

        {/* 我的挑战 */}
        {activeChallenges.length > 0 && (
          <Section title="我的挑战">
            <ActiveChallengesCard challenges={activeChallenges} />
          </Section>
        )}

        {/* 恢复与负荷（紧接今日行动，作为数据支撑） */}
        {allRecords.length > 0 && profile && fitnessMetrics && (
          <Section 
            title={t('home.bodyStatus')} 
            infoIcon
            onInfoPress={() => {
              Alert.alert(
                t('home.bodyStatusInfo'),
                t('home.bodyStatusDescription'),
                [{ text: t('common.ok'), style: 'default' }]
              );
            }}
          >
            <FitnessGauge
              metrics={fitnessMetrics}
              profile={profile}
              recoveryPlan={recoveryPlan}
            />
          </Section>
        )}

        {/* 本周推进 */}
        <Section title={t('home.weeklyProgress')}>
          {weeklyProgress ? (
            <WeeklyProgressCard
              progress={weeklyProgress}
              onPress={() => router.push('/(tabs)/history?focus=current-week')}
            />
          ) : (
            <EmptyState message={t('home.emptyWeeklyProgress')} />
          )}
        </Section>

        {/* 最近一次训练 */}
        {latestDayRecords.length > 0 && (
          <Section title={t('home.recentTraining')}>
            <RecentTrainingCarousel
              records={latestDayRecords}
              weeklyProgress={weeklyProgress}
              allRecords={allRecords}
              profile={profile}
              onPressRecord={(id) => router.push(`/record/${id}`)}
            />
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== 子组件 =====
function Section({ 
  title, 
  children, 
  infoIcon,
  onInfoPress 
}: { 
  title: string; 
  children: React.ReactNode;
  infoIcon?: boolean;
  onInfoPress?: () => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {infoIcon && onInfoPress && (
          <TouchableOpacity onPress={onInfoPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>i</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
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
}: {
  prescription: TrainingPrescription;
}) {
  return (
    <View style={styles.todayCard}>
      <PrescriptionCard prescription={prescription} />
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
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.progressCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.progressHeader}>
        <View>
          <Text style={styles.progressLabel}>{t('weeklyProgress.completed')}</Text>
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
          label={t('weeklyProgress.intensityWorkouts')}
          value={`${progress.qualityDone}/${progress.qualityTarget}`}
          positive={progress.qualityDone >= progress.qualityTarget}
          hasInfo
          onPress={() => {
            const zones = calcTrainingZones(progress.currentVDOT || 0);
            const tZone = zones.find(z => z.zone === 'T');
            const iZone = zones.find(z => z.zone === 'I');
            const rZone = zones.find(z => z.zone === 'R');
            
            const formatPace = (sec: number) => {
              const min = Math.floor(sec / 60);
              const s = Math.floor(sec % 60);
              return `${min}:${s.toString().padStart(2, '0')}`;
            };
            
            let message = t('weeklyProgress.intensityWorkoutDefinition') + '\n\n';
            message += t('weeklyProgress.intensityZoneHeader') + '\n\n';
            
            if (tZone) {
              message += `T - ${tZone.label}\n`;
              message += `${t('weeklyProgress.paceLabel')}：${formatPace(tZone.paceMinSec)} - ${formatPace(tZone.paceMaxSec)}/km\n`;
              message += `${t('weeklyProgress.heartRateLabel')}：${tZone.hrPercent[0]}-${tZone.hrPercent[1]}% HRmax\n\n`;
            }
            
            if (iZone) {
              message += `I - ${iZone.label}\n`;
              message += `${t('weeklyProgress.paceLabel')}：${formatPace(iZone.paceMinSec)} - ${formatPace(iZone.paceMaxSec)}/km\n`;
              message += `${t('weeklyProgress.heartRateLabel')}：${iZone.hrPercent[0]}-${iZone.hrPercent[1]}% HRmax\n\n`;
            }
            
            if (rZone) {
              message += `R - ${rZone.label}\n`;
              message += `${t('weeklyProgress.paceLabel')}：${formatPace(rZone.paceMinSec)} - ${formatPace(rZone.paceMaxSec)}/km\n`;
              message += `${t('weeklyProgress.heartRateLabel')}：${rZone.hrPercent[0]}% HRmax`;
            }
            
            Alert.alert(t('weeklyProgress.intensityWorkoutInfo'), message, [{ text: t('common.ok') }]);
          }}
        />
        <StatPill
          label={t('weeklyProgress.longRuns')}
          value={progress.longRunDone ? t('weeklyProgress.completed') : t('weeklyProgress.notCompleted')}
          positive={progress.longRunDone}
          hasInfo
          onPress={() => {
            Alert.alert(
              t('weeklyProgress.longRunInfo'),
              t('weeklyProgress.longRunRequirements'),
              [{ text: t('common.ok') }]
            );
          }}
        />
      </View>

      <View style={styles.progressSummaryCard}>
        <Text style={styles.progressSummaryTitle}>{buildWeeklyProgressSummary(progress)}</Text>
        <Text style={styles.progressSummaryMeta}>{buildWeeklyCompletionMeta(progress, t)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function FeedbackCard({
  record,
  weeklyProgress,
  allRecords,
  profile,
}: {
  record: RunRecord;
  weeklyProgress: WeeklyProgress | null;
  allRecords: RunRecord[];
  profile: any;
}) {
  const { t } = useTranslation();
  const richFeedback: RichFeedback | null = profile ? buildRichFeedback(record, allRecords, profile) : null;
  return (
    <View style={{ gap: CARD_GAP }}>
      <View style={styles.feedbackCard}>
        <Text style={styles.feedbackTitle}>{t('weeklyProgress.trainingFeedback')}</Text>

        {/* 明日建议简版：仅在无 richFeedback 时显示 */}
        {!richFeedback && (
          <>
            <Text style={styles.feedbackSubTitle}>{t('analysis.tomorrowAction')}</Text>
            <Text style={styles.feedbackBody}>{record.suggest}</Text>
          </>
        )}

        {/* 本次贡献：这条记录为本周目标带来的推进 */}
        {weeklyProgress ? (
          <>
            <View style={styles.feedbackDivider} />
            <Text style={styles.feedbackMomentum}>{buildTrainingMomentum(record, weeklyProgress)}</Text>
          </>
        ) : null}

        {record.risk ? <Text style={styles.riskText}>⚠️ {record.risk}</Text> : null}
      </View>

      {/* 训练分析（InsightRow 列表） */}
      {richFeedback && <InsightsBlock insights={richFeedback.insights} />}

      {/* 明日建议详细版 */}
      {richFeedback && <TomorrowCard recommendation={richFeedback.tomorrow} />}
    </View>
  );
}

const CARD_GAP = Spacing.sm;
const PEEK_WIDTH = 20; // 下一张卡片从右侧露出的宽度

function RecentTrainingCarousel({
  records,
  weeklyProgress,
  allRecords,
  profile,
  onPressRecord,
}: {
  records: RunRecord[];
  weeklyProgress: WeeklyProgress | null;
  allRecords: RunRecord[];
  profile: any;
  onPressRecord: (id: number) => void;
}) {
  const screenWidth = Dimensions.get('window').width;
  // 容器左右各有 Spacing.md 的 padding（来自父级 scroll），再减去右侧露出量
  const containerPadding = Spacing.md * 2;
  const cardWidth = records.length > 1
    ? screenWidth - containerPadding - CARD_GAP - PEEK_WIDTH
    : screenWidth - containerPadding;

  return (
    <View style={styles.carouselWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ gap: CARD_GAP, paddingRight: records.length > 1 ? PEEK_WIDTH : 0 }}
      >
        {records.map((record) => (
          <View key={record.id} style={{ width: cardWidth }}>
            <RunSummaryCard
              record={record}
              onPress={() => record.id != null && onPressRecord(record.id!)}
            />
            <View style={{ marginTop: CARD_GAP }}>
              <FeedbackCard
                record={record}
                weeklyProgress={weeklyProgress}
                allRecords={allRecords}
                profile={profile}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function StatPill({
  label,
  value,
  positive,
  hasInfo,
  onPress,
}: {
  label: string;
  value: string;
  positive?: boolean;
  hasInfo?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.statPillHeader}>
        <Text style={styles.statPillLabel}>{label}</Text>
        {hasInfo && (
          <View style={styles.statPillInfoIcon}>
            <Text style={styles.statPillInfoIconText}>i</Text>
          </View>
        )}
      </View>
      <Text style={[styles.statPillValue, positive && styles.statPillValuePositive]}>{value}</Text>
    </>
  );
  
  if (hasInfo && onPress) {
    return (
      <TouchableOpacity 
        style={[styles.statPill, positive && styles.statPillPositive]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }
  
  return (
    <View style={[styles.statPill, positive && styles.statPillPositive]}>
      {content}
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


function ActiveChallengesCard({ challenges }: { challenges: Challenge[] }) {
  return (
    <View style={styles.activeChallengesCard}>
      {challenges.map((c) => {
        const days = Math.max(0, Math.floor((Date.now() - c.created_at) / 86400000));
        return (
          <View key={c.id} style={styles.activeChallengeRow}>
            <Text style={styles.activeChallengeIcon}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeChallengeTitle}>{c.title}</Text>
              <Text style={styles.activeChallengesSub}>
                {c.target_km} km · {formatPace(c.target_pace_sec)}/km{days >= 1 ? ` · 第 ${days} 天` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function buildWeeklyCompletionMeta(progress: WeeklyProgress, t: (key: string) => string): string {
  if (progress.completionRate >= 100) {
    return t('weeklyProgress.weeklyTargetAchieved');
  }
  if (progress.remainingKm <= 5) {
    return t('weeklyProgress.weeklyTargetAlmostDone');
  }
  return t('weeklyProgress.weeklyProgressDefault');
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.gray3,
    letterSpacing: 1,
  },
  infoIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.gray3 + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.gray3,
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
  statPillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statPillLabel: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
  },
  statPillInfoIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.gray3 + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statPillInfoIconText: {
    fontSize: 8,
    fontWeight: FontWeight.bold,
    color: Colors.gray3,
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
  carouselWrapper: {
    // 负 margin 使横向滚动溢出父容器的 padding，让右侧 peek 可见
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
    overflow: 'visible',
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
  // ===== 进行中的挑战 =====
  activeChallengesCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  activeChallengeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.primary + '08',
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  activeChallengeIcon: { fontSize: 18, marginTop: 1 },
  activeChallengeTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  activeChallengesSub: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    marginTop: 2,
  },
});
