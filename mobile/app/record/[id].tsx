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
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  IntensityColors,
  Spacing,
} from '../../src/constants/theme';
import { runRecordRepo } from '../../src/db/repositories/RunRecordRepository';
import { formatDuration, formatPace } from '../../src/engine/AnalysisEngine';
import { Intensity, IntensityLabel, RunRecord } from '../../src/types';

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    runRecordRepo.fetchById(parseInt(id, 10))
      .then(setRecord)
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = () => {
    Alert.alert('删除记录', '确定要删除这条跑步记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
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
        <Text style={styles.errorText}>记录不存在</Text>
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
            {IntensityLabel[record.intensity as Intensity]}
          </Text>
        </View>

        {/* 核心指标 */}
        <View style={styles.metricsGrid}>
          <BigMetric label="距离" value={`${record.distance}`} unit="km" />
          <BigMetric label="配速" value={formatPace(record.avg_pace)} unit="/km" />
          <BigMetric label="心率" value={`${record.avg_hr}`} unit="bpm" />
          <BigMetric label="时长" value={formatDuration(record.duration_sec)} />
          {record.tss != null && (
            <BigMetric label="TSS" value={record.tss.toFixed(0)} unit="分" />
          )}
          {record.vdot != null && record.vdot > 0 && (
            <BigMetric label="VDOT" value={record.vdot.toFixed(1)} />
          )}
          {record.rpe != null && (
            <BigMetric label="RPE" value={`${record.rpe}`} unit="/10" />
          )}
        </View>

        {/* 分析结论 */}
        <AnalysisBlock title="本次总结" content={record.conclusion} />
        <AnalysisBlock title="明日建议" content={record.suggest} />
        {record.risk ? (
          <AnalysisBlock title="风险提示" content={record.risk} warning />
        ) : null}

        {/* 删除按钮 */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>删除此记录</Text>
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
