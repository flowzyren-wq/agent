// Mock OpenAI-compatible LLM server for demonstrating 9Router combos locally.
// Models:
//   demo-fast  - always works, replies fast
//   demo-pro   - always works
//   demo-flaky - always returns 500 (to demo combo fallback)
const http = require('http');

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = { 'Content-Type': 'application/json' };

    if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
      res.writeHead(200, json);
      return res.end(
        JSON.stringify({
          object: 'list',
          data: [
            { id: 'demo-fast', object: 'model', owned_by: 'demo-local' },
            { id: 'demo-pro', object: 'model', owned_by: 'demo-local' },
            { id: 'demo-flaky', object: 'model', owned_by: 'demo-local' },
          ],
        })
      );
    }

    if (req.method === 'POST' && req.url.includes('/chat/completions')) {
      let j = {};
      try { j = JSON.parse(body); } catch {}
      const model = j.model || 'unknown';
      console.log(`[mock] ${new Date().toISOString()} POST ${req.url} model=${model} stream=${!!j.stream}`);

      if (model === 'demo-flaky') {
        res.writeHead(500, json);
        return res.end(
          JSON.stringify({
            error: {
              message: 'demo-flaky is down (simulated outage)',
              type: 'server_error',
              code: 'internal_server_error',
            },
          })
        );
      }

      const lastMsg = (j.messages || []).filter((m) => m.role === 'user').slice(-1)[0];
      const content = `Halo! Gw jawab pake model '${model}' dari mock provider lokal. Pesan lu: "${lastMsg ? lastMsg.content : ''}"`;

      // Non-stream response
      if (!j.stream) {
        res.writeHead(200, json);
        return res.end(
          JSON.stringify({
            id: 'chatcmpl-demo-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              { index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
          })
        );
      }

      // Streaming response (SSE)
      res.writeHead(200, { ...json, 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      const chunk = (delta) =>
        res.write(
          'data: ' +
            JSON.stringify({
              id: 'chatcmpl-demo-' + Date.now(),
              object: 'chat.completion.chunk',
              model,
              choices: [{ index: 0, delta, finish_reason: null }],
            }) +
          '\n\n'
        );
      chunk({ role: 'assistant' });
      for (const word of content.split(' ')) chunk({ content: word + ' ' });
      res.write(
        'data: ' +
          JSON.stringify({
            id: 'chatcmpl-demo-' + Date.now(),
            object: 'chat.completion.chunk',
            model,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          }) +
          '\n\n'
      );
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    res.writeHead(404, json);
    res.end(JSON.stringify({ error: { message: 'not found' } }));
  });
});

server.listen(9999, '0.0.0.0', () => console.log('Mock LLM listening on 0.0.0.0:9999'));
