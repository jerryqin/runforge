import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { getAppVersion } from '../../src/services/VersionService';
import { UserProfile } from '../../src/types';

export default function ProfileScreen() {
  const router = useRouter();
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

    if (!mhr || mhr < 150 || mhr > 220) return Alert.alert('最大心率应在 150–220 之间');
    if (!rhr || rhr < 30 || rhr > 80) return Alert.alert('静息心率应在 30–80 之间');
    if (!lthr || lthr < 130 || lthr > 200) return Alert.alert('乳酸阈值心率应在 130–200 之间');
    if (wk < 5 || wk > 250) return Alert.alert('周跑量应在 5–250 之间');

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
      return Alert.alert('请先填写有效出生年份');
    }
    const age = new Date().getFullYear() - year;
    const est = 220 - age;
    setMaxHr(String(est));
    Alert.alert('已估算', `基于年龄（${age}岁）估算最大心率为 ${est}。\n建议后续以实测值替换。`);
  };

  // 导出备份
  const handleExportBackup = async () => {
    setExportLoading(true);
    try {
      await backupRepo.shareBackup();
      Alert.alert(
        '备份成功',
        '数据已导出，请保存到安全位置（如 iCloud Drive）。'
      );
    } catch (e) {
      Alert.alert('导出失败', String(e));
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
        '导入完成',
        `成功导入 ${imported} 条记录\n跳过 ${skipped} 条重复记录`,
        [{ text: '确定' }]
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
      Alert.alert('导入失败', String(e));
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
            <Text style={styles.pageTitle}>个人档案</Text>
            <Text style={styles.pageSubtitle}>训练分析基于这些数据做个性化计算</Text>
          </View>

          {/* 个人信息 */}
          <View style={styles.fieldCard}>
            <Text style={styles.fieldCardTitle}>个人信息</Text>
            <View style={styles.fieldCardBody}>
              <ProfileField
                label="出生年份"
                value={birthYear}
                onChangeText={setBirthYear}
                placeholder="如：1985"
                keyboardType="number-pad"
                hint="用于年龄估算"
              />
              <View style={styles.fieldDivider} />
              <ProfileField
                label="开始跑步年份"
                value={runningStartYear}
                onChangeText={setRunningStartYear}
                placeholder="如：2018"
                keyboardType="number-pad"
                hint="用于疲劳阈值个性化"
              />
              <TouchableOpacity style={styles.estimateBtn} onPress={estimateMaxHr} activeOpacity={0.7}>
                <Text style={styles.estimateBtnText}>根据年龄估算最大心率</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 训练参数 */}
          <View style={styles.fieldCard}>
            <Text style={styles.fieldCardTitle}>训练参数</Text>
            <View style={styles.fieldCardBody}>
              <ProfileField
                label="最大心率 (bpm)"
                value={maxHr}
                onChangeText={setMaxHr}
                placeholder="如：185"
                keyboardType="number-pad"
                hint="以实测值最准确（如冲刺后最高心率）"
              />
              <View style={styles.fieldDivider} />
              <ProfileField
                label="静息心率 (bpm)"
                value={restingHr}
                onChangeText={setRestingHr}
                placeholder="如：55"
                keyboardType="number-pad"
                hint="早晨起床前测量"
              />
              <View style={styles.fieldDivider} />
              <ProfileField
                label="乳酸阈值心率 LTHR (bpm)"
                value={hrThreshold}
                onChangeText={setHrThreshold}
                placeholder="如：165"
                keyboardType="number-pad"
                hint="通常为最大心率的 87–92%"
              />
              <View style={styles.fieldDivider} />
              <ProfileField
                label="每周跑量目标 (km)"
                value={weeklyKm}
                onChangeText={setWeeklyKm}
                placeholder="如：30"
                keyboardType="number-pad"
                hint="训练计划与处方的基准参考"
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
              {saved ? '✓ 已保存' : saving ? '保存中...' : '保存档案'}
            </Text>
          </TouchableOpacity>

          <View style={styles.reminderSection}>
            <Text style={styles.reminderTitle}>提醒与召回</Text>
            <Text style={styles.reminderHint}>开启每日训练提醒，在固定时间查看今日行动。</Text>
            <TouchableOpacity
              style={styles.reminderBtn}
              onPress={() => router.push('/reminder-settings')}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.reminderBtnLabel}>🔔 每日训练提醒</Text>
                <Text style={styles.reminderBtnDesc}>可开启真实本地通知，并设置固定提醒时间。</Text>
              </View>
              <Text style={styles.toolArrow}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toolsSection}>
            <Text style={styles.toolsTitle}>训练工具</Text>
            <Text style={styles.toolsHint}>赛前规划和训练安排工具，按需使用。</Text>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => router.push('/training-plan')}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.toolLabel}>📅 训练计划</Text>
                <Text style={styles.toolDesc}>生成比赛周期训练安排，适合赛季规划时使用。</Text>
              </View>
              <Text style={styles.toolArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => router.push('/race-assistant')}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.toolLabel}>🏁 比赛助手</Text>
                <Text style={styles.toolDesc}>设置目标完赛时间，查看赛前与比赛日策略。</Text>
              </View>
              <Text style={styles.toolArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* 数据备份 */}
          <View style={styles.backupSection}>
            <Text style={styles.backupTitle}>数据备份</Text>
            <Text style={styles.backupHint}>
              所有数据仅保存在本机。删除 App、重装或更换手机前，请先导出备份。
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
                    <Text style={styles.backupBtnText}>导出备份</Text>
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
                    <Text style={styles.backupBtnText}>导入备份</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 版本信息 */}
          <View style={styles.versionCard}>
            <Text style={styles.versionLabel}>当前版本号</Text>
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
