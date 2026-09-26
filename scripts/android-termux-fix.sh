#!/data/data/com.termux/files/usr/bin/bash
# Fix untuk error EBADPLATFORM di Termux Android
# npm error notsup os android

set -e

echo "🔧 Fix EBADPLATFORM Android - Install OpenCode di Termux"

# 1. Install deps
pkg update -y
pkg install -y nodejs git curl wget tar proot

# 2. Coba install dengan --force (bypass os check)
echo "📦 Coba install dengan --force..."
npm install -g opencode-ai --force 2>&1 | tail -n 20 || true

if command -v opencode >/dev/null 2>&1; then
  echo "✅ Berhasil via npm --force"
  opencode --version
  exit 0
fi

# 3. Coba set platform jadi linux
echo "📦 Coba dengan npm_config_os=linux..."
npm_config_os=linux npm_config_cpu=arm64 npm install -g opencode-ai --force 2>&1 | tail -n 20 || true

if command -v opencode >/dev/null 2>&1; then
  echo "✅ Berhasil via npm_config_os=linux"
  opencode --version
  exit 0
fi

# 4. Manual download dari npm registry (bypass os check)
echo "📦 Manual download binary linux-arm64 dari npm registry..."
cd /tmp
rm -rf opencode-manual
mkdir opencode-manual && cd opencode-manual

# Download tgz langsung
curl -kL -o opencode.tgz https://registry.npmjs.org/opencode-linux-arm64/-/opencode-linux-arm64-1.18.32.tgz || wget --no-check-certificate -O opencode.tgz https://registry.npmjs.org/opencode-linux-arm64/-/opencode-linux-arm64-1.18.32.tgz

tar -xzf opencode.tgz
ls -lh package/bin/ || ls -lh package/

# Copy binary
mkdir -p ~/.opencode/bin
cp package/bin/opencode.exe ~/.opencode/bin/opencode 2>/dev/null || cp package/bin/opencode ~/.opencode/bin/opencode 2>/dev/null || cp package/opencode ~/.opencode/bin/opencode
chmod +x ~/.opencode/bin/opencode

export PATH=$PATH:~/.opencode/bin
echo 'export PATH=$PATH:$HOME/.opencode/bin' >> ~/.bashrc

if ~/.opencode/bin/opencode --version; then
  echo "✅ Berhasil via manual download npm registry"
  exit 0
fi

# 5. Manual download dari GitHub releases
echo "📦 Coba download dari GitHub releases..."
cd /tmp
curl -kL -o opencode.tar.gz https://github.com/anomalyco/opencode/releases/download/v1.18.32/opencode-linux-arm64.tar.gz || wget --no-check-certificate -O opencode.tar.gz https://github.com/anomalyco/opencode/releases/download/v1.18.32/opencode-linux-arm64.tar.gz

if [ -f opencode.tar.gz ]; then
  tar -xzf opencode.tar.gz
  ls -lh
  mkdir -p ~/.opencode/bin
  cp opencode ~/.opencode/bin/opencode 2>/dev/null || cp opencode-linux-arm64 ~/.opencode/bin/opencode 2>/dev/null || find . -name "opencode*" -type f -exec cp {} ~/.opencode/bin/opencode \;
  chmod +x ~/.opencode/bin/opencode
  ~/.opencode/bin/opencode --version && echo "✅ Berhasil via GitHub releases" && exit 0
fi

# 6. Fallback: pakai proot linux
echo "📦 Coba via proot (bikin Termux keliatan kayak linux)..."
pkg install -y proot-distro
proot-distro install ubuntu 2>&1 | tail -n 10 || true
echo "Kalau proot terinstall, jalankan:"
echo "  proot-distro login ubuntu"
echo "  apt update && apt install -y nodejs npm"
echo "  npm install -g opencode-ai"
echo "  opencode serve --hostname 0.0.0.0 --port 4096"

echo ""
echo "❌ Semua cara gagal. Coba manual:"
echo "  curl -kL https://registry.npmjs.org/opencode-linux-arm64/-/opencode-linux-arm64-1.18.32.tgz -o /tmp/opencode.tgz"
echo "  tar -xzf /tmp/opencode.tgz -C /tmp"
echo "  cp /tmp/package/bin/opencode.exe ~/.opencode/bin/opencode"
echo "  chmod +x ~/.opencode/bin/opencode"
echo "  ~/.opencode/bin/opencode --version"
