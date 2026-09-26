# Phone Only - Pakai OpenCode Desktop Cuma Modal HP

> Gak punya laptop? Gak masalah. Ini cara pakai OpenCode Desktop asli cuma modal HP Android / iOS.

## Konsep

OpenCode Desktop asli itu sebenernya 2 bagian:
1. **Backend Server** (port 4096) - yang jalanin AI, tools, terminal
2. **Frontend UI** (SolidJS) - yang lu liat di desktop

Di laptop, keduanya jalan bareng via Electron. Di HP, kita pisah:
- Backend bisa jalan di HP itu sendiri (Android) atau di cloud (iOS)
- Frontend diakses via browser HP + mobile bridge

**UI tetap asli 100%, bukan tiruan.**

## Android - 100% HP Only (Tanpa Laptop, Tanpa Cloud)

Android bisa jalanin Linux via **Termux**. Jadi HP lu jadi server + client sekaligus.

### Langkah 1: Install Termux

- Download Termux dari F-Droid (jangan dari Play Store, udah outdated): https://f-droid.org/en/packages/com.termux/
- Buka Termux

### Langkah 2: Setup OpenCode di Termux

Copy paste ini di Termux:

```bash
# Update & install deps
pkg update -y && pkg upgrade -y
pkg install -y nodejs git curl

# Install opencode
curl -fsSL https://opencode.ai/install | bash

# Atau via npm kalau curl gagal
npm install -g opencode-ai

# Cek
opencode --version

# Clone mobile gateway (repo ini)
git clone https://github.com/flowzyren-wq/agent.git opencode-mobile
cd opencode-mobile

# Jalankan gateway + opencode server barengan
# Terminal 1: opencode server
opencode serve --hostname 0.0.0.0 --port 4096

# Terminal 2: buka new session di Termux (swipe dari kiri > New Session)
# cd opencode-mobile && npm start
# Atau: PORT=3000 OPENCODE_URL=http://localhost:4096 node src/server/index.js
```

### Langkah 3: Buka di Browser HP

Buka Chrome di HP Android (bukan di Termux):
```
http://localhost:3000
```
Atau kalau mau PWA:
```
http://localhost:4096  (langsung ke opencode asli)
http://localhost:3000  (via gateway dengan mobile bridge)
```

**Voila! OpenCode Desktop asli jalan di HP Android, tanpa laptop.**

#### Tips Android:
- Biar Termux tetap jalan background: `termux-wake-lock`
- Add to Home Screen biar jadi app
- Pakai keyboard Hacker Keyboard (ada Ctrl, Esc, Tab) untuk terminal enak
- Hubungkan mouse bluetooth kalau mau lebih enak

---

## iOS - HP Only via Cloud (Gratis)

iOS gak bisa jalanin binary kayak Android, jadi backend harus di cloud. Tapi frontend tetap di HP lu, UI tetap asli.

### Opsi 1: Deploy Gratis ke Cloud (1 Klik)

**Pakai Railway / Fly.io / Render (gratis tier):**

1. Fork repo ini
2. Deploy ke Railway:
   - Buka https://railway.app/new
   - Connect GitHub repo
   - Add variable: `OPENCODE_MODEL` = `anthropic/claude-sonnet-4` (atau model lain)
   - Deploy

Atau pakai Docker (sudah ada Dockerfile):

```dockerfile
# Dockerfile sudah ada di repo
docker build -t opencode-mobile .
docker run -p 3000:3000 -p 4096:4096 opencode-mobile
```

3. Setelah deploy, lu dapet URL misal `https://opencode-xxx.up.railway.app`
4. Buka URL itu di Safari iPhone → UI Desktop asli muncul!

### Opsi 2: GitHub Codespaces (Gratis 60 jam/bulan)

1. Buka https://github.com/sst/opencode di Safari iPhone
2. Klik Code > Codespaces > Create Codespace
3. Tunggu loading, terus di terminal Codespace:
   ```bash
   opencode serve --hostname 0.0.0.0 --port 4096
   ```
4. VS Code di browser bakal muncul popup "Port 4096 forwarded" → klik Open in Browser
5. UI OpenCode asli muncul di Safari iPhone!

### Opsi 3: Tailscale + HP Jadi Server (Advanced)

Kalau punya Android + iPhone, Android jadi server, iPhone jadi client via Tailscale VPN.

---

## Cara Pakai di HP (Setelah Server Jalan)

Sama kayak di laptop, tapi dioptimalkan touch:

- **Sidebar:** Swipe dari tepi kiri layar
- **Command Palette:** Tap tombol ⌘ di toolbar bawah (trigger Ctrl+K asli)
- **Terminal:** Tap terminal buat focus, pakai toolbar Esc/Tab/Ctrl
- **Context Menu:** Long-press 500ms di file
- **Keyboard:** Prompt tetap visible pas keyboard muncul
- **Toolbar:** Floating di bawah, tap tepi bawah buat munculin lagi kalau auto-hide

## Kenapa Ini Tetap UI Asli?

- Gateway cuma proxy + inject JS/CSS touch handling
- Tidak ada rewrite component
- Class names, layout, sidebar, editor, terminal semua asli dari `packages/app`
- Backend tetap opencode asli (bukan mock)

## Troubleshooting HP Only

**Android Termux: opencode command not found**
```bash
export PATH=$PATH:/data/data/com.termux/files/usr/bin
# atau
~/.opencode/bin/opencode --version
# tambahin ke .bashrc
echo 'export PATH=$PATH:$HOME/.opencode/bin' >> ~/.bashrc
```

**iOS Safari: keyboard nutupin input**
- Sudah di-handle via `interactive-widget=resizes-content` + VisualViewport API
- Kalau masih ketutup, scroll manual dikit

**HP kentang lemot**
- Matikan animasi: di OpenCode settings > reduce motion
- Pakai model yang ringan (Haiku, bukan Opus)

**Mau coding project di HP?**
- Android: project ada di `/data/data/com.termux/files/home/`
- Bisa clone git langsung di Termux
- iOS Cloud: project di cloud, tapi bisa sync via GitHub

## Kesimpulan

- **Android:** 100% HP only via Termux, HP jadi server + client
- **iOS:** HP only via cloud gratis (Railway/Codespaces), HP jadi client, cloud jadi server
- **Keduanya:** UI tetap Desktop asli, bukan tiruan, bisa dipakai beneran buat coding

Gak perlu laptop lagi!
