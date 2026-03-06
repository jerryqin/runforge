import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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
import { Colors, FontSize, FontWeight, Spacing } from '../../src/constants/theme';
import { runRecordRepo } from '../../src/db/repositories/RunRecordRepository';
import { userProfileRepo } from '../../src/db/repositories/UserProfileRepository';
import { calcIntensity, buildConclusion, buildSuggest, buildRisk } from '../../src/engine/AnalysisEngine';
import { RunRecord } from '../../src/types';

export default function HistoryScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<RunRecord[]>([]);
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
  group: { gap: Spacing.sm },
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
