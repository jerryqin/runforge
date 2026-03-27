import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RunSummaryCard } from '../../src/components/RunSummaryCard';
import { TrainingZonesCard } from '../../src/components/TrainingZonesCard';
import { VDOTTrendCard } from '../../src/components/VDOTTrendCard';
import { Colors, FontSize, FontWeight, Spacing } from '../../src/constants/theme';
import { runRecordRepo } from '../../src/db/repositories/RunRecordRepository';
import { userProfileRepo } from '../../src/db/repositories/UserProfileRepository';
import { calcIntensity, buildConclusion, buildSuggest, buildRisk } from '../../src/engine/AnalysisEngine';
import { calcTrainingZones } from '../../src/engine/VDOTEngine';
import { calcVDOT } from '../../src/engine/VDOTEngine';
import { RunRecord } from '../../src/types';

export default function HistoryScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [currentVDOT, setCurrentVDOT] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [data, profile] = await Promise.all([
      runRecordRepo.fetchAll(),
      userProfileRepo.get(),
    ]);
    
    // 根据最新 max_hr 重新计算每条记录的强度和相关文案
    const updated = data.map((record, idx) => {
      const intensity = calcIntensity(record.avg_hr, profile);
      const recentForRisk = data.slice(0, idx); // 前面的记录用于风险判断
      return {
        ...record,
        intensity,
        conclusion: buildConclusion(intensity),
        suggest: buildSuggest(intensity, record.distance, recentForRisk),
        risk: buildRisk(intensity, recentForRisk),
      };
    });

    const validRecords = data
      .filter(r => r.distance >= 3 && r.duration_sec > 0)
      .slice(0, 5);

    if (validRecords.length > 0) {
      const vdots = validRecords.map(r => r.vdot ?? calcVDOT(r.distance, r.duration_sec));
      const sorted = [...vdots].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      setCurrentVDOT(median);
    } else {
      setCurrentVDOT(0);
    }
    
    setRecords(updated);
  }, []);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // 按周分组
  const grouped = groupByWeek(records);

  // 计算总体统计信息
  const stats = useMemo(() => {
    if (records.length === 0) return null;
    
    const totalKm = records.reduce((sum, r) => sum + r.distance, 0);
    const totalSec = records.reduce((sum, r) => sum + r.duration_sec, 0);
    const avgMinPerKm = totalSec / 60 / totalKm;
    const minPart = Math.floor(avgMinPerKm);
    const secPart = Math.round((avgMinPerKm - minPart) * 60);
    
    const dates = records.map(r => new Date(r.run_date).getTime()).sort((a, b) => b - a);
    const startDate = new Date(dates[dates.length - 1]);
    const endDate = new Date(dates[0]);
    
    const fmt = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    
    return {
      dateRange: `${fmt(startDate)} – ${fmt(endDate)}`,
      totalKm: totalKm.toFixed(1),
      avgPace: `${minPart}:${secPart.toString().padStart(2, '0')}`,
      count: records.length,
    };
  }, [records]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.weekLabel}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {stats ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>时间跨度</Text>
                    <Text style={styles.summaryValue}>{stats.dateRange}</Text>
                  </View>
                  <View style={styles.summarySeparator} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>总里程(km)</Text>
                    <Text style={styles.summaryValue}>{stats.totalKm}</Text>
                  </View>
                  <View style={styles.summarySeparator} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>平均配速</Text>
                    <Text style={styles.summaryValue}>{stats.avgPace}</Text>
                  </View>
                </View>
                <View style={styles.summaryFooter}>
                  <Text style={styles.summaryCount}>共 {stats.count} 次训练</Text>
                </View>
              </View>
            ) : null}
            
            {focus === 'current-week' ? (
              <View style={styles.focusBanner}>
                <Text style={styles.focusBannerTitle}>当前优先查看本周记录</Text>
                <Text style={styles.focusBannerText}>顶部这一组就是本周训练，可快速检查周目标完成情况。</Text>
              </View>
            ) : null}


          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无跑步记录</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.group}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>{item.weekLabel}</Text>
              <Text style={styles.weekStats}>
                {item.totalKm.toFixed(1)}km · {item.records.length} 次
              </Text>
            </View>
            {item.records.map((record) => (
              <RunSummaryCard
                key={record.id}
                record={record}
                onPress={() => router.push(`/record/${record.id}`)}
                compact
              />
            ))}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

// ===== 按周分组 =====
interface WeekGroup {
  weekLabel: string;
  records: RunRecord[];
  totalKm: number;
}

function groupByWeek(records: RunRecord[]): WeekGroup[] {
  const map = new Map<string, RunRecord[]>();
  for (const r of records) {
    const d = new Date(r.run_date);
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    const key = monday.toISOString().split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monday, recs]) => {
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const fmt = (d: Date) =>
        `${d.getMonth() + 1}/${d.getDate()}`;
      return {
        weekLabel: `${fmt(new Date(monday))} – ${fmt(sunday)}`,
        records: recs,
        totalKm: recs.reduce((s, r) => s + r.distance, 0),
      };
    });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: Spacing.md, gap: Spacing.lg },
  headerContent: { gap: Spacing.md, marginBottom: Spacing.md },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: Spacing.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  summarySeparator: {
    width: 1,
    height: 40,
    backgroundColor: Colors.separator,
    marginHorizontal: Spacing.sm,
  },
  summaryLabel: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
    fontWeight: FontWeight.medium,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  summaryFooter: {
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    paddingTop: Spacing.xs,
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
  },
  focusBanner: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 12,
    padding: Spacing.md,
    gap: 2,
  },
  focusBannerTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  focusBannerText: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
  },
  analyticsSection: {
    gap: Spacing.sm,
  },
  analyticsTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  group: { gap: Spacing.md },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  weekStats: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
  },
  empty: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.body,
    color: Colors.gray3,
  },
});
