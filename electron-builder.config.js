module.exports = {
  appId: 'com.ghilman.arcvault',
  productName: 'ArcVault',
  copyright: 'Copyright © 2025 Ghilman',

  directories: {
    output: 'release',
    buildResources: 'assets',
  },

  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'node_modules/better-sqlite3/**/*',
  ],

  // Windows installer
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    requestedExecutionLevel: 'asInvoker',
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowDirectoryChange: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'ArcVault',
  },

  // Auto-update via GitHub Releases
  publish: {
    provider: 'github',
    owner: 'ghilman', // Dummy placeholder unless specified
    repo: 'arcvault',
    releaseType: 'release',
  },

  // PENTING: include native module better-sqlite3
  extraResources: [
    {
      from: 'node_modules/better-sqlite3/build/Release',
      to: 'better-sqlite3',
    }
  ],
};
