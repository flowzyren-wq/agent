# OpenCode Desktop - Audit Report

## Tujuan Audit
Memahami arsitektur OpenCode Desktop asli untuk menentukan pendekatan paling masuk akal agar bisa dipakai di HP Android dan iOS tanpa mengubah UI, menu, fitur, dan behavior aslinya.

## Sumber
- Repository resmi: https://github.com/sst/opencode (commit latest Sept 2026)
- Package yang diaudit: `packages/desktop`, `packages/app`, `packages/ui`, `packages/opencode`, `packages/tui`, `packages/sdk`

## 1. Arsitektur Umum

OpenCode adalah monorepo Bun + Turbo.

```
packages/
  opencode/     -> Core server, CLI, AI provider integration, tool execution, session management
  app/          -> Shared Web UI (SolidJS + Vite) - INI UI ASLI DESKTOP
  desktop/      -> Electron wrapper untuk app (electron-vite)
  ui/           -> Component library
  tui/          -> Terminal UI (OpenTUI)
  sdk/          -> Client SDK
  server/       -> Server logic
```

### Client-Server Architecture
- Backend: `packages/opencode` menjalankan server (default port 4096) yang handle AI, session, file, terminal PTY, LSP, dll.
- Frontend: `packages/app` adalah SolidJS app yang komunikasi via WebSocket + HTTP ke backend.
- Desktop: `packages/desktop` adalah Electron yang start backend di background dan load `packages/app` UI sebagai renderer.

**Kesimpulan penting:** UI Desktop asli = Web UI (SolidJS). Electron hanya wrapper. Ini berarti UI asli sudah web-based dan bisa dijalankan di browser tanpa Electron.

## 2. Teknologi UI

- **Framework:** SolidJS (bukan React), dengan @solidjs/router
- **Build:** Vite + electron-vite
- **Styling:** TailwindCSS + custom theme system
- **Editor:** ContentEditable div custom (bukan Monaco) - di `prompt-input.tsx`, dengan handling cursor manual. Mobile-friendly secara teori karena contenteditable.
- **Terminal:** `ghostty-web` (WASM terminal) + xterm-like. Menggunakan textarea hidden untuk input, jadi bisa support virtual keyboard.
- **File Tree:** Custom component dengan virtual scroll (@tanstack/solid-virtual)
- **State:** TanStack Query + Solid signals
- **PWA Support:** Sudah ada di `packages/app/index.html`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content, viewport-fit=cover">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  ```
  Jadi sudah ada niat mobile, tapi belum dioptimalkan untuk penggunaan real.

## 3. Frontend, Backend, Editor, Terminal

### Frontend (packages/app/src)
- `app.tsx`: Root dengan routing, ServerProvider, SDKProvider, dll.
- `pages/`: home, session, new-session, layout
- `components/`: 
  - prompt-input (editor utama chat)
  - terminal.tsx (ghostty-web)
  - file-tree, dialog-*, titlebar, session-*
  - command-palette, settings, model selection

### Backend (packages/opencode/src)
- `server/`: HTTP + WebSocket server
- `session/`: session management
- `tool/`: file edit, bash, etc.
- `provider/`: 75+ AI providers
- `project/`: git-based project detection

### Editor
- Bukan Monaco, tapi contenteditable dengan pill/mention support
- File editing via tool `edit` yang dipanggil AI, bukan editor manual full IDE. Tapi ada inline editor di layout.

### Terminal
- `ghostty-web` WASM, PTY via node-pty di Electron, via WebSocket di web
- Sudah handle copy/paste, link click, focus

### Dependency Kunci
- `solid-js`, `vite`, `tailwindcss`, `ghostty-web`, `effect`, `drizzle-orm`, `electron`, `@tanstack/solid-query`

## 4. Desktop Wrapper (packages/desktop)
- `electron.vite.config.ts`: build main, preload, renderer
- `src/main/`: background-cli.ts (start opencode service), windows.ts, menu.ts, ipc.ts
- `src/renderer/`: hanya load `packages/app` UI, plus theme preload, zoom handling, fullscreen
- Tidak ada logic UI sendiri, semua dari `packages/app`

## 5. Analisis Kompatibilitas Mobile

### Yang Sudah Mobile-Friendly
- Viewport meta sudah ada dengan `interactive-widget=resizes-content` (penting untuk virtual keyboard Android/iOS)
- Layout menggunakan flex + dvh (dynamic viewport height)
- PWA manifest sudah ada
- Editor contenteditable seharusnya work dengan virtual keyboard
- Terminal ghostty-web pakai textarea hidden, bisa trigger keyboard

