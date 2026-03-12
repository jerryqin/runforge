import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Spacing } from '../src/constants/theme';

const PROGRESSION_ROWS = [
  {
    range: '25–30',
    min: 25,
    max: 30,
    level: '入门跑者',
    marathon: '4:30–5:00',
    meaning: '能完成半马 / 全马，以健康跑、轻松跑为主',
  },
  {
    range: '30–35',
    min: 30,
    max: 35,
    level: '进阶跑者',
    marathon: '3:45–4:30',
    meaning: '具备稳定长距离能力，可参与大众赛事 PB',
  },
  {
    range: '35–40',
    min: 35,
    max: 40,
    level: '精英大众',
    marathon: '3:15–3:45',
    meaning: '赛事前几名水平，具备系统间歇 / 阈值训练能力',
  },
  {
    range: '40–50',
    min: 40,
    max: 50,
    level: '业余精英',
    marathon: '2:45–3:15',
    meaning: '接近专业水准，可冲击国家级赛事名次',
  },
  {
    range: '50+',
    min: 50,
    max: Number.POSITIVE_INFINITY,
    level: '职业选手',
    marathon: '2:20 以内',
    meaning: '顶尖耐力水平，代表人类长跑极限',
  },
];

export default function VDOTProgressionScreen() {
  const { current } = useLocalSearchParams<{ current?: string }>();
  const currentVDOT = Number(current ?? 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>跑力进阶路径</Text>
          <Text style={styles.heroTitle}>看看你当前处在哪个阶段，以及下一步的提升方向</Text>
          <Text style={styles.heroBody}>把当前跑力放进长期坐标里看，比只看单次预测更容易判断自己正在往哪里走。</Text>
        </View>

        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>当前跑力</Text>
          <Text style={styles.currentValue}>{currentVDOT.toFixed(1)}</Text>
          <Text style={styles.currentMeta}>{findProgressionLabel(currentVDOT)}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.rangeCol]}>VDOT 范围</Text>
          <Text style={[styles.tableHeaderCell, styles.levelCol]}>对应水平</Text>
          <Text style={[styles.tableHeaderCell, styles.resultCol]}>全马参考</Text>
          <Text style={[styles.tableHeaderCell, styles.meaningCol]}>意义</Text>
        </View>

        {PROGRESSION_ROWS.map((row) => {
          const active = isCurrentRange(currentVDOT, row.min, row.max);
          return (
            <View key={row.range} style={[styles.tableRow, active && styles.tableRowActive]}>
              <Text style={[styles.tableCell, styles.rangeCol, active && styles.tableCellActive]}>{row.range}</Text>
              <Text style={[styles.tableCell, styles.levelCol, active && styles.tableCellActive]}>{row.level}</Text>
              <Text style={[styles.tableCell, styles.resultCol, active && styles.tableCellActive]}>{row.marathon}</Text>
              <Text style={[styles.tableCell, styles.meaningCol, active && styles.tableCellActive]}>{row.meaning}</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function isCurrentRange(vdot: number, min: number, max: number) {
  return vdot >= min && vdot < max;
}

function findProgressionLabel(vdot: number) {
  const matched = PROGRESSION_ROWS.find((row) => isCurrentRange(vdot, row.min, row.max));
  if (matched) {
    return `你当前处于「${matched.level}」阶段`;
  }
  if (vdot < PROGRESSION_ROWS[0].min) {
    return '你当前处于入门积累阶段';
  }
  return '你当前已达到顶尖耐力阶段';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  heroCard: {
    backgroundColor: Colors.black,
    borderRadius: 20,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroEyebrow: {
    fontSize: FontSize.caption,
    color: Colors.white + 'CC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  heroBody: {
    fontSize: FontSize.body,
    color: Colors.white,
    lineHeight: 22,
  },
  currentCard: {
    backgroundColor: Colors.primary + '12',
    borderRadius: 16,
    padding: Spacing.md,
    gap: 2,
  },
  currentLabel: { fontSize: FontSize.caption, color: Colors.gray2 },
  currentValue: { fontSize: FontSize.h1, fontWeight: FontWeight.bold, color: Colors.primary },
  currentMeta: { fontSize: FontSize.body, color: Colors.gray1 },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  tableHeaderCell: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    fontWeight: FontWeight.semibold,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  tableRowActive: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    paddingHorizontal: Spacing.xs,
  },
  tableCell: {
    fontSize: FontSize.caption,
    color: Colors.black,
    lineHeight: 18,
  },
  tableCellActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  rangeCol: { flex: 0.9 },
  levelCol: { flex: 1.1 },
  resultCol: { flex: 1.2 },
  meaningCol: { flex: 1.8 },
});