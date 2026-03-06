import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Spacing,
} from '../src/constants/theme';
import { userProfileRepo } from '../src/db/repositories/UserProfileRepository';
import { trainingPlanRepo } from '../src/db/repositories/TrainingPlanRepository';
import { runRecordRepo } from '../src/db/repositories/RunRecordRepository';
import {
  generateTrainingPlan,
  PlanPhase,
  PlanPhaseLabel,
  TrainingPlan,
  WeekPlan,
} from '../src/engine/TrainingPlanEngine';
import { TrainingType, calcVDOT } from '../src/engine/VDOTEngine';
import { formatPace } from '../src/engine/AnalysisEngine';

const PHASE_COLORS: Record<PlanPhase, string> = {
  [PlanPhase.BASE]: Colors.intensityEasy,
  [PlanPhase.BUILD]: Colors.intensityNormal,
  [PlanPhase.PEAK]: Colors.intensityHigh,
  [PlanPhase.TAPER]: '#8B5CF6',
};

const TYPE_COLORS: Record<TrainingType, string> = {
  [TrainingType.REST]: Colors.gray3,
  [TrainingType.EASY]: Colors.intensityEasy,
  [TrainingType.LONG_RUN]: Colors.intensityNormal,
  [TrainingType.TEMPO]: Colors.intensityHigh,
  [TrainingType.INTERVAL]: Colors.intensityOver,
  [TrainingType.RECOVERY]: Colors.intensityEasy,
};

