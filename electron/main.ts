import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { app, BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';
import { initDatabase } from './db/database';
import { registerGameHandlers } from './ipc/gameHandlers';
import { registerSystemHandlers } from './ipc/systemHandlers';
import { setupAutoUpdater } from './updater';
import { registerAIHandlers } from './ipc/aiHandlers';

// ── Store for persisting window bounds ──
const store = new Store<{ windowBounds: Electron.Rectangle }>();

// ── Determine dev vs prod ──
const isDev = !app.isPackaged;

function createWindow(): BrowserWindow {
  // Restore previous window bounds if available
  const savedBounds = store.get('windowBounds');

  const win = new BrowserWindow({
    width: savedBounds?.width ?? 1280,
    height: savedBounds?.height ?? 720,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 960,
    minHeight: 600,
    frame: false,               // Custom titlebar — frameless window
    backgroundColor: '#07070d', // Match ArcVault dark theme
    show: false,                // Prevent white flash
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Show window once fully rendered (prevent white flash)
  win.once('ready-to-show', () => {
    win.show();
  });
  console.log('resourcesPath:', process.resourcesPath);
  console.log('__dirname:', __dirname);
  console.log('isPackaged:', app.isPackaged);

  // Load the app
  if (app.isPackaged) {
    win.loadFile(path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html'));
  } else {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools({ mode: 'detach' }); // Turn off devtools
  }


  // ── Save window bounds on move/resize ──
  const saveBounds = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      store.set('windowBounds', win.getBounds());
    }
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  // ── Emit Maximize state changes to Renderer ──
  win.on('maximize', () => win.webContents.send('window:maximize-change', true));
  win.on('unmaximize', () => win.webContents.send('window:maximize-change', false));

  return win;
}

// ── IPC: Window Controls ──
ipcMain.handle('window:minimize', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.minimize();
});

ipcMain.handle('window:maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.handle('window:close', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.close();
});

// ── App Lifecycle ──
app.whenReady().then(() => {
  dotenv.config({ path: path.join(__dirname, '../.env') });
  initDatabase();
  registerGameHandlers();
  registerSystemHandlers();
  registerAIHandlers();
  const win = createWindow();
  setupAutoUpdater(win);

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
