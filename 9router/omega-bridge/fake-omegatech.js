// ============================================================
// fake-omegatech — mock server yang meniru format respons
// OmegaTech API + FazzCode API (buat tes free-bridge secara lokal).
//
// Bentuk respons yang ditiru:
//   OMEGATECH:
//     /api/ai/Qwen     → { success, reply }
//     /api/ai/chatday  → { success, data: { reply: "<SSE mentah>" } }
//     /api/ai/Blackbox → { success, data: { reply } }
//     /api/ai/Aicli    → { success, result }
//   FAZZCODE:
//     /gemini          → { status: "success", result: { response } }
//     /claude-sonnet-5 → { status: "success", result: "<string>" }
//     /router/*        → { status: "success", result: { response } }
// ============================================================
const http = require('http');
const PORT = parseInt(process.env.PORT || '9997', 10);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  if (url.pathname === '/api/ai/Qwen') {
    const msg = url.searchParams.get('message') || '';
    return send({ statusCode: 200, success: true, source: 'Omegatech', reply: `[Qwen-mock] Halo! Lu nanya: "${msg}". Gw model Qwen dari fake OmegaTech.`, timestamp: new Date().toISOString() });
  }
  if (url.pathname === '/api/ai/chatday') {
    const msg = url.searchParams.get('message') || '';
    const model = url.searchParams.get('model') || 'unknown';
    const text = `[chatday-mock:${model}] Hai! Pesan lu: "${msg}". Ini jawaban dari fake OmegaTech.`;
    const sse = 'data: {"type":"text-start","id":"x"}\n\n' +
      text.split(/(\s+)/).filter(Boolean).map((w) => 'data: ' + JSON.stringify({ type: 'text-delta', delta: w }) + '\n\n').join('') +
      'data: {"type":"text-end","id":"x"}\n\ndata: [DONE]\n\n';
    return send({ statusCode: 200, success: true, source: 'Omegatech', data: { reply: sse, model, conversationId: 'fake-conv-1' }, timestamp: new Date().toISOString() });
  }
  if (url.pathname === '/api/ai/Blackbox') {
    const msg = url.searchParams.get('prompt') || '';
    const model = url.searchParams.get('model');
    return send({ statusCode: 200, success: true, source: 'Omegatech', data: { reply: `[blackbox-mock${model ? ':' + model : ''}] Siap bos! Prompt lu: "${msg}". Gw blackbox fake, siap bantu coding.`, model: model || 'default' }, timestamp: new Date().toISOString() });
  }
  if (url.pathname === '/api/ai/Aicli') {
    const msg = url.searchParams.get('query') || '';
    const model = url.searchParams.get('model') || 'unknown';
    return send({ statusCode: 200, success: true, source: 'Omegatech', result: `[aicli-mock:${model}] Oke! Query lu: "${msg}". Jawaban dari fake Aicli.` });
  }
  // ---- FazzCode ----
  const auth = req.headers['authorization'] || '';
  if (url.pathname.startsWith('/gemini') || url.pathname.startsWith('/claude-sonnet-5') || url.pathname.startsWith('/router/') || url.pathname.startsWith('/turboseek')) {
    if (!auth.includes('fcs_live')) {
      return send({ status: 'error', creator: 'fazzcode', message: 'API key is required. Send as "Authorization: Bearer YOUR_KEY" or "?api_key=YOUR_KEY".', code: 'MISSING_API_KEY' });
    }
    const q = url.searchParams.get('prompt') || url.searchParams.get('question') || '';
    const isGemini = url.pathname === '/gemini';
    const isSonnet = url.pathname === '/claude-sonnet-5';
    const label = url.pathname.replace('/router/', 'router:').replace('/', '');
    if (isGemini) {
      return send({ status: 'success', creator: 'fazzcode', message: 'Berhasil', result: { response: `[fazz-gemini-mock] Halo! Prompt lu: "${q}". Jawaban dari fake FazzCode Gemini.`, session_id: 'fake-session', response_length: 42, word_count: 9 } });
    }
    if (isSonnet) {
      return send({ status: 'success', creator: 'fazzcode', message: 'Berhasil', result: `[fazz-sonnet5-mock] Siap! Prompt lu: "${q}". Claude Sonnet-5 fake, siap bantu coding.` });
    }
    return send({ status: 'success', creator: 'fazzcode', message: 'Berhasil', result: { response: `[fazz-${label}-mock] Oke! Prompt lu: "${q}". Jawaban dari fake router FazzCode.` } });
  }
  send({ statusCode: 404, success: false, error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`fake-omegatech jalan di 0.0.0.0:${PORT}`));
