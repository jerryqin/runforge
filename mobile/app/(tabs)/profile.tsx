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
import { UserProfile } from '../../src/types';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [maxHr, setMaxHr] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [hrThreshold, setHrThreshold] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [weeklyKm, setWeeklyKm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    userProfileRepo.get().then((p) => {
      setProfile(p);
      setMaxHr(String(p.max_hr));
      setRestingHr(String(p.resting_hr));
      setHrThreshold(String(p.hr_threshold));
      setBirthYear(p.birth_year ? String(p.birth_year) : '');
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

    const wk = weeklyKm ? parseInt(weeklyKm, 10) : 30;

    if (!mhr || mhr < 150 || mhr > 220) return Alert.alert('最大心率应在 150–220 之间');
    if (!rhr || rhr < 30 || rhr > 80) return Alert.alert('静息心率应在 30–80 之间');
    if (!lthr || lthr < 130 || lthr > 200) return Alert.alert('乳酸阈值心率应在 130–200 之间');
    if (wk < 5 || wk > 250) return Alert.alert('周跑量应在 5–250 之间');

    setSaving(true);
    try {
      await userProfileRepo.save({ max_hr: mhr, resting_hr: rhr, hr_threshold: lthr, birth_year: by, weekly_km: wk });
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
    setBackupLoading(true);
    try {
      await backupRepo.shareBackup();
      Alert.alert(
        '备份成功',
        '数据已导出，请保存到安全位置（如 iCloud Drive）。\n\n删除 App 前请务必备份数据！'
      );
    } catch (e) {
      Alert.alert('导出失败', String(e));
    } finally {
      setBackupLoading(false);
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

      setBackupLoading(true);
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
      setWeeklyKm(p.weekly_km ? String(p.weekly_km) : '30');
    } catch (e) {
      Alert.alert('导入失败', String(e));
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 提示卡片 */}
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>为什么需要这些数据？</Text>
            <Text style={styles.tipText}>
              强度判断基于个人最大心率，而非固定值。
              准确的档案让每次分析更贴合你的实际状况。
            </Text>
          </View>

          {/* 出生年份（用于估算）*/}
          <ProfileField
            label="出生年份"
            value={birthYear}
            onChangeText={setBirthYear}
            placeholder="如：1985"
            keyboardType="number-pad"
            hint="用于估算最大心率"
          />
          <TouchableOpacity style={styles.estimateBtn} onPress={estimateMaxHr}>
            <Text style={styles.estimateBtnText}>根据年龄估算最大心率 →</Text>
          </TouchableOpacity>

          {/* 心率参数 */}
          <ProfileField
            label="最大心率 (bpm)"
            value={maxHr}
            onChangeText={setMaxHr}
            placeholder="如：185"
            keyboardType="number-pad"
            hint="以实测值最准确（如冲刺后最高心率）"
          />
          <ProfileField
            label="静息心率 (bpm)"
            value={restingHr}
            onChangeText={setRestingHr}
            placeholder="如：55"
            keyboardType="number-pad"
            hint="早晨起床前测量"
          />
          <ProfileField
            label="乳酸阈值心率 LTHR (bpm)"
            value={hrThreshold}
            onChangeText={setHrThreshold}
            placeholder="如：165"
            keyboardType="number-pad"
            hint="通常为最大心率的 87–92%"
          />
          <ProfileField
            label="当前每周跑量 (km)"
            value={weeklyKm}
            onChangeText={setWeeklyKm}
            placeholder="如：30"
            keyboardType="number-pad"
            hint="用于生成训练计划和处方的参考基准"
          />

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
            <Text style={styles.reminderHint}>先预留提醒设置入口，下一阶段可接入每日训练提醒与周报提醒。</Text>
            <TouchableOpacity
              style={styles.reminderBtn}
              onPress={() => router.push('/reminder-settings')}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.reminderBtnLabel}>🔔 提醒设置（即将上线）</Text>
                <Text style={styles.reminderBtnDesc}>先预留入口，后续可配置训练提醒、恢复提醒和周报提醒。</Text>
              </View>
              <Text style={styles.toolArrow}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toolsSection}>
            <Text style={styles.toolsTitle}>训练工具</Text>
            <Text style={styles.toolsHint}>低频功能先收纳到这里，需要时再进入。</Text>

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
            <Text style={styles.backupTitle}>💾 数据备份</Text>
            <Text style={styles.backupHint}>
              删除 App 会清除所有本地数据，请定期备份！
            </Text>
            
            <View style={styles.backupBtns}>
              <TouchableOpacity
                style={styles.backupBtn}
                onPress={handleExportBackup}
                disabled={backupLoading}
                activeOpacity={0.7}
              >
                {backupLoading ? (
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
                disabled={backupLoading}
                activeOpacity={0.7}
              >
                {backupLoading ? (
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
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  tipCard: {
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  tipTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.primary },
  tipText: { fontSize: FontSize.body, color: Colors.gray1, lineHeight: 22 },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.black },
  fieldHint: { fontSize: FontSize.caption, color: Colors.gray3 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.separator,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.h3,
    color: Colors.black,
  },
  estimateBtn: { alignSelf: 'flex-start', marginTop: -Spacing.xs },
  estimateBtnText: { fontSize: FontSize.body, color: Colors.primary, fontWeight: FontWeight.medium },
  saveBtn: {
    backgroundColor: Colors.black,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold, color: Colors.white },
  reminderSection: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  reminderTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  reminderHint: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
  },
  reminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  reminderBtnLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  reminderBtnDesc: {
    marginTop: 2,
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
    maxWidth: 240,
  },
  toolsSection: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  toolsTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  toolsHint: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  toolLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  toolDesc: {
    marginTop: 2,
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
    maxWidth: 240,
  },
  toolArrow: {
    fontSize: FontSize.h2,
    color: Colors.gray3,
  },
  backupSection: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  backupTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  backupHint: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
  },
  backupBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  backupBtnIcon: { fontSize: FontSize.h3 },
  backupBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
});
