import { getDb } from './database';
import * as crypto from 'crypto';

// ── Types ──
export interface Game {
  id: string;
  name: string;
  exePath: string;
  developer?: string;
  genre?: string;
  description?: string;
  coverUrl?: string;
  bgUrl?: string;
  year?: number;
  addedAt: string;
  lastPlayed?: string;
  totalMinutes: number;
  isFavorite: boolean;
}

// ── Row converter: snake_case DB → camelCase JS ──
function rowToGame(row: any): Game {
  return {
    id: row.id,
    name: row.name,
    exePath: row.exe_path,
    developer: row.developer,
    genre: row.genre,
    description: row.description,
    coverUrl: row.cover_url,
    bgUrl: row.bg_url,
    year: row.release_year,
    addedAt: row.added_at,
    lastPlayed: row.last_played,
    totalMinutes: row.total_minutes || 0,
    isFavorite: row.is_favorite === 1,
  };
}

// ── Whitelist: camelCase → snake_case mapping ──
const ALLOWED_FIELDS: Record<string, string> = {
  name:         'name',
  exePath:      'exe_path',
  developer:    'developer',
  genre:        'genre',
  description:  'description',
  coverUrl:     'cover_url',
  bgUrl:        'bg_url',
  year:         'release_year',
  lastPlayed:   'last_played',
  totalMinutes: 'total_minutes',
  isFavorite:   'is_favorite',
};

// ── Query functions ──

export function getAllGames(): Game[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM games ORDER BY last_played DESC NULLS LAST'
  ).all();
  return rows.map(rowToGame);
}

export function getGameById(id: string): Game | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  return row ? rowToGame(row) : null;
}

export function addGame(data: Omit<Game, 'id' | 'addedAt' | 'totalMinutes' | 'isFavorite'>): Game {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO games (id, name, exe_path, developer, genre, description, cover_url, bg_url, release_year, added_at, last_played, total_minutes, is_favorite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0)
  `).run(
    id,
    data.name,
    data.exePath,
    data.developer || null,
    data.genre || null,
    data.description || null,
    data.coverUrl || null,
    data.bgUrl || null,
    data.year || null,
    now,
  );

  return getGameById(id)!;
}

export function updateGame(id: string, patch: Partial<Game>): Game {
  const db = getDb();

  const validKeys = Object.keys(patch).filter(k => k in ALLOWED_FIELDS);
  if (validKeys.length === 0) {
    throw new Error('Tidak ada field valid untuk diupdate');
  }

  const setClauses = validKeys.map(k => `${ALLOWED_FIELDS[k]} = ?`);
  const values = validKeys.map(k => {
    if (k === 'isFavorite') return (patch as any)[k] ? 1 : 0;
    return (patch as any)[k];
  });

  db.prepare(`UPDATE games SET ${setClauses.join(', ')} WHERE id = ?`)
    .run(...values, id);

  const updated = getGameById(id);
  if (!updated) throw new Error(`Game dengan id ${id} tidak ditemukan`);
  return updated;
}

export function deleteGame(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM games WHERE id = ?').run(id);
}

export function recordSession(gameId: string, durationMin: number): void {
  const db = getDb();
  const now = new Date().toISOString();

  const insertAndUpdate = db.transaction(() => {
    db.prepare(`
      INSERT INTO play_sessions (game_id, started_at, ended_at, duration_min)
      VALUES (?, datetime('now', '-' || ? || ' minutes'), ?, ?)
    `).run(gameId, durationMin, now, durationMin);

    db.prepare(
      'UPDATE games SET total_minutes = total_minutes + ? WHERE id = ?'
    ).run(durationMin, gameId);
  });

  insertAndUpdate();
}
