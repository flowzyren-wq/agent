/**
 * OpenCode Desktop Mobile - Floating Toolbar
 * Provides mobile-friendly access to ORIGINAL desktop features
 * Does NOT replace UI, only triggers existing shortcuts/actions
 */

export class MobileToolbar {
  constructor(viewportManager, touchAdapter) {
    this.viewport = viewportManager;
    this.touch = touchAdapter;
    this.isMobile = viewportManager?.isMobile ?? this.detectMobile();
    this.visible = false;
    this.autoHideTimer = null;
    this.init();
  }

  detectMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || 
           window.innerWidth <= 768 ||
           ('ontouchstart' in window);
  }

  init() {
    if (!this.isMobile) return;

    console.log('[OpenCode Mobile] Toolbar init');
    this.createToolbar();
    this.setupAutoShow();
    this.setupEventListeners();
    this.show(); // Show initially on mobile
  }

  createToolbar() {
    // Create floating toolbar that triggers ORIGINAL UI actions
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'mobile-toolbar visible';
    this.toolbar.setAttribute('role', 'toolbar');
    this.toolbar.setAttribute('aria-label', 'Mobile quick actions');

    this.toolbar.innerHTML = `
      <button data-action="sidebar" title="Toggle Sidebar" aria-label="Toggle Sidebar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
      </button>
      <button data-action="command" title="Command Palette (Ctrl+K)" aria-label="Command Palette">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      </button>
      <button data-action="search" title="Search" aria-label="Search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>
      <div class="divider"></div>
      <button data-action="esc" title="Esc" aria-label="Escape">Esc</button>
      <button data-action="tab" title="Tab" aria-label="Tab">⇥</button>
      <button data-action="ctrl" title="Ctrl" aria-label="Ctrl">Ctrl</button>
      <div class="divider"></div>
      <button data-action="terminal" title="Toggle Terminal" aria-label="Toggle Terminal">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
      </button>
      <button data-action="fullscreen" title="Fullscreen" aria-label="Fullscreen">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <polyline points="21 3 15 3 15 9"></polyline>
          <polyline points="3 21 9 21 9 15"></polyline>
        </svg>
      </button>
      <button data-action="hide" title="Hide Toolbar" aria-label="Hide Toolbar" style="opacity:0.6">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    document.body.appendChild(this.toolbar);

    // Add swipe hint
    const hint = document.createElement('div');
    hint.className = 'sidebar-swipe-hint';
    document.body.appendChild(hint);

    this.bindActions();
  }

  bindActions() {
    this.toolbar.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const action = button.dataset.action;
      console.log('[OpenCode Mobile] Toolbar action:', action);

      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(30);

      this.handleAction(action, button);

      // Reset auto-hide
      this.resetAutoHide();
    });

    // Prevent toolbar from stealing focus from editor
    this.toolbar.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
  }

  handleAction(action, button) {
    switch (action) {
      case 'sidebar':
        this.toggleSidebar();
        break;
      case 'command':
        this.openCommandPalette();
        break;
      case 'search':
        this.openSearch();
        break;
      case 'esc':
        this.sendKey('Escape');
        break;
      case 'tab':
        this.sendKey('Tab');
        break;
      case 'ctrl':
        this.toggleCtrl(button);
        break;
      case 'terminal':
        this.toggleTerminal();
        break;
      case 'fullscreen':
        this.toggleFullscreen();
        break;
      case 'hide':
        this.hide();
        break;
    }
  }

  toggleSidebar() {
    // Try to find and click original sidebar toggle
    const selectors = [
      '[aria-label*="sidebar" i]',
      '[aria-label*="toggle sidebar" i]',
      '[class*="sidebar-toggle"]',
      'button[title*="sidebar" i]',
      // OpenCode specific: titlebar buttons
      '[class*="titlebar"] button:first-child',
    ];

    let toggled = false;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        console.log('[OpenCode Mobile] Found sidebar toggle:', sel, el);
        el.click();
        toggled = true;
        break;
      }
    }

    if (!toggled) {
      // Fallback: dispatch event for custom handling, or try keyboard shortcut
      console.log('[OpenCode Mobile] No sidebar toggle found, trying keybind');
      this.sendKey('b', true); // Ctrl+B often toggles sidebar
      // Also emit custom event
      window.dispatchEvent(new CustomEvent('opencode-mobile:toggle-sidebar'));
    }
  }

  openCommandPalette() {
    // Original OpenCode uses Ctrl+K or Cmd+K for command palette
    console.log('[OpenCode Mobile] Opening command palette');
    
    // Try multiple methods
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    // Method 1: Keyboard shortcut
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: !isMac,
      metaKey: isMac,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);

    // Method 2: Look for command palette trigger in DOM
    setTimeout(() => {
      const paletteTrigger = document.querySelector('[class*="command-palette"]') ||
                            document.querySelector('[aria-label*="command" i]');
      if (paletteTrigger && paletteTrigger !== document.activeElement) {
        // Palette should already be open from keybind
      }
    }, 100);
  }

  openSearch() {
    // Ctrl+F or Cmd+F
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const event = new KeyboardEvent('keydown', {
      key: 'f',
      code: 'KeyF',
      ctrlKey: !isMac,
      metaKey: isMac,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  }

  sendKey(key, ctrl = false, shift = false, alt = false) {
    console.log('[OpenCode Mobile] Sending key:', key, { ctrl, shift, alt });
    
    const active = document.activeElement;
    
    // If terminal is focused, send to terminal
    const terminal = document.querySelector('[class*="terminal"]');
    const isTerminalFocused = active && active.closest('[class*="terminal"]');
    
    if (isTerminalFocused || (terminal && key === 'Escape')) {
      // Send to terminal's hidden textarea
      const textarea = document.querySelector('.terminal-container textarea') ||
                      document.querySelector('[class*="terminal"] textarea');
      if (textarea) {
        textarea.focus();
        // For terminal, we need to send actual key events to xterm
        const event = new KeyboardEvent('keydown', {
          key,
          code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
          ctrlKey: ctrl,
          shiftKey: shift,
          altKey: alt,
          bubbles: true,
          cancelable: true
        });
        textarea.dispatchEvent(event);
        return;
      }
    }

    // For editor, use touch adapter
    if (this.touch) {
      this.touch.simulateKey(key, ctrl, shift, alt);
    } else {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ctrlKey: ctrl,
        shiftKey: shift,
        altKey: alt
      });
      (active || document).dispatchEvent(event);
    }
  }

  toggleCtrl(button) {
    button.classList.toggle('active');
    const active = button.classList.contains('active');
    console.log('[OpenCode Mobile] Ctrl toggled:', active);
    
    // Store state for next key press
    this.ctrlActive = active;
    
    if (active) {
      // Show hint
      this.showToast('Ctrl active - next key will have Ctrl');
    }
  }

  toggleTerminal() {
    // Original: Ctrl+` toggles terminal
    console.log('[OpenCode Mobile] Toggling terminal');
    const event = new KeyboardEvent('keydown', {
      key: '`',
      code: 'Backquote',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);

    // Also try clicking terminal toggle button
    const termButton = document.querySelector('[aria-label*="terminal" i]') ||
                      document.querySelector('[title*="terminal" i]') ||
                      document.querySelector('[class*="terminal-toggle"]');
    if (termButton) {
      termButton.click();
    }
  }

  async toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      if (this.viewport) {
        await this.viewport.enterFullscreen();
      } else {
        try {
          await document.documentElement.requestFullscreen();
        } catch (e) {
          console.warn('Fullscreen failed', e);
        }
      }
    }
  }

  setupAutoShow() {
    // Show toolbar when user taps near bottom or scrolls
    let lastScrollY = window.scrollY;

    // Show on touch near bottom
    document.addEventListener('touchend', (e) => {
      const touch = e.changedTouches[0];
      const nearBottom = touch.clientY > window.innerHeight - 100;
      const nearEdge = touch.clientX < 50 || touch.clientX > window.innerWidth - 50;
      
      if (nearBottom || nearEdge) {
        this.show();
      }
    }, { passive: true });

    // Show on scroll stop
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (Math.abs(window.scrollY - lastScrollY) > 50) {
          this.show();
        }
        lastScrollY = window.scrollY;
      }, 150);
    }, { passive: true });

    // Hide when typing
    document.addEventListener('focusin', (e) => {
      if (e.target.closest('[contenteditable]') || 
          e.target.closest('input') || 
          e.target.closest('textarea')) {
        this.hideTemporarily();
      }
    });

    document.addEventListener('focusout', () => {
      setTimeout(() => this.show(), 500);
    });
  }

  setupEventListeners() {
    // Listen for custom events from touch adapter
    window.addEventListener('opencode-mobile:toggle-sidebar', () => {
      console.log('[OpenCode Mobile] Custom sidebar toggle event');
    });

    // Show toolbar on orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.show(), 500);
    });
  }

  show() {
    if (!this.toolbar) return;
    this.toolbar.classList.add('visible');
    this.visible = true;
    this.resetAutoHide();
  }

  hide() {
    if (!this.toolbar) return;
    this.toolbar.classList.remove('visible');
    this.visible = false;
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }
    
    // Show hint that toolbar is hidden
    this.showToast('Toolbar hidden. Tap bottom edge to show.', 2000);
    
    // Allow re-show via edge tap
    const showOnEdge = (e) => {
      const touch = e.changedTouches[0];
      if (touch.clientY > window.innerHeight - 20) {
        this.show();
        document.removeEventListener('touchend', showOnEdge);
      }
    };
    document.addEventListener('touchend', showOnEdge, { passive: true, once: true });
    setTimeout(() => {
      document.removeEventListener('touchend', showOnEdge);
    }, 10000);
  }

  hideTemporarily() {
    if (!this.toolbar) return;
    this.toolbar.style.opacity = '0.3';
    this.toolbar.style.pointerEvents = 'none';
  }

  resetAutoHide() {
    if (!this.toolbar) return;
    this.toolbar.style.opacity = '';
    this.toolbar.style.pointerEvents = '';
    
    if (this.autoHideTimer) clearTimeout(this.autoHideTimer);
    
    // Auto-hide after 8 seconds of inactivity on mobile
    this.autoHideTimer = setTimeout(() => {
      if (this.isMobile && !document.querySelector('[role="dialog"]')) {
        // Don't auto-hide if dialog open
        this.toolbar.classList.remove('visible');
        this.visible = false;
      }
    }, 8000);
  }

  showToast(message, duration = 2000) {
    let toast = document.querySelector('.mobile-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'mobile-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: calc(60px + env(safe-area-inset-bottom, 0px));
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.85);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 13px;
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
        max-width: calc(100vw - 32px);
        text-align: center;
      `;
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    
    setTimeout(() => {
      toast.style.opacity = '0';
    }, duration);
  }
}
