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
import { FitnessGauge } from '../../src/components/FitnessGauge';
import { PrescriptionCard } from '../../src/components/PrescriptionCard';
import { TrainingZonesCard } from '../../src/components/TrainingZonesCard';
import { VDOTTrendCard } from '../../src/components/VDOTTrendCard';
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
import { calcBodyStatus, calcIntensity, buildConclusion, buildSuggest, buildRisk, calcFitnessMetrics } from '../../src/engine/AnalysisEngine';
import { generatePrescription, calcTrainingZones } from '../../src/engine/VDOTEngine';
import { calcVDOT } from '../../src/engine/VDOTEngine';
import { BodyStatus, RunRecord, Intensity } from '../../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allRecords, setAllRecords] = useState<RunRecord[]>([]);
  const [recentRecords, setRecentRecords] = useState<RunRecord[]>([]);
  const [bodyStatus, setBodyStatus] = useState<BodyStatus>(BodyStatus.NORMAL);
  const [currentVDOT, setCurrentVDOT] = useState(0);
  const [profile, setProfile] = useState<any>(null);

  const load = useCallback(async () => {
    const [records, prof] = await Promise.all([
      runRecordRepo.fetchAll(),
      userProfileRepo.get(),
    ]);
    
    setProfile(prof);
    setAllRecords(records);

    // 计算当前 VDOT（最近5条查询）
    const validRecords = records
      .filter(r => r.distance >= 3 && r.duration_sec > 0)
      .slice(0, 5);
    
    if (validRecords.length > 0) {
      const vdots = validRecords.map(r => r.vdot ?? calcVDOT(r.distance, r.duration_sec));
      const sorted = [...vdots].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      setCurrentVDOT(median);
    }

    // 根据最新 max_hr 重新计算每条记录的强度和相关文案
    const updated = records.map((record, idx) => {
      const intensity = calcIntensity(record.avg_hr, prof);
      const recentForRisk = records.slice(0, idx);
      return {
        ...record,
        intensity,
        conclusion: buildConclusion(intensity),
        suggest: buildSuggest(intensity, record.distance, recentForRisk),
        risk: buildRisk(intensity, recentForRisk),
      };
    });
    
    setRecentRecords(updated.slice(0, 7));
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

        {/* 快捷操作（3 按钮） */}
        <View style={styles.actionGrid}>
          <ActionButton
            label="📝 录入跑步"
            onPress={() => router.push('/(tabs)/input')}
            primary
          />
          <ActionButton
            label="📅 训练计划"
            onPress={() => router.push('/training-plan')}
          />
          <ActionButton
            label="🏁 比赛助手"
            onPress={() => router.push('/race-assistant')}
          />
        </View>

        {/* 今日身体状态 */}
        <Section title="身体状态">
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

        {/* ATL/CTL/TSB 仪表盘 */}
        {allRecords.length > 0 && profile && (
          <Section title="训练负荷">
            <FitnessGauge metrics={calcFitnessMetrics(allRecords, profile)} />
          </Section>
        )}

        {/* 每日训练处方 */}
        {currentVDOT > 0 && allRecords.length > 0 && profile && (() => {
          const metrics = calcFitnessMetrics(allRecords, profile);
          const today = new Date();
          const weekday = today.getDay() === 0 ? 7 : today.getDay();
          
          // 计算连续高强度天数
          let consecutiveHighDays = 0;
          for (const record of allRecords) {
            const recordDate = new Date(record.run_date);
            const daysAgo = Math.floor((today.getTime() - recordDate.getTime()) / (24 * 60 * 60 * 1000));
            if (daysAgo > 7) break;
            if (record.intensity === Intensity.HIGH || record.intensity === Intensity.OVER) consecutiveHighDays++;
            else if (record.intensity === Intensity.EASY) consecutiveHighDays = 0;
          }
          
          const daysSinceLastRun = allRecords.length > 0
            ? Math.floor((today.getTime() - new Date(allRecords[0].run_date).getTime()) / (24 * 60 * 60 * 1000))
            : 999;
          
          const zones = calcTrainingZones(currentVDOT);
          
          return (
            <Section title="今日训练">
              <PrescriptionCard
                prescription={generatePrescription({
                  tsb: metrics.tsb,
                  ctl: metrics.ctl,
                  consecutiveHighDays,
                  daysSinceLastRun,
                  weeklyKm: allRecords
                    .filter(r => {
                      const d = new Date(r.run_date);
                      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                      return d >= weekAgo;
                    })
                    .reduce((sum, r) => sum + r.distance, 0),
                  weeklyTargetKm: profile.weekly_km ?? 30,
                  zones,
                  weekday,
                })}
              />
            </Section>
          );
        })()}

        {/* VDOT 趋势 + 赛事预测 */}
        {allRecords.length > 0 && currentVDOT > 0 && (
          <Section title="VDOT 趋势">
            <VDOTTrendCard
              currentVDOT={currentVDOT}
              vdotHistory={allRecords
                .filter(r => r.distance >= 3 && r.duration_sec > 0)
                .map(r => ({
                  date: r.run_date,
                  vdot: r.vdot ?? calcVDOT(r.distance, r.duration_sec),
                }))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
            />
          </Section>
        )}

        {/* 训练配速区间 */}
        {currentVDOT > 0 && (
          <Section title="配速区间参考">
            <TrainingZonesCard zones={calcTrainingZones(currentVDOT)} vdot={currentVDOT} />
          </Section>
        )}

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
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
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
  actionGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
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
  actionBtn: {
    flex: 1,
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
