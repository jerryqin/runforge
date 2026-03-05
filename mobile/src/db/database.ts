import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('runforge.db');
  await initSchema(db);
  return db;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- 跑步记录表
    CREATE TABLE IF NOT EXISTS run_records (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      create_time     INTEGER NOT NULL,
      run_date        TEXT NOT NULL,
      distance        REAL NOT NULL,
      duration_sec    INTEGER NOT NULL,
      avg_pace        REAL NOT NULL,
      avg_hr          INTEGER NOT NULL,
      intensity       INTEGER NOT NULL,
      conclusion      TEXT NOT NULL DEFAULT '',
      suggest         TEXT NOT NULL DEFAULT '',
      risk            TEXT NOT NULL DEFAULT '',
      tss             REAL,
      elevation_gain  REAL,
      temperature     INTEGER,
      rpe             INTEGER
    );

    -- 比赛备赛表
    CREATE TABLE IF NOT EXISTS race_plan (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      race_date       TEXT NOT NULL,
      target_time_sec INTEGER NOT NULL,
      target_pace     REAL NOT NULL,
      plan_content    TEXT NOT NULL DEFAULT ''
    );

    -- 用户档案表
    CREATE TABLE IF NOT EXISTS user_profile (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      max_hr          INTEGER NOT NULL DEFAULT 185,
      resting_hr      INTEGER NOT NULL DEFAULT 55,
      hr_threshold    INTEGER NOT NULL DEFAULT 165,
      birth_year      INTEGER
    );

    -- schema 版本表（用于未来迁移）
    CREATE TABLE IF NOT EXISTS schema_version (
      version         INTEGER PRIMARY KEY,
      applied_at      TEXT NOT NULL
    );

    INSERT OR IGNORE INTO schema_version (version, applied_at)
    VALUES (1, datetime('now'));
  `);
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
