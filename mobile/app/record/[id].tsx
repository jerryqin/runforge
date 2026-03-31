import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  IntensityColors,
  Spacing,
} from '../../src/constants/theme';
import { runRecordRepo } from '../../src/db/repositories/RunRecordRepository';
import { buildConclusion, buildRisk, buildSuggest, formatDuration, formatPace } from '../../src/engine/AnalysisEngine';
import { Intensity, getIntensityLabel, RunRecord } from '../../src/types';

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    runRecordRepo.fetchById(parseInt(id, 10))
      .then(setRecord)
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = () => {
    Alert.alert(t('input.deleteRecord'), t('input.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (record?.id) {
            await runRecordRepo.delete(record.id);
            router.back();
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{t('record.notFound')}</Text>
      </SafeAreaView>
    );
  }

  const intensityColor = IntensityColors[record.intensity as Intensity];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 日期标题 */}
        <Text style={styles.dateTitle}>{record.run_date}</Text>

        {/* 强度标签 */}
        <View style={[styles.intensityBadge, { backgroundColor: intensityColor + '20' }]}>
          <Text style={[styles.intensityLabel, { color: intensityColor }]}>
          {getIntensityLabel(record.intensity as Intensity)}
          </Text>
        </View>

        {/* 核心指标 */}
        <View style={styles.metricsGrid}>
          <BigMetric label={t('record.metricDistance')} value={`${record.distance.toFixed(2)}`} unit="km" />
          <BigMetric label={t('record.metricPace')} value={formatPace(record.avg_pace)} unit="/km" />
          <BigMetric label={t('record.metricHR')} value={`${record.avg_hr}`} unit="bpm" />
          <BigMetric label={t('record.metricDuration')} value={formatDuration(record.duration_sec)} />
          {record.tss != null && (
            <BigMetric label={t('record.metricLoad')} value={record.tss.toFixed(0)} unit={t('record.metricLoadUnit')} />
          )}
          {record.vdot != null && record.vdot > 0 && (
            <BigMetric label={t('record.metricVDOT')} value={record.vdot.toFixed(1)} />
          )}
          {record.rpe != null && (
            <BigMetric label={t('record.metricRPE')} value={`${record.rpe}`} unit="/10" />
          )}
        </View>

        {/* 分析结论 */}
        <AnalysisBlock title={t('record.sectionSummary')} content={buildConclusion(record.intensity as Intensity)} />
        <AnalysisBlock title={t('record.sectionTomorrow')} content={buildSuggest(record.intensity as Intensity, record.distance, [])} />
        {(() => { const risk = buildRisk(record.intensity as Intensity, []); return risk ? <AnalysisBlock title={t('record.sectionRisk')} content={risk} warning /> : null; })()}

        {/* 删除按钮 */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>{t('record.deleteBtn')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function BigMetric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {unit && <Text style={styles.metricUnit}>{unit}</Text>}
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function AnalysisBlock({
  title,
  content,
  warning,
}: {
  title: string;
  content: string;
  warning?: boolean;
}) {
  return (
    <View style={[styles.analysisBlock, warning && styles.analysisBlockWarning]}>
      <Text style={[styles.analysisTitle, warning && styles.analysisTitleWarning]}>
        {title}
      </Text>
      <Text style={styles.analysisContent}>{content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.md, gap: Spacing.lg },
  dateTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  intensityBadge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: -Spacing.sm,
  },
  intensityLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  metric: { minWidth: '40%' },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  metricValue: { fontSize: FontSize.h1, fontWeight: FontWeight.bold, color: Colors.black },
  metricUnit: { fontSize: FontSize.body, color: Colors.gray3 },
  metricLabel: { fontSize: FontSize.caption, color: Colors.gray3, marginTop: 2 },
  analysisBlock: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  analysisBlockWarning: { borderLeftColor: Colors.statusOrange },
  analysisTitle: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold, color: Colors.gray2, textTransform: 'uppercase' },
  analysisTitleWarning: { color: Colors.statusOrange },
  analysisContent: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold, color: Colors.black },
  errorText: { fontSize: FontSize.body, color: Colors.gray3 },
  deleteBtn: { paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xl },
  deleteBtnText: { fontSize: FontSize.body, color: Colors.statusRed },
});
