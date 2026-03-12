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
import { formatDuration, formatPace } from '../src/engine/AnalysisEngine';
import { getWeeklyContext } from '../src/engine/RetentionEngine';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    runRecordRepo
      .fetchById(parseInt(id, 10))
      .then(setRecord)
      .finally(() => setLoading(false));
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
            <View style={styles.heroSuccessBadge}>
              <Text style={styles.heroSuccessIcon}>✓</Text>
            </View>
            <Text style={styles.heroEyebrow}>训练反馈</Text>
            <Text style={styles.heroTitle}>{weeklyContext.feedbackTitle}</Text>
            <Text style={styles.heroBody}>
              {typeof conclusion === 'string' && conclusion.length > 0
                ? conclusion
                : '系统已根据你的训练表现更新后续建议。'}
            </Text>
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
          <Block title="明日行动" content={typeof suggest === 'string' ? suggest : '按首页今日行动继续推进训练。'} />
        ) : null}

        {shouldShowFeedbackBlocks && typeof weeklyImpact === 'string' && weeklyImpact.length > 0 ? (
          <Block title={weeklyContext.title} content={weeklyImpact} accent="primary" />
        ) : null}

        {shouldShowFeedbackBlocks && typeof risk === 'string' && risk.length > 0 ? (
          <Block title="风险提示" content={risk} accent="warning" />
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
    backgroundColor: Colors.black,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroSuccessBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.statusGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSuccessIcon: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  heroEyebrow: {
    fontSize: FontSize.caption,
    color: Colors.white + 'CC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  heroBody: {
    fontSize: FontSize.body,
    color: Colors.white,
    lineHeight: 22,
  },
  heroMomentumCard: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.white + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.white + '12',
  },
  heroMomentumLabel: {
    fontSize: FontSize.caption,
    color: Colors.white + 'CC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroMomentumText: {
    fontSize: FontSize.body,
    color: Colors.white,
    fontWeight: FontWeight.semibold,
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
