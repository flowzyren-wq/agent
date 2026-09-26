#!/usr/bin/env bash
# ============================================================
# 9Router bootstrap — bikin API key, custom provider node,
# combos (fallback / round-robin / fusion), dan settings-nya
# dalam sekali jalan. Dipake di sandbox ATAU di mesin sendiri.
#
# Pemakaian (semua opsional, ada default):
#   BASE=http://localhost:20128 PASSWORD=123456 ./bootstrap.sh
#
# Token Harbor (https://tokenharbor.ai) — provider free tier:
#   TH_APIKEY="thk_live_xxx" ./bootstrap.sh
#   → bikin node 'th' (OpenAI format) + 'tha' (format Claude),
#     daftarin model free, dan combo 'free-auto'
#
# Opsional — provider OpenAI-compatible lain:
#   NODE_NAME="Provider Gw" NODE_PREFIX="gw" \
#   NODE_BASEURL="https://api.contoh.com/v1" NODE_APIKEY="sk-..." \
#   ./bootstrap.sh
# ============================================================
set -euo pipefail

BASE="${BASE:-http://localhost:20128}"
PASSWORD="${PASSWORD:-123456}"
TH_BASEURL="https://tokenharbor.ai/v1"
TH_FREE_MODELS=("deepseek-v4.1-flash:free" "deepseek-v4-flash:free" "mimo-v2.5:free" "mimo-v2.6-flash:free" "qwen3.8-flash:free")
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

jsonget() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const v=process.argv[1].split('.').reduce((o,k)=>o?.[k],j);console.log(typeof v==='object'?JSON.stringify(v):v??'')}catch(e){console.log('')}})" "$1"; }

echo "==> 1/7 Login dashboard ($BASE)"
LOGIN=$(curl -sf -c "$JAR" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -d "{\"password\":\"$PASSWORD\"}")
echo "$LOGIN" | grep -q '"success":true' || { echo "Login gagal: $LOGIN"; exit 1; }
echo "    OK (password: $PASSWORD)"

echo "==> 2/7 Bikin API key"
KEY=$(curl -sf -b "$JAR" -X POST "$BASE/api/keys" \
  -H "Content-Type: application/json" -d '{"name":"bootstrap"}' | jsonget "key")
echo "    API key: $KEY"

echo "==> 3/7 Custom provider node (opsional)"
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

echo "==> 4/7 Token Harbor (kalo TH_APIKEY diset)"
if [[ -n "${TH_APIKEY:-}" ]]; then
  TH_ID=$(curl -sf -b "$JAR" -X POST "$BASE/api/provider-nodes" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Token Harbor\",\"prefix\":\"th\",\"type\":\"openai-compatible\",\"apiType\":\"chat\",\"baseUrl\":\"$TH_BASEURL\"}" | jsonget "node.id")
  THA_ID=$(curl -sf -b "$JAR" -X POST "$BASE/api/provider-nodes" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Token Harbor (Claude API)\",\"prefix\":\"tha\",\"type\":\"anthropic-compatible\",\"baseUrl\":\"$TH_BASEURL\"}" | jsonget "node.id")
  curl -sf -b "$JAR" -X POST "$BASE/api/providers" -H "Content-Type: application/json" \
    -d "{\"provider\":\"$TH_ID\",\"apiKey\":\"$TH_APIKEY\",\"name\":\"Token Harbor Conn\",\"priority\":1}" > /dev/null
  curl -sf -b "$JAR" -X POST "$BASE/api/providers" -H "Content-Type: application/json" \
    -d "{\"provider\":\"$THA_ID\",\"apiKey\":\"$TH_APIKEY\",\"name\":\"Token Harbor Claude Conn\",\"priority\":1}" > /dev/null
  for m in "${TH_FREE_MODELS[@]}"; do
    curl -sf -b "$JAR" -X POST "$BASE/api/models/custom" -H "Content-Type: application/json" \
      -d "{\"providerAlias\":\"th\",\"id\":\"$m\",\"type\":\"llm\"}" > /dev/null
  done
  curl -sf -b "$JAR" -X POST "$BASE/api/combos" -H "Content-Type: application/json" \
    -d "{\"name\":\"free-auto\",\"models\":[\"th/${TH_FREE_MODELS[3]}\",\"th/${TH_FREE_MODELS[1]}\",\"th/${TH_FREE_MODELS[4]}\"],\"kind\":\"fallback\"}" > /dev/null \
    || echo "    (combo free-auto mungkin udah ada)"
  curl -sf -b "$JAR" -X PATCH "$BASE/api/settings" -H "Content-Type: application/json" \
    -d '{"comboStrategies":{"free-auto":{"fallbackStrategy":"fallback"}}}' > /dev/null
  # verifikasi katalog asli langsung dari Token Harbor:
  echo "    Node th/tha + model free + combo free-auto OK. Katalog asli:"
  curl -sf "$TH_BASEURL/models" -H "Authorization: Bearer $TH_APIKEY" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{JSON.parse(d).data.forEach(m=>console.log('     -',m.id))}catch(e){console.log('     (ga ke-parse — cek manual: curl $TH_BASEURL/models -H \"Authorization: Bearer ...\")')}})"
