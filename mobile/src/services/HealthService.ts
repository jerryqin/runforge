/**
 * HealthService - Apple Health / Google Health Connect 数据同步
 *
 * 使用 expo-health-connect (Android) 或 react-native-health (iOS) 读取跑步数据。
 * 如果未安装原生模块，则优雅降级并提示用户手动录入。
 *
 * 由于 Apple HealthKit 需要原生模块，本服务提供一个抽象层。
 * 在 Expo managed workflow 下，可通过 expo-dev-client 使用。
 */

import { Platform } from 'react-native';

export interface HealthWorkout {
  sourceApp: string;
  startDate: string;      // ISO date
  endDate: string;
  distanceKm: number;
  durationSec: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  calories?: number;
}

export enum HealthStatus {
  AVAILABLE = 'AVAILABLE',
  NOT_INSTALLED = 'NOT_INSTALLED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM',
}

let _healthModule: any = null;

/**
 * 尝试动态加载 Health 模块
 */
function tryLoadModule(): any {
  if (_healthModule !== undefined && _healthModule !== null) return _healthModule;

  try {
    if (Platform.OS === 'ios') {
      // react-native-health
      _healthModule = require('react-native-health');
    } else if (Platform.OS === 'android') {
      // react-native-health-connect
      _healthModule = require('react-native-health-connect');
    }
  } catch {
    _healthModule = null;
  }
  return _healthModule;
}

/**
 * 检查 Health 服务是否可用
 */
export async function checkHealthAvailability(): Promise<HealthStatus> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return HealthStatus.UNSUPPORTED_PLATFORM;
  }

  const mod = tryLoadModule();
  if (!mod) {
    return HealthStatus.NOT_INSTALLED;
  }

  return HealthStatus.AVAILABLE;
}

/**
 * 请求 HealthKit / Health Connect 权限
 */
export async function requestHealthPermissions(): Promise<boolean> {
  const mod = tryLoadModule();
  if (!mod) return false;

  try {
    if (Platform.OS === 'ios') {
      const { default: AppleHealthKit, HealthKitPermissions } = mod;
      const permissions: typeof HealthKitPermissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants?.Permissions?.DistanceWalkingRunning,
            AppleHealthKit.Constants?.Permissions?.HeartRate,
            AppleHealthKit.Constants?.Permissions?.Workout,
            AppleHealthKit.Constants?.Permissions?.ActiveEnergyBurned,
          ].filter(Boolean),
          write: [],
        },
      };

      return new Promise<boolean>((resolve) => {
        AppleHealthKit.initHealthKit(permissions, (err: any) => {
          resolve(!err);
        });
      });
    }

    // Android: Health Connect
    if (Platform.OS === 'android') {
      const { initialize, requestPermission } = mod;
      const inited = await initialize();
      if (!inited) return false;

      const granted = await requestPermission([
        { accessType: 'read', recordType: 'ExerciseSession' },
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'Distance' },
      ]);
      return granted.length > 0;
    }

    return false;
  } catch (e) {
    console.warn('[HealthService] Permission request failed:', e);
    return false;
  }
}

/**
 * 获取指定天数内的跑步记录
 */
export async function fetchRunningWorkouts(days: number = 30): Promise<HealthWorkout[]> {
  const mod = tryLoadModule();
  if (!mod) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const endDate = new Date();

  try {
    if (Platform.OS === 'ios') {
      return await fetchIOSWorkouts(mod, startDate, endDate);
    }
    if (Platform.OS === 'android') {
      return await fetchAndroidWorkouts(mod, startDate, endDate);
    }
  } catch (e) {
    console.warn('[HealthService] Fetch workouts failed:', e);
  }

  return [];
}

async function fetchIOSWorkouts(
  mod: any,
  startDate: Date,
  endDate: Date
): Promise<HealthWorkout[]> {
  const { default: AppleHealthKit } = mod;

  return new Promise((resolve) => {
    const opts = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      type: 'Running',
    };

    AppleHealthKit.getWorkoutSamples(opts, (err: any, results: any[]) => {
      if (err || !results) {
        resolve([]);
        return;
      }

      const workouts: HealthWorkout[] = results
        .filter((w: any) => w.activityName === 'Running')
        .map((w: any) => {
          const start = new Date(w.start);
          const end = new Date(w.end);
          const durationSec = (end.getTime() - start.getTime()) / 1000;

          return {
            sourceApp: w.sourceName || 'Apple Health',
            startDate: w.start,
            endDate: w.end,
            distanceKm: (w.distance || 0) / 1000, // meters → km
            durationSec,
            avgHeartRate: undefined,
            maxHeartRate: undefined,
            calories: w.calories,
          };
        });

      resolve(workouts);
    });
  });
}

async function fetchAndroidWorkouts(
  mod: any,
  startDate: Date,
  endDate: Date
): Promise<HealthWorkout[]> {
  const { readRecords } = mod;

  const sessions = await readRecords('ExerciseSession', {
    timeRangeFilter: {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    },
  });

  const workouts: HealthWorkout[] = [];
  for (const s of sessions) {
    if (s.exerciseType !== 'RUNNING') continue;

    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    const durationSec = (end.getTime() - start.getTime()) / 1000;

    workouts.push({
      sourceApp: s.metadata?.dataOrigin || 'Health Connect',
      startDate: s.startTime,
      endDate: s.endTime,
      distanceKm: 0, // Will need separate distance query
      durationSec,
    });
  }

  return workouts;
}

/**
 * 获取人类可读的状态描述
 */
export function getStatusMessage(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.AVAILABLE:
      return '已连接健康数据';
    case HealthStatus.NOT_INSTALLED:
      return '需要安装原生健康模块 (react-native-health)，请使用 expo-dev-client 构建后使用';
    case HealthStatus.PERMISSION_DENIED:
      return '请在系统设置中授权 RunForge 读取健康数据';
    case HealthStatus.UNSUPPORTED_PLATFORM:
      return '当前平台不支持健康数据同步';
  }
}
