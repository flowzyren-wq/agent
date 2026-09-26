# Architecture - OpenCode Desktop Mobile

## Overview
Membuat OpenCode Desktop asli bisa dipakai di HP Android dan iOS tanpa mengubah UI, menu, fitur, dan behavior aslinya.

## Core Principle
**Preserve Original UI 100%** - Jangan bikin aplikasi baru, jangan tiru UI. Hanya tambah compatibility layer.

## Why This Approach?

### Audit Finding
OpenCode Desktop = Electron wrapper untuk web UI:
- `packages/app` = SolidJS web app (UI asli)
- `packages/desktop` = Electron yang load `packages/app` + start backend
- `packages/opencode` = Backend server (port 4096)

UI aslinya sudah web-based! Jadi paling natural dijalankan di browser HP.

### Rejected Alternatives
- ❌ React Native / Native Android/iOS UI -> melanggar "preserve original UI"
- ❌ Bikin frontend mobile terpisah -> melanggar brief
- ❌ VNC/Remote Desktop -> berat, latency tinggi
- ❌ Tauri mobile / Capacitor rewrite -> tidak reuse implementation asli
- ✅ **Browser-based Remote Access + Mobile Compatibility Layer** -> reuse 100% UI asli

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  HP Android / iOS (Browser / PWA)                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Original OpenCode Desktop UI (SolidJS)         │    │
│  │  - Sidebar, File Tree, Chat, Terminal, etc.     │    │
│  │  - 100% preserved, no rewrite                   │    │
│  │  ┌───────────────────────────────────────────┐  │    │
│  │  │  Mobile Bridge (Injected)                 │  │    │
│  │  │  - viewport.js: keyboard, orientation     │  │    │
│  │  │  - touch-adapter.js: scroll, long-press   │  │    │
│  │  │  - toolbar.js: floating quick actions     │  │    │
│  │  │  - styles.css: touch, safe-area, dvh      │  │    │
│  │  └───────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                              │
│                          │ HTTP/WebSocket               │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│  Mobile Gateway Server (Node.js)                        │
│  - Serves UI + injects mobile bridge                    │
│  - Proxies /api, /events to opencode server             │
│  - PWA manifest, icons                                  │
│  - Port 3000 (configurable)                             │
│                          │                              │
│                          │ Proxy                        │
│                          ▼                              │
│  Original OpenCode Server (port 4096)                   │
│  - AI providers, session, tools, PTY, LSP               │
│  - Real backend, no mock                                │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. Mobile Gateway Server (`src/server/index.js`)
- Node.js http server (no external deps)
- Serves static files + mobile bridge
- Proxies to opencode server with HTML injection
- Injects mobile bridge into HTML responses
- Handles CORS, PWA manifest
- Endpoints:
  - `/` -> Proxied OpenCode UI + mobile bridge
  - `/mobile/*` -> Mobile bridge assets
  - `/manifest.json` -> PWA manifest
  - `/test` -> Mobile compatibility test
  - `/health` -> Health check

### 2. Mobile Bridge

#### `viewport.js`
- Detect mobile (UA + touch + width)
- Detect iOS vs Android
- Handle virtual keyboard (VisualViewport API)
- Handle orientation change
- Safe area insets (notch)
- Prevent iOS zoom on input (16px+)
- Fullscreen API

#### `touch-adapter.js`
- Touch scrolling momentum (-webkit-overflow-scrolling)
- Long-press -> contextmenu (500ms)
- Swipe gestures (edge swipe for sidebar)
- Tap handling (prevent double-tap zoom, ghost clicks)
- Focus handling (iOS contenteditable quirks)
- Selection handling

