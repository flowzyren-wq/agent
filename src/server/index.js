#!/usr/bin/env node
/**
 * OpenCode Desktop Mobile Gateway Server
 * 
 * Makes original OpenCode Desktop usable on Android and iOS
 * - Preserves original UI 100% (no rewrite)
 * - Adds mobile compatibility layer via injection
 * - Proxies to original opencode server (port 4096)
 * - PWA support for install on Android/iOS
 * 
 * Usage:
 *   node src/server/index.js
 *   OPENCODE_URL=http://localhost:4096 PORT=3000 node src/server/index.js
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SRC_DIR = path.join(ROOT, 'src');

const PORT = parseInt(process.env.PORT || '3000', 10);
const OPENCODE_URL = process.env.OPENCODE_URL || 'http://localhost:4096';
const HOST = process.env.HOST || '0.0.0.0';

console.log(`
╔══════════════════════════════════════════════════════════╗
║  OpenCode Desktop - Mobile Gateway                      ║
║  Membuat UI Desktop asli bisa dipakai di HP             ║
║  Preserves original UI, adds mobile compatibility       ║
╚══════════════════════════════════════════════════════════╝

Config:
  Gateway Port: ${PORT}
  OpenCode Server: ${OPENCODE_URL}
  Host: ${HOST}
  Root: ${ROOT}
`);

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function serveFile(res, filePath, statusCode = 200) {
  try {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: ' + filePath);
      return;
    }

    const content = fs.readFileSync(filePath);
    const mime = getMime(filePath);
    
    // Add CORS for mobile
    res.writeHead(statusCode, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': mime.includes('html') ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(content);
  } catch (e) {
    console.error('Serve file error:', e);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Error: ' + e.message);
  }
}

function serveMobileFile(res, subPath) {
  // Try multiple locations
  const candidates = [
    path.join(ROOT, subPath),
    path.join(SRC_DIR, subPath),
    path.join(ROOT, 'src', subPath.replace(/^\/?mobile\//, 'mobile/')),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return serveFile(res, candidate);
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Mobile file not found: ' + subPath);
}

// Proxy to OpenCode server with injection
async function proxyToOpenCode(req, res, targetUrl) {
  const url = new URL(req.url, targetUrl);
  const proxyUrl = new URL(url.pathname + url.search, targetUrl);

  console.log(`[Proxy] ${req.method} ${req.url} -> ${proxyUrl}`);

  try {
    const proxyReq = http.request(proxyUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: proxyUrl.host,
        // Remove headers that might cause issues
        'accept-encoding': 'identity'
      }
    }, (proxyRes) => {
      const contentType = proxyRes.headers['content-type'] || '';
      const isHtml = contentType.includes('text/html');

      // For HTML, we need to inject mobile bridge
      if (isHtml) {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => {
          // Inject mobile bridge
          const injected = injectMobileBridgeIntoHtml(body);
          
          // Copy headers but adjust
          const headers = { ...proxyRes.headers };
          delete headers['content-length'];
          delete headers['content-encoding'];
          headers['content-type'] = 'text/html; charset=utf-8';
          headers['access-control-allow-origin'] = '*';
          headers['cache-control'] = 'no-cache';

          res.writeHead(proxyRes.statusCode, headers);
          res.end(injected);
        });
      } else {
        // For non-HTML, stream directly
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy] Error:', err.message);
      // If opencode not running, serve wrapper page
      if (req.url === '/' || req.url.startsWith('/?')) {
        serveWrapperPage(res);
      } else {
        res.writeHead(502, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family:sans-serif;padding:20px">
            <h2>OpenCode Server tidak tersedia</h2>
            <p>Tidak bisa connect ke ${targetUrl}</p>
            <p>Error: ${err.message}</p>
            <p>Jalankan: <code>opencode serve --port 4096</code></p>
            <p><a href="/">Kembali</a></p>
          </body></html>
        `);
      }
    });

    // Pipe request body
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }

  } catch (e) {
    console.error('[Proxy] Exception:', e);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy error: ' + e.message);
  }
}

function injectMobileBridgeIntoHtml(html) {
  if (!html || typeof html !== 'string') return html;

  // Already injected?
  if (html.includes('opencode-mobile') || html.includes('OpenCodeMobileBridge')) {
    return html;
  }

  const injection = `
    <!-- OpenCode Mobile Bridge - Preserves original desktop UI -->
    <link rel="stylesheet" href="/mobile/styles.css" />
    <script type="module">
      // Early mobile detection
      (function(){
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 768 || ('ontouchstart' in window);
        if(isMobile) document.documentElement.classList.add('opencode-mobile');
      })();
    </script>
    <script type="module" src="/mobile/bridge.js"></script>
  `;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${injection}\n</head>`);
  } else if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${injection}`);
  }
  return injection + html;
}

function serveWrapperPage(res) {
  const wrapperPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(wrapperPath)) {
    serveFile(res, wrapperPath);
  } else {
    // Generate inline wrapper
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>OpenCode Desktop - Mobile Gateway</title>
<link rel="stylesheet" href="/mobile/styles.css">
<style>
body{font-family:-apple-system,sans-serif;background:#fafafa;color:#191515;margin:0;padding:20px;padding-top:calc(20px + env(safe-area-inset-top));}
.card{background:white;border-radius:16px;padding:24px;max-width:600px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.08)}
h1{font-size:20px;margin-bottom:8px}
p{font-size:14px;line-height:1.6;opacity:0.8}
code{background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:13px}
.btn{display:inline-block;margin-top:16px;padding:10px 20px;background:#191515;color:white;border-radius:8px;text-decoration:none;font-size:14px}
</style>
</head>
<body>
<div class="card">
<h1>📱 OpenCode Desktop Mobile Gateway</h1>
<p><strong>UI Desktop asli, dioptimalkan untuk HP.</strong></p>
<p>Gateway ini akan proxy ke OpenCode server di <code>${OPENCODE_URL}</code> dan inject mobile compatibility layer tanpa mengubah UI asli.</p>
<p style="margin-top:16px"><strong>Cara pakai:</strong><br>
1. Jalankan <code>opencode serve --port 4096</code><br>
2. Buka gateway ini di HP Android/iOS<br>
3. UI Desktop asli akan muncul dengan adaptasi touch</p>
<a class="btn" href="${OPENCODE_URL}">Buka OpenCode Langsung</a>
<a class="btn" style="background:white;color:#191515;border:1px solid #ddd;margin-left:8px" href="/test">Test Mobile</a>
</div>
<script type="module" src="/mobile/bridge.js"></script>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }
}

function serveTestPage(res) {
  const testPath = path.join(PUBLIC_DIR, 'test.html');
  if (fs.existsSync(testPath)) {
    serveFile(res, testPath);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Test Mobile - OpenCode</title>
<link rel="stylesheet" href="/mobile/styles.css">
<style>
body{font-family:-apple-system,sans-serif;padding:16px;background:#fafafa}
.test{max-width:600px;margin:0 auto}
.item{background:white;padding:16px;border-radius:12px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.pass{color:#16a34a} .fail{color:#dc2626}
</style>
</head>
<body>
<div class="test">
<h2>🧪 Mobile Compatibility Test</h2>
<div id="results"></div>
</div>
<script type="module">
import '/mobile/bridge.js';
setTimeout(()=>{
  const info = window.OpenCodeMobile?.getInfo?.() || {};
  const tests = [
    ['Touch Support', 'ontouchstart' in window],
    ['VisualViewport', !!window.visualViewport],
    ['Safe Area', CSS.supports('padding: env(safe-area-inset-top)')],
    ['DVH Unit', CSS.supports('height: 100dvh')],
    ['Touch Action', CSS.supports('touch-action: manipulation')],
    ['Mobile Detected', info.isMobile || /Mobile/i.test(navigator.userAgent)],
    ['Bridge Loaded', !!window.OpenCodeMobile],
    ['Toolbar', !!document.querySelector('.mobile-toolbar')],
  ];
  document.getElementById('results').innerHTML = tests.map(([name, ok])=>\`
    <div class="item"><span class="\${ok?'pass':'fail'}">\${ok?'✓':'✗'}</span> \${name}: \${ok?'PASS':'FAIL'}</div>
  \`).join('') + \`<div class="item"><pre>\${JSON.stringify(info, null, 2)}</pre></div>\`;
}, 500);
</script>
</body>
</html>
    `);
  }
}

// Main server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  console.log(`[Request] ${req.method} ${pathname} UA: ${req.headers['user-agent']?.slice(0,60)}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // Mobile bridge files
  if (pathname.startsWith('/mobile/')) {
    const subPath = pathname.replace(/^\//, '');
    return serveMobileFile(res, subPath);
  }

  // Public files
  if (pathname === '/manifest.json' || pathname === '/site.webmanifest') {
    const manifestPath = path.join(PUBLIC_DIR, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      return serveFile(res, manifestPath);
    }
    // Generate manifest
    const manifest = {
      name: "OpenCode Desktop - Mobile",
      short_name: "OpenCode",
      description: "Original OpenCode Desktop UI optimized for Android and iOS",
      start_url: "/",
      display: "standalone",
      background_color: "#fafafa",
      theme_color: "#191515",
      orientation: "any",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
      ]
    };
    res.writeHead(200, { 'Content-Type': 'application/manifest+json' });
    res.end(JSON.stringify(manifest, null, 2));
    return;
  }

  if (pathname.startsWith('/icons/')) {
    const iconPath = path.join(PUBLIC_DIR, pathname);
    if (fs.existsSync(iconPath)) {
      return serveFile(res, iconPath);
    }
    res.writeHead(404);
    res.end('Icon not found');
    return;
  }

  // Test page
  if (pathname === '/test') {
    return serveTestPage(res);
  }

  // Phone-only page
  if (pathname === '/phone-only' || pathname === '/hp-only' || pathname === '/android' || pathname === '/ios') {
    const phonePath = path.join(PUBLIC_DIR, 'phone-only.html');
    if (fs.existsSync(phonePath)) {
      return serveFile(res, phonePath);
    }
  }

  // Scripts
  if (pathname.startsWith('/scripts/')) {
    const scriptPath = path.join(ROOT, pathname);
    if (fs.existsSync(scriptPath)) {
      return serveFile(res, scriptPath);
    }
  }

  // Docs
  if (pathname.startsWith('/docs/')) {
    const docPath = path.join(ROOT, pathname);
    if (fs.existsSync(docPath)) {
      return serveFile(res, docPath);
    }
  }

  // Health check
  if (pathname === '/health' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      gateway: 'opencode-mobile',
      opencode_url: OPENCODE_URL,
      timestamp: new Date().toISOString(),
      mobile: true
    }));
    return;
  }

  // Try to proxy to OpenCode if it's likely an OpenCode route
  // OpenCode serves API at /api, and UI at /
  const isAsset = pathname.match(/\.(js|css|png|jpg|svg|woff|woff2|json|ico|map)$/);
  const isApi = pathname.startsWith('/api') || pathname.startsWith('/events') || pathname.startsWith('/auth');

  // For root and unknown, check if OpenCode is running
  // We try proxy first, fallback to wrapper
  if (pathname === '/' || isAsset || isApi || pathname.startsWith('/session') || pathname.startsWith('/project')) {
    // Check if OpenCode server is reachable via quick probe
    // For simplicity, always proxy for these paths, with fallback
    return proxyToOpenCode(req, res, OPENCODE_URL);
  }

  // Default: serve public/index.html or wrapper
  if (pathname === '/' || pathname === '/index.html') {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      return serveFile(res, indexPath);
    }
    return serveWrapperPage(res);
  }

  // 404 for unknown
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`
    <html><body style="font-family:sans-serif;padding:20px">
      <h3>404 - Not Found</h3>
      <p>Path: ${pathname}</p>
      <p><a href="/">Go Home</a> | <a href="/test">Test Mobile</a></p>
    </body></html>
  `);
});

server.listen(PORT, HOST, () => {
  console.log(`
✅ Gateway running!

  Local:   http://localhost:${PORT}
  Network: http://${HOST}:${PORT}
  Mobile:  Use your phone's browser to open the network URL

  OpenCode Server: ${OPENCODE_URL}
  
  Endpoints:
    /           -> OpenCode UI with mobile bridge (proxied)
    /test       -> Mobile compatibility test
    /health     -> Health check
    /mobile/*   -> Mobile bridge assets
    /manifest.json -> PWA manifest

  📱 For Android/iOS:
    1. Make sure opencode serve is running: opencode serve --port 4096
    2. Open http://${HOST}:${PORT} in phone browser
    3. Original desktop UI will appear, optimized for touch
    4. Add to Home Screen for PWA install

  🔍 Original UI preserved: sidebar, editor, terminal, chat, etc. remain 100% original
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
});
