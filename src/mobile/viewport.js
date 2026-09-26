/**
 * OpenCode Desktop Mobile - Viewport Manager
 * Handles virtual keyboard, orientation, fullscreen, safe areas
 * Preserves original UI, only adapts viewport behavior
 */

export class ViewportManager {
  constructor() {
    this.isMobile = this.detectMobile();
    this.isIOS = this.detectIOS();
    this.isAndroid = this.detectAndroid();
    this.keyboardVisible = false;
    this.lastViewportHeight = window.innerHeight;
    this.init();
  }

  detectMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || 
           window.innerWidth <= 768 ||
           ('ontouchstart' in window);
  }

  detectIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  detectAndroid() {
    return /Android/.test(navigator.userAgent);
  }

  init() {
    if (!this.isMobile) return;

    console.log('[OpenCode Mobile] ViewportManager init', {
      isMobile: this.isMobile,
      isIOS: this.isIOS,
      isAndroid: this.isAndroid,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    });

    this.setupViewportHandling();
    this.setupKeyboardHandling();
    this.setupOrientationHandling();
    this.setupFullscreenHandling();
    this.setupSafeArea();
    this.preventZoomOnInput();
  }

  setupViewportHandling() {
    // Use VisualViewport API if available (modern browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        this.handleViewportResize();
      });
      window.visualViewport.addEventListener('scroll', () => {
        // Keep prompt visible when keyboard appears
        if (this.keyboardVisible) {
          this.keepPromptVisible();
        }
      });
    } else {
      window.addEventListener('resize', () => this.handleViewportResize());
    }

    // Set CSS variable for dynamic viewport height
    this.updateViewportHeight();
  }

  updateViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--dvh', `${window.innerHeight}px`);
  }

  handleViewportResize() {
    const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const heightDiff = this.lastViewportHeight - currentHeight;
    
    // Keyboard detection: height reduced significantly
    if (heightDiff > 150) {
      this.keyboardVisible = true;
      document.body.classList.add('keyboard-visible');
      console.log('[OpenCode Mobile] Keyboard visible, height diff:', heightDiff);
      this.keepPromptVisible();
    } else if (heightDiff < -50 && this.keyboardVisible) {
      // Keyboard hidden
      this.keyboardVisible = false;
      document.body.classList.remove('keyboard-visible');
      console.log('[OpenCode Mobile] Keyboard hidden');
    }

    this.lastViewportHeight = currentHeight;
    this.updateViewportHeight();
  }

  keepPromptVisible() {
    // Find original prompt input and scroll it into view
    const prompt = document.querySelector('[class*="prompt-input"]') || 
                   document.querySelector('[contenteditable="true"]') ||
                   document.querySelector('div[role="textbox"]');
    
    if (prompt) {
      // Use setTimeout to wait for keyboard animation
      setTimeout(() => {
        prompt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }

  setupKeyboardHandling() {
    // iOS quirk: focus must be triggered by user gesture
    if (this.isIOS) {
      document.addEventListener('touchend', (e) => {
        const target = e.target;
        if (target.closest('[contenteditable="true"]') || 
            target.closest('input') || 
            target.closest('textarea')) {
          // Already handled
          return;
        }
      }, { passive: true });
    }

    // Handle keyboard show/hide for Android
    if (this.isAndroid) {
      // Android Chrome resizes viewport when keyboard appears (interactive-widget=resizes-content)
      // We already handle via visualViewport
    }

    // Global key handling for mobile toolbar shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't interfere with original OpenCode keybinds, just log
      if (this.isMobile && e.key === 'Escape') {
        // Close any open dialogs on mobile via Esc
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          console.log('[OpenCode Mobile] Esc pressed, dialog open');
        }
      }
    });
  }

  setupOrientationHandling() {
    window.addEventListener('orientationchange', () => {
      console.log('[OpenCode Mobile] Orientation changed:', window.orientation);
      setTimeout(() => {
        this.updateViewportHeight();
        // Trigger resize for terminal and editor
        window.dispatchEvent(new Event('resize'));
      }, 300);
    });

    // Also handle via matchMedia
    const mql = window.matchMedia('(orientation: portrait)');
    mql.addEventListener('change', () => {
      setTimeout(() => this.updateViewportHeight(), 100);
    });
  }

  setupFullscreenHandling() {
    // Add fullscreen capability for mobile
    this.fullscreenButton = null;

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        document.body.classList.add('mobile-fullscreen');
      } else {
        document.body.classList.remove('mobile-fullscreen');
      }
    });
  }

  async enterFullscreen() {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        return true;
      }
    } catch (e) {
      console.warn('[OpenCode Mobile] Fullscreen failed:', e);
    }
    return false;
  }

  setupSafeArea() {
    // Safe area insets are handled via CSS env(), but we can also set JS fallback
    const updateSafeArea = () => {
      const style = getComputedStyle(document.documentElement);
      // env(safe-area-inset-*) is CSS only, but we can detect notch via media queries
    };
    updateSafeArea();
  }

  preventZoomOnInput() {
    // Prevent iOS auto-zoom on input focus (requires 16px+ font-size)
    // Our CSS already sets 16px, but double-check
    if (this.isIOS) {
      const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
      inputs.forEach(el => {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);
        if (fontSize < 16) {
          el.style.fontSize = '16px';
        }
      });

      // Also observe new inputs
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
          m.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              const inputs = node.querySelectorAll ? node.querySelectorAll('input, textarea, [contenteditable]') : [];
              inputs.forEach(el => {
                if (parseFloat(getComputedStyle(el).fontSize) < 16) {
                  el.style.fontSize = '16px';
                }
              });
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Public API for toolbar
  getInfo() {
    return {
      isMobile: this.isMobile,
      isIOS: this.isIOS,
      isAndroid: this.isAndroid,
      keyboardVisible: this.keyboardVisible,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        visualWidth: window.visualViewport?.width || window.innerWidth,
        visualHeight: window.visualViewport?.height || window.innerHeight
      }
    };
  }
}