else
  echo "    Dilewati (set TH_APIKEY=thk_live_... kalo mau pake Token Harbor)"
fi

echo "==> 5/7 OmegaTech gratis via omega-bridge (kalo OMEGA=1)"
if [[ "${OMEGA:-}" == "1" ]]; then
  BRIDGE_OK=$(curl -sf --max-time 3 http://127.0.0.1:9998/v1/models > /dev/null 2>&1 && echo yes || echo no)
  if [[ "$BRIDGE_OK" != "yes" ]]; then
    nohup node "$(dirname "$0")/omega-bridge/server.js" > /tmp/omega-bridge.log 2>&1 &
    sleep 1.5
  fi
  OMEGA_ID=$(curl -sf -b "$JAR" -X POST "$BASE/api/provider-nodes" \
    -H "Content-Type: application/json" \
    -d '{"name":"OmegaTech","prefix":"omega","type":"openai-compatible","apiType":"chat","baseUrl":"http://127.0.0.1:9998/v1"}' | jsonget "node.id")
  curl -sf -b "$JAR" -X POST "$BASE/api/providers" -H "Content-Type: application/json" \
    -d "{\"provider\":\"$OMEGA_ID\",\"apiKey\":\"omega-no-key\",\"name\":\"OmegaTech Conn\",\"priority\":1}" > /dev/null
  curl -sf -b "$JAR" -X POST "$BASE/api/combos" -H "Content-Type: application/json" \
    -d '{"name":"code-team","models":["omega/blackbox","omega/llama","omega/qwencoder"],"kind":"fallback"}' > /dev/null \
    || echo "    (combo code-team mungkin udah ada)"
  echo "    Node omega/ (15 model) + combo code-team OK (bridge di :9998)"
else
  echo "    Dilewati (jalanin pake OMEGA=1 buat pake OmegaTech gratis)"
fi

echo "==> 6/7 Bikin combos"
combo() {
  curl -sf -b "$JAR" -X POST "$BASE/api/combos" \
    -H "Content-Type: application/json" -d "$1" | jsonget "name"
}
# Ganti model-model di bawah sesuai yang tersedia di instance lu:
combo '{"name":"smart-fallback","models":["oc/union-alpha","local/demo-pro"],"kind":"fallback"}'    || echo "    (combo 1 gagal — mungkin udah ada / model ga ada)"
combo '{"name":"cheap-rotation","models":["local/demo-fast","local/demo-pro"],"kind":"round-robin"}' || echo "    (combo 2 gagal — mungkin udah ada / model ga ada)"
combo '{"name":"panel-fusion","models":["local/demo-fast","local/demo-pro"],"kind":"fusion"}'       || echo "    (combo 3 gagal — mungkin udah ada / model ga ada)"

echo "==> 7/7 Set strategi per-combo (PENTING di v0.5.x)"
STRATEGIES='{"cheap-rotation":{"fallbackStrategy":"round-robin"},"panel-fusion":{"fallbackStrategy":"fusion","judgeModel":"local/demo-pro"},"code-team":{"fallbackStrategy":"fallback"}}'
if [[ -n "${TH_APIKEY:-}" ]]; then
  STRATEGIES=$(echo "$STRATEGIES" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);j['free-auto']={fallbackStrategy:'fallback'};console.log(JSON.stringify(j))})")
fi
curl -sf -b "$JAR" -X PATCH "$BASE/api/settings" \
  -H "Content-Type: application/json" \
  -d "{\"comboStrategies\":$STRATEGIES}" > /dev/null \
  && echo "    comboStrategies OK" || echo "    Gagal set comboStrategies"

echo
echo "Selesai! Contoh pemakaian:"
echo "  curl $BASE/v1/chat/completions -H 'Authorization: Bearer $KEY' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"model\":\"smart-fallback\",\"messages\":[{\"role\":\"user\",\"content\":\"halo\"}]}'"
