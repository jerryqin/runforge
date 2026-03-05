import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BodyStatus, BodyStatusLabel } from '../../types';
import { BodyStatusColors, BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';

interface Props {
  status: BodyStatus;
  subtitle?: string;
}

export function StatusCard({ status, subtitle }: Props) {
  const color = BodyStatusColors[status];
  const label = BodyStatusLabel[status];

  return (
    <View style={[styles.container, { borderLeftColor: color }]}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.semibold,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: FontSize.body,
    color: Colors.gray2,
  },
});
