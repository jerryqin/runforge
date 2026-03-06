import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusCard } from '../../src/components/StatusCard';
import { RunSummaryCard } from '../../src/components/RunSummaryCard';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Spacing,
} from '../../src/constants/theme';
import { runRecordRepo } from '../../src/db/repositories/RunRecordRepository';
import { userProfileRepo } from '../../src/db/repositories/UserProfileRepository';
import { calcBodyStatus, calcIntensity } from '../../src/engine/AnalysisEngine';
import { BodyStatus, RunRecord } from '../../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentRecords, setRecentRecords] = useState<RunRecord[]>([]);
  const [bodyStatus, setBodyStatus] = useState<BodyStatus>(BodyStatus.NORMAL);

  const load = useCallback(async () => {
    const [records, profile] = await Promise.all([
      runRecordRepo.fetchRecent(7),
      userProfileRepo.get(),
    ]);
    
    // 根据最新 max_hr 重新计算每条记录的强度
    const updated = records.map(record => ({
      ...record,
      intensity: calcIntensity(record.avg_hr, profile),
    }));
    
    setRecentRecords(updated);
    setBodyStatus(calcBodyStatus(updated));
  }, []);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const latest = recentRecords[0];
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* 标题栏 */}
        <View style={styles.header}>
          <Text style={styles.brand}>RunForge</Text>
          <Text style={styles.date}>{today}</Text>
        </View>

        {/* 今日身体状态 */}
        <Section title="今日状态">
          <StatusCard
            status={bodyStatus}
            subtitle={
              bodyStatus === BodyStatus.REST
                ? '近期高强度训练较多，建议今日充分休息'
                : bodyStatus === BodyStatus.TIRED
                ? '近期有长距离训练，注意恢复'
                : undefined
            }
          />
        </Section>

        {/* 最近一跑 */}
        <Section title="最近一跑">
          {latest ? (
            <RunSummaryCard
              record={latest}
              onPress={() => router.push(`/record/${latest.id}`)}
            />
          ) : (
            <EmptyState message="还没有跑步记录，录入你的第一次跑步吧" />
          )}
        </Section>

        {/* 明日建议 */}
        {latest && (
          <Section title="明日建议">
            <View style={styles.suggestCard}>
              <Text style={styles.suggestText}>{latest.suggest}</Text>
              {latest.risk ? (
                <Text style={styles.riskText}>⚠️ {latest.risk}</Text>
              ) : null}
            </View>
          </Section>
        )}

        {/* 快捷操作 */}
        <View style={styles.actions}>
          <ActionButton
            label="录入跑步数据"
            onPress={() => router.push('/(tabs)/input')}
            primary
          />
          <ActionButton
            label="比赛小助手"
            onPress={() => router.push('/race-assistant')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== 子组件 =====
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, primary && styles.actionBtnPrimary]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.actionBtnText, primary && styles.actionBtnTextPrimary]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
  },
  brand: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  date: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
  },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.gray2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  suggestText: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  riskText: {
    fontSize: FontSize.body,
    color: Colors.statusOrange,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.black,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  actionBtnTextPrimary: {
    color: Colors.white,
  },
  emptyState: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.body,
    color: Colors.gray3,
    textAlign: 'center',
  },
});
