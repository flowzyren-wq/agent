#!/usr/bin/env bash
# ============================================================
# 9Router bootstrap — bikin API key, custom provider node,
# combos (fallback / round-robin / fusion), dan settings-nya
# dalam sekali jalan. Dipake di sandbox ATAU di mesin sendiri.
#
# Pemakaian (semua opsional, ada default):
#   BASE=http://localhost:20128 PASSWORD=123456 ./bootstrap.sh
#
# Opsional — daftarin custom provider OpenAI-compatible:
#   NODE_NAME="Provider Gw" NODE_PREFIX="gw" \
#   NODE_BASEURL="https://api.contoh.com/v1" NODE_APIKEY="sk-..." \
#   ./bootstrap.sh
# ============================================================
set -euo pipefail

BASE="${BASE:-http://localhost:20128}"
PASSWORD="${PASSWORD:-123456}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

jsonget() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const v=process.argv[1].split('.').reduce((o,k)=>o?.[k],j);console.log(typeof v==='object'?JSON.stringify(v):v??'')}catch(e){console.log('')}})" "$1"; }

echo "==> 1/5 Login dashboard ($BASE)"
LOGIN=$(curl -sf -c "$JAR" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -d "{\"password\":\"$PASSWORD\"}")
echo "$LOGIN" | grep -q '"success":true' || { echo "Login gagal: $LOGIN"; exit 1; }
echo "    OK (password: $PASSWORD)"

echo "==> 2/5 Bikin API key"
KEY=$(curl -sf -b "$JAR" -X POST "$BASE/api/keys" \
  -H "Content-Type: application/json" -d '{"name":"bootstrap"}' | jsonget "key")
echo "    API key: $KEY"

echo "==> 3/5 Custom provider node (opsional)"
if [[ -n "${NODE_BASEURL:-}" && -n "${NODE_PREFIX:-}" ]]; then
  NODE_ID=$(curl -sf -b "$JAR" -X POST "$BASE/api/provider-nodes" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${NODE_NAME:-Custom}\",\"prefix\":\"$NODE_PREFIX\",\"type\":\"openai-compatible\",\"apiType\":\"chat\",\"baseUrl\":\"$NODE_BASEURL\"}" \
    | jsonget "node.id")
  curl -sf -b "$JAR" -X POST "$BASE/api/providers" \
    -H "Content-Type: application/json" \
    -d "{\"provider\":\"$NODE_ID\",\"apiKey\":\"${NODE_APIKEY:-dummy}\",\"name\":\"${NODE_NAME:-Custom} Conn\",\"priority\":1}" > /dev/null
  echo "    Node '$NODE_PREFIX' → $NODE_BASEURL OK"
else
  echo "    Dilewati (set NODE_PREFIX + NODE_BASEURL kalo mau)"
fi

echo "==> 4/5 Bikin combos"
combo() {
  curl -sf -b "$JAR" -X POST "$BASE/api/combos" \
    -H "Content-Type: application/json" -d "$1" | jsonget "name"
}
# Ganti model-model di bawah sesuai yang tersedia di instance lu:
combo '{"name":"smart-fallback","models":["oc/union-alpha","local/demo-pro"],"kind":"fallback"}'    || echo "    (combo 1 gagal — mungkin udah ada / model ga ada)"
combo '{"name":"cheap-rotation","models":["local/demo-fast","local/demo-pro"],"kind":"round-robin"}' || echo "    (combo 2 gagal — mungkin udah ada / model ga ada)"
combo '{"name":"panel-fusion","models":["local/demo-fast","local/demo-pro"],"kind":"fusion"}'       || echo "    (combo 3 gagal — mungkin udah ada / model ga ada)"

echo "==> 5/5 Set strategi per-combo (PENTING di v0.5.x)"
curl -sf -b "$JAR" -X PATCH "$BASE/api/settings" \
  -H "Content-Type: application/json" \
  -d '{"comboStrategies":{"cheap-rotation":{"fallbackStrategy":"round-robin"},"panel-fusion":{"fallbackStrategy":"fusion","judgeModel":"local/demo-pro"}}}' > /dev/null \
  && echo "    comboStrategies OK" || echo "    Gagal set comboStrategies"

echo
echo "Selesai! Contoh pemakaian:"
echo "  curl $BASE/v1/chat/completions -H 'Authorization: Bearer $KEY' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"model\":\"smart-fallback\",\"messages\":[{\"role\":\"user\",\"content\":\"halo\"}]}'"
