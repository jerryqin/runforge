/**
 * 训练增强反馈组件
 * 供 training-feedback.tsx / record/[id].tsx / index.tsx 共用
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import type { RichFeedbackInsight, TomorrowRecommendation } from '../engine/AnalysisEngine';
import type { CoachInsightResult } from '../services/CoachService';

// ===== CoachCard =====

export function CoachCard({
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

// ===== InsightRow =====

export function InsightRow({ insight }: { insight: RichFeedbackInsight }) {
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

// ===== TomorrowCard =====

export function TomorrowCard({ recommendation }: { recommendation: TomorrowRecommendation }) {
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

// ===== InsightsBlock（InsightRow 列表的容器） =====

export function InsightsBlock({ insights }: { insights: RichFeedbackInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <View style={styles.analysisCard}>
      <Text style={styles.analysisTitle}>训练分析</Text>
      {insights.map(insight => (
        <InsightRow key={insight.key} insight={insight} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: Colors.black,
    lineHeight: 22,
  },
});
