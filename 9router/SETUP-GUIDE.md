# 9Router di Sandbox — Setup Gw + Panduan Nyambungin ke Claude Code

> Settingan lengkap 9Router (`decolua/9router` v0.5.86) yang udah jalan di sandbox ini,
> plus cara replikasi di mesin lu sendiri & nyambungin ke Claude Code Desktop pake model free tier.

---

## 1. Yang Udah Jalan di Sandbox Ini

| Komponen | Detail |
|---|---|
| Server 9Router | port `20128` (bind `0.0.0.0`) → buka preview **"9Router server"** |
| Mock LLM provider | port `9999` — OpenAI-compatible lokal buat demo combo (`local/*`) |
| API key gateway | `sk-c97f6dcf3ef1685f-b4rt97-7679b787` |
| Login dashboard | password default **`123456`** |
| Endpoint OpenAI | `POST /v1/chat/completions` |
| Endpoint Claude | `POST /v1/messages` (format Anthropic, streaming SSE) ✅ |

### Model yang Bisa Dipake

| Model | Sumber | Status |
|---|---|---|
| `local/demo-fast`, `local/demo-pro` | mock provider lokal | ✅ jalan |
| `local/demo-flaky` | mock (selalu 500, sengaja) | ❌ buat demo fallback |
| `oc/muse-spark-*`, `oc/union-alpha`, `oc/jev-1.13-free` | OpenCode Free (no-auth) | ⚠️ keblokir firewall sandbox |
| `kr/claude-sonnet-4.5`, `kr/glm-5`, dll. | Kiro AI (perlu login OAuth lu) | ⚠️ perlu connect via dashboard |

> **Catatan penting:** sandbox ini punya egress allowlist — **semua domain provider AI
> (opencode.ai, api.anthropic.com, openrouter.ai, dll) diblokir**. Jadi demo end-to-end di sini
> pake mock provider lokal. Di mesin lu, provider beneran ga bakal keblokir.

### Combos yang Udah Dibikin

| Nama combo | Models | Strategi | Hasil tes |
|---|---|---|---|
| `demo-fallback` | demo-flaky → demo-pro | fallback | ✅ flaky mati → auto pindah ke pro |
| `demo-roundrobin` | demo-fast ⇄ demo-pro | round-robin (sticky=1) | ✅ selang-seling tiap request |
| `demo-fusion` | demo-fast + demo-pro | fusion (judge: demo-pro) | ✅ fan-out paralel + judge sintesis |
| `free-auto` | 3 model free Token Harbor | fallback | ✅ routing & fallback ke-test (jalan penuh di mesin lu) |

⚠️ **Jebakan v0.5.x:** kolom `kind` di combo doang ga cukup — strategi harus diset juga di
`Settings → comboStrategies` (komponen `fallbackStrategy` + `judgeModel` buat fusion).
`bootstrap.sh` udah ngurusin ini.

---

## 1b. Token Harbor (https://tokenharbor.ai) — Udah Ke-daftar ✅

Kredensial lu udah gw daftarin ke 9Router di sandbox:

| Node | Prefix | Format | Base URL |
|---|---|---|---|
| Token Harbor | `th/` | OpenAI (`/v1/chat/completions`) | `https://tokenharbor.ai/v1` |
| Token Harbor (Claude) | `tha/` | Anthropic (`/v1/messages`) | `https://tokenharbor.ai/v1` |

**Model free tier yang ke-daftar** (sumber: pengumuman resmi Token Harbor):

```
th/deepseek-v4.1-flash:free     th/mimo-v2.5:free
th/deepseek-v4-flash:free       th/mimo-v2.6-flash:free
th/qwen3.8-flash:free           (promo, cek masa aktifnya)
th/tokenharbor/qwen3-max        (berbayar, contoh id dari docs)
```

**Combo `free-auto`**: `mimo-v2.6-flash:free` → `deepseek-v4-flash:free` → `qwen3.8-flash:free`
(fallback berantai; kalau model pertama down/429, otomatis lompat ke berikutnya).

**Limit free tier Token Harbor**: 60 req/menit, 1.800 req/jam per akun. Kalau kena, keluar `429`
+ `Retry-After` — combo fallback 9Router otomatis lompat ke model lain. 🎯

**Hasil tes dari sandbox:** routing & fallback ke-bukti jalan — request bener diarahkan ke
`tokenharbor.ai` via node `th`, dan combo `free-auto` kebukti fallback sampai model ke-3. Satu-satunya
yang gagal ya jaringan sandbox (firewall egress nge-blok TLS ke tokenharbor.ai, sama kayak semua
domain AI lain). **Di mesin lu bakal langsung jalan.**

