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
      rpe             INTEGER,
      vdot            REAL,
      cadence         INTEGER
    );

    -- 比赛备赛表
    CREATE TABLE IF NOT EXISTS race_plan (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      race_date       TEXT NOT NULL,
      target_time_sec INTEGER NOT NULL,
      target_pace     REAL NOT NULL,
      plan_content    TEXT NOT NULL DEFAULT '',
      created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    -- 用户档案表
    CREATE TABLE IF NOT EXISTS user_profile (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      max_hr          INTEGER NOT NULL DEFAULT 185,
      resting_hr      INTEGER NOT NULL DEFAULT 55,
      hr_threshold    INTEGER NOT NULL DEFAULT 165,
      birth_year      INTEGER,
      running_start_year INTEGER,
      weekly_km       REAL NOT NULL DEFAULT 30
    );

    -- 训练计划表
    CREATE TABLE IF NOT EXISTS training_plan (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      race_date       TEXT NOT NULL,
      vdot            REAL NOT NULL,
      weekly_peak_km  REAL NOT NULL,
      plan_json       TEXT NOT NULL DEFAULT '{}',
      created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    -- schema 版本表（用于未来迁移）
    CREATE TABLE IF NOT EXISTS schema_version (
      version         INTEGER PRIMARY KEY,
      applied_at      TEXT NOT NULL
    );

    INSERT OR IGNORE INTO schema_version (version, applied_at)
    VALUES (1, datetime('now'));
  `);

  // 增量迁移：v2 新增列
  await migrateV2(db);
  // 增量迁移：v3 新增 running_start_year
  await migrateV3(db);
  // 增量迁移：v4 新增 challenges 表
  await migrateV4(db);
}

async function migrateV2(db: SQLite.SQLiteDatabase): Promise<void> {
  // 检查 version 2 是否已应用
  const v2 = await db.getFirstAsync<{ version: number }>(
    `SELECT version FROM schema_version WHERE version = 2`
  );
  if (v2) return;

  // 安全地添加列（SQLite 不支持 IF NOT EXISTS 语法，用 try-catch）
  const addColumnSafe = async (table: string, col: string, type: string) => {
    try {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    } catch {
      // 列已存在，忽略
    }
  };

  await addColumnSafe('run_records', 'vdot', 'REAL');
  await addColumnSafe('run_records', 'cadence', 'INTEGER');
  await addColumnSafe('user_profile', 'weekly_km', 'REAL NOT NULL DEFAULT 30');

  // 创建训练计划表（如果不存在）
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS training_plan (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      race_date       TEXT NOT NULL,
      vdot            REAL NOT NULL,
      weekly_peak_km  REAL NOT NULL,
      plan_json       TEXT NOT NULL DEFAULT '{}',
      created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
  `);

  await db.execAsync(
    `INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (2, datetime('now'))`
  );
}

async function migrateV3(db: SQLite.SQLiteDatabase): Promise<void> {
  const v3 = await db.getFirstAsync<{ version: number }>(
    `SELECT version FROM schema_version WHERE version = 3`
  );
  if (v3) return;

  const addColumnSafe = async (table: string, col: string, type: string) => {
    try {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    } catch {
      // 列已存在，忽略
    }
  };

  await addColumnSafe('user_profile', 'running_start_year', 'INTEGER');

  await db.execAsync(
    `INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (3, datetime('now'))`
  );
}

async function migrateV4(db: SQLite.SQLiteDatabase): Promise<void> {
  const v4 = await db.getFirstAsync<{ version: number }>(
    `SELECT version FROM schema_version WHERE version = 4`
  );
  if (v4) return;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS challenges (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT NOT NULL,
      target_km       REAL NOT NULL,
      target_pace_sec INTEGER NOT NULL,
      created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      achieved        INTEGER NOT NULL DEFAULT 0,
      achieved_date   TEXT
    );
  `);

  await db.execAsync(
    `INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (4, datetime('now'))`
  );
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
