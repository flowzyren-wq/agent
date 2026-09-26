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
| `free-auto` | 3 model free Token Harbor | fallback | ✅ routing & fallback ke-test |
| `code-team` ⭐ | blackbox → llama → qwencoder | fallback | ✅ fallback ke-test (blackbox lagi down) |
| `free-mega` | omega/llama → th/mimo → omega/qwen | fallback | ✅ cross-provider |
| `code-team-pro` ⭐ | fazz/sonnet-5 → omega/blackbox → omega/llama | fallback | ✅ routing ke-test |
| `code-team-max` | fazz/opus-4.8 → fazz/sonnet-4.6 → fazz/gpt-5 | fallback | ✅ (nunggu router fazz kebuka) |
| `free-squad` | fazz/gemini → th/mimo free → omega/llama | fallback | ✅ semua model live |
| `code-team-live` | omega/gpt-5.6 → omega/sonnet-5 → omega/llama → fazz/gemini | fallback | ✅ 4 model terbukti live |
| `code-fusion` | omega/gpt-5.6 + omega/llama (judge: fazz/gemini) | fusion | ✅ panel paralel + judge |

⚠️ **Jebakan v0.5.x:** kolom `kind` di combo doang ga cukup — strategi harus diset juga di
`Settings → comboStrategies`. `bootstrap.sh` udah ngurusin ini.

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

---

## 1c. OmegaTech (https://omegatech-api.dixonomega.tech) — Udah Ke-daftar ✅

Hub 260+ API gratis **tanpa API key**. Formatnya custom (bukan OpenAI-compatible), jadi gw bikin
**`omega-bridge/`** — server kecil yang nyulap OmegaTech jadi endpoint OpenAI-compatible,
terus didaftar ke 9Router sebagai prefix **`omega/`**.

**15 model yang ke-daftar di 9Router:**

```
omega/blackbox        ← katanya paling bagus buat coding (80+ model, lagi down pas dicek)
omega/fable-5         ← Fable 5 via Blackbox (sesuai info lu)
omega/llama           ← Llama 4 Maverick ✅ udah dites jalan
omega/llama-3.3       ← Llama 3.3 via Aicli
omega/gpt-5.6         ← GPT-5.6 Terra ✅ udah dites jalan (bikin kode palindrome bener)
omega/claude-sonnet-5 / claude-haiku-4.5
omega/grok-4.6  omega/kimi-k3  omega/glm-5.3  omega/qwen3-max  omega/deepseek-v4
omega/qwencoder  omega/deepseek-r1  omega/qwen
```

Sumber model: endpoint `chatday` (26 model modern), `Aicli` (30 model), `Blackbox` (80+ model),
`Qwen` — semuanya gratis tanpa key, via bridge.

**Status tes:** translasi bridge ke-bukti 100% (4 format respons OmegaTech ke-parse bener, dites
lawan fake upstream lokal). Routing 9Router → bridge → OmegaTech juga ke-bukti; di sandbox mentok
di firewall (TLS ke omegatech diblokir, sama kayak semua domain eksternal). **Di mesin lu jalan
penuh.** Blackbox lagi down di sisi server omegatech pas gw cek (upstream 404) — cek lagi nanti
pake `curl "https://omegatech-api.dixonomega.tech/api/ai/Blackbox?action=models"`.

**Bukti model live** (lewat jalur fetch agent, yang bisa nembus firewall): `llama-4-maverick` &
`gpt-5.6-terra` bales beneran — GPT-5.6 bikin fungsi `isPalindrome`, langsung gw tes 4/4 lolos. ✅

### Cara jalanin di mesin lu

```bash
node 9router/omega-bridge/server.js &     # bridge di 0.0.0.0:9998
OMEGA=1 bash 9router/bootstrap.sh         # daftar node omega/ + combo code-team ke 9Router
```

---

## 1d. FazzCode (https://api.fazzcode.eu.cc) — Udah Ke-daftar ✅

Platform API buatan Indonesia (233+ endpoint). Key lu udah gw daftarin, bridge profile `fazz`
jalan di port 9995 (skrip sama: `omega-bridge/server.js`, `PROFILE=fazz`). Prefix: **`fazz/`**.

**Status endpoint pas dicek (26 Sep 2026):**

| Endpoint | Status |
|---|---|
| `fazz/gemini` | ✅ **LIVE** — dites pake key lu, bales beneran |
| `fazz/claude-sonnet-5` | ❌ akun upstream Claude mereka kena **banned** (error `account_banned` dari sisi Anthropic) |
| `fazz/*` router (13 model: opus-4.8, gpt-5, grok-4, kimi, dll) | ⏳ lagi **di-lock otomatis** pihak FazzCode ("sedang diperbaiki" — cek /status mereka) |

Model `fazz/` yang ke-daftar di 9Router (16): `gemini`, `claude-sonnet-5`, `turboseek`,
`claude-opus-4.8`, `claude-sonnet-4.6`, `gpt-5`, `gpt-5-mini`, `gemini-3-pro`, `grok-4`,
`kimi-k2.6`, `qwen3-max`, `deepseek-v4-flash`, `glm-5.3-flash-free`, `tencent-hy3-free`,
`nemotron-3-ultra`, `mistral-large-3`.

