<div align="center">
  <h1>🎮 ArcVault Game Launcher</h1>
  <p><strong>PS5-Inspired Beautiful Desktop Game Library & Launcher</strong></p>

  <p>
    React • Vite • Electron • SQLite • Frameless Window
  </p>
</div>

<br />

## ⚡ Overview

ArcVault is a premium, lightweight, and modern UI game launcher built entirely with Web Technologies & Electron. Heavily inspired by the sleek aesthetics of modern console interfaces (like the PlayStation 5 UI), it serves as a central hub to elegantly categorize your locally installed PC games. 

With deep OS integration via Electron's Main Process and Node.js child processes, it natively boots `.exe` files, actively listens to their lifecycle, and securely persists data onto a local SQLite database without cloud dependencies.

## ✨ Features

- 🖥️ **Frameless Custom UI**: Completely custom window controls with smooth, interactive drag handles.
- ⏱️ **Playtime Tracking Engine**: Natively listens to game `.exe` closures to calculate session durations down to the minute.
- 🎮 **Native Gamepad Support**: Plug-and-play Joystick API polling. Supports D-pad & Analog stick directional grid navigation and Dual-Rumble Haptic feedback.
- 🗄️ **Zero-Latency SQLite Backend**: All metadata (Titles, Posters, Favorites, Playtimes) are locally indexed using Native `better-sqlite3` bindings for split-second queries.
- 📦 **OTA Auto-Updates**: Seamless GitHub Release fetching and update-banner rendering using `electron-updater`.
- 🔍 **Realtime Search & Filtering**: Client-side filtering allowing players to instantly seek and Favorite games via quick 'Control+F' keyboard shortcuts or Gamepad triggers.

## 🛠️ Stack & Architecture

This application strictly separates the renderer from the core OS runtime.

- **Frontend Interface**: React 18, Vite. Responsive CSS variables and custom Web Fonts (`Poppins`/`Inter`/`Orbitron`).
- **Backend / OS layer**: Electron, IPC Context Bridges, `child_process.spawn`.
- **Database Architecture**: `better-sqlite3`, Node Native Bindings.
- **Distribution**: `electron-builder` generating Windows NSIS `.exe` standalone installers.

## 🚀 Quick Start

### Prerequisites
Make sure you have Node.js and a C++ Build Environment installed on your OS (Required for `better-sqlite3` native rebuilds). Python & Visual Studio Build Tools are recommended.

```bash
# Clone repository
git clone https://github.com/USERNAME/arcvault.git

# Navigate to working directory
cd arcvault

# Install dependencies (Automated post-install will rebuild native SQLite bindings)
npm install
```

### Development Environment
```bash
# Start concurrently running the Vite Dev Server and the Electron Main Runtime
npm run dev
```

### Build & Package (Production)
```bash
# Run the complete packaging pipeline: Compiles TypeScript -> Rebuilds SQLite Native binaries -> Packages via NSIS into an executable
npm run build
```
Once complete, you can find the `ArcVault Setup X.X.X.exe` inside the `/release` folder.

## 🕹️ Gamepad Mappings (Xbox / PlayStation)
- **Arrows / Left Analog Stick**: Select Games
- **A / Cross**: Launch highlighted Game
- **X / Square**: Favorite / Unfavorite Highlighted Game
- **Start / Options**: Open Global Search
- **B / Circle**: Close Modals

<br/>

---
**Disclaimer**: This project was built for educational & portfolio purposes. Cover art capabilities and exact aesthetic implementations are credited to their respective open source originators.
