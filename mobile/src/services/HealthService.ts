/**
 * HealthService - Apple Health / Google Health Connect 数据同步
 *
 * 使用 expo-health-connect (Android) 或 react-native-health (iOS) 读取跑步数据。
 * 如果未安装原生模块，则优雅降级并提示用户手动录入。
 *
 * 由于 Apple HealthKit 需要原生模块，本服务提供一个抽象层。
 * 在 Expo managed workflow 下，可通过 expo-dev-client 使用。
 */

import { Platform, NativeModules } from 'react-native';
import { Logger } from '../utils/Logger';

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
 * 获取 AppleHealthKit 原生模块
 * 
 * react-native-health 内部使用 Object.assign({}, NativeModules.AppleHealthKit, ...)
 * 但 NativeModules 的方法可能在原型上，Object.assign 无法复制。
 * 所以直接使用 NativeModules.AppleHealthKit，并从 react-native-health 获取 Constants。
 */
function tryLoadModule(): any {
  if (_healthModule !== undefined && _healthModule !== null) return _healthModule;

  try {
    if (Platform.OS === 'ios') {
      // 直接访问原生模块，确保所有原生方法可用
      const nativeModule = NativeModules.AppleHealthKit;
      
      // 从 react-native-health 获取 Constants（Activities、Permissions 等枚举）
      let Constants = {};
      try {
        const rnHealth = require('react-native-health');
        Constants = rnHealth?.Constants || rnHealth?.default?.Constants || {};
      } catch {
        // Constants 获取失败时使用硬编码备用
        const { Permissions } = require('react-native-health');
        Constants = { Permissions };
      }

      if (nativeModule) {
        _healthModule = { ...nativeModule, Constants };
        // 绑定原生方法的 this 上下文
        const methods = ['initHealthKit', 'isAvailable', 'getSamples', 'getWorkoutSamples',
          'getAnchoredWorkouts', 'getHeartRateSamples', 'getActiveEnergyBurned', 'getDistanceWalkingRunning'];
        for (const method of methods) {
          if (nativeModule[method]) {
            _healthModule[method] = nativeModule[method].bind(nativeModule);
          }
        }
        Logger.log('[HealthService] Loaded via NativeModules.AppleHealthKit');
        Logger.log('[HealthService] Available methods:', 
          methods.filter(m => typeof _healthModule[m] === 'function').join(', '));
      } else {
        // NativeModules 回退到 react-native-health 包
        const rnHealth = require('react-native-health');
        _healthModule = rnHealth?.default || rnHealth;
        Logger.log('[HealthService] NativeModules.AppleHealthKit not found, using package');
      }
    }
  } catch (e) {
    Logger.warn('[HealthService] Module load failed:', e);
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
      const HealthKit = mod;
      
      Logger.log('[HealthService] HealthKit loaded:', typeof HealthKit);
      Logger.log('[HealthService] initHealthKit:', typeof HealthKit.initHealthKit);
      Logger.log('[HealthService] getSamples:', typeof HealthKit.getSamples);
      Logger.log('[HealthService] NativeModules.AppleHealthKit:', 
        typeof NativeModules.AppleHealthKit);
      
      if (!HealthKit.initHealthKit) {
        Logger.error('[HealthService] Native module not linked!');
        return false;
      }
      
      // 权限 ID 使用字符串常量，不依赖 Constants 对象
      const permissions = {
        permissions: {
          read: ['DistanceWalkingRunning', 'HeartRate', 'Workout', 'ActiveEnergyBurned'],
          write: [] as string[],
        },
      };

      Logger.log('[HealthService] Requesting permissions...');

      return new Promise<boolean>((resolve) => {
        HealthKit.initHealthKit(permissions, (err: any) => {
          Logger.log('[HealthService] Permission result:', err ? `denied: ${JSON.stringify(err)}` : 'granted');
          resolve(!err);
        });
      });
    }

    // Android: Health Connect 暂未集成
    // if (Platform.OS === 'android') {
    //   const { initialize, requestPermission } = mod;
    //   const inited = await initialize();
    //   if (!inited) return false;

    //   const granted = await requestPermission([
    //     { accessType: 'read', recordType: 'ExerciseSession' },
    //     { accessType: 'read', recordType: 'HeartRate' },
    //     { accessType: 'read', recordType: 'Distance' },
    //   ]);
    //   return granted.length > 0;
    // }

    return false;
  } catch (e) {
    Logger.warn('[HealthService] Permission request failed:', e);
    return false;
  }
}

/**
 * 获取跑步记录
 * @param options.startDate 起始日期（增量同步时传入上次同步时间）
 * @param options.days      若未传 startDate，则以 days 前为起点（默认 3650）
 */
export async function fetchRunningWorkouts(
  options: { startDate?: Date; days?: number } = {}
): Promise<HealthWorkout[]> {
  const mod = tryLoadModule();
  if (!mod) {
    Logger.warn('[HealthService] Module not loaded');
    return [];
  }

  let HealthKit = mod;
  
  // 如果包装后的对象缺少方法，直接使用 NativeModules
  if (!HealthKit.getSamples && NativeModules.AppleHealthKit?.getSamples) {
    Logger.warn('[HealthService] Using NativeModules.AppleHealthKit directly');
    HealthKit = NativeModules.AppleHealthKit;
  }

  if (!HealthKit.getSamples) {
    Logger.error('[HealthService] getSamples not found. The native module is not properly linked.');
    return [];
  }

  const startDate = options.startDate
    ? new Date(options.startDate)
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - (options.days ?? 3650));
        return d;
      })();
  const endDate = new Date();

  try {
    if (Platform.OS === 'ios') {
      return await fetchIOSWorkouts(HealthKit, startDate, endDate);
    }
    // Android 暂未集成
    // if (Platform.OS === 'android') {
    //   return await fetchAndroidWorkouts(mod, startDate, endDate);
    // }
  } catch (e) {
    Logger.warn('[HealthService] Fetch workouts failed:', e);
  }

  return [];
}

