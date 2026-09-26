// ============================================================
// omega-bridge — jembatan OpenAI-compatible ↔ OmegaTech API
// (https://omegatech-api.dixonomega.tech, tanpa API key)
//
// Naruh model-model OmegaTech (Blackbox, Llama, Qwen, dll) di
// balik endpoint /v1/chat/completions standar OpenAI, biar bisa
// didaftarin ke 9Router sebagai provider biasa.
//
// Pemakaian:
//   node server.js                        # OMEGA_BASE default = produksi
//   OMEGA_BASE=http://127.0.0.1:9997 node server.js   # tes lokal
//   PORT=9998 node server.js
// ============================================================
const http = require('http');
const https = require('https');

const PORT = parseInt(process.env.PORT || '9998', 10);
const OMEGA_BASE = (process.env.OMEGA_BASE || 'https://omegatech-api.dixonomega.tech').replace(/\/$/, '');

// ---- pemetaan model bridge -> endpoint OmegaTech ----
// e   = endpoint path, p = param pesan, extra = param tambahan
const MODELS = {
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

// ---- util: messages[] -> satu string prompt ----
function messagesToPrompt(messages, maxLen = 1500) {
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

// ---- util: ekstrak reply dari berbagai bentuk respons OmegaTech ----
function extractReply(j) {
  let r =
    j?.data?.reply ?? j?.reply ?? j?.data?.result ?? j?.result ??
    j?.data?.message ?? j?.data?.text ?? j?.message ?? null;
  if (typeof r === 'string' && r.includes('data:')) {
    // respons SSE mentah (mis. chatday): kumpulkan semua "delta":"..."
    const deltas = [...r.matchAll(/"delta"\s*:\s*"((?:[^"\\]|\\.)*)"/g)]
      .map((m) => { try { return JSON.parse('"' + m[1] + '"'); } catch { return m[1]; } });
    if (deltas.length) r = deltas.join('');
  }
  if (r && typeof r === 'object') r = JSON.stringify(r);
  return typeof r === 'string' && r.trim() ? r : null;
}

function callOmega(modelId, prompt) {
  const spec = MODELS[modelId];
  const qs = new URLSearchParams({ action: 'chat', [spec.p]: prompt, ...(spec.extra || {}) });
  const url = `${OMEGA_BASE}${spec.e}?${qs.toString()}`;
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.request(url, { timeout: 120000, headers: { 'User-Agent': 'omega-bridge/1.0' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`OmegaTech HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        }
        try {
          const j = JSON.parse(body);
          if (j.success === false) {
            return reject(new Error(`OmegaTech error: ${j.error || 'unknown'} (status ${j.statusCode || '?'})`));
          }
          const reply = extractReply(j);
          if (!reply) return reject(new Error('OmegaTech balas tanpa isi (reply kosong)'));
          resolve({ reply, sessionId: j.sessionId || j.data?.conversationId || null });
        } catch (err) {
          reject(new Error(`Gagal parse respons OmegaTech: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout 120s ke OmegaTech')); });
    req.on('error', (err) => reject(new Error(`Koneksi ke OmegaTech gagal: ${err.message}`)));
    req.end();
  });
}

const server = http.createServer((req, res) => {
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
    return json(200, {
      object: 'list',
      data: Object.entries(MODELS).map(([id, m]) => ({ id, object: 'model', owned_by: 'omegatech', label: m.label })),
    });
  }

  if (req.method === 'POST' && req.url.includes('/chat/completions')) {
    let body = '';
    req.on('data', (c) => (body += c));
    return req.on('end', async () => {
      let j = {};
      try { j = JSON.parse(body); } catch {}
      const modelId = j.model || 'blackbox';
      if (!MODELS[modelId]) return json(404, { error: { message: `Model '${modelId}' ga ada di omega-bridge. Liat /v1/models.`, type: 'invalid_request_error', code: 'model_not_found' } });
      const prompt = messagesToPrompt(j.messages);
      if (!prompt) return json(400, { error: { message: 'messages kosong', type: 'invalid_request_error' } });

      console.log(`[omega-bridge] ${new Date().toISOString()} model=${modelId} prompt=${prompt.slice(0, 80).replace(/\n/g, ' ')}...`);
      try {
        const { reply, sessionId } = await callOmega(modelId, prompt);
        const id = 'chatcmpl-omega-' + Date.now();
        if (!j.stream) {
          return json(200, {
            id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: modelId,
            choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            ...(sessionId ? { omega_session_id: sessionId } : {}),
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
        console.error(`[omega-bridge] GAGAL model=${modelId}: ${err.message}`);
        return json(502, { error: { message: `[omega-bridge/${modelId}] ${err.message}`, type: 'server_error', code: 'bad_gateway' } });
      }
    });
  }

  json(404, { error: { message: 'not found — pake /v1/models atau /v1/chat/completions' } });
});

server.listen(PORT, '0.0.0.0', () => console.log(`omega-bridge jalan di 0.0.0.0:${PORT} → ${OMEGA_BASE}`));
