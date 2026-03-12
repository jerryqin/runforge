/**
 * VDOTTrendCard - VDOT 跑力趋势 + 赛事成绩预测
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import { predictAllRaces, RaceDistanceName } from '../engine/VDOTEngine';

interface Props {
  currentVDOT: number;
  vdotHistory: { date: string; vdot: number }[];
  onPress?: () => void;
}

export function VDOTTrendCard({ currentVDOT, vdotHistory, onPress }: Props) {
  if (currentVDOT <= 0) return null;

  const predictions = predictAllRaces(currentVDOT);

  // 计算趋势（最近5次 vs 前5次）
  const recent5 = vdotHistory.slice(0, 5);
  const prev5 = vdotHistory.slice(5, 10);
  const recentAvg = recent5.length > 0 ? recent5.reduce((s, v) => s + v.vdot, 0) / recent5.length : 0;
  const prevAvg = prev5.length > 0 ? prev5.reduce((s, v) => s + v.vdot, 0) / prev5.length : 0;

  let trendText = '';
  let trendColor = Colors.gray2;
  if (prevAvg > 0) {
    const diff = recentAvg - prevAvg;
    if (diff > 0.5) { trendText = `↑ ${diff.toFixed(1)}`; trendColor = Colors.statusGreen; }
    else if (diff < -0.5) { trendText = `↓ ${Math.abs(diff).toFixed(1)}`; trendColor = Colors.statusRed; }
    else { trendText = '→ 稳定'; trendColor = Colors.gray2; }
  }

  // 简易趋势柱状图（最近10次）
  const chartData = vdotHistory.slice(0, 10).reverse();
  const maxV = Math.max(...chartData.map(d => d.vdot), currentVDOT + 2);
  const minV = Math.min(...chartData.map(d => d.vdot), currentVDOT - 5);
  const range = maxV - minV || 1;
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={styles.container}
      {...(onPress
        ? {
            onPress,
            activeOpacity: 0.88,
          }
        : {})}
    >
      {/* 当前 VDOT */}
      <View style={styles.header}>
        <View>
          <Text style={styles.vdotLabel}>当前跑力</Text>
          <View style={styles.vdotRow}>
            <Text style={styles.vdotValue}>{currentVDOT.toFixed(1)}</Text>
            {trendText ? (
              <Text style={[styles.trendText, { color: trendColor }]}>{trendText}</Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.pathHint}>查看进阶路径</Text>
      </View>

      {/* 趋势图 */}
      {chartData.length >= 3 && (
        <View style={styles.chart}>
          {chartData.map((d, i) => {
            const height = ((d.vdot - minV) / range) * 60 + 4;
            const isLatest = i === chartData.length - 1;
            return (
              <View key={d.date + i} style={styles.barWrapper}>
                <Text style={styles.barValue}>{d.vdot.toFixed(0)}</Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: isLatest ? Colors.primary : Colors.primary + '40',
                    },
                  ]}
                />
                <Text style={styles.barDate}>{d.date.slice(5)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* 赛事成绩预测 */}
      <View style={styles.predictions}>
        <Text style={styles.predTitle}>赛事成绩预测</Text>
        <View style={styles.predGrid}>
          {(Object.entries(predictions) as [RaceDistanceName, number][]).map(([name, sec]) => (
            <View key={name} style={styles.predItem}>
              <Text style={styles.predName}>{name}</Text>
              <Text
                style={styles.predTime}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatRacePrediction(sec)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Wrapper>
  );
}

function formatRacePrediction(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);

  if (h <= 0) {
    return `${m}m`;
  }

  if (m <= 0) {
    return `${h}h`;
  }

  return `${h}h${m}m`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  vdotLabel: { fontSize: FontSize.caption, color: Colors.gray2, fontWeight: FontWeight.medium },
  vdotRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  vdotValue: { fontSize: FontSize.h1, fontWeight: FontWeight.bold, color: Colors.primary },
  trendText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  pathHint: {
    fontSize: FontSize.caption,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 90,
    gap: 2,
  },
  barWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { fontSize: 9, color: Colors.gray3, marginBottom: 2 },
  bar: { width: '70%', borderRadius: 3, minHeight: 4 },
  barDate: { fontSize: 8, color: Colors.gray3, marginTop: 2 },
  predictions: { gap: Spacing.sm },
  predTitle: { fontSize: FontSize.caption, color: Colors.gray2, fontWeight: FontWeight.semibold, textTransform: 'uppercase' },
  predGrid: { flexDirection: 'row', gap: Spacing.sm },
  predItem: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2,
    minHeight: 74,
    justifyContent: 'center',
  },
  predName: { fontSize: FontSize.caption, color: Colors.gray2, fontWeight: FontWeight.medium },
  predTime: { fontSize: FontSize.h2, fontWeight: FontWeight.bold, color: Colors.black, textAlign: 'center', width: '100%' },
});
