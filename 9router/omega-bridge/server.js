// ============================================================
// free-bridge — jembatan OpenAI-compatible ↔ API gratis custom
//
// Dua profile (pilih via env PROFILE):
//   omega → https://omegatech-api.dixonomega.tech (tanpa key)
//   fazz  → https://api.fazzcode.eu.cc   (key via FAZZ_APIKEY,
//           dikirim sebagai Authorization: Bearer)
//
// Pemakaian:
//   PROFILE=omega PORT=9998 node server.js
//   PROFILE=fazz  PORT=9995 FAZZ_APIKEY=fcs_live_xxx node server.js
//
// Tes lokal (lawan fake):
//   PROFILE=fazz PORT=9995 F AZZ_BASE... → pakai FAZZ_BASE=http://127.0.0.1:9997
//   PROFILE=omega OMEGA_BASE=http://127.0.0.1:9997
// ============================================================
const http = require('http');
const https = require('https');

const PORT = parseInt(process.env.PORT || '9998', 10);
const PROFILE = process.env.PROFILE || 'omega';

const BASES = {
  omega: (process.env.OMEGA_BASE || 'https://omegatech-api.dixonomega.tech').replace(/\/$/, ''),
  fazz: (process.env.FAZZ_BASE || 'https://api.fazzcode.eu.cc').replace(/\/$/, ''),
};

// ---- model-model OmegaTech (profile: omega) ----
const OMEGA_MODELS = {
  'blackbox':        { e: '/api/ai/Blackbox', p: 'prompt', label: 'Blackbox AI (80+ model, paling bagus buat coding)' },
  'fable-5':         { e: '/api/ai/Blackbox', p: 'prompt', extra: { model: 'fable-5' }, label: 'Fable 5 via Blackbox' },
  'llama':           { e: '/api/ai/chatday',  p: 'message', extra: { model: 'meta/llama-4-maverick' }, label: 'Llama 4 Maverick (Meta)' },
  'llama-3.3':       { e: '/api/ai/Aicli',    p: 'query',  extra: { model: 'llama33' }, label: 'Llama 3.3 (Aicli)' },
  'gpt-5.6':         { e: '/api/ai/chatday',  p: 'message', extra: { model: 'openai/gpt-5.6-terra' }, label: 'GPT-5.6 Terra' },
  'claude-sonnet-5': { e: '/api/ai/chatday',  p: 'message', extra: { model: 'anthropic/claude-sonnet-5' }, label: 'Claude Sonnet 5' },
  'claude-haiku-4.5':{ e: '/api/ai/chatday',  p: 'message', extra: { model: 'anthropic/claude-haiku-4.5' }, label: 'Claude Haiku 4.5' },
  'grok-4.6':        { e: '/api/ai/chatday',  p: 'message', extra: { model: 'xai/grok-4.6' }, label: 'Grok 4.6' },
  'kimi-k3':         { e: '/api/ai/chatday',  p: 'message', extra: { model: 'moonshotai/kimi-k3' }, label: 'Kimi K3' },
  'glm-5.3':         { e: '/api/ai/chatday',  p: 'message', extra: { model: 'zai/glm-5.3' }, label: 'GLM 5.3' },
  'qwen3-max':       { e: '/api/ai/chatday',  p: 'message', extra: { model: 'alibaba/qwen3-max' }, label: 'Qwen3 Max' },
  'deepseek-v4':     { e: '/api/ai/chatday',  p: 'message', extra: { model: 'deepseek/deepseek-v4-flash' }, label: 'DeepSeek V4 Flash' },
  'qwencoder':       { e: '/api/ai/Aicli',    p: 'query',  extra: { model: 'qwencoder' }, label: 'Qwen Coder (Aicli)' },
  'deepseek-r1':     { e: '/api/ai/Aicli',    p: 'query',  extra: { model: 'deepseek_r1' }, label: 'DeepSeek R1 (Aicli)' },
  'qwen':            { e: '/api/ai/Qwen',     p: 'message', label: 'Qwen (Omegatech)' },
};

