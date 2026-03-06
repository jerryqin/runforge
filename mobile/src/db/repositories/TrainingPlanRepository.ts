/**
 * TrainingPlanRepository - 训练计划数据仓储
 */
import { getDatabase } from '../database';

export interface StoredTrainingPlan {
  id?: number;
  race_date: string;
  vdot: number;
  weekly_peak_km: number;
  plan_json: string;
  created_at: number;
}

export class SQLiteTrainingPlanRepository {

  async save(plan: Omit<StoredTrainingPlan, 'id' | 'created_at'>): Promise<StoredTrainingPlan> {
    const db = await getDatabase();
    // 每次只保留最新的训练计划
    await db.runAsync(`DELETE FROM training_plan`);
    const result = await db.runAsync(
      `INSERT INTO training_plan (race_date, vdot, weekly_peak_km, plan_json)
       VALUES (?, ?, ?, ?)`,
      [plan.race_date, plan.vdot, plan.weekly_peak_km, plan.plan_json]
    );
    return {
      ...plan,
      id: result.lastInsertRowId,
      created_at: Date.now(),
    };
  }

  async getLatest(): Promise<StoredTrainingPlan | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<StoredTrainingPlan>(
      `SELECT * FROM training_plan ORDER BY created_at DESC LIMIT 1`
    );
  }

  async delete(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM training_plan`);
  }
}

export const trainingPlanRepo = new SQLiteTrainingPlanRepository();
