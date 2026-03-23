import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { initDatabase } from './db/database';
import { registerGameHandlers } from './ipc/gameHandlers';
import { registerSystemHandlers } from './ipc/systemHandlers';
import { setupAutoUpdater } from './updater';

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

  // Load the app
  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
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
  initDatabase();
  registerGameHandlers();
  registerSystemHandlers();
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
