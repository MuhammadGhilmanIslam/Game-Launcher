import { ipcMain, dialog } from 'electron';

export function registerSystemHandlers() {
  ipcMain.handle('system:browsePath', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Pilih file executable game',
      properties: ['openFile'],
      filters: [
        { name: 'Game Executable', extensions: ['exe', 'lnk', 'bat', 'cmd'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return result; // { canceled: boolean, filePaths: string[] }
  });
}
