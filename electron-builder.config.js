module.exports = {
  appId: 'com.ghilman.arcvault',
  productName: 'ArcVault',

  directories: {
    output: 'release',           // Output must be "release" so it doesn't wipe vite's "dist"
    buildResources: 'assets',
  },

  files: [
    '.env',                   // ← Sertakan file env ke dalam aplikasi (jangan di github)
    'dist/**/*',              // ← React build output
    'dist-electron/**/*',     // ← Electron main process
  ],

  extraResources: [
    {
      from: 'node_modules/better-sqlite3/build/Release/',
      to: 'better-sqlite3/',
    }
  ],

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
  },
}
