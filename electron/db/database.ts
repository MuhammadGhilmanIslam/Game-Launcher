import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';

let db: Database.Database;

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'arcvault.db');
  db = new Database(dbPath);

  // ── Performance & safety pragmas ──
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  // ── Migrations ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      exe_path        TEXT NOT NULL,
      developer       TEXT,
      genre           TEXT,
      description     TEXT,
      cover_url       TEXT,
      bg_url          TEXT,
      release_year    INTEGER,
      added_at        TEXT DEFAULT (datetime('now')),
      last_played     TEXT,
      total_minutes   INTEGER DEFAULT 0,
      is_favorite     INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS play_sessions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id         TEXT REFERENCES games(id) ON DELETE CASCADE,
      started_at      TEXT NOT NULL,
      ended_at        TEXT,
      duration_min    INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_games_last_played ON games(last_played DESC);
  `);

  // ── Dev seed ──
  if (!app.isPackaged) {
    const { seedIfEmpty } = require('./seed.dev');
    seedIfEmpty(db);
  }
}

export function getDb(): Database.Database {
  return db;
}