// ---- model-model FazzCode (profile: fazz) ----
// Router (/router/*) lagi di-lock otomatis pihak FazzCode pas dicek —
// didaftar tetap, biar langsung kepake pas mereka benerin.
const FAZZ_MODELS = {
  'gemini':            { e: '/gemini', p: 'prompt', label: 'Gemini (FazzCode) — LIVE ✅' },
  'claude-sonnet-5':   { e: '/claude-sonnet-5', p: 'prompt', label: 'Claude Sonnet-5 (upstream banned pas dicek 26 Sep)' },
  'turboseek':         { e: '/turboseek', p: 'question', label: 'TurboSeek (search QA)' },
  'claude-opus-4.8':   { e: '/router/claude-opus-4.8', p: 'prompt', label: 'Claude Opus 4.8 (router)' },
  'claude-sonnet-4.6': { e: '/router/claude-sonnet-4.6', p: 'prompt', label: 'Claude Sonnet 4.6 (router)' },
  'gpt-5':             { e: '/router/gpt-5', p: 'prompt', label: 'GPT-5 (router)' },
  'gpt-5-mini':        { e: '/router/gpt-5-mini', p: 'prompt', label: 'GPT-5 Mini (router)' },
  'gemini-3-pro':      { e: '/router/gemini-3-pro', p: 'prompt', label: 'Gemini 3 Pro (router)' },
  'grok-4':            { e: '/router/grok-4', p: 'prompt', label: 'Grok 4 (router)' },
  'kimi-k2.6':         { e: '/router/kimi-k2.6', p: 'prompt', label: 'Kimi K2.6 (router)' },
  'qwen3-max':         { e: '/router/qwen3-max', p: 'prompt', label: 'Qwen 3 Max (router)' },
  'deepseek-v4-flash': { e: '/router/deepseek-v4-flash', p: 'prompt', label: 'DeepSeek V4 Flash (router)' },
  'glm-5.3-flash-free':{ e: '/router/glm-5.3-flash-free', p: 'prompt', label: 'GLM 5.3 Flash Free (router)' },
  'tencent-hy3-free':  { e: '/router/tencent-hy3-free', p: 'prompt', label: 'Tencent HY3 Free (router)' },
  'nemotron-3-ultra':  { e: '/router/nemotron-3-ultra', p: 'prompt', label: 'Nemotron 3 Ultra (router)' },
  'mistral-large-3':   { e: '/router/mistral-large-3', p: 'prompt', label: 'Mistral Large 3 (router)' },
};

const MODELS = PROFILE === 'fazz' ? FAZZ_MODELS : OMEGA_MODELS;
const BASE = BASES[PROFILE];

// ---- util: messages[] -> satu string prompt ----
function messagesToPrompt(messages, maxLen = 4000) {
  if (!Array.isArray(messages) || !messages.length) return '';
  const parts = messages.map((m) => {
    const role = m.role || 'user';
    const content = typeof m.content === 'string' ? m.content
      : Array.isArray(m.content) ? m.content.map((c) => c.text || '').join(' ')
      : '';
    if (role === 'system') return `[Instruksi sistem]: ${content}`;
    if (role === 'assistant') return `[Jawaban sebelumnya]: ${content}`;
    return content;
  });
  let prompt = messages.length === 1 ? parts[0] : parts.join('\n\n');
  if (prompt.length > maxLen) prompt = prompt.slice(0, maxLen) + '\n[...]';
  return prompt;
}

// ---- util: ekstrak reply dari berbagai bentuk respons ----
function extractReply(j) {
  let r =
    j?.data?.reply ?? j?.reply ?? j?.data?.result ?? j?.result ??
    j?.data?.response ?? j?.response ?? j?.result?.response ??
    j?.data?.message ?? j?.data?.text ?? j?.message ?? null;
  if (typeof r === 'string' && r.includes('data:')) {
    const deltas = [...r.matchAll(/"delta"\s*:\s*"((?:[^"\\]|\\.)*)"/g)]
      .map((m) => { try { return JSON.parse('"' + m[1] + '"'); } catch { return m[1]; } });
    if (deltas.length) r = deltas.join('');
  }
  if (r && typeof r === 'object') {
    // bentuk FazzCode: { result: { response: "..." } }
    if (typeof r.response === 'string') r = r.response;
    else r = JSON.stringify(r);
  }
  return typeof r === 'string' && r.trim() ? r : null;
}

