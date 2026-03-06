/**
 * PrescriptionCard - 每日训练处方卡片
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import { TrainingPrescription, TrainingType } from '../engine/VDOTEngine';

interface Props {
  prescription: TrainingPrescription;
}

const TYPE_ICONS: Record<TrainingType, string> = {
  [TrainingType.REST]: '😴',
  [TrainingType.EASY]: '🏃',
  [TrainingType.LONG_RUN]: '🏔️',
  [TrainingType.TEMPO]: '⚡',
  [TrainingType.INTERVAL]: '🔥',
  [TrainingType.RECOVERY]: '🧘',
};

const TYPE_COLORS: Record<TrainingType, string> = {
  [TrainingType.REST]: Colors.gray3,
  [TrainingType.EASY]: Colors.intensityEasy,
  [TrainingType.LONG_RUN]: Colors.intensityNormal,
  [TrainingType.TEMPO]: Colors.intensityHigh,
  [TrainingType.INTERVAL]: Colors.intensityOver,
  [TrainingType.RECOVERY]: Colors.intensityEasy,
};

export function PrescriptionCard({ prescription }: Props) {
  const color = TYPE_COLORS[prescription.type];
  const icon = TYPE_ICONS[prescription.type];

  return (
    <View style={[styles.container, { borderLeftColor: color }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.label, { color }]}>{prescription.label}</Text>
          {prescription.distance != null && (
            <Text style={styles.distance}>{prescription.distance}km</Text>
          )}
        </View>
        {prescription.zone !== '-' && (
          <View style={[styles.zoneBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.zoneText, { color }]}>{prescription.zone}区</Text>
          </View>
        )}
      </View>

      <Text style={styles.description}>{prescription.description}</Text>

      {prescription.paceRange ? (
        <View style={styles.paceRow}>
          <Text style={styles.paceLabel}>目标配速</Text>
          <Text style={[styles.paceValue, { color }]}>{prescription.paceRange}</Text>
        </View>
      ) : null}

      {(prescription.warmup || prescription.cooldown) && (
        <View style={styles.extra}>
          {prescription.warmup && (
            <Text style={styles.extraText}>🔹 热身: {prescription.warmup}</Text>
          )}
          {prescription.cooldown && (
            <Text style={styles.extraText}>🔹 放松: {prescription.cooldown}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderLeftWidth: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  icon: { fontSize: 28 },
  headerText: { flex: 1 },
  label: { fontSize: FontSize.h3, fontWeight: FontWeight.bold },
  distance: { fontSize: FontSize.caption, color: Colors.gray2, marginTop: 1 },
  zoneBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  zoneText: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  description: { fontSize: FontSize.body, color: Colors.gray1, lineHeight: 22 },
  paceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  paceLabel: { fontSize: FontSize.caption, color: Colors.gray2 },
  paceValue: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  extra: { gap: 2 },
  extraText: { fontSize: FontSize.caption, color: Colors.gray2 },
});
