/**
 * FitnessGauge - 身体状态 + ATL/CTL/TSB 指标组件（合并自 StatusCard）
 */
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { BodyStatusColors, BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import { getRecoveryLoadStatusInfo } from '../engine/AnalysisEngine';
import { BodyStatusLabel, FitnessMetrics, UserProfile } from '../types';

interface Props {
  metrics: FitnessMetrics;
  profile?: UserProfile;
}

function getStatusInfo(tsb: number, ctl: number, profile?: UserProfile): { label: string; color: string; tip: string; detail: string } {
  const status = getRecoveryLoadStatusInfo(tsb, profile, ctl);
  return {
    label: BodyStatusLabel[status.bodyStatus],
    color: BodyStatusColors[status.bodyStatus],
    detail: status.detail,
    tip: status.tip,
  };
}

export function FitnessGauge({ metrics, profile }: Props) {
  const status = getStatusInfo(metrics.tsb, metrics.ctl, profile);

  const handlePress = () => {
    Alert.alert(
      '身体状态说明',
      '状态 > 0：体能 > 疲劳 → 身体偏恢复、状态好、适合比赛\n　常见比赛目标：+10～+25（赛前10-14天训练减量后）\n\n状态 ≈ 0：体能 ≈ 疲劳 → 训练适应中、维持期\n\n状态 < 0：疲劳 > 体能 → 累积疲劳、偏累、易受伤、不适合高强度比赛',
      [{ text: '知道了', style: 'default' }]
    );
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.8}>
      {/* 顶部：状态标签行（替代 StatusCard） */}
      <View style={[styles.statusRow, { borderLeftColor: status.color }]}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          <View style={[styles.tsbPill, { backgroundColor: status.color + '18' }]}>
            <Text style={[styles.tsbPillText, { color: status.color }]}>
              状态 {metrics.tsb > 0 ? '+' : ''}{metrics.tsb.toFixed(0)}
            </Text>
          </View>
        </View>
        <Text style={styles.statusDetail}>{status.detail}</Text>
      </View>

      {/* ATL / CTL 指标 */}
      <View style={styles.metricsRow}>
        <GaugeItem
          label="疲劳"
          value={metrics.atl.toFixed(0)}
          barColor={Colors.statusRed}
          barWidth={Math.min(100, metrics.atl / 2)}
        />
        <GaugeItem
          label="体能"
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
          <View style={styles.tsbZeroMark} />
        </View>
        <View style={styles.tsbBarLabels}>
          <Text style={styles.tsbBarLabelText}>疲劳 -50</Text>
          <Text style={styles.tsbBarLabelText}>0</Text>
          <Text style={styles.tsbBarLabelText}>巅峰 +50</Text>
        </View>
      </View>

      {/* 状态提示 */}
      <Text style={styles.tsbTip}>{status.tip}</Text>
    </TouchableOpacity>
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
  // 状态行（替代 StatusCard）
  statusRow: {
    borderLeftWidth: 4,
    paddingLeft: Spacing.sm,
    gap: 4,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.semibold,
  },
  tsbPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginLeft: 4,
  },
  tsbPillText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  statusDetail: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    marginLeft: 16,
  },
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
    backgroundColor: Colors.white,
    opacity: 0.6,
  },
  tsbBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tsbBarLabelText: {
    fontSize: FontSize.small,
    color: Colors.gray3,
  },
  tsbTip: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 19,
  },
});
