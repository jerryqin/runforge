import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Spacing } from '../src/constants/theme';

const PROGRESSION_ROWS = [
  { range: '25–30', min: 25, max: 30, key: 'beginner', marathon: '4:30–5:00' },
  { range: '30–35', min: 30, max: 35, key: 'intermediate', marathon: '3:45–4:30' },
  { range: '35–40', min: 35, max: 40, key: 'eliteAmateur', marathon: '3:15–3:45' },
  { range: '40–50', min: 40, max: 50, key: 'amateurElite', marathon: '2:45–3:15' },
  { range: '50+', min: 50, max: Number.POSITIVE_INFINITY, key: 'professional', marathon: null },
];

export default function VDOTProgressionScreen() {
  const { current } = useLocalSearchParams<{ current?: string }>();
  const currentVDOT = Number(current ?? 0);
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>{t('vdotProgression.currentLabel')}</Text>
          <Text style={styles.currentValue}>{currentVDOT.toFixed(1)}</Text>
          <Text style={styles.currentMeta}>{findProgressionLabel(currentVDOT, t)}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.rangeCol]}>{t('vdotProgression.rangeHeader')}</Text>
          <Text style={[styles.tableHeaderCell, styles.levelCol]}>{t('vdotProgression.levelHeader')}</Text>
          <Text style={[styles.tableHeaderCell, styles.resultCol]}>{t('vdotProgression.marathonHeader')}</Text>
          <Text style={[styles.tableHeaderCell, styles.meaningCol]}>{t('vdotProgression.meaningHeader')}</Text>
        </View>

        {PROGRESSION_ROWS.map((row) => {
          const active = isCurrentRange(currentVDOT, row.min, row.max);
          const marathonText = row.marathon ?? t('vdotProgression.marathon_50plus');
          return (
            <View key={row.range} style={[styles.tableRow, active && styles.tableRowActive]}>
              <Text style={[styles.tableCell, styles.rangeCol, active && styles.tableCellActive]}>{row.range}</Text>
              <Text style={[styles.tableCell, styles.levelCol, active && styles.tableCellActive]}>{t(`vdotProgression.level_${row.key}`)}</Text>
              <Text style={[styles.tableCell, styles.resultCol, active && styles.tableCellActive]}>{marathonText}</Text>
              <Text style={[styles.tableCell, styles.meaningCol, active && styles.tableCellActive]}>{t(`vdotProgression.meaning_${row.key}`)}</Text>
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

function findProgressionLabel(vdot: number, t: (key: string, opts?: object) => string) {
  const matched = PROGRESSION_ROWS.find((row) => isCurrentRange(vdot, row.min, row.max));
  if (matched) {
    return t('vdotProgression.stageLabel', { level: t(`vdotProgression.level_${matched.key}`) });
  }
  if (vdot < PROGRESSION_ROWS[0].min) {
    return t('vdotProgression.beginnerStage');
  }
  return t('vdotProgression.eliteStage');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
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