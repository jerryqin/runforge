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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Spacing,
} from '../../src/constants/theme';
import { userProfileRepo } from '../../src/db/repositories/UserProfileRepository';
import { UserProfile } from '../../src/types';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [maxHr, setMaxHr] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [hrThreshold, setHrThreshold] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    userProfileRepo.get().then((p) => {
      setProfile(p);
      setMaxHr(String(p.max_hr));
      setRestingHr(String(p.resting_hr));
      setHrThreshold(String(p.hr_threshold));
      setBirthYear(p.birth_year ? String(p.birth_year) : '');
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

    if (!mhr || mhr < 150 || mhr > 220) return Alert.alert('最大心率应在 150–220 之间');
    if (!rhr || rhr < 30 || rhr > 80) return Alert.alert('静息心率应在 30–80 之间');
    if (!lthr || lthr < 130 || lthr > 200) return Alert.alert('乳酸阈值心率应在 130–200 之间');

    setSaving(true);
    try {
      await userProfileRepo.save({ max_hr: mhr, resting_hr: rhr, hr_threshold: lthr, birth_year: by });
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
});