function callUpstream(modelId, prompt) {
  const spec = MODELS[modelId];
  const qs = new URLSearchParams({ action: 'chat', [spec.p]: prompt, ...(spec.extra || {}) });
  // FazzCode: action ga dipakai — buang biar URL bersih
  if (PROFILE === 'fazz') qs.delete('action');
  const url = `${BASE}${spec.e}?${qs.toString()}`;
  const headers = { 'User-Agent': 'free-bridge/1.0' };
  if (PROFILE === 'fazz' && process.env.FAZZ_APIKEY) {
    headers['Authorization'] = `Bearer ${process.env.FAZZ_APIKEY}`;
  }
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.request(url, { timeout: 120000, headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`upstream HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        }
        try {
          const j = JSON.parse(body);
          if (j.success === false || j.status === 'error') {
            return reject(new Error(`upstream: ${j.message || j.error || 'unknown error'}${j.code ? ` (code ${j.code})` : ''}`));
          }
          const reply = extractReply(j);
          if (!reply) return reject(new Error('upstream balas tanpa isi (reply kosong)'));
          resolve({ reply, sessionId: j.sessionId || j.data?.conversationId || j.result?.session_id || null });
        } catch (err) {
          reject(new Error(`Gagal parse respons upstream: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout 120s ke upstream')); });
    req.on('error', (err) => reject(new Error(`Koneksi ke upstream gagal: ${err.message}`)));
    req.end();
  });
}

const server = http.createServer((req, res) => {
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
    return json(200, {
      object: 'list',
      data: Object.entries(MODELS).map(([id, m]) => ({ id, object: 'model', owned_by: PROFILE, label: m.label })),
    });
  }

  if (req.method === 'POST' && req.url.includes('/chat/completions')) {
    let body = '';
    req.on('data', (c) => (body += c));
    return req.on('end', async () => {
      let j = {};
      try { j = JSON.parse(body); } catch {}
      const modelId = j.model || Object.keys(MODELS)[0];
      if (!MODELS[modelId]) return json(404, { error: { message: `Model '${modelId}' ga ada di bridge (profile: ${PROFILE}). Liat /v1/models.`, type: 'invalid_request_error', code: 'model_not_found' } });
      const prompt = messagesToPrompt(j.messages);
      if (!prompt) return json(400, { error: { message: 'messages kosong', type: 'invalid_request_error' } });

      console.log(`[free-bridge:${PROFILE}] ${new Date().toISOString()} model=${modelId} prompt=${prompt.slice(0, 80).replace(/\n/g, ' ')}...`);
      try {
        const { reply, sessionId } = await callUpstream(modelId, prompt);
        const id = 'chatcmpl-bridge-' + Date.now();
        if (!j.stream) {
          return json(200, {
            id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: modelId,
            choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            ...(sessionId ? { bridge_session_id: sessionId } : {}),
          });
        }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        const chunk = (delta, finish = null) =>
          res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', model: modelId, choices: [{ index: 0, delta, finish_reason: finish }] }) + '\n\n');
        chunk({ role: 'assistant' });
        for (const w of reply.split(/(\s+)/)) if (w) chunk({ content: w });
        chunk({}, 'stop');
        res.write('data: [DONE]\n\n');
        return res.end();
      } catch (err) {
        console.error(`[free-bridge:${PROFILE}] GAGAL model=${modelId}: ${err.message}`);
        return json(502, { error: { message: `[free-bridge:${PROFILE}/${modelId}] ${err.message}`, type: 'server_error', code: 'bad_gateway' } });
      }
    });
  }

  json(404, { error: { message: 'not found — pake /v1/models atau /v1/chat/completions' } });
});

server.listen(PORT, '0.0.0.0', () => console.log(`free-bridge (${PROFILE}) jalan di 0.0.0.0:${PORT} → ${BASE}`));
