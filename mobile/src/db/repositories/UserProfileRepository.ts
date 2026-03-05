import { getDatabase } from '../database';
import { UserProfile } from '../../types';

const DEFAULT_PROFILE: Omit<UserProfile, 'id'> = {
  max_hr: 185,
  resting_hr: 55,
  hr_threshold: 165,
};

export class SQLiteUserProfileRepository {

  async get(): Promise<UserProfile> {
    const db = await getDatabase();
    const profile = await db.getFirstAsync<UserProfile>(
      `SELECT * FROM user_profile LIMIT 1`
    );
    if (!profile) {
      return await this.save(DEFAULT_PROFILE);
    }
    return profile;
  }

  async save(profile: Omit<UserProfile, 'id'>): Promise<UserProfile> {
    const db = await getDatabase();
    // 只保留一条用户档案记录
    await db.runAsync(`DELETE FROM user_profile`);
    const result = await db.runAsync(
      `INSERT INTO user_profile (max_hr, resting_hr, hr_threshold, birth_year)
       VALUES (?, ?, ?, ?)`,
      [profile.max_hr, profile.resting_hr, profile.hr_threshold, profile.birth_year ?? null]
    );
    return { ...profile, id: result.lastInsertRowId };
  }

  async update(patch: Partial<Omit<UserProfile, 'id'>>): Promise<UserProfile> {
    const current = await this.get();
    return await this.save({ ...current, ...patch });
  }
}

export const userProfileRepo = new SQLiteUserProfileRepository();
