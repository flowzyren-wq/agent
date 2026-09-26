# OpenCode Desktop Mobile - Phone Only via Cloud
# Dockerfile untuk deploy ke Railway / Fly.io / Render
# Jadi iPhone bisa pakai tanpa laptop, backend di cloud

FROM node:22-slim

# Install deps untuk opencode
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install bun (dibutuhkan opencode)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install opencode via npm (fallback kalau bun install gagal)
RUN npm install -g opencode-ai || true

# Coba install via official installer juga
RUN curl -fsSL https://opencode.ai/install | bash || true
ENV PATH="/root/.opencode/bin:${PATH}"

WORKDIR /app

# Copy mobile gateway
COPY package.json ./
COPY src ./src
COPY public ./public
COPY docs ./docs
COPY scripts ./scripts

# Install gateway deps (tidak ada deps external, tapi untuk jaga-jaga)
RUN npm install || true

# Expose ports
EXPOSE 3000 4096

# Env
ENV PORT=3000
ENV OPENCODE_URL=http://localhost:4096
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Start script
COPY <<'EOF' /app/start.sh
#!/bin/sh
set -e

echo "Starting OpenCode Desktop Mobile - Phone Only Cloud"

# Start opencode server di background
echo "Starting opencode server on 4096..."
if command -v opencode >/dev/null 2>&1; then
  opencode serve --hostname 0.0.0.0 --port 4096 &
elif command -v opencode-ai >/dev/null 2>&1; then
  opencode-ai serve --hostname 0.0.0.0 --port 4096 &
else
  echo "Opencode binary not found, gateway will run in wrapper mode"
  echo "UI tetap bisa diakses, tapi butuh opencode server"
fi

# Tunggu bentar
sleep 2

# Start gateway
echo "Starting mobile gateway on 3000..."
node src/server/index.js
EOF

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
