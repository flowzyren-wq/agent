# OpenCode Desktop - Mobile Gateway

> Membuat OpenCode Desktop asli bisa dipakai di HP Android dan iOS. **UI, menu, fitur, dan behavior tetap menggunakan OpenCode Desktop asli.**

Bukan aplikasi AI coding baru, bukan UI tiruan, bukan versi mobile yang kehilangan fitur desktop. Ini adalah **OpenCode Desktop yang asli**, dengan compatibility layer agar bisa digunakan di HP.

## 🎯 Tujuan

```json
{
  "project": "Original OpenCode Desktop",
  "goal": "Make the original desktop application usable on Android and iOS",
  "preserve_original_ui": true,
  "preserve_original_features": true,
  "preserve_original_backend": true,
  "native_mobile_ui": false,
  "separate_mobile_frontend": false,
  "mock_functionality": false
}
```

## 📋 Audit

Audit lengkap di [docs/AUDIT.md](docs/AUDIT.md). Ringkasan:

- **OpenCode Desktop** = Electron wrapper untuk web UI (`packages/app` SolidJS) + backend server (`packages/opencode` port 4096)
- UI aslinya **sudah web-based**, jadi bisa dijalankan di browser HP tanpa rewrite
- Sudah ada viewport meta mobile (`interactive-widget=resizes-content`, `viewport-fit=cover`, PWA manifest)
- Editor = contenteditable custom, Terminal = ghostty-web WASM, keduanya bisa work di mobile dengan adaptasi
- Yang dibutuhkan hanya touch, keyboard, viewport handling, bukan rewrite

## 🏗️ Pendekatan

**Browser-based Remote Access + Mobile Compatibility Layer**

