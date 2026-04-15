import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { RunSummaryCard } from '../../src/components/RunSummaryCard';
import { TrainingZonesCard } from '../../src/components/TrainingZonesCard';
import { VDOTTrendCard } from '../../src/components/VDOTTrendCard';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../src/constants/theme';
import { runRecordRepo } from '../../src/db/repositories/RunRecordRepository';
import { userProfileRepo } from '../../src/db/repositories/UserProfileRepository';
import { challengesRepo, Challenge } from '../../src/db/repositories/ChallengesRepository';
import { calcIntensity, buildConclusion, buildSuggest, buildRisk, formatPace } from '../../src/engine/AnalysisEngine';
import { calcTrainingZones } from '../../src/engine/VDOTEngine';
import { calcVDOT } from '../../src/engine/VDOTEngine';
import { RunRecord } from '../../src/types';

export default function HistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [currentVDOT, setCurrentVDOT] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [bestsModal, setBestsModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [data, profile, savedChallenges] = await Promise.all([
      runRecordRepo.fetchAll(),
      userProfileRepo.get(),
      challengesRepo.fetchAll(),
    ]);
    
    const updated = data.map((record, idx) => {
      const intensity = calcIntensity(record.avg_hr, profile);
      const recentForRisk = data.slice(0, idx);
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

    // 自动检测挑战是否达成
    const updatedChallenges = await Promise.all(
      savedChallenges.map(async (challenge) => {
        if (challenge.achieved) return challenge;
        // 找到距离 >= 目标距离（允许 50m 误差）且配速 <= 目标配速（允许 5 秒容差）的记录
        const achievedRec = data.find(
          r => r.distance >= challenge.target_km - 0.05 && r.avg_pace <= challenge.target_pace_sec + 5
        );
        if (achievedRec) {
          await challengesRepo.markAchieved(challenge.id!, achievedRec.run_date);
          return { ...challenge, achieved: true, achieved_date: achievedRec.run_date };
        }
        return challenge;
      })
    );
    setChallenges(updatedChallenges);
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
    
    // 仅统计有实际距离和时长的记录（过滤 GPS 丢失等异常数据）
    const valid = records.filter(r => r.distance > 0 && r.duration_sec > 0);
    if (valid.length === 0) return null;

    const totalKm = valid.reduce((sum, r) => sum + r.distance, 0);
    const totalSec = valid.reduce((sum, r) => sum + r.duration_sec, 0);
    // 加权平均配速（以距离为权重），单位：秒/公里
    const avgSecPerKm = totalSec / totalKm;
    let minPart = Math.floor(avgSecPerKm / 60);
    let secPart = Math.round(avgSecPerKm % 60);
    // 修正进位：59.5→60 时应进为下一分钟
    if (secPart === 60) { minPart += 1; secPart = 0; }
    
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

  const personalBests = useMemo(() => calcPersonalBests(records), [records]);

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
                    <Text style={styles.summaryLabel}>{t('history.timeSpan')}</Text>
                    <Text style={styles.summaryValue}>{stats.dateRange}</Text>
                  </View>
                  <View style={styles.summarySeparator} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{t('history.totalDistanceKm')}</Text>
                    <Text style={styles.summaryValue}>{stats.totalKm}</Text>
                  </View>
                  <View style={styles.summarySeparator} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{t('history.averagePace')}</Text>
                    <Text style={styles.summaryValue}>{stats.avgPace}</Text>
                  </View>
                </View>
                <View style={styles.summaryFooter}>
                  <Text style={styles.summaryCount}>{t('history.totalSessions', { count: stats.count })}</Text>
                </View>
              </View>
            ) : null}

            {personalBests ? (
              <PersonalBestsSection
                bests={personalBests}
                records={records}
                onItemPress={(type) => setBestsModal(type)}
              />
            ) : null}
            <ChallengesSection
              challenges={challenges}
              onAdd={() => {
                setEditingChallenge(null);
                setShowChallengeModal(true);
              }}
              onEdit={(c) => {
                setEditingChallenge(c);
                setShowChallengeModal(true);
              }}
              onDelete={async (id) => {
                Alert.alert('删除挑战', '确定删除这个挑战吗？', [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: async () => {
                      await challengesRepo.delete(id);
                      setChallenges(prev => prev.filter(c => c.id !== id));
                    },
                  },
                ]);
              }}
            />

            {focus === 'current-week' ? (
              <View style={styles.focusBanner}>
                <Text style={styles.focusBannerTitle}>{t('history.currentWeekFocusTitle')}</Text>
                <Text style={styles.focusBannerText}>{t('history.currentWeekFocusText')}</Text>
              </View>
            ) : null}


          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('history.noRecords')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.group}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>{item.weekLabel}</Text>
              <Text style={styles.weekStats}>
                {t('history.weekStats', { km: item.totalKm.toFixed(1), count: item.records.length })}
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
      <ChallengeModal
        visible={showChallengeModal}
        editing={editingChallenge}
        onClose={() => setShowChallengeModal(false)}
        onSave={async (data) => {
          if (editingChallenge?.id) {
            const updated = { ...editingChallenge, ...data };
            await challengesRepo.update(updated);
            setChallenges(prev => prev.map(c => c.id === updated.id ? updated : c));
          } else {
            const created = await challengesRepo.save(data);
            setChallenges(prev => [created, ...prev]);
          }
          setShowChallengeModal(false);
        }}
      />
      <BestsDetailModal
        type={bestsModal}
        records={records}
        bests={personalBests}
        onClose={() => setBestsModal(null)}
      />
    </SafeAreaView>
  );
}

