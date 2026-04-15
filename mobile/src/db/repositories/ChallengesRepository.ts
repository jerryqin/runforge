import { getDatabase } from '../database';

export interface Challenge {
  id?: number;
  title: string;
  target_km: number;
  target_pace_sec: number;
  created_at: number;
  achieved: boolean;
  achieved_date?: string | null;
}

class ChallengesRepository {
  async fetchAll(): Promise<Challenge[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: number;
      title: string;
      target_km: number;
      target_pace_sec: number;
      created_at: number;
      achieved: number;
      achieved_date: string | null;
    }>(`SELECT * FROM challenges ORDER BY created_at DESC`);
    return rows.map(r => ({ ...r, achieved: r.achieved === 1 }));
  }

  async save(c: Omit<Challenge, 'id' | 'created_at' | 'achieved' | 'achieved_date'>): Promise<Challenge> {
    const db = await getDatabase();
    const now = Date.now();
    const result = await db.runAsync(
      `INSERT INTO challenges (title, target_km, target_pace_sec, created_at, achieved)
       VALUES (?, ?, ?, ?, 0)`,
      [c.title, c.target_km, c.target_pace_sec, now]
    );
    return {
      id: result.lastInsertRowId,
      title: c.title,
      target_km: c.target_km,
      target_pace_sec: c.target_pace_sec,
      created_at: now,
      achieved: false,
      achieved_date: null,
    };
  }

  async update(c: Challenge): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE challenges SET title=?, target_km=?, target_pace_sec=? WHERE id=?`,
      [c.title, c.target_km, c.target_pace_sec, c.id!]
    );
  }

  async markAchieved(id: number, date: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE challenges SET achieved=1, achieved_date=? WHERE id=?`,
      [date, id]
    );
  }

  async delete(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM challenges WHERE id=?`, [id]);
  }
}

export const challengesRepo = new ChallengesRepository();
