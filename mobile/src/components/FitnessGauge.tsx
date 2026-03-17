/**
 * FitnessGauge - ATL/CTL/TSB 指标组件
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BodyStatusColors, BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import { getRecoveryLoadStatusInfo } from '../engine/AnalysisEngine';
import { BodyStatusLabel, FitnessMetrics } from '../types';

interface Props {
  metrics: FitnessMetrics;
}

function getStatusInfo(tsb: number): { label: string; color: string; tip: string; detail: string } {
  const status = getRecoveryLoadStatusInfo(tsb);
  return {
    label: BodyStatusLabel[status.bodyStatus],
    color: BodyStatusColors[status.bodyStatus],
    detail: status.detail,
    tip: status.tip,
  };
}

export function FitnessGauge({ metrics }: Props) {
  const status = getStatusInfo(metrics.tsb);

  return (
    <View style={styles.container}>
      {/* TSB 主指标 */}
      <View style={styles.tsbSection}>
        <View style={[styles.tsbBadge, { backgroundColor: status.color + '20' }]}>
          <Text style={[styles.tsbValue, { color: status.color }]}>
            {metrics.tsb > 0 ? '+' : ''}{metrics.tsb.toFixed(0)}
          </Text>
          <Text style={[styles.tsbLabel, { color: status.color }]}>{status.label}</Text>
          <Text style={[styles.tsbDetail, { color: status.color }]}>{status.detail}</Text>
        </View>
        <Text style={styles.tsbTip}>{status.tip}</Text>
      </View>

      {/* ATL / CTL 指标 */}
      <View style={styles.metricsRow}>
        <GaugeItem
          label="疲劳 ATL"
          value={metrics.atl.toFixed(0)}
          barColor={Colors.statusRed}
          barWidth={Math.min(100, metrics.atl / 2)}
        />
        <GaugeItem
          label="体能 CTL"
          value={metrics.ctl.toFixed(0)}
          barColor={Colors.statusGreen}
          barWidth={Math.min(100, metrics.ctl / 2)}
        />
      </View>

      {/* TSB 视觉条 */}
      <View style={styles.tsbBar}>
        <View style={styles.tsbBarTrack}>
          <View
            style={[
              styles.tsbBarFill,
              {
                backgroundColor: status.color,
                width: `${Math.min(100, Math.max(0, (metrics.tsb + 50) / 100 * 100))}%`,
              },
            ]}
          />
          {/* 零线标记 */}
          <View style={styles.tsbZeroMark} />
        </View>
        <View style={styles.tsbBarLabels}>
          <Text style={styles.tsbBarLabelText}>疲劳 -50</Text>
          <Text style={styles.tsbBarLabelText}>0</Text>
          <Text style={styles.tsbBarLabelText}>巅峰 +50</Text>
        </View>
      </View>
    </View>
  );
}

function GaugeItem({
  label,
  value,
  barColor,
  barWidth,
}: {
  label: string;
  value: string;
  barColor: string;
  barWidth: number;
}) {
  return (
    <View style={styles.gaugeItem}>
      <View style={styles.gaugeHeader}>
        <Text style={styles.gaugeLabel}>{label}</Text>
        <Text style={[styles.gaugeValue, { color: barColor }]}>{value}</Text>
      </View>
      <View style={styles.gaugeBarTrack}>
        <View
          style={[styles.gaugeBarFill, { backgroundColor: barColor, width: `${barWidth}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  tsbSection: { gap: Spacing.xs, alignItems: 'center' },
  tsbBadge: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  tsbValue: { fontSize: FontSize.h1, fontWeight: FontWeight.bold },
  tsbLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  tsbDetail: { fontSize: FontSize.caption, fontWeight: FontWeight.medium },
  tsbTip: { fontSize: FontSize.caption, color: Colors.gray2, textAlign: 'center' },
  metricsRow: { flexDirection: 'row', gap: Spacing.md },
  gaugeItem: { flex: 1, gap: Spacing.xs },
  gaugeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gaugeLabel: { fontSize: FontSize.caption, color: Colors.gray2 },
  gaugeValue: { fontSize: FontSize.h3, fontWeight: FontWeight.bold },
  gaugeBarTrack: {
    height: 6,
    backgroundColor: Colors.separator,
    borderRadius: 3,
    overflow: 'hidden',
  },
  gaugeBarFill: { height: '100%', borderRadius: 3 },
  tsbBar: { gap: Spacing.xs },
  tsbBarTrack: {
    height: 8,
    backgroundColor: Colors.separator,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  tsbBarFill: { height: '100%', borderRadius: 4 },
  tsbZeroMark: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.gray3,
  },
  tsbBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tsbBarLabelText: { fontSize: FontSize.small, color: Colors.gray3 },
});
