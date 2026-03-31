import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../src/constants/theme';
import {
  DailyTrainingReminderSettings,
  disableDailyTrainingReminder,
  enableDailyTrainingReminder,
  formatReminderTime,
  loadDailyTrainingReminderSettings,
  saveDailyTrainingReminderSettings,
  scheduleReminderTestNotification,
} from '../src/services/ReminderService';

const ITEMS = [
  {
    icon: '🏃',
    title: '每日训练提醒',
    desc: '已支持真实本地提醒，可每天在固定时间提醒查看今日行动。',
  },
  {
    icon: '🧘',
    title: '恢复与休息提醒',
    desc: '后续可根据疲劳状态动态触发。',
  },
  {
    icon: '📊',
    title: '周报提醒',
    desc: '后续可固定每周提醒查看本周推进。',
  },
];

const PRESET_TIMES = [
  { label: '早上 07:00', hour: 7, minute: 0 },
  { label: '中午 12:30', hour: 12, minute: 30 },
  { label: '晚上 19:30', hour: 19, minute: 30 },
  { label: '晚上 21:00', hour: 21, minute: 0 },
];

export default function ReminderSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<DailyTrainingReminderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDailyTrainingReminderSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  const selectedTime = useMemo(() => {
    if (!settings) return '19:30';
    return formatReminderTime(settings.hour, settings.minute);
  }, [settings]);

  const statusText = useMemo(() => {
    if (!settings) return '';
    if (settings.enabled) {
      return `已开启：每天 ${selectedTime} 提醒你查看今日行动。`;
    }
    if (settings.permissionStatus === 'denied') {
      return '系统通知权限未开启，请到系统设置中允许通知后再启用。';
    }
    return '关闭状态。开启后会在固定时间发送本地提醒。';
  }, [selectedTime, settings]);

  const handleToggle = async (nextValue: boolean) => {
    if (!settings || saving) return;

    setSaving(true);
    try {
      const nextSettings = nextValue
        ? await enableDailyTrainingReminder(settings.hour, settings.minute)
        : await disableDailyTrainingReminder();

      setSettings(nextSettings);

      if (nextValue && nextSettings.permissionStatus !== 'granted') {
        Alert.alert(
          '通知权限未开启',
          '请先允许 RunForge 发送通知，才能启用每日训练提醒。',
          [
            { text: '稍后再说', style: 'cancel' },
            { text: '打开系统设置', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      Alert.alert(t('input.setupFailed'), String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleTimePress = async (hour: number, minute: number) => {
    if (!settings || saving) return;

    setSaving(true);
    try {
      let nextSettings: DailyTrainingReminderSettings;
      if (settings.enabled) {
        nextSettings = await enableDailyTrainingReminder(hour, minute);
      } else {
        nextSettings = {
          ...settings,
          hour,
          minute,
        };
        await saveDailyTrainingReminderSettings(nextSettings);
      }

      setSettings(nextSettings);
    } catch (error) {
      Alert.alert(t('input.saveFailed'), String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleTestReminder = async () => {
    if (saving) return;

    setSaving(true);
    try {
      const permissionStatus = await scheduleReminderTestNotification();
      const refreshed = await loadDailyTrainingReminderSettings();
      setSettings(refreshed);

      if (permissionStatus !== 'granted') {
        Alert.alert(
          '通知权限未开启',
          '请先允许 RunForge 发送通知，才能接收测试提醒。',
          [
            { text: '稍后再说', style: 'cancel' },
            { text: '打开系统设置', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      Alert.alert(t('input.testReminderScheduled'), t('input.testReminderMessage'));
    } catch (error) {
      Alert.alert(t('input.testFailed'), String(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>提醒设置</Text>
          <Text style={styles.heroTitle}>每日训练提醒已经可用</Text>
          <Text style={styles.heroBody}>
            这一版先只做一项真实提醒：每天固定时间提醒你打开 RunForge，查看今日行动。
          </Text>
        </View>

        <View style={styles.liveCard}>
          <View style={styles.liveHeader}>
            <View style={styles.liveHeaderText}>
              <Text style={styles.liveTitle}>🏃 每日训练提醒</Text>
              <Text style={styles.liveHint}>{statusText}</Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggle}
              trackColor={{ false: Colors.gray4, true: Colors.primary + '66' }}
              thumbColor={settings.enabled ? Colors.primary : Colors.white}
              disabled={saving}
            />
          </View>

          <View style={styles.timeSection}>
            <Text style={styles.timeTitle}>提醒时间</Text>
            <View style={styles.timeOptions}>
              {PRESET_TIMES.map((item) => {
                const active = settings.hour === item.hour && settings.minute === item.minute;
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.timeChip, active && styles.timeChipActive]}
                    onPress={() => handleTimePress(item.hour, item.minute)}
                    activeOpacity={0.85}
                    disabled={saving}
                  >
                    <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.testBtn, saving && styles.btnDisabled]}
            onPress={handleTestReminder}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.testBtnText}>{saving ? '处理中...' : '发送 5 秒后测试提醒'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>本阶段范围</Text>
          {ITEMS.map(item => (
            <View key={item.title} style={styles.itemCard}>
              <Text style={styles.itemIcon}>{item.icon}</Text>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>当前已完成</Text>
          <Text style={styles.placeholderText}>MVP 已接入真实本地通知。当前支持“每日训练提醒”，其余提醒类型继续保留在下一阶段。</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)')} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>回首页继续看今日行动</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  heroCard: {
    backgroundColor: Colors.black,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroEyebrow: {
    fontSize: FontSize.caption,
    color: Colors.white + 'CC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  heroBody: {
    fontSize: FontSize.body,
    color: Colors.white,
    lineHeight: 22,
  },
  liveCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  liveHeaderText: {
    flex: 1,
    gap: 4,
  },
  liveTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  liveHint: {
    fontSize: FontSize.body,
    color: Colors.gray2,
    lineHeight: 20,
  },
  timeSection: { gap: Spacing.sm },
  timeTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  timeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  timeChip: {
    borderWidth: 1,
    borderColor: Colors.separator,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  timeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '14',
  },
  timeChipText: {
    fontSize: FontSize.body,
    color: Colors.gray2,
    fontWeight: FontWeight.medium,
  },
  timeChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  testBtn: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  testBtnText: {
    fontSize: FontSize.body,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  btnDisabled: { opacity: 0.6 },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  itemCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  itemIcon: { fontSize: 24 },
  itemContent: { flex: 1, gap: 2 },
  itemTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  itemDesc: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
  },
  placeholderCard: {
    backgroundColor: Colors.primary + '12',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  placeholderTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  placeholderText: {
    fontSize: FontSize.body,
    color: Colors.gray1,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  primaryBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
});
