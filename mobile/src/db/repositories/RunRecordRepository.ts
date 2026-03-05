import { getDatabase } from '../database';
import { RunRecord } from '../../types';

// RunRecord 数据仓储
// 业务层只依赖这个接口，未来切换 PostgreSQL 只需换实现
export interface IRunRecordRepository {
  save(record: Omit<RunRecord, 'id'>): Promise<RunRecord>;
  fetchAll(): Promise<RunRecord[]>;
  fetchRecent(days: number): Promise<RunRecord[]>;
  fetchById(id: number): Promise<RunRecord | null>;
  delete(id: number): Promise<void>;
}

export class SQLiteRunRecordRepository implements IRunRecordRepository {

  async save(record: Omit<RunRecord, 'id'>): Promise<RunRecord> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `INSERT INTO run_records
        (create_time, run_date, distance, duration_sec, avg_pace, avg_hr,
         intensity, conclusion, suggest, risk, tss, elevation_gain, temperature, rpe)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.create_time,
        record.run_date,
        record.distance,
        record.duration_sec,
        record.avg_pace,
        record.avg_hr,
        record.intensity,
        record.conclusion,
        record.suggest,
        record.risk,
        record.tss ?? null,
        record.elevation_gain ?? null,
        record.temperature ?? null,
        record.rpe ?? null,
      ]
    );
    return { ...record, id: result.lastInsertRowId };
  }

  async fetchAll(): Promise<RunRecord[]> {
    const db = await getDatabase();
    return await db.getAllAsync<RunRecord>(
      `SELECT * FROM run_records ORDER BY run_date DESC, create_time DESC`
    );
  }

  async fetchRecent(days: number): Promise<RunRecord[]> {
    const db = await getDatabase();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return await db.getAllAsync<RunRecord>(
      `SELECT * FROM run_records
       WHERE run_date >= ?
       ORDER BY run_date DESC`,
      [cutoffStr]
    );
  }

  async fetchById(id: number): Promise<RunRecord | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<RunRecord>(
      `SELECT * FROM run_records WHERE id = ?`,
      [id]
    );
  }

  async delete(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM run_records WHERE id = ?`, [id]);
  }
}

// 单例导出
export const runRecordRepo = new SQLiteRunRecordRepository();
