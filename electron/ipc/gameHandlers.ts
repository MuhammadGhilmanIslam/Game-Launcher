import { ipcMain, BrowserWindow } from 'electron';
import * as queries from '../db/queries';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Track game yang sedang berjalan
const runningProcesses = new Map<string, { process: ChildProcess; startTime: number }>();

export function registerGameHandlers(): void {
  ipcMain.handle('games:getAll', () => {
    try {
      return queries.getAllGames();
    } catch (err: any) {
      throw new Error(`Gagal mengambil daftar game: ${err.message}`);
    }
  });

  ipcMain.handle('games:add', (_, data) => {
    try {
      return queries.addGame(data);
    } catch (err: any) {
      throw new Error(`Gagal menambahkan game: ${err.message}`);
    }
  });

  ipcMain.handle('games:update', (_, id: string, patch: any) => {
    try {
      return queries.updateGame(id, patch);
    } catch (err: any) {
      throw new Error(`Gagal mengupdate game: ${err.message}`);
    }
  });

  ipcMain.handle('games:delete', (_, id: string) => {
    try {
      return queries.deleteGame(id);
    } catch (err: any) {
      throw new Error(`Gagal menghapus game: ${err.message}`);
    }
  });

  ipcMain.handle('sessions:record', (_, data: { gameId: string; durationMin: number }) => {
    try {
      return queries.recordSession(data.gameId, data.durationMin);
    } catch (err: any) {
      throw new Error(`Gagal merekam sesi bermain: ${err.message}`);
    }
  });

  ipcMain.handle('games:launch', async (_, gameId: string) => {
    try {
      // 1. Ambil data game dari SQLite
      const game = queries.getGameById(gameId);
      if (!game) throw new Error('Game tidak ditemukan di database');

      // 2. Validasi file exists
      if (!fs.existsSync(game.exePath)) {
        throw new Error(`File tidak ditemukan: ${game.exePath}`);
      }

      // 3. Cek apakah sudah berjalan
      if (runningProcesses.has(gameId)) {
        throw new Error('Game sudah sedang berjalan');
      }

      // 4. Spawn proses game
      const child = spawn(game.exePath, [], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(game.exePath), // Set working directory ke folder game
      });
      child.unref(); // Penting: jangan blok Electron saat game berjalan

      // 5. Track dan update DB
      runningProcesses.set(gameId, { process: child, startTime: Date.now() });
      queries.updateGame(gameId, { lastPlayed: new Date().toISOString() });

      // 6. Beritahu renderer
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('game:launched', gameId);

      // 7. Monitor saat game ditutup
      child.on('close', () => {
        const entry = runningProcesses.get(gameId);
        if (entry) {
          const durationMin = Math.round((Date.now() - entry.startTime) / 60000);
          runningProcesses.delete(gameId);
          
          // Simpan sesi bermain ke DB
          queries.recordSession(gameId, durationMin);
          
          // Beritahu renderer
          win?.webContents.send('game:closed', { gameId, durationMin });
        }
      });

      child.on('error', (err) => {
        runningProcesses.delete(gameId);
        win?.webContents.send('game:error', { gameId, error: err.message });
      });

      return { success: true, gameId };
    } catch (err: any) {
      throw new Error(`Gagal launch game: ${err.message}`);
    }
  });
}