/**
 * 支持的运动类型
 */
const SUPPORTED_ACTIVITY_NAMES = [
  'Running',         // 户外跑步
  'Indoor Run',      // 室内跑步
  'Treadmill',       // 跑步机
];

async function fetchIOSWorkouts(
  HealthKit: any,
  startDate: Date,
  endDate: Date
): Promise<HealthWorkout[]> {
  Logger.log('[HealthService] fetchIOSWorkouts - using getAnchoredWorkouts');

  // 优先使用 getAnchoredWorkouts（专为 workout 设计，能返回全部历史记录）
  // 若不可用则回退到 getSamples
  const useAnchored = typeof HealthKit?.getAnchoredWorkouts === 'function';
  Logger.log('[HealthService] getAnchoredWorkouts available:', useAnchored);

  if (useAnchored) {
    return fetchWithAnchoredWorkouts(HealthKit, startDate, endDate);
  }
  return fetchWithGetSamples(HealthKit, startDate, endDate);
}

async function fetchWithAnchoredWorkouts(
  HealthKit: any,
  startDate: Date,
  endDate: Date
): Promise<HealthWorkout[]> {
  return new Promise((resolve) => {
    const opts = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      type: 'Workout',
    };

    Logger.log('[HealthService] getAnchoredWorkouts opts:', opts);

    HealthKit.getAnchoredWorkouts(opts, async (err: any, results: any) => {
      if (err) {
        Logger.warn('[HealthService] getAnchoredWorkouts error:', err);
        resolve([]);
        return;
      }

      const rawList: any[] = results?.data || results || [];
      Logger.log('[HealthService] Raw results count:', rawList.length);

      // 打印所有原始记录的 activityName，便于调试
      rawList.forEach((w: any, i: number) => {
        Logger.log(`  [${i}] activityName="${w.activityName}" activityId=${w.activityId} source="${w.sourceName}" start=${w.start} dist=${w.distance}`);
      });

      const workouts: HealthWorkout[] = [];

      for (const w of rawList) {
        const activityName: string = w.activityName || '';
        if (!SUPPORTED_ACTIVITY_NAMES.includes(activityName)) {
          Logger.log(`  ❌ Skipped activityName="${activityName}" activityId=${w.activityId}`);
          continue;
        }

        // getAnchoredWorkouts 直接提供 duration（秒），无需自己算
        const durationSec: number =
          typeof w.duration === 'number' && w.duration > 0
            ? w.duration
            : (new Date(w.end).getTime() - new Date(w.start).getTime()) / 1000;

        Logger.log(`  ✅ ${activityName} | ${w.sourceName} | dist=${w.distance}mi | dur=${durationSec}s`);

        const heartRateData = await getAverageHeartRate(
          HealthKit,
          w.start,
          w.end,
        );

        workouts.push({
          sourceApp: w.sourceName || 'Apple Health',
          startDate: w.start,
          endDate: w.end,
          distanceKm: (w.distance || 0) * 1.60934,
          durationSec,
          avgHeartRate: heartRateData.average,
          maxHeartRate: heartRateData.max,
          calories: w.calories,
        });
      }

      Logger.log(`[HealthService] Total workouts found: ${workouts.length}`);
      resolve(workouts);
    });
  });
}

async function fetchWithGetSamples(
  HealthKit: any,
  startDate: Date,
  endDate: Date
): Promise<HealthWorkout[]> {
  return new Promise((resolve) => {
    const opts = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      type: 'Workout',
      ascending: false,
    };

    HealthKit.getSamples(opts, async (err: any, results: any[]) => {
      if (err) {
        Logger.warn('[HealthService] getSamples error:', err);
        resolve([]);
        return;
      }

      const rawList: any[] = results || [];
      Logger.log('[HealthService] getSamples raw count:', rawList.length);

      const workouts: HealthWorkout[] = [];

      for (const w of rawList) {
        const activityName: string = w.activityName || '';
        if (!SUPPORTED_ACTIVITY_NAMES.includes(activityName)) continue;

        const start = new Date(w.start);
        const end = new Date(w.end);
        const durationSec = (end.getTime() - start.getTime()) / 1000;

        const heartRateData = await getAverageHeartRate(
          HealthKit, w.start, w.end,
        );

        workouts.push({
          sourceApp: w.sourceName || 'Apple Health',
          startDate: w.start,
          endDate: w.end,
          distanceKm: (w.distance || 0) * 1.60934,
          durationSec,
          avgHeartRate: heartRateData.average,
          maxHeartRate: heartRateData.max,
          calories: w.calories,
        });
      }

      Logger.log(`[HealthService] Total workouts found: ${workouts.length}`);
      resolve(workouts);
    });
  });
}

/**
 * 获取指定时段的平均/最大心率
 */
async function getAverageHeartRate(
  HealthKit: any,
  startDate: string,
  endDate: string
): Promise<{ average?: number; max?: number }> {
  return new Promise((resolve) => {
    const opts = {
      startDate,
      endDate,
      ascending: false,
      limit: 1000, // 最多获取1000个心率样本
    };

    HealthKit.getHeartRateSamples(opts, (err: any, results: any[]) => {
      if (err || !results || results.length === 0) {
        resolve({ average: undefined, max: undefined });
        return;
      }

      const heartRates = results.map((r: any) => r.value);
      const sum = heartRates.reduce((a: number, b: number) => a + b, 0);
      const average = Math.round(sum / heartRates.length);
      const max = Math.max(...heartRates);

      resolve({ average, max });
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
