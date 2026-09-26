/**
 * OpenCode Desktop Mobile - Main Bridge
 * Entry point that loads all mobile compatibility layers
 * PRESERVES ORIGINAL UI - Only adds mobile adaptations
 * 
 * This file is injected into the original OpenCode Desktop UI
 */

import { ViewportManager } from './viewport.js';
import { TouchAdapter } from './touch-adapter.js';
import { MobileToolbar } from './toolbar.js';

class OpenCodeMobileBridge {
  constructor() {
    this.version = '1.0.0';
    this.initialized = false;
    this.managers = {};
  }

  async init() {
    if (this.initialized) return;
    
    console.log(`[OpenCode Mobile Bridge v${this.version}] Initializing...`);
    console.log('[OpenCode Mobile] UserAgent:', navigator.userAgent);
    console.log('[OpenCode Mobile] Viewport:', `${window.innerWidth}x${window.innerHeight}`);
    console.log('[OpenCode Mobile] Touch support:', 'ontouchstart' in window);

    // Wait for DOM ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    // Check if we're in OpenCode UI
    const isOpenCode = this.detectOpenCode();
    console.log('[OpenCode Mobile] Is OpenCode UI:', isOpenCode);

    // Initialize managers (even if not OpenCode, for testing)
    try {
      this.managers.viewport = new ViewportManager();
      this.managers.touch = new TouchAdapter(this.managers.viewport);
      this.managers.toolbar = new MobileToolbar(this.managers.viewport, this.managers.touch);
      
      this.setupGlobalHelpers();
      this.setupErrorHandling();
      this.injectMetaTags();
      
      this.initialized = true;
      console.log('[OpenCode Mobile Bridge] Initialized successfully');
      
      // Dispatch ready event
      window.dispatchEvent(new CustomEvent('opencode-mobile:ready', {
        detail: { version: this.version, managers: Object.keys(this.managers) }
      }));

      // Show welcome toast on mobile
      if (this.managers.viewport.isMobile) {
        setTimeout(() => this.showWelcome(), 1000);
      }

    } catch (error) {
      console.error('[OpenCode Mobile Bridge] Init failed:', error);
    }
  }

  detectOpenCode() {
    // Check for OpenCode-specific elements
    return !!(
      document.querySelector('#root') ||
      document.querySelector('[class*="opencode"]') ||
      document.title.includes('OpenCode') ||
      window.location.port === '4096' ||
      document.querySelector('meta[name="theme-color"]')
    );
  }

  injectMetaTags() {
    // Ensure viewport meta is optimal for mobile (preserve original but enhance)
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.appendChild(viewportMeta);
    }

    // Enhance existing viewport meta for mobile if needed
    const current = viewportMeta.content;
    if (!current.includes('interactive-widget')) {
      viewportMeta.content = current + ', interactive-widget=resizes-content';
      console.log('[OpenCode Mobile] Enhanced viewport meta:', viewportMeta.content);
    }

    // Ensure theme-color
    if (!document.querySelector('meta[name="theme-color"]')) {
      const theme = document.createElement('meta');
      theme.name = 'theme-color';
      theme.content = '#fafafa';
      document.head.appendChild(theme);
    }
  }

  setupGlobalHelpers() {
    // Expose global API for debugging and toolbar
    window.OpenCodeMobile = {
      version: this.version,
      viewport: this.managers.viewport,
      touch: this.managers.touch,
      toolbar: this.managers.toolbar,
      showToolbar: () => this.managers.toolbar?.show(),
      hideToolbar: () => this.managers.toolbar?.hide(),
      toggleSidebar: () => this.managers.toolbar?.toggleSidebar(),
      openCommandPalette: () => this.managers.toolbar?.openCommandPalette(),
      getInfo: () => ({
        version: this.version,
        initialized: this.initialized,
        isMobile: this.managers.viewport?.isMobile,
        isIOS: this.managers.viewport?.isIOS,
        isAndroid: this.managers.viewport?.isAndroid,
        viewport: this.managers.viewport?.getInfo(),
        userAgent: navigator.userAgent
      }),
      // For testing
      simulateTouch: (x, y) => {
        const el = document.elementFromPoint(x, y);
        if (el) {
          el.dispatchEvent(new TouchEvent('touchstart', {
            touches: [{ clientX: x, clientY: y }],
            bubbles: true
          }));
        }
      }
    };

    console.log('[OpenCode Mobile] Global API exposed as window.OpenCodeMobile');
  }

  setupErrorHandling() {
    window.addEventListener('error', (e) => {
      if (e.message.includes('OpenCode Mobile')) {
        console.warn('[OpenCode Mobile] Handled error:', e.message);
      }
    });

    window.addEventListener('unhandledrejection', (e) => {
      if (e.reason?.message?.includes('OpenCode Mobile')) {
        console.warn('[OpenCode Mobile] Handled rejection:', e.reason);
        e.preventDefault();
      }
    });
  }

  showWelcome() {
    if (sessionStorage.getItem('opencode-mobile-welcomed')) return;
    
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: calc(12px + env(safe-area-inset-top, 0px));
      left: 50%;
      transform: translateX(-50%);
      background: #191515;
      color: white;
      padding: 12px 20px;
      border-radius: 24px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      z-index: 10001;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      max-width: calc(100vw - 24px);
      text-align: center;
      line-height: 1.4;
      animation: slideDown 0.3s ease;
    `;
    toast.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px">📱 OpenCode Mobile</div>
      <div style="opacity:0.8">UI Desktop asli, dioptimalkan untuk HP. Tap tepi bawah untuk toolbar.</div>
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from { transform: translate(-50%, -20px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -20px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);

    sessionStorage.setItem('opencode-mobile-welcomed', '1');
  }

  // For testing Android/iOS
  static testCompatibility() {
    const results = {
      touch: 'ontouchstart' in window,
      viewport: !!window.visualViewport,
      safeArea: CSS.supports('padding: env(safe-area-inset-top)'),
      touchAction: CSS.supports('touch-action: manipulation'),
      dvh: CSS.supports('height: 100dvh'),
      webkitOverflow: CSS.supports('-webkit-overflow-scrolling: touch'),
      userAgent: navigator.userAgent,
      isMobile: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      isAndroid: /Android/.test(navigator.userAgent),
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio
    };

    console.table(results);
    return results;
  }
}

// Auto-init when script loads
const bridge = new OpenCodeMobileBridge();

// Init immediately if DOM ready, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bridge.init());
} else {
  bridge.init();
}

// Also try on window load for safety
window.addEventListener('load', () => {
  if (!bridge.initialized) bridge.init();
});

// Export for module usage
export default bridge;
export { OpenCodeMobileBridge };

// For non-module inclusion
if (typeof window !== 'undefined') {
  window.OpenCodeMobileBridge = OpenCodeMobileBridge;
}
