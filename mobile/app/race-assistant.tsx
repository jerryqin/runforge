import React, { useState } from 'react';
import {
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
import { generateRacePlan, RacePlanOutput } from '../src/engine/RaceEngine';

export default function RaceAssistantScreen() {
  const [raceDate, setRaceDate] = useState('');
  const [targetTime, setTargetTime] = useState(''); // HH:MM:SS
  const [plan, setPlan] = useState<RacePlanOutput | null>(null);

  const handleGenerate = () => {
    // 解析目标时间
    const parts = targetTime.split(':').map(Number);
    let sec = 0;
    if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) sec = parts[0] * 3600 + parts[1] * 60;

    if (!raceDate.match(/^\d{4}-\d{2}-\d{2}$/)) return;
    if (sec < 7200 || sec > 28800) return; // 2h–8h 范围

    setPlan(generateRacePlan({ raceDate, targetTimeSec: sec }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 输入区 */}
          <View style={styles.inputArea}>
            <View style={styles.field}>
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
            <View style={styles.field}>
              <Text style={styles.label}>目标完赛时间</Text>
              <TextInput
                style={styles.input}
                value={targetTime}
                onChangeText={setTargetTime}
                placeholder="如：04:30:00"
                placeholderTextColor={Colors.gray4}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} activeOpacity={0.8}>
              <Text style={styles.generateBtnText}>生成备赛方案</Text>
            </TouchableOpacity>
          </View>

          {/* 结果区 */}
          {plan && (
            <View style={styles.planArea}>
              {/* 概览 */}
              <View style={styles.overview}>
                <OverviewItem label="目标时间" value={plan.targetTimeLabel} />
                <OverviewItem label="目标配速" value={plan.targetPaceLabel + '/km'} />
                <OverviewItem label="VDOT" value={String(plan.vdot)} />
                <OverviewItem
                  label="距比赛"
                  value={plan.daysUntilRace > 0 ? `${plan.daysUntilRace} 天` : '已过'}
                />
              </View>

              {/* 分段策略 */}
              <PlanSection title="分段配速策略">
                {plan.segments.map((seg) => (
                  <View key={seg.segment} style={styles.segRow}>
                    <View style={styles.segLeft}>
                      <Text style={styles.segSegment}>{seg.segment}</Text>
                      <Text style={styles.segPace}>{seg.paceLabel}</Text>
                    </View>
                    <Text style={styles.segNote}>{seg.note}</Text>
                  </View>
                ))}
              </PlanSection>

              {/* 补给策略 */}
              <PlanSection title="补给策略">
                {plan.gels.map((gel) => (
                  <View key={gel.km} style={styles.gelRow}>
                    <View style={styles.gelKmBadge}>
                      <Text style={styles.gelKm}>{gel.km}km</Text>
                    </View>
                    <Text style={styles.gelNote}>{gel.note}</Text>
                  </View>
                ))}
                <Text style={styles.gelExtra}>每个补水站少量多次补水</Text>
              </PlanSection>

              {/* 赛前计划 */}
              <PlanSection title="赛前 10 天计划">
                {plan.preRacePlan.map((item) => (
                  <View key={item.days} style={styles.preRow}>
                    <Text style={styles.preDays}>{item.days}</Text>
                    <Text style={styles.prePlan}>{item.plan}</Text>
                  </View>
                ))}
              </PlanSection>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OverviewItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.overviewItem}>
      <Text style={styles.overviewValue}>{value}</Text>
      <Text style={styles.overviewLabel}>{label}</Text>
    </View>
  );
}

function PlanSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { padding: Spacing.md, gap: Spacing.lg },
  inputArea: { gap: Spacing.md },
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
  generateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  generateBtnText: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold, color: Colors.white },
  planArea: { gap: Spacing.lg },
  overview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  overviewItem: { alignItems: 'center', flex: 1 },
  overviewValue: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.black },
  overviewLabel: { fontSize: FontSize.caption, color: Colors.gray3, marginTop: 2 },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.gray2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  segRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    gap: Spacing.md,
  },
  segLeft: { minWidth: 80 },
  segSegment: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.black },
  segPace: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.primary },
  segNote: { flex: 1, fontSize: FontSize.caption, color: Colors.gray2, lineHeight: 18 },
  gelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    gap: Spacing.md,
  },
  gelKmBadge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 52,
    alignItems: 'center',
  },
  gelKm: { fontSize: FontSize.caption, fontWeight: FontWeight.bold, color: Colors.white },
  gelNote: { flex: 1, fontSize: FontSize.body, color: Colors.black },
  gelExtra: {
    padding: Spacing.md,
    fontSize: FontSize.caption,
    color: Colors.gray3,
  },
  preRow: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    gap: Spacing.xs,
  },
  preDays: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.black },
  prePlan: { fontSize: FontSize.body, color: Colors.gray2, lineHeight: 22 },
});