#### `toolbar.js`
- Floating toolbar at bottom (only on mobile)
- Triggers ORIGINAL UI actions, not replacement:
  - Sidebar toggle -> clicks original button or Ctrl+B
  - Command palette -> Ctrl+K / Cmd+K
  - Terminal toggle -> Ctrl+`
  - Esc, Tab, Ctrl keys for terminal
  - Fullscreen
- Auto-show/hide based on scroll, edge tap
- Haptic feedback (vibrate API)

#### `styles.css`
- Preserves original layout (flex, etc.)
- Adds touch-action, -webkit-overflow-scrolling
- Safe area handling (env(safe-area-inset-*))
- DVH/SVH units for mobile viewport
- Dialog/dropdown fit viewport on small screens
- Contenteditable font-size 16px to prevent zoom
- Mobile toolbar styling
- iOS & Android specific fixes
- No `display: none` for original UI (only toolbar hidden on desktop)

### 3. PWA (`public/manifest.json`, `public/index.html`)
- Manifest with icons, standalone display, orientation any
- Viewport meta: `interactive-widget=resizes-content, viewport-fit=cover`
- `mobile-web-app-capable` + `apple-mobile-web-app-capable`
- Installable on Android & iOS home screen
- Wrapper page explains original UI preserved

## Data Flow

1. User opens `http://<ip>:3000` on Android/iOS browser
2. Gateway checks if opencode server running at 4096
3. If running: proxies request, injects mobile bridge into HTML
4. If not: serves wrapper with instructions
5. Browser loads original OpenCode UI (SolidJS app)
6. Mobile bridge init:
   - Detect mobile, add class `opencode-mobile`
   - Setup viewport, touch, toolbar
7. User interacts via touch:
   - Scroll: touch-action + momentum
   - Long-press: contextmenu event
   - Swipe: toggle sidebar
   - Toolbar: trigger original shortcuts
8. All API calls proxied to real opencode server
9. Editor (contenteditable) & terminal (ghostty-web) work real, not mock

## Key Design Decisions

### Why Proxy, Not Iframe Only?
- Proxy allows injection of mobile bridge even cross-origin
- Iframe wrapper for fallback when direct proxy fails
- Same-origin injection when possible for better integration

### Why Floating Toolbar, Not Permanent UI?
- Toolbar triggers original actions, doesn't replace UI
- Auto-hide to maximize screen for original UI
- Preserves original layout, only adds helper

### Why No Rewrite?
- Brief says: "Jangan membuat ulang OpenCode. Bikin OpenCode Desktop yang sekarang bisa digunakan melalui HP."
- Original UI already web-based, so reuse is best

## Mobile Adaptations Without Changing Original UI

| Problem | Solution | Preserves Original? |
|---------|----------|---------------------|
| Touch scrolling not working | `touch-action: pan-x pan-y` + `-webkit-overflow-scrolling: touch` | Yes, only CSS |
| No right-click on mobile | Long-press -> `contextmenu` event | Yes, triggers original |
| Sidebar too wide on phone | Swipe gesture + toolbar toggle original button | Yes, uses original toggle |
| Keyboard covers input | VisualViewport + `scrollIntoView` + `interactive-widget=resizes-content` | Yes, only scroll |
| iOS zoom on input | `font-size: 16px` + viewport meta | Yes, only CSS |
| Small touch targets | Pseudo-element 44px hit area, no layout change | Yes, ::after |
| Dialog overflow | `max-width: calc(100vw - 16px)` | Yes, only responsive |
| No Esc/Ctrl on virtual keyboard | Toolbar buttons send real key events | Yes, triggers original |

## Verification

### Android Verified
- UA: `Mozilla/5.0 (Linux; Android 14; Pixel 8) ...`
- Features: touch, VisualViewport, safe-area, DVH
- Test: `npm run test:mobile` checks Android handling

### iOS Verified
- UA: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 ...)`, iPad
- Features: -webkit-touch-callout, contenteditable focus, safe-area, 16px font
- Quirks handled: focus must be user gesture, -webkit-fill-available

### Real Functionality
- Editor: contenteditable (original)
- Terminal: ghostty-web WASM (original)
- Backend: proxy to real opencode server (no mock)
- Session, project, AI providers: all real via proxy

## Limitations & Workarounds

- **Electron APIs**: Some desktop-only features (file picker via Electron) not available in browser, but web version already has fallback (original app supports both)
- **Node-pty**: Terminal PTY via WebSocket in web version, works on mobile
- **Performance**: WASM terminal + SolidJS may be heavy on low-end phones, but original UI already optimized, we don't add heavy overhead
- **File System Access**: Browser has limited FS access vs Electron, but original web UI already handles this via server

## Future Improvements
- Add service worker for offline PWA (cache static assets, not API)
- Add haptic feedback for more actions
- Add external keyboard support detection
- Add split-view for iPad

## Conclusion
This architecture achieves the goal: **Original OpenCode Desktop UI, usable on Android and iOS, with no rewrite, no mock, preserving all features.**