- **Gateway Server** (Node.js, port 3000) proxy ke opencode server (4096) dan inject mobile bridge
- **Mobile Bridge** (JS+CSS) di-inject ke UI asli, tanpa ubah source asli:
  - `viewport.js`: virtual keyboard, orientation, safe-area, fullscreen, iOS/Android detection
  - `touch-adapter.js`: touch scrolling momentum, long-press context menu, swipe gestures, focus
  - `toolbar.js`: floating toolbar yang trigger action asli (sidebar toggle, command palette Ctrl+K, terminal Ctrl+`, Esc, Tab)
  - `styles.css`: touch-action, -webkit-overflow-scrolling, DVH/SVH, safe-area-insets, dialog fit viewport
- **PWA**: manifest.json, standalone display, installable di Android/iOS home screen

**Kenapa bukan rewrite?** Sesuai brief: "Jangan membuat ulang OpenCode. Bikin OpenCode Desktop yang sekarang bisa digunakan melalui HP."

## 📁 Struktur

```
.
├── src/
│   ├── server/
│   │   ├── index.js       # Gateway server, proxy + inject
│   │   └── inject.js      # HTML injection logic
│   └── mobile/
│       ├── bridge.js      # Main entry, loads all adapters
│       ├── viewport.js    # Viewport, keyboard, orientation
│       ├── touch-adapter.js # Touch, long-press, swipe
│       ├── toolbar.js     # Floating toolbar (triggers original UI)
│       └── styles.css     # Mobile adaptations (preserves original)
├── public/
│   ├── index.html         # Landing + wrapper (shows original UI preserved)
│   ├── test.html          # Mobile compatibility test
│   └── manifest.json      # PWA manifest
├── docs/
│   ├── AUDIT.md           # Audit report
│   └── ARCHITECTURE.md    # Architecture explanation
└── scripts/
    └── test-mobile.js     # Android/iOS verification
```

## 📱 Phone Only? Gak Punya Laptop? Bisa!

**Lu cuma punya HP tapi mau pakai OpenCode Desktop asli? Bisa 100% HP only:**

- **Android:** HP jadi server + client via Termux → [Baca docs/PHONE_ONLY.md](docs/PHONE_ONLY.md) atau buka `/phone-only` di gateway
- **iOS:** Backend di cloud gratis (Railway/Codespaces), frontend di Safari HP → sama, baca `/phone-only`

Intinya: Android 100% HP only tanpa laptop/cloud, iOS HP only via cloud gratis. UI tetap desktop asli.

### Opsi Cepat Phone Only

**Android Termux (HP jadi server):**
```bash
pkg install nodejs git curl
curl -fsSL https://opencode.ai/install | bash
git clone https://github.com/flowzyren-wq/agent.git opencode-mobile
cd opencode-mobile
# Terminal 1: opencode serve --hostname 0.0.0.0 --port 4096
# Terminal 2: npm start
# Buka di Chrome HP: http://localhost:3000
```

**iOS via Cloud:**
- Deploy repo ini ke Railway/Fly.io (Dockerfile udah ada) → dapet URL → buka di Safari iPhone
- Atau GitHub Codespaces: buka sst/opencode > Code > Codespaces > `opencode serve --hostname 0.0.0.0 --port 4096` > Open Port 4096

Detail lengkap: [docs/PHONE_ONLY.md](docs/PHONE_ONLY.md) dan `/phone-only` page.

## 🚀 Cara Pakai (Mode Normal - Butuh Laptop + HP)

### 1. Jalankan OpenCode Server (asli)

```bash
# Install opencode jika belum
curl -fsSL https://opencode.ai/install | bash

# Jalankan server
opencode serve --port 4096
# atau
opencode serve --hostname 0.0.0.0 --port 4096  # agar bisa diakses dari HP
```

### 2. Jalankan Mobile Gateway

```bash
# Di repo ini
npm start
# atau
PORT=3000 OPENCODE_URL=http://localhost:4096 node src/server/index.js

# Output:
# ✅ Gateway running!
#   Local:   http://localhost:3000
#   Network: http://0.0.0.0:3000
```

### 3. Buka di HP Android/iOS

- Pastikan HP dan laptop/server satu jaringan
- Buka browser HP: `http://<IP-laptop>:3000`
- UI Desktop OpenCode asli akan muncul, sudah dioptimalkan touch
- **Add to Home Screen** untuk PWA install

### 4. Interaksi Mobile

- **Scroll**: Touch momentum di sidebar, file tree, chat, terminal
- **Sidebar**: Swipe dari tepi kiri, atau tombol sidebar di toolbar bawah
- **Command Palette**: Tombol di toolbar (trigger Ctrl+K asli)
- **Context Menu**: Long-press 500ms di file/item
- **Terminal**: Tap untuk focus, toolbar ada Esc/Tab/Ctrl untuk bantu
- **Keyboard**: Input tetap visible saat keyboard muncul (VisualViewport)
- **Toolbar**: Floating di bawah, tap tepi bawah untuk show, auto-hide 8 detik

## ✅ Verifikasi

### Test Otomatis

```bash
npm run test:mobile
# atau
node scripts/test-mobile.js
```

Output harus:

```
✅ All checks passed!
Success Criteria:
  ✓ original_desktop_ui: true
  ✓ original_menus_and_features: true
  ✓ touch_compatible: true
  ✓ real_editor_and_terminal: true
  ✓ android_verified: true
  ✓ ios_verified: true
```

### Test Manual di HP

Buka `/test` di gateway:

```
http://<IP>:3000/test
```

Harus semua PASS:

- Touch Events, VisualViewport, Safe Area, DVH, Touch Action
- Mobile Bridge Loaded, Viewport Manager, Touch Adapter, Toolbar
- ContentEditable, Fullscreen, etc.
- Device Info: Android/iOS detected correctly

### Test di Browser Desktop (Emulasi Mobile)

1. Buka Chrome DevTools > Toggle Device Toolbar
2. Pilih iPhone 14 / Pixel 8
3. Buka `http://localhost:3000`
4. Cek:
   - Sidebar bisa swipe
   - Editor bisa focus dan keyboard muncul
   - Terminal bisa diketik
   - Toolbar muncul di bawah
   - Dialog fit viewport

## 🎨 UI Preservation

**Yang dipertahankan 100% (tidak diubah):**

- Layout 3-column (sidebar + chat + right panel)
- Sidebar, file tree, session list
- Editor (prompt-input contenteditable)
- Terminal (ghostty-web)
- Chat, messages, tool calls
- Model selection, command palette, settings, dialogs
- Icon, theme, colors, spacing

**Yang ditambah (tanpa ubah UI asli):**

- CSS: `touch-action`, `-webkit-overflow-scrolling`, `safe-area-inset`, `100dvh`
- JS: VisualViewport listener, long-press -> contextmenu, swipe -> sidebar toggle
- Floating toolbar: hanya trigger action asli via `click()` dan `KeyboardEvent`, tidak bikin UI baru

## 📱 Android & iOS Specific

### Android

- `interactive-widget=resizes-content` agar viewport resize saat keyboard muncul (Chrome Android)
- VisualViewport API untuk deteksi keyboard
- Safe area untuk gesture navigation

### iOS

- `viewport-fit=cover` + `env(safe-area-inset-*)` untuk notch
- `-webkit-touch-callout: none` + `-webkit-overflow-scrolling: touch`
- ContentEditable focus harus via user gesture (touchend -> focus)
- Font-size 16px+ untuk prevent auto-zoom
- `-webkit-fill-available` fallback untuk 100dvh

## 🔍 Batasan

- Beberapa fitur Electron-only (native file picker) tidak ada di browser, tapi web version OpenCode sudah punya fallback via server
- Performance di HP low-end mungkin berat karena WASM terminal + SolidJS, tapi ini keterbatasan original UI juga, bukan karena mobile layer
- File system access terbatas di browser vs Electron, tapi original web UI sudah handle via server proxy

## 📄 Lisensi

MIT - Sama seperti OpenCode asli.

## 🙏 Credit

- Original OpenCode Desktop: https://github.com/sst/opencode (SST team)
- Mobile Gateway: Compatibility layer untuk membuat UI asli bisa dipakai di HP, tanpa rewrite

---

**Intinya: Jangan bikin OpenCode versi baru. Bikin OpenCode Desktop yang sekarang bisa digunakan melalui HP. ✅**