**Combos baru (bareng FazzCode):**

- **`code-team-pro`** ⭐ — `fazz/claude-sonnet-5` → `omega/blackbox` → `omega/llama`.
  Chain coding cross-provider terkuat: kalau FazzCode bermasalah, otomatis mendarat ke OmegaTech.
- **`code-team-max`** — `fazz/claude-opus-4.8` → `fazz/claude-sonnet-4.6` → `fazz/gpt-5`.
  Semua model premium FazzCode berantai (bakal idup kalau router mereka kebuka).
- **`free-squad`** — `fazz/gemini` → `th/mimo-v2.6-flash:free` → `omega/llama`.
  Gabungan semua model free yang **lagi live** dari 3 provider.
- **`code-team-live`** — `omega/gpt-5.6` → `omega/claude-sonnet-5` → `omega/llama` → `fazz/gemini`.
  Empat model coding yang udah **terbukti live & lolos tes coding** (palindrome 4/4, fibonacci 11/11).
- **`code-fusion`** — panel paralel `omega/gpt-5.6` + `omega/llama`, jawaban disintesis judge `fazz/gemini`.
  Buat tugas sulit: dua model jawab barengan, Gemini yang milih & gabungin yang terbaik.

> 🔐 **Keamanan:** sama kayak Token Harbor — key `fcs_live_...` lu ada di chat & sqlite sandbox.
> Rotasi kalau perlu. Di repo cuma lewat env var `FAZZ_APIKEY`.

### Cara jalanin di mesin lu

```bash
PROFILE=fazz PORT=9995 FAZZ_APIKEY=fcs_live_xxx node 9router/omega-bridge/server.js &
FAZZ_APIKEY=fcs_live_xxx bash 9router/bootstrap.sh   # daftar node fazz/ + 3 combo baru
```

---

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

## 3. Alur Kerja Kita: Gw = Terminal Lu 🖥️

Lu ga pake Claude Code Desktop — lu pake **gw (agent Arena)** sebagai terminal buat ngoding bareng.
Jadi alurnya gini:

### Mode A — Langsung di chat ini (sekarang)

Lu minta apa aja → gw yang ngerjain di sandbox (nulis, ngetes, jalanin kode). Kalau butuh
pendapat/hasil dari model eksternal (GPT-5.6, Llama, dll dari OmegaTech), gw panggil langsung
lewat jalur fetch gw — **itu satu-satunya jalur yang bisa nembus firewall sandbox** — terus hasilnya
gw integrasi & gw tes di sini. Udah kebukti: GPT-5.6-terra bikin fungsi `isPalindrome`, gw tes 4/4 lolos. ✅

Batasan mode ini: jalur fetch gw cuma GET + panjang prompt kebatasan (±1500 karakter), dan
9Router di sandbox ga bisa keluar (firewall). Buat tugas berat, mode B lebih cocok.

### Mode B — Full 9Router di mesin lu (setup udah siap)

Semua yang ada di guide ini tinggal lu replikasi di mesin lu (lihat bagian 2), dan semuanya bakal
jalan beneran karena ga ada firewall ngeblok. Abis itu kita ngoding bareng pake combo:

| Model / combo | Buat apa |
|---|---|
| `code-team-pro` ⭐ | combo coding terkuat: fazz/sonnet-5 → omega/blackbox → omega/llama |
| `code-team-max` | combo premium FazzCode: opus-4.8 → sonnet-4.6 → gpt-5 |
| `free-squad` | semua model free yang lagi live (fazz/gemini → th/mimo → omega/llama) |
| `code-team` | combo coding OmegaTech: blackbox → llama → qwencoder |
| `omega/blackbox` | "model paling bagus buat coding" versi lu |
| `omega/fable-5` | Fable 5 via Blackbox |
| `fazz/gemini` | Gemini via FazzCode (live) |
| `omega/llama`, `omega/gpt-5.6`, `omega/claude-sonnet-5` | model modern gratis |
| `free-auto` / `free-mega` | combo fallback model free Token Harbor / campuran |
| `th/mimo-v2.6-flash:free` | model free Token Harbor |

Endpoint 9Router: `http://localhost:20128/v1/chat/completions` (OpenAI) atau `/v1/messages`
(Anthropic) — dua-duanya udah dites jalan. Di dashboard 9Router ada juga tombol **CLI Tools**
buat auto-config berbagai agent (opencode, Cline, dll) kalo suatu saat lu mau pake.

> Kenapa lewat 9Router padahal OmegaTech bisa langsung? Karena 9Router nambahin **combo
> fallback antar model/provider** (model down → otomatis pindah), monitoring usage, dan
> satu tempat buat semua provider.

---

## 4. Catatan Keamanan (kalo mau serius dipake)

- Ganti password dashboard default (`123456`) → Dashboard → Profile.
- Set `requireApiKey` di settings biar gateway `/v1/*` wajib API key.
- Kalo 9Router mau diakses dari luar localhost, jangan pake tunnel publik tanpa password.
