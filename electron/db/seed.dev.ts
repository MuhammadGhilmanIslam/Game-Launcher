import Database from 'better-sqlite3';

const SEED_GAMES = [
  {
    id: 'g1', name: 'Elden Ring', developer: 'FromSoftware', genre: 'Action RPG',
    release_year: 2022,
    description: 'Open world action RPG epik di The Lands Between. Desain dunia terbuka yang seamlessly menyatu dengan gameplay brutal khas FromSoftware.',
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg',
    bg_url: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/scre5ci1.jpg',
    exe_path: 'C:\\Games\\EldenRing\\eldenring.exe',
    last_played: new Date(Date.now() - 7200000).toISOString(),
    total_minutes: 8520, is_favorite: 1,
  },
  {
    id: 'g2', name: 'Cyberpunk 2077', developer: 'CD Projekt Red', genre: 'RPG',
    release_year: 2020,
    description: 'Open world RPG futuristik di Night City. Jadi V, mercenary yang terperangkap dalam konspirasi digital yang mengancam jiwanya.',
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4hna.jpg',
    bg_url: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/u9bopxhf9rjx6ccs5yk0.jpg',
    exe_path: 'C:\\Games\\Cyberpunk2077\\Cyberpunk2077.exe',
    last_played: new Date(Date.now() - 86400000).toISOString(),
    total_minutes: 5220, is_favorite: 0,
  },
  {
    id: 'g3', name: 'Hollow Knight', developer: 'Team Cherry', genre: 'Metroidvania',
    release_year: 2017,
    description: 'Metroidvania 2D dengan atmosfer gelap yang indah. Jelajahi kerajaan serangga bawah tanah yang luas dengan gameplay presisi tinggi.',
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1rgi.jpg',
    bg_url: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc58rs.jpg',
    exe_path: 'C:\\Games\\HollowKnight\\hollow_knight.exe',
    last_played: new Date(Date.now() - 3 * 86400000).toISOString(),
    total_minutes: 3360, is_favorite: 1,
  },
  {
    id: 'g4', name: "Baldur's Gate 3", developer: 'Larian Studios', genre: 'RPG',
    release_year: 2023,
    description: 'RPG turn-based terbaik dekade ini. 100+ jam konten dengan pilihan moral kompleks dan konsekuensi nyata di setiap keputusan.',
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co5f46.jpg',
    bg_url: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/sck7ue.jpg',
    exe_path: 'C:\\Games\\BaldursGate3\\bg3.exe',
    last_played: new Date(Date.now() - 7 * 86400000).toISOString(),
    total_minutes: 12600, is_favorite: 0,
  },
  {
    id: 'g5', name: 'Hades', developer: 'Supergiant Games', genre: 'Roguelike',
    release_year: 2020,
    description: 'Roguelike action dengan narasi yang berkembang tiap run. Lolos dari underworld dengan bantuan para dewa Olympus dalam gameplay adiktif.',
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2uro.jpg',
    bg_url: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc6cew.jpg',
    exe_path: 'C:\\Games\\Hades\\Hades.exe',
    last_played: new Date(Date.now() - 14 * 86400000).toISOString(),
    total_minutes: 5640, is_favorite: 0,
  },
  {
    id: 'g6', name: 'Civilization VI', developer: 'Firaxis Games', genre: 'Strategy',
    release_year: 2016,
    description: '4X strategy legendaris. Bangun peradaban dari zaman batu hingga era luar angkasa. One more turn syndrome dijamin menyerang.',
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4fgr.jpg',
    bg_url: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/g1cbuwlkzjqbviqoaacp.jpg',
    exe_path: 'C:\\Games\\CivilizationVI\\CivVI.exe',
    last_played: new Date(Date.now() - 21 * 86400000).toISOString(),
    total_minutes: 19200, is_favorite: 0,
  },
];

/**
 * Insert seed data only if the games table is empty.
 * Only runs in dev mode (!app.isPackaged).
 */
export function seedIfEmpty(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as c FROM games').get() as { c: number };
  if (count.c > 0) return;

  console.log('[ArcVault] Dev mode: seeding database with sample games...');

  const insert = db.prepare(`
    INSERT INTO games (id, name, exe_path, developer, genre, description, cover_url, bg_url, release_year, added_at, last_played, total_minutes, is_favorite)
    VALUES (@id, @name, @exe_path, @developer, @genre, @description, @cover_url, @bg_url, @release_year, datetime('now'), @last_played, @total_minutes, @is_favorite)
  `);

  const insertMany = db.transaction((games: typeof SEED_GAMES) => {
    for (const game of games) {
      insert.run(game);
    }
  });

  insertMany(SEED_GAMES);
  console.log(`[ArcVault] Seeded ${SEED_GAMES.length} games.`);
}