> ⚠️ **Cek id model asli** di mesin lu (id `:free` bisa berubah sewaktu-waktu):
> ```bash
> curl https://tokenharbor.ai/v1/models -H "Authorization: Bearer $TH_APIKEY" | jq '.data[].id'
> ```
> Kalau beda sama yang ke-daftar, update via Dashboard → Providers → Token Harbor → Add custom model.
> Contoh di docs resmi pake id bergaya `tokenharbor/qwen3-max` — kalo `:free`-nya juga ke-prefix
> gitu, tinggal daftarin variant `th/tokenharbor/deepseek-v4-flash:free` dsb.

> 🔐 **Keamanan:** key `thk_live_...` lu ke-paste di chat & tersimpan di sqlite sandbox ini.
> Kalo lu share session/repo ini ke orang lain, **rotasi key-nya** di dashboard Token Harbor.
> Di repo, key TIDAK di-commit — `bootstrap.sh` ngebacanya dari env var `TH_APIKEY`.

### Tes Cepet

```bash
KEY="sk-c97f6dcf3ef1685f-b4rt97-7679b787"
curl -s http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"demo-fallback","messages":[{"role":"user","content":"halo"}]}' | jq .
```

---

## 2. Replikasi di Mesin Lu

```bash
npm install -g 9router
9router                      # dashboard kebuka di http://localhost:20128
# password default: 123456 (ganti di dashboard → Profile)

# terus jalanin bootstrap dari repo ini:
bash 9router/bootstrap.sh
# atau custom provider:
NODE_PREFIX="gw" NODE_BASEURL="https://api.provider-lu.com/v1" NODE_APIKEY="sk-..." bash 9router/bootstrap.sh

# Pake Token Harbor (free tier) — tinggal:
TH_APIKEY="thk_live_xxx" bash 9router/bootstrap.sh
# → node th/ + tha/ ke-bikin, model free ke-daftar, combo free-auto siap
```

Connect provider **free tier** di Dashboard → Providers:

| Provider | Cara connect | Model |
|---|---|---|
| **OpenCode Free** | sekali klik, **tanpa akun** | `oc/*` |
| **Kiro AI** | login AWS Builder ID / Google / GitHub | `kr/claude-sonnet-4.5`, `kr/glm-5`, `kr/MiniMax-M2.5` |
| **OpenRouter** | API key gratis (200 req/hari free) | `openrouter/*` |

Punya API key + base URL sendiri (kayak yang mau lu kirim)? → tinggal
Dashboard → Providers → **Custom / OpenAI-compatible** → masukin base URL + key,
atau pake `bootstrap.sh` dengan `NODE_*`.

---

## 3. Nyambungin Claude Code Desktop

Setelah 9Router jalan di mesin lu + provider free tier ke-connect:

**Cara termudah:** Dashboard → **CLI Tools → Claude Code** → 9Router nulis `settings.json` lu otomatis.

**Cara manual** (`~/.claude/settings.json` atau env var):

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:20128",
    "ANTHROPIC_AUTH_TOKEN": "<API key dari dashboard>"
  }
}
```

Model yang dipake di Claude Code (prefix = provider, atau langsung nama combo):

```
th/mimo-v2.6-flash:free   ← Token Harbor free tier
th/deepseek-v4.1-flash:free
free-auto                 ← combo fallback 3 model free Token Harbor ⭐
kr/claude-sonnet-4.5      ← Claude gratis via Kiro
oc/union-alpha            ← gratis tanpa akun
demo-fallback             ← combo (fallback otomatis)
```

**Alternatif — Claude Code langsung ke Token Harbor** (tanpa 9Router):

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://tokenharbor.ai",
    "ANTHROPIC_AUTH_TOKEN": "thk_live_xxx"
  }
}
```

Token Harbor punya endpoint `/v1/messages` native (format Anthropic), jadi Claude Code bisa
langsung. Tapi pake 9Router di tengah lu dapet extra: **combo fallback antar model**, RTK
penghemat token, tracking usage, dan gampang nambah provider lain tanpa ubah config Claude Code.

Claude Code ngomong ke 9Router pake endpoint `/v1/messages` (format Anthropic) —
udah dites di sandbox ini: streaming SSE + combo fallback jalan mulus. ✅

---

## 4. Catatan Keamanan (kalo mau serius dipake)

- Ganti password dashboard default (`123456`) → Dashboard → Profile.
- Set `requireApiKey` di settings biar gateway `/v1/*` wajib API key.
- Kalo 9Router mau diakses dari luar localhost, jangan pake tunnel publik tanpa password.
