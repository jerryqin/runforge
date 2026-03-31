import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import i18n from '../i18n';
import { Logger } from '../utils/Logger';

const STORAGE_KEY = '@runforge/daily-training-reminder';
const ANDROID_CHANNEL_ID = 'daily-training-reminders';
const NOTIFICATIONS_UNAVAILABLE_MESSAGE = '当前安装包不包含通知原生模块，请重新安装最新开发包后再使用提醒功能。';

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

function getNotificationsModule() {
  try {
    return require('expo-notifications');
  } catch (error) {
    Logger.warn('[Reminder] expo-notifications unavailable', error);
    return null;
  }
}

function requireNotificationsModule() {
  const notifications = getNotificationsModule();
  if (!notifications) {
    throw new Error(NOTIFICATIONS_UNAVAILABLE_MESSAGE);
  }
  return notifications;
}

export function isReminderSupported() {
  return getNotificationsModule() != null;
}

export async function setupReminderNotificationHandler() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return false;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  return true;
}

export async function configureReminderChannel() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: i18n.t('reminder.channelName'),
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
  const Notifications = getNotificationsModule();
  if (!Notifications) return 'undetermined';
  const permission = await Notifications.getPermissionsAsync();
  return permission.status as ReminderPermissionStatus;
}

export async function requestReminderPermissions(): Promise<ReminderPermissionStatus> {
  const Notifications = requireNotificationsModule();
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
  const Notifications = requireNotificationsModule();
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
      title: i18n.t('reminder.notificationTitle'),
      body: i18n.t('reminder.notificationBody'),
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
  const Notifications = getNotificationsModule();
  const currentSettings = await loadDailyTrainingReminderSettings();

  if (Notifications && currentSettings.notificationId) {
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
  const Notifications = requireNotificationsModule();
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