// ===== 个人最佳 =====
interface PersonalBests {
  longestRun: { distance: number; date: string };
  bestPace: { paceSec: number; date: string } | null;
  bestVDOT: { vdot: number; date: string } | null;
  longestStreak: number;
  bestWeeklyKm: number;
  totalKm: number;
}

function calcPersonalBests(records: RunRecord[]): PersonalBests | null {
  const valid = records.filter(r => r.distance > 0 && r.duration_sec > 0);
  if (valid.length === 0) return null;

  const longestRun = valid.reduce((b, r) => r.distance > b.distance ? r : b, valid[0]);

  const longEnough = valid.filter(r => r.distance >= 3 && r.avg_pace > 0);
  const bestPaceRec = longEnough.length > 0
    ? longEnough.reduce((b, r) => r.avg_pace < b.avg_pace ? r : b, longEnough[0])
    : null;

  const withVDOT = valid.filter(r => (r.vdot ?? 0) > 0);
  const bestVDOTRec = withVDOT.length > 0
    ? withVDOT.reduce((b, r) => (r.vdot ?? 0) > (b.vdot ?? 0) ? r : b, withVDOT[0])
    : null;

  const totalKm = valid.reduce((s, r) => s + r.distance, 0);

  const dateSet = [...new Set(valid.map(r => r.run_date))].sort();
  let streak = 1, maxStreak = 1;
  for (let i = 1; i < dateSet.length; i++) {
    const diff = Math.round(
      (new Date(dateSet[i]).getTime() - new Date(dateSet[i - 1]).getTime()) / 86400000
    );
    if (diff === 1) { streak++; maxStreak = Math.max(maxStreak, streak); }
    else streak = 1;
  }

  const weekMap = new Map<string, number>();
  for (const r of valid) {
    const d = new Date(r.run_date);
    const shift = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const mon = new Date(d);
    mon.setDate(d.getDate() - shift);
    const key = mon.toISOString().split('T')[0];
    weekMap.set(key, (weekMap.get(key) ?? 0) + r.distance);
  }
  const bestWeeklyKm = weekMap.size > 0 ? Math.max(...weekMap.values()) : 0;

  return {
    longestRun: { distance: longestRun.distance, date: longestRun.run_date },
    bestPace: bestPaceRec ? { paceSec: bestPaceRec.avg_pace, date: bestPaceRec.run_date } : null,
    bestVDOT: bestVDOTRec ? { vdot: bestVDOTRec.vdot!, date: bestVDOTRec.run_date } : null,
    longestStreak: maxStreak,
    bestWeeklyKm,
    totalKm,
  };
}

