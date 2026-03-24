import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // ── Game CRUD ──
  getGames:          ()             => ipcRenderer.invoke('games:getAll'),
  addGame:           (data: any)    => ipcRenderer.invoke('games:add', data),
  updateGame:        (id: string, patch: any) => ipcRenderer.invoke('games:update', id, patch),
  deleteGame:        (id: string)   => ipcRenderer.invoke('games:delete', id),

  // ── Game Actions ──
  launchGame:        (id: string)   => ipcRenderer.invoke('games:launch', id),
  browsePath:        ()             => ipcRenderer.invoke('system:browsePath'),
  recordPlaySession: (data: any)    => ipcRenderer.invoke('sessions:record', data),

  // ── Window Controls ──
  minimizeWindow:    ()             => ipcRenderer.invoke('window:minimize'),
  maximizeWindow:    ()             => ipcRenderer.invoke('window:maximize'),
  closeWindow:       ()             => ipcRenderer.invoke('window:close'),

  // ── Event Listeners (with cleanup) ──
  onGameLaunched: (cb: (...args: any[]) => void) => {
    ipcRenderer.on('game:launched', cb);
    return () => ipcRenderer.removeListener('game:launched', cb);
  },
  onGameClosed: (cb: (...args: any[]) => void) => {
    ipcRenderer.on('game:closed', cb);
    return () => ipcRenderer.removeListener('game:closed', cb);
  },
  onMaximizeChange: (cb: (event: any, isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximize-change', cb);
    return () => ipcRenderer.removeListener('window:maximize-change', cb);
  },
  
  // ── Auto Updates ──
  onUpdateAvailable: (cb: (event: any, info: any) => void) => {
    ipcRenderer.on('update:available', cb);
    return () => ipcRenderer.removeListener('update:available', cb);
  },
  onUpdateDownloaded: (cb: (event: any, info: any) => void) => {
    ipcRenderer.on('update:downloaded', cb);
    return () => ipcRenderer.removeListener('update:downloaded', cb);
  },
  installUpdate: () => ipcRenderer.invoke('update:install'),

  // ── AI ──
  getMetadata:       (name: string)    => ipcRenderer.invoke('ai:getMetadata', name),
  getRecommendation: (summary: string) => ipcRenderer.invoke('ai:getRecommendation', summary),
});
