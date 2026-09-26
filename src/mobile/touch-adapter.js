/**
 * OpenCode Desktop Mobile - Touch Adapter
 * Makes original desktop UI touch-compatible without rewriting it
 * Handles: scrolling, long-press context menu, tap, swipe, focus
 */

export class TouchAdapter {
  constructor(viewportManager) {
    this.viewport = viewportManager;
    this.isMobile = viewportManager?.isMobile ?? this.detectMobile();
    this.longPressTimer = null;
    this.longPressDelay = 500;
    this.touchStartPos = null;
    this.lastTouchEnd = 0;
    this.init();
  }

  detectMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || 
           window.innerWidth <= 768 ||
           ('ontouchstart' in window);
  }

  init() {
    if (!this.isMobile) {
      console.log('[OpenCode Mobile] TouchAdapter skipped - not mobile');
      return;
    }

    console.log('[OpenCode Mobile] TouchAdapter init');
    this.setupTouchScrolling();
    this.setupLongPress();
    this.setupTapHandling();
    this.setupSwipeGestures();
    this.setupFocusHandling();
    this.setupSelectionHandling();
  }

  setupTouchScrolling() {
    // Ensure all scrollable original containers work with touch momentum
    const scrollableSelectors = [
      '[class*="sidebar"]',
      '[class*="file-tree"]',
      '[class*="session"]',
      '[class*="chat"]',
      '[class*="terminal"]',
      '[class*="scroll"]',
      '[data-slot="sidebar"]',
      '[data-radix-scroll-area-viewport]',
      '.overflow-auto',
      '.overflow-y-auto',
      '.overflow-x-auto'
    ];

    // Apply touch scrolling via CSS is already done, but ensure JS doesn't block
    document.addEventListener('touchmove', (e) => {
      // Allow scrolling, but prevent bounce on body
      const target = e.target;
      const scrollable = target.closest(scrollableSelectors.join(', '));
      
      if (!scrollable && target === document.body) {
        // Prevent body scroll when no scrollable parent (avoid pull-to-refresh interfering)
        // But allow if at top/bottom of scrollable
      }
    }, { passive: true });

    // Fix for iOS: ensure -webkit-overflow-scrolling is applied
    this.enforceMomentumScrolling();
  }

  enforceMomentumScrolling() {
    const apply = () => {
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
            style.overflowX === 'auto' || style.overflowX === 'scroll') {
          el.style.webkitOverflowScrolling = 'touch';
        }
      });
    };

    apply();
    // Re-apply on DOM changes
    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  setupLongPress() {
    // Convert long-press to right-click for context menus (original UI uses right-click)
    let startX, startY, target;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      target = e.target;

      // Don't trigger long-press on editable areas
      if (target.closest('[contenteditable="true"]') || 
          target.closest('input') || 
          target.closest('textarea') ||
          target.closest('button') ||
          target.closest('a')) {
        return;
      }

      this.longPressTimer = setTimeout(() => {
        const moveX = Math.abs((e.touches[0]?.clientX || startX) - startX);
        const moveY = Math.abs((e.touches[0]?.clientY || startY) - startY);
        
        if (moveX < 10 && moveY < 10) {
          this.triggerContextMenu(target, startX, startY);
          target.classList.add('long-press-active');
          setTimeout(() => target.classList.remove('long-press-active'), 200);
          
          // Haptic feedback if available
          if (navigator.vibrate) navigator.vibrate(50);
        }
      }, this.longPressDelay);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!this.longPressTimer) return;
      const touch = e.touches[0];
      const moveX = Math.abs(touch.clientX - startX);
      const moveY = Math.abs(touch.clientY - startY);
      if (moveX > 10 || moveY > 10) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }, { passive: true });

    document.addEventListener('touchcancel', () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }, { passive: true });
  }

  triggerContextMenu(target, x, y) {
    console.log('[OpenCode Mobile] Long-press context menu at', x, y, target);

    // Try to trigger original context menu
    // 1. Try contextmenu event
    const contextEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 2
    });
    
    const canceled = !target.dispatchEvent(contextEvent);
    
    // 2. If no custom handler, try to find and click the original context menu trigger
    if (!canceled) {
      // Look for common context menu patterns in original UI
      const fileItem = target.closest('[data-file]') || target.closest('[class*="file"]');
      if (fileItem) {
        // File tree context menu
        fileItem.dispatchEvent(contextEvent);
      }
    }
  }

  setupTapHandling() {
    // Prevent 300ms delay and handle double-tap zoom prevention
    let lastTap = 0;

    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      const tapLength = now - lastTap;
      
      // Prevent double-tap zoom on non-editable elements
      if (tapLength < 300 && tapLength > 0) {
        const target = e.target;
        if (!target.closest('input') && 
            !target.closest('textarea') && 
            !target.closest('[contenteditable]')) {
          e.preventDefault();
        }
      }
      lastTap = now;

      // Handle fast tap for buttons (ghost click prevention)
      this.lastTouchEnd = now;
    }, { passive: false });

    // Prevent ghost clicks
    document.addEventListener('click', (e) => {
      if (Date.now() - this.lastTouchEnd < 300) {
        // This might be a ghost click, but allow it for now as SolidJS needs clicks
      }
    }, true);
  }

  setupSwipeGestures() {
    let startX = 0, startY = 0, startTime = 0;
    const SWIPE_THRESHOLD = 80;
    const SWIPE_TIME = 500;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!startX) return;
      
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX;
      const diffY = endY - startY;
      const elapsed = Date.now() - startTime;

      if (elapsed > SWIPE_TIME) {
        startX = 0;
        return;
      }

      // Horizontal swipe
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > SWIPE_THRESHOLD) {
        if (diffX > 0 && startX < 30) {
          // Swipe right from left edge -> open sidebar
          console.log('[OpenCode Mobile] Swipe right - open sidebar');
          this.triggerSidebarToggle(true);
        } else if (diffX < 0 && startX > window.innerWidth - 30) {
          // Swipe left from right edge -> open right panel
          console.log('[OpenCode Mobile] Swipe left - open right panel');
          this.triggerRightPanelToggle(true);
        } else if (diffX < -SWIPE_THRESHOLD && Math.abs(diffY) < 100) {
          // Swipe left in content -> close sidebar if open
          const sidebar = document.querySelector('[class*="sidebar"]');
          if (sidebar && this.isSidebarVisible(sidebar)) {
            this.triggerSidebarToggle(false);
          }
        }
      }

      startX = 0;
    }, { passive: true });
  }

  isSidebarVisible(sidebar) {
    const rect = sidebar.getBoundingClientRect();
    return rect.left < window.innerWidth && rect.width > 50;
  }

  triggerSidebarToggle(open) {
    // Find original sidebar toggle button and click it
    // OpenCode has various toggles - try common selectors
    const toggles = [
      document.querySelector('[aria-label*="sidebar"]'),
      document.querySelector('[aria-label*="Sidebar"]'),
      document.querySelector('[class*="sidebar-toggle"]'),
      document.querySelector('button:has([class*="sidebar"])'),
      // Look for hamburger or menu button
      document.querySelector('[class*="titlebar"] button')
    ].filter(Boolean);

    if (toggles.length > 0) {
      // Heuristic: first button in titlebar often toggles sidebar
      console.log('[OpenCode Mobile] Triggering sidebar toggle via', toggles[0]);
      toggles[0].click();
    } else {
      // Fallback: dispatch custom event that toolbar can handle
      window.dispatchEvent(new CustomEvent('opencode-mobile:toggle-sidebar', { detail: { open } }));
    }
  }

  triggerRightPanelToggle(open) {
    window.dispatchEvent(new CustomEvent('opencode-mobile:toggle-right-panel', { detail: { open } }));
  }

  setupFocusHandling() {
    // iOS fix: ensure contenteditable gets focus on tap
    document.addEventListener('touchend', (e) => {
      const editable = e.target.closest('[contenteditable="true"]');
      if (editable) {
        // Small delay to allow other handlers
        setTimeout(() => {
          if (document.activeElement !== editable) {
            editable.focus();
            // Place cursor at end
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(editable);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }, 50);
      }
    }, { passive: true });

    // Ensure terminal textarea can be focused
    document.addEventListener('touchend', (e) => {
      const terminal = e.target.closest('[class*="terminal"]') || e.target.closest('.terminal-container');
      if (terminal) {
        const textarea = terminal.querySelector('textarea');
        if (textarea) {
          setTimeout(() => textarea.focus(), 50);
        }
      }
    }, { passive: true });
  }

  setupSelectionHandling() {
    // Make text selection work better on mobile for editor
    // Original editor uses custom selection, ensure it works with touch

    // Prevent selection on UI chrome, allow in content
    document.addEventListener('selectstart', (e) => {
      const target = e.target;
      if (target.closest('button') || target.closest('[role="button"]')) {
        // Allow selection in editor, but not on buttons
        if (!target.closest('[contenteditable]') && !target.closest('[class*="editor"]')) {
          // e.preventDefault(); // Don't prevent, let browser handle
        }
      }
    });
  }

  // Public API
  simulateKey(key, ctrl = false, shift = false, alt = false) {
    const event = new KeyboardEvent('keydown', {
      key,
      code: key,
      ctrlKey: ctrl,
      shiftKey: shift,
      altKey: alt,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
    
    const upEvent = new KeyboardEvent('keyup', {
      key,
      code: key,
      ctrlKey: ctrl,
      shiftKey: shift,
      altKey: alt,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(upEvent);
  }
}
