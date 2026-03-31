import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RunRecord, getIntensityLabel } from '../types';
import { IntensityColors, BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import { formatPace } from '../engine/AnalysisEngine';

interface Props {
  record: RunRecord;
  onPress?: () => void;
  compact?: boolean;
}

export function RunSummaryCard({ record, onPress, compact = false }: Props) {
  const { t } = useTranslation();
  const intensityColor = IntensityColors[record.intensity];

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* 顶部：日期 + 强度标签 */}
      <View style={styles.header}>
        <Text style={styles.date}>{record.run_date}</Text>
        <View style={[styles.badge, { backgroundColor: intensityColor + '20' }]}>
          <Text style={[styles.badgeText, { color: intensityColor }]}>
            {getIntensityLabel(record.intensity)}
          </Text>
        </View>
      </View>

      {/* 核心数据行 */}
      <View style={styles.metrics}>
        <MetricItem label={t('history.distance')} value={`${record.distance.toFixed(2)}km`} large />
        <MetricItem label={t('history.pace')} value={formatPace(record.avg_pace)} />
        <MetricItem label={t('history.heartRate')} value={`${record.avg_hr}bpm`} />
      </View>

      {/* 一句话结论 */}
      {!compact && (
        <Text style={styles.conclusion}>{record.conclusion}</Text>
      )}
    </TouchableOpacity>
  );
}

function MetricItem({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <View style={styles.metricItem}>
      <Text style={[styles.metricValue, large && styles.metricValueLarge]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.separator,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  date: {
    fontSize: FontSize.body,
    color: Colors.gray2,
    fontWeight: FontWeight.medium,
  },
  badge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  metrics: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  metricItem: {
    alignItems: 'flex-start',
  },
  metricValue: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  metricValueLarge: {
    fontSize: FontSize.h2,
  },
  metricLabel: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
    marginTop: 1,
  },
  conclusion: {
    fontSize: FontSize.body,
    color: Colors.gray1,
    marginTop: Spacing.xs,
  },
});
