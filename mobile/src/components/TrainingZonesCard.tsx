/**
 * TrainingZonesCard - 配速区间展示卡片
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import { PaceZone } from '../engine/VDOTEngine';
import { formatPace } from '../engine/AnalysisEngine';

interface Props {
  zones: PaceZone[];
  vdot: number;
}

const ZONE_COLORS: Record<string, string> = {
  E: Colors.intensityEasy,
  M: Colors.intensityNormal,
  T: Colors.intensityHigh,
  I: Colors.intensityOver,
  R: '#8B5CF6', // 紫色
};

export function TrainingZonesCard({ zones, vdot }: Props) {
  if (zones.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>配速与心率区间</Text>
        <Text style={styles.headerHint}>基于当前跑力</Text>
      </View>
      {zones.map(zone => {
        const color = ZONE_COLORS[zone.zone] ?? Colors.gray2;
        return (
          <View key={zone.zone} style={styles.zoneRow}>
            <View style={[styles.zoneBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.zoneCode, { color }]}>{zone.zone}</Text>
            </View>
            <View style={styles.zoneInfo}>
              <Text style={styles.zoneLabel}>{zone.label}</Text>
              <Text style={styles.zonePace}>
                {formatPace(zone.paceMinSec)} ~ {formatPace(zone.paceMaxSec)}
              </Text>
            </View>
            <Text style={styles.zoneHr}>{zone.hrPercent[0]}-{zone.hrPercent[1]}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  headerTitle: { fontSize: FontSize.body, color: Colors.black, fontWeight: FontWeight.semibold },
  headerHint: { fontSize: FontSize.caption, fontWeight: FontWeight.medium, color: Colors.gray2 },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    gap: Spacing.sm,
  },
  zoneBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneCode: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  zoneInfo: { flex: 1 },
  zoneLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.black },
  zonePace: { fontSize: FontSize.caption, color: Colors.gray2, marginTop: 1 },
  zoneHr: { fontSize: FontSize.caption, color: Colors.gray3 },
});
