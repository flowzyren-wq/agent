#!/data/data/com.termux/files/usr/bin/bash
# OpenCode Desktop - Android Termux Setup
# 100% HP Only, tanpa laptop
# Jalankan ini di Termux

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║  OpenCode Desktop - Android HP Only Setup      ║"
echo "║  Bikin HP jadi server + client OpenCode        ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# 1. Update
echo "📦 Update packages..."
pkg update -y && pkg upgrade -y

# 2. Install deps
echo "📦 Install Node.js, git, curl..."
pkg install -y nodejs git curl termux-tools

# 3. Install opencode
echo "📦 Install OpenCode..."
if curl -fsSL https://opencode.ai/install | bash; then
  echo "✅ OpenCode installed via official installer"
else
  echo "⚠️  Curl install gagal, coba via npm..."
  npm install -g opencode-ai
fi

# 4. Setup PATH
export PATH=$PATH:$HOME/.opencode/bin
echo 'export PATH=$PATH:$HOME/.opencode/bin' >> ~/.bashrc

# 5. Clone mobile gateway
echo "📦 Clone mobile gateway..."
if [ -d "opencode-mobile" ]; then
  echo "Folder opencode-mobile sudah ada, skip clone"
else
  git clone https://github.com/flowzyren-wq/agent.git opencode-mobile
fi

cd opencode-mobile

# 6. Test opencode
echo ""
echo "🧪 Test OpenCode..."
if command -v opencode &> /dev/null; then
  opencode --version
  echo "✅ OpenCode ready"
else
  echo "❌ OpenCode not found, coba manual:"
  echo "   ~/.opencode/bin/opencode --version"
  echo "   atau: npx opencode-ai --version"
fi

# 7. Info
echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  ✅ Setup Selesai!                             ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "Cara pakai (2 terminal):"
echo ""
echo "Terminal 1 - Jalankan OpenCode Server:"
echo "  cd ~/opencode-mobile"
echo "  opencode serve --hostname 0.0.0.0 --port 4096"
echo ""
echo "Terminal 2 - Buka New Session di Termux (swipe kiri > New Session):"
echo "  cd ~/opencode-mobile"
echo "  npm start"
echo "  # atau: PORT=3000 node src/server/index.js"
echo ""
echo "Terus buka di Chrome HP:"
echo "  http://localhost:3000  (dengan mobile bridge)"
echo "  http://localhost:4096  (langsung opencode)"
echo ""
echo "Tips:"
echo "  termux-wake-lock  # biar gak mati background"
echo "  Add to Home Screen di Chrome biar jadi app"
echo ""
echo "Happy coding di HP! 📱"
