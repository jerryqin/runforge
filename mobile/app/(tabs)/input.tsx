import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { runRecordRepo } from '../../src/db/repositories/RunRecordRepository';
import { userProfileRepo } from '../../src/db/repositories/UserProfileRepository';
import { analyze, parseDuration } from '../../src/engine/AnalysisEngine';
import { ocrEngine } from '../../src/services/OCRService';

type InputMode = 'ocr' | 'manual';

export default function InputScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>('ocr');
  const [ocrLoading, setOcrLoading] = useState(false);

  // 表单字段
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');   // HH:MM:SS
  const [avgHr, setAvgHr] = useState('');
  const [runDate, setRunDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [submitting, setSubmitting] = useState(false);

  // ===== OCR 图片导入 =====
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要相册权限', '请在设置中允许访问相册');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setOcrLoading(true);
    try {
      const ocrResult = await ocrEngine.analyze(result.assets[0].uri);
      // 预填表单
      if (ocrResult.distance) setDistance(String(ocrResult.distance));
      if (ocrResult.duration_sec) {
        const h = Math.floor(ocrResult.duration_sec / 3600);
        const m = Math.floor((ocrResult.duration_sec % 3600) / 60);
        const s = ocrResult.duration_sec % 60;
        setDuration(
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        );
      }
      if (ocrResult.avg_hr) setAvgHr(String(ocrResult.avg_hr));
      if (ocrResult.run_date) setRunDate(ocrResult.run_date);
      // 切换到手动模式让用户确认
      setMode('manual');
      Alert.alert('识别完成', `置信度 ${Math.round(ocrResult.confidence * 100)}%，请确认数据后提交`);
    } catch (e) {
      Alert.alert('识别失败', '请手动输入数据');
      setMode('manual');
    } finally {
      setOcrLoading(false);
    }
  };

  // ===== 提交 =====
  const handleSubmit = async () => {
    // 验证
    const dist = parseFloat(distance);
    const durationSec = parseDuration(duration);
    const hr = parseInt(avgHr, 10);

    if (!dist || dist <= 0) return Alert.alert('请输入有效距离');
    if (!durationSec) return Alert.alert('请输入有效时长（HH:MM:SS）');
    if (!hr || hr < 60 || hr > 220) return Alert.alert('请输入有效心率（60–220）');
    if (!runDate.match(/^\d{4}-\d{2}-\d{2}$/)) return Alert.alert('日期格式应为 YYYY-MM-DD');

    setSubmitting(true);
    try {
      const profile = await userProfileRepo.get();
      const recentRecords = await runRecordRepo.fetchRecent(7);

      const output = analyze({
        distance: dist,
        durationSec,
        avgHr: hr,
        runDate,
        profile,
        recentRecords,
      });

      const saved = await runRecordRepo.save({
        create_time: Date.now(),
        run_date: runDate,
        distance: dist,
        duration_sec: durationSec,
        avg_pace: output.avgPace,
        avg_hr: hr,
        intensity: output.intensity,
        conclusion: output.conclusion,
        suggest: output.suggest,
        risk: output.risk,
        tss: output.tss,
      });

      // 跳转到详情页
      router.replace(`/record/${saved.id}`);
    } catch (e) {
      Alert.alert('保存失败', String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 模式切换 */}
          <View style={styles.modeSwitch}>
            <ModeTab label="📷 图片导入" active={mode === 'ocr'} onPress={() => setMode('ocr')} />
            <ModeTab label="✏️ 手动输入" active={mode === 'manual'} onPress={() => setMode('manual')} />
          </View>

          {/* OCR 模式 */}
          {mode === 'ocr' && (
            <View style={styles.ocrArea}>
              {ocrLoading ? (
                <View style={styles.ocrLoading}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.ocrLoadingText}>正在识别截图...</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity style={styles.ocrBtn} onPress={handlePickImage} activeOpacity={0.8}>
                    <Text style={styles.ocrBtnIcon}>🖼️</Text>
                    <Text style={styles.ocrBtnTitle}>选择跑步截图</Text>
                    <Text style={styles.ocrBtnSub}>支持 Keep、Garmin、Apple Watch 等截图</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMode('manual')}>
                    <Text style={styles.manualLink}>或手动输入 →</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* 手动输入模式 */}
          {mode === 'manual' && (
            <View style={styles.form}>
              <FormField
                label="距离 (km)"
                value={distance}
                onChangeText={setDistance}
                placeholder="如：10.5"
                keyboardType="decimal-pad"
              />
              <FormField
                label="时长 (HH:MM:SS)"
                value={duration}
                onChangeText={setDuration}
                placeholder="如：01:05:33"
                keyboardType="numbers-and-punctuation"
              />
              <FormField
                label="平均心率 (bpm) *"
                value={avgHr}
                onChangeText={setAvgHr}
                placeholder="如：131"
                keyboardType="number-pad"
              />
              <FormField
                label="日期"
                value={runDate}
                onChangeText={setRunDate}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
              />

              {/* 配速预计算提示 */}
              {distance && duration ? (
                <View style={styles.pacePreview}>
                  <Text style={styles.pacePreviewLabel}>预估配速</Text>
                  <Text style={styles.pacePreviewValue}>
                    {(() => {
                      const sec = parseDuration(duration);
                      const dist = parseFloat(distance);
                      if (!sec || !dist) return '--';
                      const pace = sec / dist;
                      const m = Math.floor(pace / 60);
                      const s = Math.round(pace % 60);
                      return `${m}'${s.toString().padStart(2, '0')}"`;
                    })()}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>分析并保存</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ===== 子组件 =====
function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.modeTab, active && styles.modeTabActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: TextInput['props']['keyboardType'];
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray4}
        keyboardType={keyboardType}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.gray5,
    borderRadius: BorderRadius.md,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: { fontSize: FontSize.body, color: Colors.gray2, fontWeight: FontWeight.medium },
  modeTabTextActive: { color: Colors.black, fontWeight: FontWeight.semibold },
  ocrArea: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  ocrBtn: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.separator,
    borderStyle: 'dashed',
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ocrBtnIcon: { fontSize: 40 },
  ocrBtnTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold, color: Colors.black },
  ocrBtnSub: { fontSize: FontSize.caption, color: Colors.gray3, textAlign: 'center' },
  manualLink: { fontSize: FontSize.body, color: Colors.primary, fontWeight: FontWeight.medium },
  ocrLoading: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  ocrLoadingText: { fontSize: FontSize.body, color: Colors.gray2 },
  form: { gap: Spacing.md },
  fieldContainer: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: Colors.black },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.separator,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.h3,
    color: Colors.black,
  },
  pacePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  pacePreviewLabel: { fontSize: FontSize.body, color: Colors.gray2 },
  pacePreviewValue: { fontSize: FontSize.h2, fontWeight: FontWeight.bold, color: Colors.primary },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold, color: Colors.white },
});
