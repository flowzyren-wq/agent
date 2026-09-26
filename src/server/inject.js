/**
 * HTML Injector - Injects mobile compatibility layer into original OpenCode UI
 * Preserves original UI 100%, only adds mobile bridge
 */

export function injectMobileBridge(html, options = {}) {
  const {
    basePath = '',
    enableBridge = true,
    opencodeServerUrl = 'http://localhost:4096'
  } = options;

  if (!enableBridge) return html;

  // Check if already injected
  if (html.includes('opencode-mobile-bridge') || html.includes('OpenCodeMobileBridge')) {
    return html;
  }

  const mobileStyles = `${basePath}/mobile/styles.css`;
  const bridgeScript = `${basePath}/mobile/bridge.js`;

  // Inject CSS and JS into head
  const injection = `
    <!-- OpenCode Mobile Bridge - Preserves original UI, adds mobile compatibility -->
    <link rel="stylesheet" href="${mobileStyles}" />
    <script type="module">
      // Detect mobile early and set class
      (function() {
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 768 || ('ontouchstart' in window);
        if (isMobile) {
          document.documentElement.classList.add('opencode-mobile');
          console.log('[OpenCode Mobile] Mobile detected, bridge will load');
        }
      })();
    </script>
    <script type="module" src="${bridgeScript}"></script>
    <!-- End Mobile Bridge -->
  `;

  // Try to inject into <head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `${injection}\n</head>`);
  } else if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n${injection}`);
  } else {
    // Fallback: inject at start
    return injection + '\n' + html;
  }
}

export function createMobileWrapper(opencodeUrl, options = {}) {
  const { title = 'OpenCode Desktop - Mobile' } = options;

  return `<!DOCTYPE html>
<html lang="en" class="opencode-mobile-wrapper">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content, viewport-fit=cover" />
  <title>${title}</title>
  <meta name="theme-color" content="#fafafa" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="manifest" href="/manifest.json" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #fafafa;
      color: #191515;
      height: 100dvh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 12px 16px;
      padding-top: calc(12px + env(safe-area-inset-top, 0px));
      background: #191515;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .header h1 {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header .status {
      font-size: 12px;
      opacity: 0.7;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .frame-container {
      flex: 1;
      position: relative;
      background: white;
      overflow: hidden;
    }
    .frame-container iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    .loading {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #fafafa;
      gap: 16px;
      z-index: 1;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e5e5e5;
      border-top-color: #191515;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .info {
      padding: 12px 16px;
      background: #fffbeb;
      border-top: 1px solid #fde68a;
      font-size: 12px;
      line-height: 1.5;
      color: #92400e;
      flex-shrink: 0;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    }
    .info strong { color: #78350f; }
    @media (min-width: 769px) {
      .info { display: none; }
    }
  </style>
  <link rel="stylesheet" href="/mobile/styles.css" />
</head>
<body>
  <div class="header">
    <h1>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
      OpenCode Desktop
    </h1>
    <div class="status">
      <div class="status-dot"></div>
      <span id="status-text">Mobile Ready</span>
    </div>
  </div>
  
  <div class="frame-container">
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <div style="text-align:center">
        <div style="font-weight:600;font-size:14px">Loading OpenCode Desktop</div>
        <div style="font-size:12px;opacity:0.6;margin-top:4px">UI asli, dioptimalkan untuk HP</div>
      </div>
    </div>
    <iframe 
      id="opencode-frame" 
      src="${opencodeUrl}" 
      allow="clipboard-read; clipboard-write; fullscreen"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
      title="OpenCode Desktop Original UI"
    ></iframe>
  </div>

  <div class="info">
    <strong>📱 Mode Mobile Aktif:</strong> Ini adalah UI Desktop OpenCode yang asli, bukan tiruan. 
    Sidebar, editor, terminal, dan semua fitur tetap asli. Gunakan toolbar bawah untuk akses cepat. 
    Swipe dari tepi kiri untuk sidebar.
  </div>

  <script type="module">
    import '/mobile/bridge.js';
    
    const frame = document.getElementById('opencode-frame');
    const loading = document.getElementById('loading');
    const statusText = document.getElementById('status-text');
    
    frame.addEventListener('load', () => {
      console.log('[Wrapper] OpenCode iframe loaded');
      loading.style.display = 'none';
      statusText.textContent = 'Connected';
      
      // Try to inject bridge into iframe if same-origin
      try {
        const iframeDoc = frame.contentDocument;
        if (iframeDoc) {
          console.log('[Wrapper] Same-origin, injecting bridge directly into iframe');
          const link = iframeDoc.createElement('link');
          link.rel = 'stylesheet';
          link.href = '/mobile/styles.css';
          iframeDoc.head.appendChild(link);
          
          const script = iframeDoc.createElement('script');
          script.type = 'module';
          script.src = '/mobile/bridge.js';
          iframeDoc.head.appendChild(script);
        }
      } catch (e) {
        console.log('[Wrapper] Cross-origin iframe, bridge via proxy needed:', e.message);
        statusText.textContent = 'Proxy Mode';
      }
    });

    frame.addEventListener('error', () => {
      loading.innerHTML = \`
        <div style="text-align:center;padding:20px">
          <div style="font-size:24px;margin-bottom:12px">⚠️</div>
          <div style="font-weight:600">OpenCode Server tidak ditemukan</div>
          <div style="font-size:12px;opacity:0.7;margin-top:8px;max-width:300px">
            Pastikan opencode server jalan di ${opencodeUrl}<br/>
            Jalankan: <code style="background:#eee;padding:2px 6px;border-radius:4px">opencode serve</code>
          </div>
          <button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;border-radius:8px;border:none;background:#191515;color:white;cursor:pointer">
            Coba Lagi
          </button>
        </div>
      \`;
      statusText.textContent = 'Offline';
    });

    // Handle messages from iframe
    window.addEventListener('message', (e) => {
      if (e.data.type === 'opencode-mobile:ready') {
        console.log('[Wrapper] Mobile bridge ready inside iframe');
        statusText.textContent = 'Mobile Ready ✓';
      }
    });
  </script>
</body>
</html>`;
}
