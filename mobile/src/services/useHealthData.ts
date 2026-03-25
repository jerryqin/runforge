/**
 * useHealthData - Apple Health 数据同步 Hook
 *
 * 支持增量同步：
 *  - 首次使用时全量拉取 3650 天
 *  - 后续只拉取上次同步以来的新记录，并与缓存合并
 *  - 缓存通过 AsyncStorage 持久化，重启 App 后无需重新拉取全量数据
 */

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  checkHealthAvailability,
  requestHealthPermissions,
  fetchRunningWorkouts,
  HealthStatus,
  HealthWorkout,
  getStatusMessage,
} from './HealthService';
import { Logger } from '../utils/Logger';

const KEY_WORKOUTS  = '@runforge_health_workouts';
const KEY_LAST_SYNC = '@runforge_health_last_sync';

// 全量同步时拉取的天数
const FULL_SYNC_DAYS = 3650;

export interface UseHealthDataReturn {
  status: HealthStatus | null;
  isLoading: boolean;
  error: string | null;
  workouts: HealthWorkout[];
  lastSyncDate: Date | null;
  checkAvailability: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  /** 增量同步：仅拉取上次同步以来的新记录；首次自动转全量 */
  incrementalSync: () => Promise<void>;
  /** 全量同步：清空缓存，重新拉取全部历史数据 */
  fullSync: () => Promise<void>;
  /** 兼容旧调用的别名 */
  syncWorkouts: (days?: number) => Promise<void>;
  statusMessage: string;
}

export function useHealthData(): UseHealthDataReturn {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<HealthWorkout[]>([]);
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);

  // ── 启动时从缓存恢复 ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [cachedItem, lastSyncItem] = await AsyncStorage.multiGet([
          KEY_WORKOUTS,
          KEY_LAST_SYNC,
        ]);
        if (cachedItem[1]) {
          const parsed: HealthWorkout[] = JSON.parse(cachedItem[1]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWorkouts(parsed);
          }
        }
        if (lastSyncItem[1]) {
          setLastSyncDate(new Date(lastSyncItem[1]));
        }
      } catch {
        // 缓存读取失败时静默处理
      }
    })();
  }, []);

  // ── 工具：初始化 & 鉴权 ──────────────────────────────────────────────
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestHealthPermissions();
    if (granted) {
      setStatus(HealthStatus.AVAILABLE);
    } else {
      setStatus(HealthStatus.PERMISSION_DENIED);
      setError('Apple Health 授权失败，请在设置中允许访问健康数据');
    }
    return granted;
  }, []);

  // ── 工具：持久化缓存 ─────────────────────────────────────────────────
  const saveCache = useCallback(
    async (list: HealthWorkout[], syncDate: Date) => {
      try {
        await AsyncStorage.multiSet([
          [KEY_WORKOUTS,  JSON.stringify(list)],
          [KEY_LAST_SYNC, syncDate.toISOString()],
        ]);
      } catch {
        Logger.warn('[useHealthData] Failed to save cache');
      }
    },
    []
  );

  // ── 增量同步 ─────────────────────────────────────────────────────────
  const incrementalSync = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const granted = await ensurePermission();
      if (!granted) return;

      if (!lastSyncDate) {
        // 首次同步 → 全量
        Logger.log('[useHealthData] No last sync date, falling back to full sync');
        const data = await fetchRunningWorkouts({ days: FULL_SYNC_DAYS });
        const now = new Date();
        setWorkouts(data);
        setLastSyncDate(now);
        await saveCache(data, now);
        return;
      }

      // 只拉取 lastSyncDate 以来的新记录（稍微往前 5 分钟避免边界遗漏）
      const since = new Date(lastSyncDate.getTime() - 5 * 60 * 1000);
      Logger.log(`[useHealthData] Incremental sync since ${since.toISOString()}`);
      const newData = await fetchRunningWorkouts({ startDate: since });

      if (newData.length === 0) {
        Logger.log('[useHealthData] No new workouts');
        const now = new Date();
        setLastSyncDate(now);
        await AsyncStorage.setItem(KEY_LAST_SYNC, now.toISOString());
        return;
      }

      // 合并：以 startDate 去重
      const existingKeys = new Set(workouts.map(w => w.startDate));
      const merged = [
        ...newData.filter(w => !existingKeys.has(w.startDate)),
        ...workouts,
      ].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );

      const now = new Date();
      setWorkouts(merged);
      setLastSyncDate(now);
      await saveCache(merged, now);
      Logger.log(`[useHealthData] Incremental: +${merged.length - workouts.length} new, total ${merged.length}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '同步训练数据失败');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensurePermission, saveCache, lastSyncDate, workouts]);

  // ── 全量同步 ─────────────────────────────────────────────────────────
  const fullSync = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const granted = await ensurePermission();
      if (!granted) return;

      Logger.log('[useHealthData] Full sync started');
      const data = await fetchRunningWorkouts({ days: FULL_SYNC_DAYS });
      const now = new Date();
      setWorkouts(data);
      setLastSyncDate(now);
      await saveCache(data, now);
      Logger.log(`[useHealthData] Full sync done: ${data.length} records`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '全量同步失败');
    } finally {
      setIsLoading(false);
    }
  }, [ensurePermission, saveCache]);

  // ── 兼容旧调用（syncWorkouts(days)） ─────────────────────────────────
  const syncWorkouts = useCallback(
    async (days?: number) => {
      if (!days || days >= FULL_SYNC_DAYS) {
        return fullSync();
      }
      return incrementalSync();
    },
    [fullSync, incrementalSync]
  );

  // ── checkAvailability ────────────────────────────────────────────────
  const checkAvailability = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const healthStatus = await checkHealthAvailability();
      setStatus(healthStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : '检查健康服务失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── requestPermission ────────────────────────────────────────────────
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const granted = await requestHealthPermissions();
      setStatus(granted ? HealthStatus.AVAILABLE : HealthStatus.PERMISSION_DENIED);
      return granted;
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求权限失败');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const statusMessage = status ? getStatusMessage(status) : '';

  return {
    status,
    isLoading,
    error,
    workouts,
    lastSyncDate,
    checkAvailability,
    requestPermission,
    incrementalSync,
    fullSync,
    syncWorkouts,
    statusMessage,
  };
}