export default function TrainingPlanScreen() {
  const [raceDate, setRaceDate] = useState('');
  const [currentVDOT, setCurrentVDOT] = useState(0);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 加载已保存的训练计划
        const saved = await trainingPlanRepo.getLatest();
        if (saved) {
          const parsed = JSON.parse(saved.plan_json) as TrainingPlan;
          setPlan(parsed);
          setRaceDate(saved.race_date);
          setCurrentVDOT(saved.vdot);
        }

        // 计算当前 VDOT
        const records = await runRecordRepo.fetchAll();
        const vdots = records
          .filter(r => r.distance >= 3 && r.duration_sec > 0)
          .slice(0, 5)
          .map(r => r.vdot ?? calcVDOT(r.distance, r.duration_sec))
          .filter(v => v > 0);

        if (vdots.length > 0) {
          const sorted = [...vdots].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          setCurrentVDOT(median);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleGenerate = async () => {
    if (!raceDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('日期格式错误', '请输入 YYYY-MM-DD 格式');
      return;
    }

    if (currentVDOT <= 0) {
      Alert.alert('无法生成', '请先录入至少一条3km以上的跑步记录，以便计算 VDOT');
      return;
    }

    const profile = await userProfileRepo.get();

    setGenerating(true);
    try {
      const generated = generateTrainingPlan({
        raceDate,
        currentVDOT,
        currentWeeklyKm: profile.weekly_km ?? 30,
      });

      if (!generated) {
        Alert.alert('距比赛太近', '至少需要2周以上才能生成训练计划');
        return;
      }

      setPlan(generated);
      setExpandedWeek(1);

      // 保存到数据库
      await trainingPlanRepo.save({
        race_date: raceDate,
        vdot: currentVDOT,
        weekly_peak_km: generated.weeklyPeakKm,
        plan_json: JSON.stringify(generated),
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 输入区 */}
          <View style={styles.inputArea}>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>比赛日期</Text>
                <TextInput
                  style={styles.input}
                  value={raceDate}
                  onChangeText={setRaceDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.gray4}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={[styles.field, { width: 100 }]}>
                <Text style={styles.label}>VDOT</Text>
                <View style={styles.vdotBox}>
                  <Text style={styles.vdotValue}>
                    {currentVDOT > 0 ? currentVDOT.toFixed(1) : '—'}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.generateBtn, generating && { opacity: 0.7 }]}
              onPress={handleGenerate}
              disabled={generating}
              activeOpacity={0.8}
            >
              <Text style={styles.generateBtnText}>
                {generating ? '生成中...' : plan ? '重新生成' : '生成训练计划'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 计划总览 */}
          {plan && (
            <>
              <View style={styles.overview}>
                <Text style={styles.overviewTitle}>
                  {plan.totalWeeks} 周训练计划
                </Text>
                <View style={styles.phaseBar}>
                  {plan.phases.map(p => {
                    const weeks = p.endWeek - p.startWeek + 1;
                    const pct = (weeks / plan.totalWeeks) * 100;
                    return (
                      <View
                        key={p.phase}
                        style={[
                          styles.phaseSegment,
                          {
                            flex: weeks,
                            backgroundColor: PHASE_COLORS[p.phase] + '40',
                          },
                        ]}
                      >
                        <Text style={[styles.phaseSegText, { color: PHASE_COLORS[p.phase] }]}>
                          {p.label}
                        </Text>
                        <Text style={styles.phaseWeeks}>{weeks}周</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* 每周计划 */}
              {plan.weeks.map(week => (
                <WeekCard
                  key={week.weekNumber}
                  week={week}
                  expanded={expandedWeek === week.weekNumber}
                  onToggle={() =>
                    setExpandedWeek(expandedWeek === week.weekNumber ? null : week.weekNumber)
                  }
                />
              ))}

              {/* 配速区间参考 */}
              <View style={styles.zonesRef}>
                <Text style={styles.zonesRefTitle}>配速区间参考 (VDOT {plan.targetVDOT.toFixed(1)})</Text>
                {plan.zones.map(z => (
                  <View key={z.zone} style={styles.zoneRefRow}>
                    <Text style={styles.zoneRefCode}>{z.zone}</Text>
                    <Text style={styles.zoneRefLabel}>{z.label}</Text>
                    <Text style={styles.zoneRefPace}>
                      {formatPace(z.paceMinSec)} ~ {formatPace(z.paceMaxSec)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WeekCard({
  week,
  expanded,
  onToggle,
}: {
  week: WeekPlan;
  expanded: boolean;
  onToggle: () => void;
}) {
  const phaseColor = PHASE_COLORS[week.phase];

  return (
    <TouchableOpacity
      style={[styles.weekCard, { borderLeftColor: phaseColor }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.weekHeader}>
        <View>
          <Text style={styles.weekNumber}>第 {week.weekNumber} 周</Text>
          <Text style={[styles.weekPhase, { color: phaseColor }]}>{week.phaseLabel}</Text>
        </View>
        <View style={styles.weekRight}>
          <Text style={styles.weekKm}>{week.weeklyKm}km</Text>
          <Text style={styles.weekExpand}>{expanded ? '▼' : '▶'}</Text>
        </View>
      </View>

      <Text style={styles.weekFocus}>{week.focus}</Text>

      {expanded && (
        <View style={styles.daysList}>
          {week.days.map(day => {
            const typeColor = TYPE_COLORS[day.type];
            return (
              <View key={day.dayOfWeek} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                <View style={[styles.dayBadge, { backgroundColor: typeColor + '15' }]}>
                  <Text style={[styles.dayType, { color: typeColor }]}>{day.label}</Text>
                </View>
                {day.paceRange && (
                  <Text style={styles.dayPace}>{day.paceRange}</Text>
                )}
              </View>
            );
          })}
          {week.days.some(d => d.note) && (
            <View style={styles.notesBox}>
              {week.days.filter(d => d.note).map(d => (
                <Text key={d.dayOfWeek} style={styles.noteText}>
                  {d.dayLabel}: {d.note}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  inputArea: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  field: { gap: Spacing.xs },
  label: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.black },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.separator,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.h3,
    color: Colors.black,
  },
  vdotBox: {
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.primary + '08',
  },
  vdotValue: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.primary },
  generateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  generateBtnText: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold, color: Colors.white },
  overview: { gap: Spacing.sm },
  overviewTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.black },
  phaseBar: {
    flexDirection: 'row',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    gap: 2,
  },
  phaseSegment: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  phaseSegText: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  phaseWeeks: { fontSize: FontSize.small, color: Colors.gray2 },
  weekCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderLeftWidth: 4,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekNumber: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.black },
  weekPhase: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  weekRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  weekKm: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.gray2 },
  weekExpand: { fontSize: FontSize.caption, color: Colors.gray3 },
  weekFocus: { fontSize: FontSize.caption, color: Colors.gray2 },
  daysList: { gap: Spacing.xs, marginTop: Spacing.xs },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 3,
  },
  dayLabel: {
    width: 32,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    color: Colors.gray2,
  },
  dayBadge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  dayType: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  dayPace: { fontSize: FontSize.small, color: Colors.gray3, flex: 1, textAlign: 'right' },
  notesBox: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    gap: 2,
    marginTop: Spacing.xs,
  },
  noteText: { fontSize: FontSize.caption, color: Colors.gray2, lineHeight: 18 },
  zonesRef: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  zonesRefTitle: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold, color: Colors.gray2 },
  zoneRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  zoneRefCode: { width: 20, fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.primary },
  zoneRefLabel: { flex: 1, fontSize: FontSize.body, color: Colors.black },
  zoneRefPace: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.gray1 },
});
