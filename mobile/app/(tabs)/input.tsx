import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { useHealthData } from '../../src/services/useHealthData';
import { HealthStatus, HealthWorkout } from '../../src/services/HealthService';

type InputMode = 'health' | 'ocr' | 'manual';

export default function InputScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>('health');
  const [ocrLoading, setOcrLoading] = useState(false);

  // Apple Health
  const healthData = useHealthData();
  const [selectedWorkout, setSelectedWorkout] = useState<HealthWorkout | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const syncTriggered = useRef(false);

  const visibleCount = useMemo(
    () => healthData.workouts.filter((w, idx) => !hiddenKeys.has(`${w.startDate}-${idx}`)).length,
    [healthData.workouts, hiddenKeys]
  );

  // 按月分组（仅在 workouts 变化时重新计算）
  const workoutsByMonth = useMemo(() => {
    const map = new Map<string, { item: HealthWorkout; idx: number }[]>();
    healthData.workouts.forEach((item, idx) => {
      const d = new Date(item.startDate);
      const key = `${d.getFullYear()}年${d.getMonth() + 1}月`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ item, idx });
    });
    // 每组内按日期降序，月份按降序
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, items]) => ({
        month,
        items: items.sort((a, b) => new Date(b.item.startDate).getTime() - new Date(a.item.startDate).getTime()),
      }));
  }, [healthData.workouts]);

  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const toggleMonth = useCallback((month: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }, []);

  const handleDeleteWorkout = useCallback((key: string) => {
    setHiddenKeys(prev => new Set([...prev, key]));
  }, []);

  // 同步完成后检查结果（isLoading false 且 workouts 为空才提示）
  useEffect(() => {
    if (syncTriggered.current && !healthData.isLoading) {
      syncTriggered.current = false;
      if (healthData.workouts.length === 0 && !healthData.error) {
        Alert.alert('没有数据', '未找到跑步记录，请确认 Apple Health 中有跑步数据');
      }
    }
  }, [healthData.isLoading, healthData.workouts.length, healthData.error]);

  // 初始化 Health 状态
  useEffect(() => {
    healthData.checkAvailability();
  }, []);

  // 表单字段
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');   // HH:MM:SS
  const [avgHr, setAvgHr] = useState('');
  const [rpe, setRpe] = useState('');              // RPE 1-10
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
      const ocrResult = await ocrEngine.analyzeImage(result.assets[0].uri);
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
      if (ocrResult.confidence === 0) {
        Alert.alert('识别失败', ocrResult.raw_text || '请手动输入数据');
      } else {
        Alert.alert('识别完成', `置信度 ${Math.round(ocrResult.confidence * 100)}%，请确认数据后提交`);
      }
    } catch (e) {
      Alert.alert('识别失败', '请手动输入数据');
      setMode('manual');
    } finally {
      setOcrLoading(false);
    }
  };

  // ===== Apple Health 同步 =====
  const handleHealthSync = async () => {
    if (healthData.status === HealthStatus.NOT_INSTALLED) {
      Alert.alert(
        'Apple Health 不可用',
        '需要使用 expo-dev-client 构建应用才能使用此功能。\n\n请运行: npx expo run:ios',
        [{ text: '知道了' }]
      );
      return;
    }
    syncTriggered.current = true;
    healthData.incrementalSync(); // 增量同步，首次自动全量
  };

  const handleFullSync = () => {
    Alert.alert(
      '全量重新同步',
      '将重新拉取全部历史跑步数据，时间较长。是否继续？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '继续',
          onPress: () => {
            syncTriggered.current = true;
            healthData.fullSync();
          },
        },
      ]
    );
  };

  const lastSyncText = healthData.lastSyncDate
    ? (() => {
        const d = healthData.lastSyncDate;
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      })()
    : null;

  // ===== 导入选中的 Health 记录 =====
  const handleImportWorkout = useCallback(async (workout: HealthWorkout) => {
    setSelectedWorkout(workout);
    
    // 预填表单
    setDistance(workout.distanceKm.toFixed(2));
    const h = Math.floor(workout.durationSec / 3600);
    const m = Math.floor((workout.durationSec % 3600) / 60);
    const s = Math.floor(workout.durationSec % 60);
    setDuration(
      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    );
    if (workout.avgHeartRate) {
      setAvgHr(String(Math.round(workout.avgHeartRate)));
    }
    setRunDate(workout.startDate.split('T')[0]);
    
    // 切换到手动模式确认
    setMode('manual');
    Alert.alert('数据已导入', '请确认数据后提交');
  }, []);

  // ===== 批量导入所有 Health 记录 =====
  const handleBatchImport = async () => {
    if (healthData.workouts.length === 0) {
      Alert.alert('没有数据', '请先同步健康数据');
      return;
    }

    Alert.alert(
      '批量导入',
      `确定导入全部 ${visibleCount} 条跑步记录吗？\n\n这可能需要一些时间。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            setSubmitting(true);
            try {
              const profile = await userProfileRepo.get();
              const recentRecords = await runRecordRepo.fetchRecent(7);
              let imported = 0;
              let skipped = 0;

              for (const [idx, workout] of healthData.workouts.entries()) {
                const key = `${workout.startDate}-${idx}`;
                if (hiddenKeys.has(key)) {
                  skipped++;
                  continue;
                }
                // 检查是否已存在（按日期判断）
                const date = workout.startDate.split('T')[0];
                const existing = await runRecordRepo.fetchAll();
                if (existing.some(r => r.run_date === date)) {
                  skipped++;
                  continue;
                }

                const durationSec = workout.durationSec;
                const distanceKm = workout.distanceKm;
                const avgHr = workout.avgHeartRate || profile.hr_threshold;

                const output = analyze({
                  distance: distanceKm,
                  durationSec,
                  avgHr,
                  runDate: date,
                  profile,
                  recentRecords,
                });

                await runRecordRepo.save({
                  create_time: Date.now(),
                  run_date: date,
                  distance: distanceKm,
                  duration_sec: durationSec,
                  avg_pace: output.avgPace,
                  avg_hr: avgHr,
                  intensity: output.intensity,
                  conclusion: output.conclusion,
                  suggest: output.suggest,
                  risk: output.risk,
                  tss: output.tss,
                  vdot: output.vdot,
                });

                imported++;
              }

              Alert.alert(
                '导入完成',
                `成功导入 ${imported} 条记录\n跳过 ${skipped} 条重复记录`,
                [
                  {
                    text: '查看历史',
                    onPress: () => router.push('/(tabs)/history'),
                  },
                  { text: '确定' },
                ]
              );
            } catch (e) {
              Alert.alert('导入失败', String(e));
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
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
        rpe: rpe ? parseInt(rpe, 10) : undefined,
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
        vdot: output.vdot,
        rpe: output.rpe,
      });

      // 跳转到详情页
      router.push(`/record/${saved.id}`);
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
            <ModeTab label="🍎 健康数据" active={mode === 'health'} onPress={() => setMode('health')} />
            <ModeTab label="📷 图片" active={mode === 'ocr'} onPress={() => setMode('ocr')} />
            <ModeTab label="✏️ 手动" active={mode === 'manual'} onPress={() => setMode('manual')} />
          </View>

          {/* Apple Health 模式 */}
          {mode === 'health' && (
            <View style={styles.healthArea}>
              {healthData.isLoading ? (
                <View style={styles.healthLoading}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.healthLoadingText}>
                    {healthData.lastSyncDate ? '正在同步新数据...' : '正在同步全部历史数据...'}
                  </Text>
                  {!healthData.lastSyncDate && (
                    <Text style={styles.healthLoadingSubText}>首次同步需要较长时间，请稍候</Text>
                  )}
                </View>
              ) : healthData.workouts.length === 0 ? (
                <>
                  <TouchableOpacity
                    style={styles.healthBtn}
                    onPress={handleHealthSync}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.healthBtnIcon}>🍎</Text>
                    <Text style={styles.healthBtnTitle}>从 Apple Health 同步</Text>
                    <Text style={styles.healthBtnSub}>
                      {healthData.statusMessage || '读取全部历史跑步记录'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMode('ocr')}>
                    <Text style={styles.manualLink}>或使用图片识别 →</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.workoutList}>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text style={styles.workoutHeaderTitle}>
                        {visibleCount} 条跑步记录
                      </Text>
                      {lastSyncText && (
                        <Text style={styles.workoutHeaderSub}>上次同步：{lastSyncText}</Text>
                      )}
                    </View>
                    <View style={styles.syncButtons}>
                      <TouchableOpacity onPress={handleHealthSync} style={styles.syncBtn}>
                        <Text style={styles.syncBtnText}>增量</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleFullSync} style={[styles.syncBtn, styles.syncBtnSecondary]}>
                        <Text style={[styles.syncBtnText, styles.syncBtnTextSecondary]}>全量</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.batchImportBtn}
                    onPress={handleBatchImport}
                    disabled={submitting}
                    activeOpacity={0.7}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <Text style={styles.batchImportBtnIcon}>⚡</Text>
                        <Text style={styles.batchImportBtnText}>
                          批量导入全部 {visibleCount} 条
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <View style={styles.workoutFlatList}>
                    {workoutsByMonth.map(({ month, items }) => {
                      const visibleItems = items.filter(({ idx, item }) =>
                        !hiddenKeys.has(`${item.startDate}-${idx}`)
                      );
                      const isCollapsed = collapsedMonths.has(month);
                      return (
                        <View key={month}>
                          {/* 月份标题行 */}
                          <TouchableOpacity
                            style={styles.monthHeader}
                            onPress={() => toggleMonth(month)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.monthHeaderTitle}>{month}</Text>
                            <Text style={styles.monthHeaderMeta}>
                              {visibleItems.length} 条　{isCollapsed ? '▶' : '▼'}
                            </Text>
                          </TouchableOpacity>
                          {/* 展开时显示内容 */}
                          {!isCollapsed && visibleItems.map(({ item, idx }) => {
                            const key = `${item.startDate}-${idx}`;
                            return (
                              <WorkoutItem
                                key={key}
                                itemKey={key}
                                workout={item}
                                onImport={handleImportWorkout}
                                onDelete={handleDeleteWorkout}
                              />
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

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

              {/* RPE 主观疲劳评分 */}
              <View style={styles.rpeContainer}>
                <Text style={styles.fieldLabel}>主观疲劳 RPE（可选）</Text>
                <Text style={styles.rpeHint}>1=非常轻松  5=适中  10=筍疲力竭</Text>
                <View style={styles.rpeRow}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[
                        styles.rpeBtn,
                        rpe === String(n) && styles.rpeBtnActive,
                        n <= 3 && rpe === String(n) && { backgroundColor: Colors.intensityEasy + '30' },
                        n >= 4 && n <= 6 && rpe === String(n) && { backgroundColor: Colors.intensityNormal + '30' },
                        n >= 7 && n <= 8 && rpe === String(n) && { backgroundColor: Colors.intensityHigh + '30' },
                        n >= 9 && rpe === String(n) && { backgroundColor: Colors.intensityOver + '30' },
                      ]}
                      onPress={() => setRpe(rpe === String(n) ? '' : String(n))}
                    >
                      <Text style={[
                        styles.rpeBtnText,
                        rpe === String(n) && styles.rpeBtnTextActive,
                        n <= 3 && rpe === String(n) && { color: Colors.intensityEasy },
                        n >= 4 && n <= 6 && rpe === String(n) && { color: Colors.intensityNormal },
                        n >= 7 && n <= 8 && rpe === String(n) && { color: Colors.intensityHigh },
                        n >= 9 && rpe === String(n) && { color: Colors.intensityOver },
                      ]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

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

const WorkoutItem = React.memo(function WorkoutItem({
  workout,
  itemKey,
  onImport,
  onDelete,
}: {
  workout: HealthWorkout;
  itemKey: string;
  onImport: (w: HealthWorkout) => void;
  onDelete: (key: string) => void;
}) {
  const date = new Date(workout.startDate);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
  const durationMin = Math.round(workout.durationSec / 60);
  const pace =
    workout.distanceKm > 0
      ? workout.durationSec / workout.distanceKm
      : 0;
  const paceMin = Math.floor(pace / 60);
  const paceSec = Math.round(pace % 60);

  return (
    <TouchableOpacity
      style={styles.workoutItem}
      onPress={() => onImport(workout)}
      activeOpacity={0.7}
    >
      {/* 删除按钮 */}
      <TouchableOpacity
        style={styles.workoutDeleteBtn}
        onPress={(e) => { e.stopPropagation(); onDelete(itemKey); }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.workoutDeleteBtnText}>×</Text>
      </TouchableOpacity>
      <View style={styles.workoutItemInfo}>
        <Text style={styles.workoutItemDate}>{dateStr}</Text>
        <Text style={styles.workoutItemSource}>{workout.sourceApp}</Text>
        <View style={styles.workoutItemStats}>
          <Text style={styles.workoutItemStat}>
            📏 {workout.distanceKm.toFixed(2)} km
          </Text>
          <Text style={styles.workoutItemStat}>⏱️ {durationMin} 分钟</Text>
          {workout.avgHeartRate && (
            <Text style={styles.workoutItemStat}>
              ❤️ {Math.round(workout.avgHeartRate)} bpm
            </Text>
          )}
          {pace > 0 && (
            <Text style={styles.workoutItemStat}>
              ⚡ {paceMin}'{paceSec.toString().padStart(2, '0')}"
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.workoutItemArrow}>→</Text>
    </TouchableOpacity>
  );
});

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
  
  // Apple Health 同步
  healthArea: { gap: Spacing.md, paddingVertical: Spacing.md },
  healthBtn: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '08',
  },
  healthBtnIcon: { fontSize: 40 },
  healthBtnTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold, color: Colors.black },
  healthBtnSub: { fontSize: FontSize.caption, color: Colors.gray3, textAlign: 'center' },
  healthLoading: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  healthLoadingText: { fontSize: FontSize.body, color: Colors.gray2 },
  healthLoadingSubText: { fontSize: FontSize.caption, color: Colors.gray3 },
  workoutList: { gap: Spacing.sm },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  workoutHeaderTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold, color: Colors.black },
  workoutHeaderSub: { fontSize: FontSize.caption, color: Colors.gray3, marginTop: 2 },
  syncButtons: { flexDirection: 'row', gap: Spacing.xs },
  syncBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
  },
  syncBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  syncBtnText: { fontSize: FontSize.caption, color: Colors.white, fontWeight: FontWeight.medium },
  syncBtnTextSecondary: { color: Colors.primary },
  batchImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  batchImportBtnIcon: { fontSize: FontSize.h3 },
  batchImportBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  workoutFlatList: {},
  workoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.separator,
  },
  workoutItemInfo: { flex: 1, gap: Spacing.xs },
  workoutItemDate: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold, color: Colors.black },
  workoutItemSource: { fontSize: FontSize.caption, color: Colors.gray3 },
  workoutItemStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  workoutItemStat: { fontSize: FontSize.caption, color: Colors.gray2 },
  workoutItemArrow: { fontSize: FontSize.h2, color: Colors.primary, marginLeft: Spacing.sm },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  monthHeaderTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  monthHeaderMeta: {
    fontSize: FontSize.caption,
    color: Colors.gray3,
  },
  workoutDeleteBtn: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.gray3 + '40',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  workoutDeleteBtnText: { fontSize: 16, color: Colors.gray2, lineHeight: 20, includeFontPadding: false },
  
  // OCR
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
  rpeContainer: { gap: Spacing.xs },
  rpeHint: { fontSize: FontSize.caption, color: Colors.gray3 },
  rpeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  rpeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeBtnActive: { borderColor: 'transparent' },
  rpeBtnText: { fontSize: FontSize.body, color: Colors.gray2, fontWeight: FontWeight.medium },
  rpeBtnTextActive: { fontWeight: FontWeight.bold },
});