function PersonalBestsSection({
  bests,
  records,
  onItemPress,
}: {
  bests: PersonalBests;
  records: RunRecord[];
  onItemPress: (type: string) => void;
}) {
  const items = [
    { icon: '📏', label: '最长距离', type: 'longestRun', value: `${bests.longestRun.distance.toFixed(2)} km`, date: bests.longestRun.date },
    bests.bestPace ? { icon: '⚡', label: '最快配速', type: 'bestPace', value: `${formatPace(bests.bestPace.paceSec)}/km`, date: bests.bestPace.date } : null,
    bests.bestVDOT ? { icon: '📈', label: '最高跑力', type: 'bestVDOT', value: bests.bestVDOT.vdot.toFixed(1), date: bests.bestVDOT.date } : null,
    { icon: '🔥', label: '最长连跑', type: 'longestStreak', value: `${bests.longestStreak} 天`, date: null },
    { icon: '📅', label: '单周最高', type: 'bestWeeklyKm', value: `${bests.bestWeeklyKm.toFixed(1)} km`, date: null },
    { icon: '🌍', label: '累计里程', type: 'totalKm', value: `${Math.round(bests.totalKm)} km`, date: null },
  ].filter((x): x is { icon: string; label: string; type: string; value: string; date: string | null } => x !== null);

  return (
    <View style={styles.bestsCard}>
      <Text style={styles.bestsTitle}>我之最</Text>
      <View style={styles.bestsGrid}>
        {items.map((item, idx) => (
          <TouchableOpacity key={idx} style={styles.bestsItem} onPress={() => onItemPress(item.type)} activeOpacity={0.7}>
            <Text style={styles.bestsItemIcon}>{item.icon}</Text>
            <Text style={styles.bestsItemValue}>{item.value}</Text>
            <Text style={styles.bestsItemLabel}>{item.label}</Text>
            {item.date ? <Text style={styles.bestsItemDate}>{item.date}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ===== 我之最详情弹窗 =====
function computeBestsDetail(
  type: string,
  records: RunRecord[],
  bests: PersonalBests,
): { title: string; rows: { label: string; value: string }[] } {
  const valid = records.filter(r => r.distance > 0 && r.duration_sec > 0);
  const fmtDur = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };
  switch (type) {
    case 'longestRun': {
      const rec = [...valid].sort((a, b) => b.distance - a.distance)[0];
      const rows: { label: string; value: string }[] = [
        { label: '日期', value: rec.run_date },
        { label: '距离', value: `${rec.distance.toFixed(2)} km` },
        { label: '配速', value: `${formatPace(rec.avg_pace)}/km` },
        { label: '时长', value: fmtDur(rec.duration_sec) },
      ];
      if (rec.avg_hr > 0) rows.push({ label: '平均心率', value: `${rec.avg_hr} bpm` });
      return { title: '📏 最长距离', rows };
    }
    case 'bestPace': {
      if (!bests.bestPace) return { title: '⚡ 最快配速', rows: [] };
      const rec = valid
        .filter(r => r.distance >= 3 && r.avg_pace > 0)
        .reduce((b, r) => r.avg_pace < b.avg_pace ? r : b);
      const rows: { label: string; value: string }[] = [
        { label: '日期', value: rec.run_date },
        { label: '配速', value: `${formatPace(rec.avg_pace)}/km` },
        { label: '距离', value: `${rec.distance.toFixed(2)} km` },
        { label: '时长', value: fmtDur(rec.duration_sec) },
      ];
      if (rec.avg_hr > 0) rows.push({ label: '平均心率', value: `${rec.avg_hr} bpm` });
      return { title: '⚡ 最快配速', rows };
    }
    case 'bestVDOT': {
      if (!bests.bestVDOT) return { title: '📈 最高跑力', rows: [] };
      const rec = valid
        .filter(r => (r.vdot ?? 0) > 0)
        .reduce((b, r) => (r.vdot ?? 0) > (b.vdot ?? 0) ? r : b);
      return {
        title: '📈 最高跑力',
        rows: [
          { label: '日期', value: rec.run_date },
          { label: '跑力 (VDOT)', value: (rec.vdot ?? 0).toFixed(1) },
          { label: '距离', value: `${rec.distance.toFixed(2)} km` },
          { label: '配速', value: `${formatPace(rec.avg_pace)}/km` },
          { label: '时长', value: fmtDur(rec.duration_sec) },
        ],
      };
    }
    case 'longestStreak': {
      const dateSet = [...new Set(valid.map(r => r.run_date))].sort();
      if (dateSet.length === 0) return { title: '🔥 最长连跑', rows: [] };
      let sStart = dateSet[0], sPrev = dateSet[0], sLen = 1;
      let best = { start: sStart, end: sPrev, days: sLen };
      for (let i = 1; i < dateSet.length; i++) {
        const diff = Math.round((new Date(dateSet[i]).getTime() - new Date(sPrev).getTime()) / 86400000);
        if (diff === 1) { sLen++; sPrev = dateSet[i]; if (sLen > best.days) best = { start: sStart, end: sPrev, days: sLen }; }
        else { sStart = sPrev = dateSet[i]; sLen = 1; }
      }
      if (sLen > best.days) best = { start: sStart, end: sPrev, days: sLen };
      const streakRuns = valid.filter(r => r.run_date >= best.start && r.run_date <= best.end);
      const streakKm = streakRuns.reduce((s, r) => s + r.distance, 0);
      return {
        title: '🔥 最长连跑',
        rows: [
          { label: '连续天数', value: `${best.days} 天` },
          { label: '起止日期', value: best.days === 1 ? best.start : `${best.start} – ${best.end}` },
          { label: '期间里程', value: `${streakKm.toFixed(1)} km` },
          { label: '期间训练', value: `${streakRuns.length} 次` },
        ],
      };
    }
    case 'bestWeeklyKm': {
      const weekMap = new Map<string, RunRecord[]>();
      for (const r of valid) {
        const d = new Date(r.run_date);
        const shift = d.getDay() === 0 ? 6 : d.getDay() - 1;
        const mon = new Date(d); mon.setDate(d.getDate() - shift);
        const key = mon.toISOString().split('T')[0];
        if (!weekMap.has(key)) weekMap.set(key, []);
        weekMap.get(key)!.push(r);
      }
      if (weekMap.size === 0) return { title: '📅 单周最高', rows: [] };
      const [bestKey, bestRecs] = [...weekMap.entries()].reduce(
        ([bk, br], [k, recs]) =>
          recs.reduce((s, r) => s + r.distance, 0) > br.reduce((s, r) => s + r.distance, 0)
            ? [k, recs] : [bk, br]
      );
      const weekKm = bestRecs.reduce((s, r) => s + r.distance, 0);
      const sun = new Date(bestKey); sun.setDate(sun.getDate() + 6);
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      return {
        title: '📅 单周最高',
        rows: [
          { label: '周期', value: `${bestKey} – ${fmt(sun)}` },
          { label: '总里程', value: `${weekKm.toFixed(1)} km` },
          { label: '训练次数', value: `${bestRecs.length} 次` },
          { label: '平均每次', value: `${(weekKm / bestRecs.length).toFixed(1)} km` },
        ],
      };
    }
    case 'totalKm': {
      const totalKm = valid.reduce((s, r) => s + r.distance, 0);
      const dates = valid.map(r => r.run_date).sort();
      return {
        title: '🌍 累计里程',
        rows: [
          { label: '总里程', value: `${Math.round(totalKm)} km` },
          { label: '总训练次数', value: `${valid.length} 次` },
          { label: '平均每次', value: `${(totalKm / valid.length).toFixed(1)} km` },
          { label: '最早记录', value: dates[0] ?? '-' },
          { label: '最近记录', value: dates[dates.length - 1] ?? '-' },
        ],
      };
    }
    default: return { title: '', rows: [] };
  }
}

function BestsDetailModal({
  type,
  records,
  bests,
  onClose,
}: {
  type: string | null;
  records: RunRecord[];
  bests: PersonalBests | null;
  onClose: () => void;
}) {
  if (!type || !bests) return null;
  const { title, rows } = computeBestsDetail(type, records, bests);
  return (
    <Modal visible={!!type} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.bestsDetailList}>
            {rows.map((item, i) => (
              <View key={i}>
                {i > 0 && <View style={{ height: 1, backgroundColor: Colors.separator }} />}
                <View style={styles.bestsDetailRow}>
                  <Text style={styles.bestsDetailLabel}>{item.label}</Text>
                  <Text style={styles.bestsDetailValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.bestsCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.bestsCloseBtnText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ===== 我的挑战（DB-backed，用户自编辑）=====
function ChallengesSection({
  challenges,
  onAdd,
  onEdit,
  onDelete,
}: {
  challenges: Challenge[];
  onAdd: () => void;
  onEdit: (c: Challenge) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <View style={styles.challengeCard}>
      <View style={styles.challengeHeader}>
        <Text style={styles.challengeTitle}>我的挑战</Text>
        <TouchableOpacity style={styles.challengeAddBtn} onPress={onAdd} activeOpacity={0.7}>
          <Text style={styles.challengeAddBtnText}>+ 新增</Text>
        </TouchableOpacity>
      </View>
      {challenges.length === 0 ? (
        <Text style={styles.challengeEmpty}>
          设定一个小目标：比如以 4'00"/km 配速跑完 1 公里。{'\n'}系统会自动检测你的记录是否达成。
        </Text>
      ) : (
        challenges.map((c) => (
          <View key={c.id} style={[styles.challengeRow, !c.achieved && styles.challengeRowActive]}>
            <View style={styles.challengeRowLeft}>
              <Text style={styles.challengeRowIcon}>{c.achieved ? '✅' : '🎯'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.challengeRowLabel, !c.achieved && styles.challengeRowLabelHighlight]}>
                  {c.title}
                </Text>
                <Text style={styles.challengeRowSub}>
                  {c.target_km} km · {formatPace(c.target_pace_sec)}/km
                </Text>
                {!c.achieved && (() => {
                  const days = Math.floor((Date.now() - c.created_at) / 86400000);
                  return days >= 1
                    ? <Text style={styles.challengeRowSub}>第 {days} 天</Text>
                    : null;
                })()}
                {c.achieved_date ? (
                  <Text style={styles.challengeRowDate}>已达成 · {c.achieved_date}</Text>
                ) : null}
              </View>
            </View>
            {!c.achieved && (
              <View style={styles.challengeActions}>
                <TouchableOpacity onPress={() => onEdit(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.challengeEditBtn}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(c.id!)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.challengeDeleteBtn}>删除</Text>
                </TouchableOpacity>
              </View>
            )}
            {c.achieved && (
              <TouchableOpacity onPress={() => onDelete(c.id!)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.challengeDeleteBtn}>删除</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </View>
  );
}

// ===== 挑战编辑弹窗 =====
function ChallengeModal({
  visible,
  editing,
  onClose,
  onSave,
}: {
  visible: boolean;
  editing: Challenge | null;
  onClose: () => void;
  onSave: (data: { title: string; target_km: number; target_pace_sec: number }) => void;
}) {
  const [title, setTitle] = React.useState('');
  const [km, setKm] = React.useState('');
  const [paceMin, setPaceMin] = React.useState('');
  const [paceSec, setPaceSec] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      if (editing) {
        setTitle(editing.title);
        setKm(String(editing.target_km));
        setPaceMin(String(Math.floor(editing.target_pace_sec / 60)));
        setPaceSec(String(editing.target_pace_sec % 60));
      } else {
        setTitle('');
        setKm('');
        setPaceMin('');
        setPaceSec('');
      }
    }
  }, [visible, editing]);

  const handleSave = () => {
    const kmVal = parseFloat(km);
    const minVal = parseInt(paceMin, 10);
    const secVal = parseInt(paceSec, 10);
    if (!title.trim()) { Alert.alert('请填写挑战名称'); return; }
    if (!kmVal || kmVal <= 0) { Alert.alert('请填写有效距离'); return; }
    if (!minVal || minVal < 1 || isNaN(secVal) || secVal < 0 || secVal > 59) {
      Alert.alert('请填写有效配速（分:秒，秒数 0-59）'); return;
    }
    onSave({ title: title.trim(), target_km: kmVal, target_pace_sec: minVal * 60 + secVal });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{editing ? '编辑挑战' : '新增挑战'}</Text>

          <Text style={styles.modalLabel}>挑战名称</Text>
          <TextInput
            style={styles.modalInput}
            value={title}
            onChangeText={setTitle}
            placeholder="例：以 4'00 配速跑完 1 公里"
            placeholderTextColor={Colors.gray4}
          />

          <Text style={styles.modalLabel}>目标距离（公里）</Text>
          <TextInput
            style={styles.modalInput}
            value={km}
            onChangeText={setKm}
            placeholder="例：1"
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.gray4}
          />

          <Text style={styles.modalLabel}>目标配速（分 : 秒 每公里）</Text>
          <View style={styles.modalPaceRow}>
            <TextInput
              style={[styles.modalInput, { flex: 1 }]}
              value={paceMin}
              onChangeText={setPaceMin}
              placeholder="分"
              keyboardType="number-pad"
              placeholderTextColor={Colors.gray4}
            />
            <Text style={styles.modalPaceColon}>:</Text>
            <TextInput
              style={[styles.modalInput, { flex: 1 }]}
              value={paceSec}
              onChangeText={setPaceSec}
              placeholder="秒"
              keyboardType="number-pad"
              placeholderTextColor={Colors.gray4}
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.modalSaveText}>保存</Text>
            </TouchableOpacity>
          </View>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
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
  // ===== 我的之最 =====
  bestsCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  bestsTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  bestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  bestsItem: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    gap: 2,
  },
  bestsItemIcon: { fontSize: 20 },
  bestsItemValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.black,
    marginTop: 2,
  },
  bestsItemLabel: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
  },
  bestsItemDate: {
    fontSize: FontSize.small,
    color: Colors.gray4,
  },
  bestsItemTap: {
    fontSize: FontSize.small,
    color: Colors.primary,
    marginTop: 2,
  },
  bestsDetailList: {
    gap: 0,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.cardBackground,
  },
  bestsCloseBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  bestsCloseBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: Colors.gray2,
  },
  bestsDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  bestsDetailLabel: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    flex: 1,
  },
  bestsDetailValue: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
    textAlign: 'right',
  },
  // ===== 挑战 =====
  challengeCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  challengeAddBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  challengeAddBtnText: {
    fontSize: FontSize.caption,
    color: Colors.white,
    fontWeight: FontWeight.semibold,
  },
  challengeEmpty: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 20,
  },
  challengeBasis: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  challengeRowActive: {
    backgroundColor: Colors.primary + '0D',
  },
  challengeRowHighlight: {
    backgroundColor: Colors.primary + '10',
  },
  challengeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  challengeRowIcon: { fontSize: 18 },
  challengeRowLabel: {
    fontSize: FontSize.body,
    color: Colors.black,
    fontWeight: FontWeight.medium,
  },
  challengeRowLabelHighlight: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  challengeRowSub: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
    marginTop: 1,
  },
  challengeRowDate: {
    fontSize: FontSize.caption,
    color: Colors.statusGreen,
    marginTop: 1,
  },
  challengeActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  challengeEditBtn: {
    fontSize: FontSize.caption,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    paddingHorizontal: Spacing.xs,
  },
  challengeDeleteBtn: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
    paddingHorizontal: Spacing.xs,
  },
  challengePaceBadge: {
    backgroundColor: Colors.separator,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  challengePaceBadgeAchieved: {
    backgroundColor: Colors.statusGreen + '20',
  },
  challengePaceText: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    fontWeight: FontWeight.medium,
  },
  challengePaceTextAchieved: {
    color: Colors.statusGreen,
  },
  // ===== 弹窗 =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    color: Colors.black,
    marginBottom: Spacing.xs,
  },
  modalLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.gray2,
    marginTop: Spacing.xs,
  },
  modalInput: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
    color: Colors.black,
    borderWidth: 1,
    borderColor: Colors.separator,
    marginTop: 4,
  },
  modalPaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  modalPaceColon: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: Colors.gray2,
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
});