### Yang Perlu Adaptasi untuk HP
1. **Touch Input:** Sidebar, file tree, tabs butuh touch scrolling momentum, bukan hanya mouse wheel
2. **Context Menu:** Right-click tidak ada di HP, perlu long-press
3. **Hover States:** Banyak UI pakai hover, perlu fallback touch
4. **Small Screen:** Layout 3-column (sidebar + chat + right panel) terlalu lebar untuk HP. Perlu cara akses tanpa ubah UI: floating toggle buttons yang trigger existing state
5. **Virtual Keyboard:** Prompt input harus stay visible saat keyboard muncul, terminal height harus adjust
6. **Dropdown/Dialog:** Harus fit viewport, tidak overflow
7. **Selection & Focus:** Contenteditable dan terminal butuh handling focus yang benar di iOS (iOS punya quirks dengan focus)
8. **Fullscreen:** Perlu support fullscreen API untuk maksimalkan layar HP
9. **Orientation:** Handle rotate, ensure scroll position terjaga

### Yang TIDAK Boleh Dilakukan (sesuai brief)
- Jangan bikin UI native Android/iOS
- Jangan bikin frontend mobile terpisah yang meniru
- Jangan hapus/sederhanakan fitur desktop
- Jangan mock backend

## 6. Pendekatan yang Dipilih

**Pendekatan: Browser-based Remote Access + Mobile Compatibility Layer (tanpa rewrite UI)**

Alasan:
- UI asli sudah web-based (SolidJS), jadi paling natural dijalankan di browser HP
- Electron hanya wrapper, core tetap web UI + server
- Tidak perlu compatibility layer berat seperti emulasi Electron di Android
- Tidak perlu rewrite component, hanya tambah layer adaptasi touch
- Backend tetap asli (opencode server), tidak mock
- Bisa PWA install di Android/iOS, jadi terasa seperti app

Implementasi:
1. **Server Gateway:** Node.js server yang proxy ke opencode server (port 4096) dan serve UI asli + inject mobile bridge
2. **Mobile Bridge:** JS + CSS kecil yang di-inject ke UI asli, tanpa ubah source asli:
   - Touch adapter (scroll, long-press, tap)
   - Viewport manager (keyboard, orientation, fullscreen)
   - Floating toolbar (trigger existing shortcuts: toggle sidebar, command palette, etc.)
3. **PWA:** Manifest + service worker agar bisa di-install di Android/iOS home screen
4. **Preservasi UI:** UI asli 100% dipertahankan, hanya ditambah layer interaksi

Alternatif yang dipertimbangkan tapi ditolak:
- **Capacitor/Cordova wrapper:** Tetap butuh webview, lebih kompleks, tapi intinya sama dengan PWA. PWA lebih universal.
- **Tauri mobile:** Butuh rewrite build chain, tidak reuse Electron.
- **VNC/Remote Desktop:** Terlalu berat, latency tinggi, bukan native web.
- **React Native WebView:** Hanya wrapper browser, tidak ada value tambah vs PWA + proxy.

## 7. Risiko & Mitigasi

- **iOS Safari quirks:** Focus pada contenteditable kadang tidak trigger keyboard. Mitigasi: explicit focus + scrollIntoView.
- **Terminal di HP:** Ghostty-web butuh keyboard, tapi virtual keyboard HP tidak punya Esc, Ctrl, dll. Mitigasi: floating toolbar dengan tombol Esc, Ctrl, Tab, arrows.
- **File Tree di layar kecil:** Tetap bisa scroll horizontal, tapi tambah swipe gesture untuk toggle sidebar.
- **Performance:** WASM terminal + SolidJS di HP low-end bisa berat. Mitigasi: keep original, tapi tambah option untuk reduce motion.

## 8. Kesimpulan Audit

OpenCode Desktop asli sangat memungkinkan untuk dipakai di HP karena:
- UI-nya web-based (SolidJS) bukan native Electron drawing
- Sudah ada viewport mobile meta
- Backend terpisah (client-server) jadi bisa remote access
- Editor dan terminal menggunakan web standards yang support mobile

Yang dibutuhkan hanya compatibility layer tipis untuk touch, keyboard, dan viewport, bukan rewrite.

**Next Step:** Implementasi gateway server + mobile bridge yang preserve 100% UI asli.
