import { getDatabase } from '../database';
import { RacePlan } from '../../types';

export class SQLiteRacePlanRepository {

  async save(plan: Omit<RacePlan, 'id'>): Promise<RacePlan> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `INSERT INTO race_plan (race_date, target_time_sec, target_pace, plan_content)
       VALUES (?, ?, ?, ?)`,
      [plan.race_date, plan.target_time_sec, plan.target_pace, plan.plan_content]
    );
    return { ...plan, id: result.lastInsertRowId };
  }

  /** 获取最新的比赛计划（通常只有一个） */
  async getLatest(): Promise<RacePlan | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<RacePlan>(
      `SELECT * FROM race_plan ORDER BY race_date DESC LIMIT 1`
    );
  }

  async fetchAll(): Promise<RacePlan[]> {
    const db = await getDatabase();
    return await db.getAllAsync<RacePlan>(
      `SELECT * FROM race_plan ORDER BY race_date DESC`
    );
  }

  async delete(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM race_plan WHERE id = ?`, [id]);
  }

  /** 更新已有计划 */
  async upsert(plan: Omit<RacePlan, 'id'>): Promise<RacePlan> {
    // 每次比赛只保留一份计划，先清除同一 race_date 的旧计划
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM race_plan WHERE race_date = ?`, [plan.race_date]);
    return await this.save(plan);
  }
}

export const racePlanRepo = new SQLiteRacePlanRepository();
