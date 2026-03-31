import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Spacing,
} from '../../src/constants/theme';
import { userProfileRepo } from '../../src/db/repositories/UserProfileRepository';
import { backupRepo } from '../../src/db/repositories/BackupRepository';
import { runRecordRepo } from '../../src/db/repositories/RunRecordRepository';
import { getAppVersion } from '../../src/services/VersionService';
import { VDOTTrendCard } from '../../src/components/VDOTTrendCard';
import { TrainingZonesCard } from '../../src/components/TrainingZonesCard';
import { LanguageSelector } from '../../src/components/LanguageSelector';
import { calcVDOT } from '../../src/engine/VDOTEngine';
import { calcTrainingZones } from '../../src/engine/VDOTEngine';
import { UserProfile, RunRecord } from '../../src/types';

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [maxHr, setMaxHr] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [hrThreshold, setHrThreshold] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [runningStartYear, setRunningStartYear] = useState('');
  const [weeklyKm, setWeeklyKm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [currentVDOT, setCurrentVDOT] = useState(0);
  const [records, setRecords] = useState<RunRecord[]>([]);

  const loadAnalyticsData = useCallback(async () => {
    const data = await runRecordRepo.fetchAll();
    setRecords(data);

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
  }, []);

  useFocusEffect(useCallback(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]));

  useEffect(() => {
    userProfileRepo.get().then((p) => {
      setProfile(p);
      setMaxHr(String(p.max_hr));
      setRestingHr(String(p.resting_hr));
      setHrThreshold(String(p.hr_threshold));
      setBirthYear(p.birth_year ? String(p.birth_year) : '');
      setRunningStartYear(p.running_start_year ? String(p.running_start_year) : '');
      setWeeklyKm(p.weekly_km ? String(p.weekly_km) : '30');
    });
  }, []);

  // 最大心率改变时，自动计算 LTHR（87% 是常用值）
  useEffect(() => {
    if (maxHr) {
      const mhr = parseInt(maxHr, 10);
      if (mhr && mhr >= 150 && mhr <= 220) {
        const lthr = Math.round(mhr * 0.87);
        setHrThreshold(String(lthr));
      }
    }
  }, [maxHr]);

  const handleSave = async () => {
    const mhr = parseInt(maxHr, 10);
    const rhr = parseInt(restingHr, 10);
    const lthr = parseInt(hrThreshold, 10);
    const by = birthYear ? parseInt(birthYear, 10) : undefined;
    const rsy = runningStartYear ? parseInt(runningStartYear, 10) : undefined;

    const wk = weeklyKm ? parseInt(weeklyKm, 10) : 30;

    if (!mhr || mhr < 150 || mhr > 220) return Alert.alert(t('profile.errors.maxHrRange'));
    if (!rhr || rhr < 30 || rhr > 80) return Alert.alert(t('profile.errors.restingHrRange'));
    if (!lthr || lthr < 130 || lthr > 200) return Alert.alert(t('profile.errors.thresholdHrRange'));
    if (wk < 5 || wk > 250) return Alert.alert(t('profile.errors.weeklyKmRange'));

    setSaving(true);
    try {
      await userProfileRepo.save({ max_hr: mhr, resting_hr: rhr, hr_threshold: lthr, birth_year: by, running_start_year: rsy, weekly_km: wk });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  // 基于出生年份估算最大心率
  const estimateMaxHr = () => {
    const year = parseInt(birthYear, 10);
    if (!year || year < 1950 || year > 2010) {
      return Alert.alert(t('profile.errors.birthYearRequired'));
    }
    const age = new Date().getFullYear() - year;
    const est = 220 - age;
    setMaxHr(String(est));
    Alert.alert(t('profile.estimated'), t('profile.estimateMaxHrMessage', { age, hr: est }));
  };

  // 导出备份
  const handleExportBackup = async () => {
    setExportLoading(true);
    try {
      await backupRepo.shareBackup();
      Alert.alert(
        t('profile.backupSuccess'),
        t('profile.backupSuccessMessage')
      );
    } catch (e) {
      Alert.alert(t('input.exportFailed'), String(e));
    } finally {
      setExportLoading(false);
    }
  };

  // 导入备份
  const handleImportBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setImportLoading(true);
      const { imported, skipped } = await backupRepo.importFromFile(result.assets[0].uri);

      Alert.alert(
        t('profile.importComplete'),
        t('profile.importResult', { imported, skipped }),
        [{ text: t('common.ok') }]
      );

      // 刷新数据
      const p = await userProfileRepo.get();
      setProfile(p);
      setMaxHr(String(p.max_hr));
      setRestingHr(String(p.resting_hr));
      setHrThreshold(String(p.hr_threshold));
      setBirthYear(p.birth_year ? String(p.birth_year) : '');
      setRunningStartYear(p.running_start_year ? String(p.running_start_year) : '');
      setWeeklyKm(p.weekly_km ? String(p.weekly_km) : '30');
    } catch (e) {
      Alert.alert(t('input.importFailed'), String(e));
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 页面标题 */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>{t('profile.title')}</Text>
            <Text style={styles.pageSubtitle}>{t('profile.subtitle')}</Text>
          </View>

          {/* 个人信息 */}
          <View style={styles.fieldCard}>
            <Text style={styles.fieldCardTitle}>{t('profile.personalInfo')}</Text>
            <View style={styles.fieldCardBody}>
              <ProfileField
                label={t('profile.birthYear')}
                value={birthYear}
                onChangeText={setBirthYear}
                placeholder={t('profile.birth_year_hint')}
                keyboardType="number-pad"
                hint={t('profile.hints.birthYearUsage')}
              />
              <View style={styles.fieldDivider} />
              <ProfileField
                label={t('profile.runningStartYear')}
                value={runningStartYear}
                onChangeText={setRunningStartYear}
                placeholder={t('profile.running_start_year_hint')}
                keyboardType="number-pad"
                hint={t('profile.hints.runningStartYearUsage')}
              />
              <TouchableOpacity style={styles.estimateBtn} onPress={estimateMaxHr} activeOpacity={0.7}>
                <Text style={styles.estimateBtnText}>{t('profile.estimateMaxHr')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 训练参数 */}
          <View style={styles.fieldCard}>
            <Text style={styles.fieldCardTitle}>{t('profile.trainingSettings')}</Text>
            <View style={styles.fieldCardBody}>
              <ProfileField
                label={`${t('profile.maxHeartRate')} (bpm)`}
                value={maxHr}
                onChangeText={setMaxHr}
                placeholder={t('profile.max_hr_hint')}
                keyboardType="number-pad"
                hint={t('profile.hints.maxHrAccuracy')}
              />
              <View style={styles.fieldDivider} />
              <ProfileField
                label={`${t('profile.restingHeartRate')} (bpm)`}
                value={restingHr}
                onChangeText={setRestingHr}
                placeholder={t('profile.resting_hr_hint')}
                keyboardType="number-pad"
                hint={t('profile.hints.restingHrMeasure')}
              />
              <View style={styles.fieldDivider} />
              <ProfileField
                label={`${t('profile.thresholdHeartRate')} (bpm)`}
                value={hrThreshold}
                onChangeText={setHrThreshold}
                placeholder={t('profile.threshold_hr_hint')}
                keyboardType="number-pad"
                hint={t('profile.hints.thresholdHrRange')}
              />
              <View style={styles.fieldDivider} />
              <ProfileField
                label={`${t('profile.weeklyTargetKm')} (km)`}
                value={weeklyKm}
                onChangeText={setWeeklyKm}
                placeholder={t('profile.weekly_km_hint')}
                keyboardType="number-pad"
                hint={t('profile.hints.weeklyKmUsage')}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>
              {saved ? '✓ 已保存' : saving ? t('common.loading') : t('profile.saveProfile')}
            </Text>
          </TouchableOpacity>

          {/* 趋势与配速参考 */}
          {records.length > 0 && currentVDOT > 0 ? (
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsTitle}>{t('profile.trendAndPaceReference')}</Text>
              <VDOTTrendCard
                currentVDOT={currentVDOT}
                onPress={() => router.push(`/vdot-progression?current=${currentVDOT.toFixed(1)}`)}
                vdotHistory={records
                  .filter(r => r.distance >= 3 && r.duration_sec > 0)
                  .map(r => ({
                    date: r.run_date,
                    vdot: r.vdot ?? calcVDOT(r.distance, r.duration_sec),
                  }))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
              />
              <TrainingZonesCard zones={calcTrainingZones(currentVDOT)} vdot={currentVDOT} />
            </View>
          ) : null}

          <View style={styles.toolsSection}>
            <Text style={styles.toolsTitle}>{t('profile.trainingTools')}</Text>
            <Text style={styles.toolsHint}>{t('profile.trainingToolsDescription')}</Text>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => router.push('/training-plan')}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.toolLabel}>📅 {t('profile.trainingPlanTool')}</Text>
                <Text style={styles.toolDesc}>{t('profile.trainingPlanDescription')}</Text>
              </View>
              <Text style={styles.toolArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => router.push('/race-assistant')}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.toolLabel}>🏁 {t('profile.raceAssistantTool')}</Text>
                <Text style={styles.toolDesc}>{t('profile.raceAssistantDescription')}</Text>
              </View>
              <Text style={styles.toolArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* 数据备份 */}
          <View style={styles.backupSection}>
            <Text style={styles.backupTitle}>{t('profile.dataBackupSection')}</Text>
            <Text style={styles.backupHint}>
              {t('profile.backupDescription')}
            </Text>

            <View style={styles.backupBtns}>
              <TouchableOpacity
                style={styles.backupBtn}
                onPress={handleExportBackup}
                disabled={exportLoading || importLoading}
                activeOpacity={0.7}
              >
                {exportLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Text style={styles.backupBtnIcon}>📤</Text>
                    <Text style={styles.backupBtnText}>{t('profile.exportData')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backupBtn}
                onPress={handleImportBackup}
                disabled={importLoading || exportLoading}
                activeOpacity={0.7}
              >
                {importLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Text style={styles.backupBtnIcon}>📥</Text>
                    <Text style={styles.backupBtnText}>{t('profile.importData')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 系统设置 */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsTitle}>{t('profile.systemSettings')}</Text>
            <LanguageSelector style={styles.languageSelector} />
          </View>

          {/* 版本信息 */}
          <View style={styles.versionCard}>
            <Text style={styles.versionLabel}>{t('profile.currentVersion')}</Text>
            <Text style={styles.versionText}>v{getAppVersion()}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: TextInput['props']['keyboardType'];
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray4}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  // 页面标题
  pageHeader: { paddingBottom: Spacing.xs },
  pageTitle: { fontSize: FontSize.h1, fontWeight: FontWeight.bold, color: Colors.black },
  pageSubtitle: { marginTop: 4, fontSize: FontSize.caption, color: Colors.gray3 },
  // 字段分组卡片
  fieldCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  fieldCardTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.gray3,
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  fieldCardBody: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.sm },
  fieldDivider: { height: 1, backgroundColor: Colors.separator },
  // 字段
  field: { gap: 4 },
  fieldLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.black },
  fieldHint: { fontSize: FontSize.caption, color: Colors.gray3 },
  input: {
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: Colors.separator,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.h3,
    color: Colors.black,
  },
  // 估算按钮（outline 小按钮）
  estimateBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.gray4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  estimateBtnText: { fontSize: FontSize.caption, color: Colors.gray2, fontWeight: FontWeight.medium },
  // 保存按钮（改为橙色 Primary）
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold, color: Colors.white },
  // Section 通用
  reminderSection: {
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  reminderTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.black },
  reminderHint: { fontSize: FontSize.caption, color: Colors.gray2, lineHeight: 18 },
  reminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    paddingTop: Spacing.sm,
  },
  reminderBtnLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.black },
  reminderBtnDesc: {
    marginTop: 2,
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
    maxWidth: 240,
  },
  toolsSection: {
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  analyticsSection: {
    gap: Spacing.md,
  },
  analyticsTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.black },
  toolsTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.black },
  toolsHint: { fontSize: FontSize.caption, color: Colors.gray2, lineHeight: 18 },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    paddingTop: Spacing.sm,
  },
  toolLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.black },
  toolDesc: {
    marginTop: 2,
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
    maxWidth: 240,
  },
  toolArrow: { fontSize: FontSize.h2, color: Colors.gray3 },
  backupSection: {
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  backupTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.black },
  backupHint: { fontSize: FontSize.caption, color: Colors.gray2, lineHeight: 18 },
  backupBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.separator,
    backgroundColor: Colors.white,
  },
  backupBtnIcon: { fontSize: FontSize.h3 },
  backupBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.gray1 },
  // 系统设置
  settingsSection: {
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  settingsTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.black },
  languageSelector: {
    marginTop: Spacing.xs,
  },
  // 版本信息卡片
  versionCard: {
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  versionLabel: { fontSize: FontSize.caption, color: Colors.gray3 },
  versionText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.gray2 },
});
