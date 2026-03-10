import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const STORAGE_KEY = '@runforge/daily-training-reminder';
const ANDROID_CHANNEL_ID = 'daily-training-reminders';

export type ReminderPermissionStatus = 'undetermined' | 'denied' | 'granted';

export interface DailyTrainingReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  notificationId: string | null;
  permissionStatus: ReminderPermissionStatus;
}

const DEFAULT_SETTINGS: DailyTrainingReminderSettings = {
  enabled: false,
  hour: 19,
  minute: 30,
  notificationId: null,
  permissionStatus: 'undetermined',
};

export async function configureReminderChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: '每日训练提醒',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function loadDailyTrainingReminderSettings(): Promise<DailyTrainingReminderSettings> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  const permissionStatus = await getReminderPermissionStatus();

  if (!stored) {
    return {
      ...DEFAULT_SETTINGS,
      permissionStatus,
    };
  }

  try {
    const parsed = JSON.parse(stored) as Partial<DailyTrainingReminderSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      permissionStatus,
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      permissionStatus,
    };
  }
}

export async function saveDailyTrainingReminderSettings(settings: DailyTrainingReminderSettings) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function getReminderPermissionStatus(): Promise<ReminderPermissionStatus> {
  const permission = await Notifications.getPermissionsAsync();
  return permission.status as ReminderPermissionStatus;
}

export async function requestReminderPermissions(): Promise<ReminderPermissionStatus> {
  const existingStatus = await getReminderPermissionStatus();
  if (existingStatus === 'granted') return existingStatus;

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return requested.status as ReminderPermissionStatus;
}

export async function enableDailyTrainingReminder(hour: number, minute: number) {
  await configureReminderChannel();

  const permissionStatus = await requestReminderPermissions();
  if (permissionStatus !== 'granted') {
    const failedSettings = {
      ...(await loadDailyTrainingReminderSettings()),
      enabled: false,
      hour,
      minute,
      permissionStatus,
    };
    await saveDailyTrainingReminderSettings(failedSettings);
    return failedSettings;
  }

  const currentSettings = await loadDailyTrainingReminderSettings();
  if (currentSettings.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(currentSettings.notificationId);
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '该看今日行动了',
      body: '打开 RunForge，看看今天该怎么练。',
      sound: true,
      ...(Platform.OS === 'android' ? { androidChannelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    } as any,
  });

  const nextSettings: DailyTrainingReminderSettings = {
    enabled: true,
    hour,
    minute,
    notificationId,
    permissionStatus,
  };

  await saveDailyTrainingReminderSettings(nextSettings);
  return nextSettings;
}

export async function disableDailyTrainingReminder() {
  const currentSettings = await loadDailyTrainingReminderSettings();

  if (currentSettings.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(currentSettings.notificationId);
  }

  const nextSettings: DailyTrainingReminderSettings = {
    ...currentSettings,
    enabled: false,
    notificationId: null,
    permissionStatus: await getReminderPermissionStatus(),
  };

  await saveDailyTrainingReminderSettings(nextSettings);
  return nextSettings;
}

export async function scheduleReminderTestNotification() {
  await configureReminderChannel();

  const permissionStatus = await requestReminderPermissions();
  if (permissionStatus !== 'granted') {
    return permissionStatus;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'RunForge 测试提醒',
      body: '这是一条测试提醒，真实每日训练提醒已可用。',
      sound: true,
      ...(Platform.OS === 'android' ? { androidChannelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    } as any,
  });

  return permissionStatus;
}

export function formatReminderTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}