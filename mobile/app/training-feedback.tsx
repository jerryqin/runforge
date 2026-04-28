import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  IntensityColors,
  Spacing,
} from '../src/constants/theme';
import { runRecordRepo } from '../src/db/repositories/RunRecordRepository';
import { userProfileRepo } from '../src/db/repositories/UserProfileRepository';
import { buildRichFeedback, formatDuration, formatPace, RichFeedback } from '../src/engine/AnalysisEngine';
import { getWeeklyContext } from '../src/engine/RetentionEngine';
import { fetchCoachInsight, CoachInsightResult } from '../src/services/CoachService';
import { Intensity, IntensityLabel, RunRecord } from '../src/types';

export default function TrainingFeedbackScreen() {
  const router = useRouter();
  const { id, conclusion, suggest, risk, weeklyImpact, momentum } = useLocalSearchParams<{
    id?: string;
    conclusion?: string;
    suggest?: string;
    risk?: string;
    weeklyImpact?: string;
    momentum?: string;
  }>();
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [richFeedback, setRichFeedback] = useState<RichFeedback | null>(null);
  const [coachInsight, setCoachInsight] = useState<CoachInsightResult | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [rec, allRecords, profile] = await Promise.all([
          runRecordRepo.fetchById(parseInt(id, 10)),
          runRecordRepo.fetchAll(),
          userProfileRepo.get(),
        ]);
        setRecord(rec);
        if (rec && profile) {
          const rf = buildRichFeedback(rec, allRecords, profile);
          setRichFeedback(rf);
          // 异步请求 LLM 教练解读（不阻塞页面渲染）
          setCoachLoading(true);
          fetchCoachInsight(
            rec,
            rf,
            typeof conclusion === 'string' ? conclusion : '',
            typeof suggest === 'string' ? suggest : '',
            typeof risk === 'string' ? risk : '',
          ).then(result => {
            setCoachInsight(result);
          }).finally(() => {
            setCoachLoading(false);
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const intensity = (record?.intensity as Intensity | undefined) ?? Intensity.NORMAL;
  const intensityColor = IntensityColors[intensity] ?? Colors.primary;
  const weeklyContext = getWeeklyContext(record?.run_date ?? new Date());
  const shouldShowFeedbackBlocks = record ? isCurrentWeekRecord(record.run_date) : false;
  const successText = typeof momentum === 'string' && momentum.length > 0
    ? momentum
    : `系统已将这次训练计入${weeklyContext.weekLabel}推进。`;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {shouldShowFeedbackBlocks ? (
          <View style={styles.heroCard}>
            {/* 顶部：成功标记 + 强度标签 */}
            <View style={styles.heroTopRow}>
              <View style={styles.heroSuccessBadge}>
                <Text style={styles.heroSuccessIcon}>✓</Text>
              </View>
              <View style={[styles.intensityBadge, { backgroundColor: intensityColor + '20' }]}>
                <Text style={[styles.intensityText, { color: intensityColor }]}>
                  {IntensityLabel[intensity]}
                </Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>训练已记录</Text>

            {/* 本次数据三列 */}
            {record ? (
              <View style={styles.heroMetricsRow}>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricValue}>{record.distance.toFixed(1)}</Text>
                  <Text style={styles.heroMetricLabel}>km 距离</Text>
                </View>
                <View style={styles.heroMetricDivider} />
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricValue}>{formatPace(record.avg_pace)}</Text>
                  <Text style={styles.heroMetricLabel}>/km 配速</Text>
                </View>
                <View style={styles.heroMetricDivider} />
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricValue}>{record.avg_hr}</Text>
                  <Text style={styles.heroMetricLabel}>bpm 心率</Text>
                </View>
              </View>
            ) : null}

            {/* 本次推进 */}
            <View style={styles.heroMomentumCard}>
              <Text style={styles.heroMomentumLabel}>本次推进</Text>
              <Text style={styles.heroMomentumText}>{successText}</Text>
            </View>
          </View>
        ) : null}

        {record ? (
          <View style={styles.metricsCard}>
            <View style={styles.metricsHeader}>
              <View style={styles.metricsHeaderText}>
                <Text style={styles.metricsDate}>{record.run_date}</Text>
                <Text style={styles.metricsSubtitle}>
                  {shouldShowFeedbackBlocks ? weeklyContext.feedbackSubtitle : '历史训练记录'}
                </Text>
              </View>
              <View style={[styles.intensityBadge, { backgroundColor: intensityColor + '20' }]}>
                <Text style={[styles.intensityText, { color: intensityColor }]}> 
                  {IntensityLabel[intensity]}
                </Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <MetricItem label="距离" value={`${record.distance.toFixed(2)} km`} />
              <MetricItem label="配速" value={`${formatPace(record.avg_pace)}/km`} />
              <MetricItem label="时长" value={formatDuration(record.duration_sec)} />
              <MetricItem label="心率" value={`${record.avg_hr} bpm`} />
            </View>
          </View>
        ) : null}

        {shouldShowFeedbackBlocks ? (
          <>
            {/* 教练解读（LLM / 降级文案） */}
            {(coachLoading || coachInsight) ? (
              <CoachCard loading={coachLoading} insight={coachInsight} />
            ) : null}

            {/* 训练分析 */}
            {richFeedback && richFeedback.insights.length > 0 ? (
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>训练分析</Text>
                {richFeedback.insights.map(insight => (
                  <InsightRow key={insight.key} insight={insight} />
                ))}
              </View>
            ) : null}

            {/* 明日建议 */}
            {richFeedback ? (
              <TomorrowCard recommendation={richFeedback.tomorrow} />
            ) : (
              <Block title="明日行动" content={typeof suggest === 'string' ? suggest : '按首页今日行动继续推进训练。'} />
            )}

            {/* 本周推进 */}
            {typeof weeklyImpact === 'string' && weeklyImpact.length > 0 ? (
              <Block title={weeklyContext.title} content={weeklyImpact} accent="primary" />
            ) : null}

            {/* 风险提示 */}
            {typeof risk === 'string' && risk.length > 0 ? (
              <Block title="风险提示" content={risk} accent="warning" />
            ) : null}
          </>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>回首页继续看今日行动</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(tabs)/input')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>继续录入下一条</Text>
          </TouchableOpacity>

          {id ? (
            <TouchableOpacity
              style={styles.tertiaryBtn}
              onPress={() => router.push(`/record/${id}`)}
              activeOpacity={0.75}
            >
              <Text style={styles.tertiaryBtnText}>查看完整详情</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Block({
  title,
  content,
  accent,
}: {
  title: string;
  content: string;
  accent?: 'primary' | 'warning';
}) {
  const borderColor = accent === 'warning' ? Colors.statusOrange : Colors.primary;
  const titleColor = accent === 'warning' ? Colors.statusOrange : Colors.gray2;

  return (
    <View style={[styles.block, { borderLeftColor: borderColor }]}>
      <Text style={[styles.blockTitle, { color: titleColor }]}>{title}</Text>
      <Text style={styles.blockContent}>{content}</Text>
    </View>
  );
}

function CoachCard({
  loading,
  insight,
}: {
  loading: boolean;
  insight: CoachInsightResult | null;
}) {
  return (
    <View style={styles.coachCard}>
      <View style={styles.coachHeader}>
        <Text style={styles.coachIcon}>🏃‍♂️</Text>
        <Text style={styles.coachTitle}>教练解读</Text>
        {insight?.source === 'llm' && (
          <View style={styles.coachAiBadge}>
            <Text style={styles.coachAiBadgeText}>AI</Text>
          </View>
        )}
      </View>
      {loading ? (
        <View style={styles.coachLoading}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.coachLoadingText}>正在生成教练解读…</Text>
        </View>
      ) : (
        <Text style={styles.coachText}>{insight?.coachText ?? ''}</Text>
      )}
    </View>
  );
}

function InsightRow({ insight }: { insight: import('../src/engine/AnalysisEngine').RichFeedbackInsight }) {
  const accentColor =
    insight.variant === 'positive' ? Colors.statusGreen :
    insight.variant === 'warning'  ? Colors.statusOrange :
    Colors.gray3;
  return (
    <View style={styles.insightRow}>
      <Text style={styles.insightIcon}>{insight.icon}</Text>
      <View style={styles.insightText}>
        <Text style={[styles.insightTitle, { color: accentColor }]}>{insight.title}</Text>
        <Text style={styles.insightDetail}>{insight.detail}</Text>
      </View>
    </View>
  );
}

function TomorrowCard({ recommendation }: { recommendation: import('../src/engine/AnalysisEngine').TomorrowRecommendation }) {
  const isRest = recommendation.distanceRange === '0 km';
  return (
    <View style={styles.tomorrowCard}>
      <View style={styles.tomorrowHeader}>
        <Text style={styles.tomorrowTitle}>明日建议</Text>
        <View style={styles.tomorrowTypeBadge}>
          <Text style={styles.tomorrowTypeText}>{recommendation.type}</Text>
        </View>
      </View>
      {!isRest && (
        <View style={styles.tomorrowMetrics}>
          <View style={styles.tomorrowMetric}>
            <Text style={styles.tomorrowMetricValue}>{recommendation.distanceRange}</Text>
            <Text style={styles.tomorrowMetricLabel}>建议距离</Text>
          </View>
          {recommendation.paceHint ? (
            <>
              <View style={styles.tomorrowMetricDivider} />
              <View style={styles.tomorrowMetric}>
                <Text style={styles.tomorrowMetricValue}>{recommendation.paceHint}</Text>
                <Text style={styles.tomorrowMetricLabel}>配速区间</Text>
              </View>
            </>
          ) : null}
        </View>
      )}
      <Text style={styles.tomorrowReason}>{recommendation.reason}</Text>
    </View>
  );
}

function isCurrentWeekRecord(runDate: string) {
  const recordDate = parseRunDate(runDate);
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  const recordWeekStart = getWeekStart(recordDate);
  return currentWeekStart.getTime() === recordWeekStart.getTime();
}

function parseRunDate(runDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(runDate);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(runDate);
}

function getWeekStart(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.separator,
    borderTopWidth: 4,
    borderTopColor: Colors.statusGreen,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroSuccessBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.statusGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSuccessIcon: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  heroTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.gray5,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  heroMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroMetricDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.separator,
  },
  heroMetricValue: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  heroMetricLabel: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
  },
  heroMomentumCard: {
    backgroundColor: Colors.primary + '0D',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  heroMomentumLabel: {
    fontSize: FontSize.caption,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroMomentumText: {
    fontSize: FontSize.body,
    color: Colors.black,
    fontWeight: FontWeight.medium,
    lineHeight: 22,
  },
  metricsCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  metricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metricsHeaderText: {
    flex: 1,
    gap: 2,
  },
  metricsDate: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  metricsSubtitle: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
  },
  intensityBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  intensityText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricItem: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: 2,
  },
  metricLabel: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
  },
  metricValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  block: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderLeftWidth: 4,
  },
  blockTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blockContent: {
    fontSize: FontSize.body,
    color: Colors.black,
    lineHeight: 22,
  },
  // ===== 教练解读卡片 =====
  coachCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  coachIcon: {
    fontSize: 16,
  },
  coachTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.gray2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  coachAiBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  coachAiBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  coachLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  coachLoadingText: {
    fontSize: FontSize.body,
    color: Colors.gray3,
  },
  coachText: {
    fontSize: FontSize.body,
    color: Colors.black,
    lineHeight: 24,
  },
  // ===== 训练分析卡片 =====
  analysisCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  analysisTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.gray2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  insightIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
    marginTop: 1,
  },
  insightText: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  insightDetail: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
  },
  // ===== 明日建议卡片 =====
  tomorrowCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  tomorrowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tomorrowTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.gray2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tomorrowTypeBadge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  tomorrowTypeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  tomorrowMetrics: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  tomorrowMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tomorrowMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.separator,
  },
  tomorrowMetricValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  tomorrowMetricLabel: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
  },
  tomorrowReason: {
    fontSize: FontSize.body,
    color: Colors.gray2,
    lineHeight: 22,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  secondaryBtn: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  tertiaryBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  tertiaryBtnText: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    fontWeight: FontWeight.medium,
  },
});
