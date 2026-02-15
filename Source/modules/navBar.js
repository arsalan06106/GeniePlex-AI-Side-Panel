// Navigation Bar Module
export class NavBarManager {
  constructor() {
    // Make this instance globally available
    window.navBarManager = this;
    // Debounced commit delay for shortcut-based model switching (ms)
    this._shortcutNavDelay = 450;
    this._switchCommitTimer = null;
    this._pendingTarget = null;
    this._initialized = false;
    // Track timers and animation frames for proper cleanup
    this._scrollTimeout = null;
    this._scrollRafId = null;
    this._currentModelLabel = 'AI';
  }

  init() {
    // Prevent double initialization
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    
    this.initializeButtonClickHandlers();
    this.initializeDragAndDrop();
    this.initializePremiumScrolling();
    this.initializeLoadingState();
    this.initializeActiveIndicator();
  }

  initializeActiveIndicator() {
    const toolbar = document.getElementById('toolbar');
    const activeIndicator = toolbar.querySelector('.active-indicator');
    const buttons = toolbar.querySelectorAll('.btn');

    const updateIndicator = (target) => {
      if (!target) return;
      const targetRect = target.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      
      // Calculate relative position accounting for scroll
      const relativeLeft = targetRect.left - toolbarRect.left + toolbar.scrollLeft;
      const relativeTop = targetRect.top - toolbarRect.top;
      
      activeIndicator.style.transform = `translateX(${relativeLeft}px)`;
      // Ensure width matches target
      activeIndicator.style.width = `${targetRect.width}px`;
      activeIndicator.style.height = `${targetRect.height}px`;
      activeIndicator.style.top = `${relativeTop}px`;
    };

    // Set initial position
    const activeButton = toolbar.querySelector('.btn.active');
    if (activeButton) {
      updateIndicator(activeButton);
    }

    // Note: Click handling is now done in initializeButtonClickHandlers for better performance

    // Update on resize
    new ResizeObserver(() => {
      const currentActive = toolbar.querySelector('.btn.active');
      if (currentActive) {
        updateIndicator(currentActive);
      }
    }).observe(toolbar);
  }

  initializeButtonClickHandlers() {
    const toolbar = document.getElementById('toolbar');
    const iframeContainer = document.getElementById('iframe-container');
    const supportPage = document.getElementById('support-page');
    const supportBtn = document.getElementById('support-btn');
    const splitViewBtn = document.getElementById('split-view-btn');

    if (!toolbar || !iframeContainer || !supportPage || !supportBtn || !splitViewBtn) {
      console.error('Required elements not found for navigation initialization');
      return;
    }

    // Combined event delegation for clicks - handles both indicator update and navigation
    toolbar.addEventListener('click', (e) => {
      // Check what was clicked
      const button = e.target.closest('.btn[data-url]');
      const supportButton = e.target.closest('#support-btn');
      const splitButton = e.target.closest('#split-view-btn');

      // SKIP processing for split view button - it has its own handler
      if (splitButton) {
        console.log('NavBar: Split button clicked, skipping navbar processing');
        // Don't call e.stopPropagation() or preventDefault() - let split view handler work
        return;
      }

      const anyButton = e.target.closest('.btn');

      // Update active indicator for any button click (except split view)
      if (anyButton && !splitButton) {
        this.updateActiveIndicator(anyButton);
      }

      // Handle specific button actions
      if (button && button.hasAttribute('data-url')) {
        this.handleServiceButtonClick(button, iframeContainer, supportPage, splitViewBtn, supportBtn, toolbar);
      } else if (supportButton) {
        this.handleSupportButtonClick(iframeContainer, supportPage, toolbar, supportButton);
      }
    });

  // Runtime message handling is centralized in sidepanel-modular.js

    // In-panel fallback shortcuts (only when global commands are unassigned)
    let fallbackEnabled = false;
    try {
      chrome.commands.getAll((cmds) => {
        const find = (n) => cmds.find((c) => c.name === n);
        const next = find('next_ai_model');
        const prev = find('previous_ai_model');
        fallbackEnabled = !(next?.shortcut) || !(prev?.shortcut);
      });
    } catch { }

    document.addEventListener('keydown', (e) => {
      if (!fallbackEnabled) return;
      // Avoid when typing in inputs/selects/textareas or with modifiers like Ctrl in text fields
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;
      if (isTyping) return;

      // Use Alt+[ or Alt+] as low-conflict fallback keys
      const altOnly = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
      if (!altOnly) return;
      if (e.key === ']') { e.preventDefault(); this.switchModel(1); }
      if (e.key === '[') { e.preventDefault(); this.switchModel(-1); }
    });
  }

  handleServiceButtonClick(button, iframeContainer, supportPage, splitViewBtn, supportBtn, toolbar) {
    // If there is a pending delayed switch (from shortcuts), cancel it and commit now via this click
    if (this._switchCommitTimer) {
      clearTimeout(this._switchCommitTimer);
      this._switchCommitTimer = null;
      this._pendingTarget = null;
    }
  const url = button.getAttribute('data-url');
  const modelLabel = this.getModelLabelFromButton(button);

    // Update split view button state
    splitViewBtn.disabled = false;
    splitViewBtn.title = '';
    supportBtn.classList.remove('active');

    // Hide support page smoothly
    supportPage.classList.remove('active');
    setTimeout(() => {
      supportPage.style.display = 'none';
    }, 200);

  this.switchToIframe(url, modelLabel);

    // Update active button state
    toolbar.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Update the active indicator
    this.updateActiveIndicator(button);

    // Persist last selected model (URL) for optional restore
    try {
      window.saveManager?.saveLastSelectedModel(url);
    } catch { }

    // After switching, try to focus the search box inside the destination site
    const activeIframe = document.querySelector(`#iframe-container > iframe[data-url="${url}"]`);
    if (activeIframe) {
      this.focusSearchInIframe(activeIframe, url);
    }
  }

  handleSupportButtonClick(iframeContainer, supportPage, toolbar, supportButton) {
    // Cancel any pending delayed navigation when opening support
    if (this._switchCommitTimer) {
      clearTimeout(this._switchCommitTimer);
      this._switchCommitTimer = null;
      this._pendingTarget = null;
    }
    // Handle support button click
    this.toggleLoadingState(false); // Hide spinner for support page
    
    // Hide all iframes
    const iframes = iframeContainer.querySelectorAll('iframe');
    iframes.forEach(iframe => iframe.style.display = 'none');

    // Show support page with smooth animation
    supportPage.style.display = 'flex';
    requestAnimationFrame(() => {
      supportPage.classList.add('active');
    });

    toolbar.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
    supportButton.classList.add('active');
    this.updateActiveIndicator(supportButton);
  }

  getModelLabelFromButton(button) {
    if (!button) {
      return 'AI';
    }

    const dataLabel = button.dataset?.label;
    if (dataLabel) {
      return dataLabel;
    }

    const imgAlt = button.querySelector('img')?.alt;
    if (imgAlt) {
      return imgAlt.replace(/\s*icon$/i, '').trim() || 'AI';
    }

    const text = button.textContent?.trim();
    if (text) {
      return text;
    }

    return 'AI';
  }

  getModelLabelForUrl(url) {
    if (!url) {
      return this._currentModelLabel || 'AI';
    }

    const candidates = document.querySelectorAll('.btn[data-url]');
    for (const btn of candidates) {
      if (btn.getAttribute('data-url') === url) {
        return this.getModelLabelFromButton(btn);
      }
    }

    return this._currentModelLabel || 'AI';
  }

  switchToIframe(url, modelLabel) {
    const iframeContainer = document.getElementById('iframe-container');
    if (!iframeContainer) {
      console.error('iframe-container not found');
      return;
    }
    
    const iframes = iframeContainer.querySelectorAll('iframe');
    let targetIframe = iframeContainer.querySelector(`iframe[data-url="${url}"]`);

    const label = modelLabel || this.getModelLabelForUrl(url);
    this._currentModelLabel = label;

    // Hide all iframes (except target if it exists)
    iframes.forEach(iframe => {
      if (iframe !== targetIframe) {
        iframe.classList.remove('animate-enter');
        iframe.classList.add('animate-exit');
        
        // Wait for animation to finish before hiding
        setTimeout(() => {
          iframe.style.display = 'none';
          iframe.classList.remove('animate-exit');
        }, 200); // Match animation duration
      }
      
      // Remove main-iframe ID from all iframes
      if (iframe.id === 'main-iframe') {
        iframe.id = '';
      }
    });

    if (targetIframe) {
      // Iframe already cached - show instantly with animation
      targetIframe.style.display = 'block';
      targetIframe.id = 'main-iframe'; // Set as main iframe for split view
      
      // Remove exit class if present and add enter class
      targetIframe.classList.remove('animate-exit');
      targetIframe.classList.add('animate-enter');
      
      this.toggleLoadingState(false);
    } else {
      // New iframe - show loader
      this.toggleLoadingState(true, label);
      
      targetIframe = document.createElement('iframe');
      targetIframe.id = 'main-iframe'; // Set as main iframe for split view
      targetIframe.src = url;
      targetIframe.setAttribute('data-url', url);
      targetIframe.setAttribute('allow', 'clipboard-write');
      targetIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads');
      targetIframe.setAttribute('data-model-label', label);
      targetIframe.style.display = 'block';
      iframeContainer.appendChild(targetIframe);

      const handleLoad = () => {
        this.toggleLoadingState(false);
        targetIframe.removeEventListener('load', handleLoad);
        targetIframe.removeEventListener('error', handleError);
      };

      const handleError = () => {
        this.toggleLoadingState(false);
        targetIframe.removeEventListener('load', handleLoad);
        targetIframe.removeEventListener('error', handleError);
      };

      targetIframe.addEventListener('load', handleLoad);
      targetIframe.addEventListener('error', handleError);
    }
  }

  updateActiveIndicator(target) {
    const toolbar = document.getElementById('toolbar');
    const activeIndicator = toolbar.querySelector('.active-indicator');
    if (!target || !activeIndicator) return;

    const targetRect = target.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    
    // Calculate relative position accounting for scroll
    const relativeLeft = targetRect.left - toolbarRect.left + toolbar.scrollLeft;
    const relativeTop = targetRect.top - toolbarRect.top;
    
    activeIndicator.style.transform = `translateX(${relativeLeft}px)`;
    activeIndicator.style.width = `${targetRect.width}px`;
    activeIndicator.style.height = `${targetRect.height}px`;
    activeIndicator.style.top = `${relativeTop}px`;
  }

  initializeLoadingState() {
    const loadingSpinner = document.querySelector('.loader');

    if (!loadingSpinner) {
      console.error('Loader not found for initialization');
      return;
    }

    // Loader is visible by default in HTML/CSS
    // This ensures navbar shows immediately while AI content loads
    // Only ensuring proper z-index here
    loadingSpinner.style.zIndex = '100';
  }

  toggleLoadingState(show, label) {
    const loadingSpinner = document.querySelector('.loader');
    const loaderLabel = document.getElementById('loader-label');

    if (!loadingSpinner) {
      console.error('Loader not found for toggleLoadingState');
      return;
    }

    if (show) {
      if (loaderLabel) {
        const defaultText = loaderLabel.getAttribute('data-default-text') || 'Loading…';
        loaderLabel.textContent = label ? `Loading ${label}…` : defaultText;
      }
      loadingSpinner.style.display = 'flex';
      loadingSpinner.setAttribute('aria-hidden', 'false');
    } else {
      loadingSpinner.style.display = 'none';
      loadingSpinner.setAttribute('aria-hidden', 'true');
      if (loaderLabel) {
        const defaultText = loaderLabel.getAttribute('data-default-text') || loaderLabel.textContent;
        loaderLabel.textContent = defaultText;
      }
    }
  }

  loadInitialUrl() {
    const iframeContainer = document.getElementById('iframe-container');
    const supportPage = document.getElementById('support-page');
    
    // Get ALL buttons with data-url attribute
    const allButtons = document.querySelectorAll('.btn[data-url]');
    
    // Find the FIRST visible button by checking display style
    let firstVisibleButton = null;
    for (const btn of allButtons) {
      const style = window.getComputedStyle(btn);
      if (style.display !== 'none') {
        firstVisibleButton = btn;
        break; // Found the first visible one, stop looking
      }
    }
    
    const defaultUrl = "https://chatgpt.com/";

    if (!iframeContainer) {
      console.error('iframe-container not found');
      return;
    }

    // Hide support page initially
    if (supportPage) {
      supportPage.style.display = 'none';
      supportPage.classList.remove('active');
    }

    // Determine initial URL based on settings: remember last model if enabled
    let url = defaultUrl;
    try {
      const remember = localStorage.getItem('rememberLastModel') === 'true'; // default false
      const last = remember ? window.saveManager?.getLastSelectedModel?.() : null;
      if (remember && last) {
        // Ensure the button for the last URL is currently visible/enabled
        const matchBtn = document.querySelector(`.btn[data-url="${last}"]`);
        const isVisible = matchBtn && getComputedStyle(matchBtn).display !== 'none';
        if (isVisible) {
          url = last;
        } else if (firstVisibleButton) {
          url = firstVisibleButton.getAttribute('data-url');
        }
      } else if (firstVisibleButton) {
        // Use the FIRST visible button's URL
        url = firstVisibleButton.getAttribute('data-url');
      }

      // Set the active state on the correct button
      const activeButton = document.querySelector(`.btn[data-url="${url}"]`) || firstVisibleButton;
      if (activeButton) {
        document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
        this.updateActiveIndicator(activeButton);
      }

      // Use the same iframe management system as button clicks
      const initialLabel = this.getModelLabelFromButton(activeButton) || this.getModelLabelForUrl(url);
      this.switchToIframe(url, initialLabel);
      
      // Save the selected model
      window.saveManager?.saveLastSelectedModel(url);
    } catch (e) {
    console.error("Error loading initial URL:", e);
    // Fallback to default
    this.switchToIframe(defaultUrl, this.getModelLabelForUrl(defaultUrl));
    }
  }

  initializeDragAndDrop() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) {
      console.error('Toolbar not found for drag and drop initialization');
      return;
    }

    let draggedElement = null;

    // Remove existing delegated listeners to prevent duplicates
    if (toolbar.dragAndDropInitialized) {
      return; // Already initialized
    }

    // Use event delegation for drag and drop to handle dynamic content
    toolbar.addEventListener('dragstart', (e) => {
      const target = e.target.closest('.btn');
      if (target && target.draggable) {
        draggedElement = target;
        // Add a slight delay to allow the ghost image to be created
        setTimeout(() => {
          draggedElement.classList.add('dragging');
        }, 0);

        // Create a custom ghost image
        const ghost = target.cloneNode(true);
        ghost.classList.add('ghost');
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);

        // Clean up the ghost image after the drag operation
        setTimeout(() => {
          document.body.removeChild(ghost);
        }, 0);
      }
    });

    toolbar.addEventListener('dragend', (e) => {
      if (draggedElement) {
        draggedElement.classList.remove('dragging');
        toolbar.querySelectorAll('.btn').forEach(btn => btn.classList.remove('drag-over'));
        draggedElement = null;
      }
    });

    toolbar.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dropTarget = e.target.closest('.btn');
      if (!draggedElement || !dropTarget || dropTarget === draggedElement) {
        return;
      }
      // Clear previous drag-over states
      toolbar.querySelectorAll('.btn.drag-over').forEach(btn => btn.classList.remove('drag-over'));
      dropTarget.classList.add('drag-over');
    });

    toolbar.addEventListener('dragleave', (e) => {
      const dropTarget = e.target.closest('.btn');
      if (dropTarget) {
        dropTarget.classList.remove('drag-over');
      }
    });

    toolbar.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropTarget = e.target.closest('.btn');
      if (!draggedElement || !dropTarget || dropTarget === draggedElement) {
        return;
      }

      // Reorder elements
      const allButtons = [...toolbar.querySelectorAll('.btn')];
      const draggedIndex = allButtons.indexOf(draggedElement);
      const dropIndex = allButtons.indexOf(dropTarget);

      if (draggedIndex < dropIndex) {
        dropTarget.parentNode.insertBefore(draggedElement, dropTarget.nextSibling);
      } else {
        dropTarget.parentNode.insertBefore(draggedElement, dropTarget);
      }

      // Clean up classes
      dropTarget.classList.remove('drag-over');

      // Save the new order
      this.saveButtonOrder();
    });

    toolbar.dragAndDropInitialized = true;
  }

  saveButtonOrder() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    const orderedButtons = Array.from(toolbar.querySelectorAll('.btn[data-url]'));
    const order = orderedButtons.map(btn => btn.getAttribute('data-url'));
    
    try {
      window.saveManager?.saveButtonOrder(order);
    } catch (error) {
      console.error('Error saving button order from NavBarManager:', error);
    }
  }

  initializePremiumScrolling() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) {
      console.error('Toolbar not found for premium scrolling initialization');
      return;
    }

    // Create scroll indicator elements
    const scrollIndicator = document.createElement('div');
    scrollIndicator.className = 'toolbar-scroll-indicator';
    toolbar.appendChild(scrollIndicator);

    // Create fade overlay elements for better scroll indication
    const leftFade = document.createElement('div');
    leftFade.className = 'toolbar-scroll-fade-left';
    toolbar.appendChild(leftFade);

    const rightFade = document.createElement('div');
    rightFade.className = 'toolbar-scroll-fade-right';
    toolbar.appendChild(rightFade);

    // Create enhanced border element
    const borderElement = document.createElement('div');
    borderElement.className = 'toolbar-border';
    toolbar.appendChild(borderElement);

    // Create scroll hint element
    const scrollHint = document.createElement('div');
    scrollHint.className = 'toolbar-scroll-hint';
    toolbar.appendChild(scrollHint);

    let scrollTimeout;
    let isScrolling = false;
    let rafId;
    let userHasInteracted = false;

    // Function to hide hint after user interaction
    const hideScrollHint = () => {
      if (!userHasInteracted) {
        userHasInteracted = true;
        toolbar.classList.add('user-interacted');
      }
    };

    // Enhanced scroll event handler with premium feedback
    const handleScroll = () => {
      hideScrollHint(); // Hide hint on first scroll

      if (!isScrolling) {
        isScrolling = true;
        toolbar.classList.add('scrolling');

        // Cancel any existing RAF
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
      }

      // Update scroll indicators
      this.updateScrollIndicators(toolbar);

      // Clear existing timeout and track it
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Clear existing RAF and track it
      if (this._scrollRafId) {
        cancelAnimationFrame(this._scrollRafId);
      }

      // Set timeout to end scrolling state
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        toolbar.classList.remove('scrolling');
        rafId = requestAnimationFrame(() => {
          this.updateScrollIndicators(toolbar);
        });
        this._scrollRafId = rafId;
      }, 150);
      this._scrollTimeout = scrollTimeout;
    };

    // Passive scroll listener for better performance
    toolbar.addEventListener('scroll', handleScroll, { passive: true });

    // Enhanced wheel event for smooth horizontal scrolling
    toolbar.addEventListener('wheel', (e) => {
      hideScrollHint(); // Hide hint on wheel interaction

      // Check if it's a horizontal scroll or if we should convert vertical to horizontal
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Already horizontal scroll, let it happen naturally
        return;
      }

      // Convert vertical wheel to horizontal scroll for better UX
      e.preventDefault();

      // More responsive scrolling with adaptive sensitivity
      const sensitivity = e.ctrlKey ? 0.5 : 1.2; // Slower when Ctrl is held for precision
      const scrollAmount = e.deltaY * sensitivity;

      // Check for bounds to provide gentle bounce feedback
      const currentScroll = toolbar.scrollLeft;
      const maxScroll = toolbar.scrollWidth - toolbar.clientWidth;

      if ((currentScroll <= 0 && scrollAmount < 0) ||
        (currentScroll >= maxScroll && scrollAmount > 0)) {
        // At bounds - provide subtle bounce feedback
        toolbar.style.transform = `translateX(${scrollAmount > 0 ? -2 : 2}px)`;
        requestAnimationFrame(() => {
          toolbar.style.transform = '';
        });
        return;
      }

      toolbar.scrollBy({
        left: scrollAmount,
        behavior: 'auto' // Immediate response for better feel
      });
    });

    // Touch events for mobile premium scrolling
    let touchStartX = 0;
    let touchVelocity = 0;
    let lastTouchTime = 0;

    toolbar.addEventListener('touchstart', (e) => {
      hideScrollHint(); // Hide hint on touch interaction
      touchStartX = e.touches[0].clientX;
      lastTouchTime = Date.now();
      touchVelocity = 0;
    }, { passive: true });

    toolbar.addEventListener('touchmove', (e) => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastTouchTime;
      const deltaX = e.touches[0].clientX - touchStartX;

      if (deltaTime > 0) {
        touchVelocity = deltaX / deltaTime;
      }

      lastTouchTime = currentTime;
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    toolbar.addEventListener('touchend', () => {
      // Apply momentum scrolling based on velocity
      if (Math.abs(touchVelocity) > 0.5) {
        const momentum = touchVelocity * 300;
        toolbar.scrollBy({
          left: -momentum, // Negative for natural touch direction
          behavior: 'smooth'
        });
      }
    }, { passive: true });

    // Initial indicator state and show hint if scrollable
    this.updateScrollIndicators(toolbar);

    // Show scroll hint if toolbar is scrollable (after a short delay for better UX)
    setTimeout(() => {
      const isScrollable = toolbar.scrollWidth > toolbar.clientWidth;
      if (isScrollable && !userHasInteracted) {
        scrollHint.style.opacity = '1';
      }
    }, 500);

    // Update indicators when toolbar content changes
    const observer = new MutationObserver(() => {
      // Small delay to allow layout to settle
      setTimeout(() => this.updateScrollIndicators(toolbar), 100);
    });

    observer.observe(toolbar, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });

    // Keyboard navigation support
    toolbar.addEventListener('keydown', (e) => {
      const activeButton = document.activeElement;
      if (!activeButton || !activeButton.classList.contains('btn')) return;

      hideScrollHint(); // Hide hint on keyboard interaction

      const buttons = [...toolbar.querySelectorAll('.btn:not([style*="display: none"])')];
      const currentIndex = buttons.indexOf(activeButton);
      let targetIndex;

      switch (e.key) {
        case 'ArrowLeft':
          targetIndex = Math.max(0, currentIndex - 1);
          break;
        case 'ArrowRight':
          targetIndex = Math.min(buttons.length - 1, currentIndex + 1);
          break;
        case 'Home':
          targetIndex = 0;
          break;
        case 'End':
          targetIndex = buttons.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      const targetButton = buttons[targetIndex];
      if (targetButton) {
        targetButton.focus();
        this.smoothScrollToButton(toolbar, targetButton);
      }
    });
  }

  updateScrollIndicators(toolbar) {
    const scrollLeft = toolbar.scrollLeft;
    const scrollWidth = toolbar.scrollWidth;
    const clientWidth = toolbar.clientWidth;
    const maxScroll = scrollWidth - clientWidth;

    // Update scroll classes for gradient indicators
    toolbar.classList.toggle('scroll-left', scrollLeft > 5);
    toolbar.classList.toggle('scroll-right', scrollLeft < maxScroll - 5);

    // Update scroll progress indicator
    const indicator = toolbar.querySelector('.toolbar-scroll-indicator');
    if (indicator && maxScroll > 0) {
      const progress = scrollLeft / maxScroll;
      const indicatorWidth = (clientWidth / scrollWidth) * 100;
      const indicatorLeft = progress * (100 - indicatorWidth);

      indicator.style.width = `${indicatorWidth}%`;
      indicator.style.left = `${indicatorLeft}%`;
    }
  }

  smoothScrollToButton(toolbar, button) {
    const buttonRect = button.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const buttonCenter = buttonRect.left + buttonRect.width / 2;
    const toolbarCenter = toolbarRect.left + toolbarRect.width / 2;
    const offset = buttonCenter - toolbarCenter;

    toolbar.scrollBy({
      left: offset,
      behavior: 'smooth'
    });
  }

  updateScrollbarVisibility(alwaysVisible) {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) {
      console.error('Toolbar not found for scrollbar visibility update');
      return;
    }

    if (alwaysVisible) {
      toolbar.classList.remove('scrollbar-hover-only');
    } else {
      toolbar.classList.add('scrollbar-hover-only');
    }

    // Update scroll indicators to account for potential scrollbar position changes
    requestAnimationFrame(() => {
      this.updateScrollIndicators(toolbar);
    });
  }

  // Switch to next/previous visible model button (excluding non-model controls)
  switchModel(direction = 1) {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    // Helper function to check if button is actually visible
    const isVisible = (btn) => {
      if (!btn) return false;
      const style = btn.style.display;
      const computed = getComputedStyle(btn).display;
      return style !== 'none' && computed !== 'none';
    };

    // Get candidates in current DOM order (which reflects drag-and-drop changes)
    let candidates = [...toolbar.querySelectorAll('.btn[data-url]')].filter(isVisible);

    if (candidates.length === 0) return;

    const active = toolbar.querySelector('.btn.active');
    let idx = candidates.indexOf(active); // -1 if none

    // If active class is out of sync, derive current index from iframe URL host
    const iframeForIndex = document.getElementById('main-iframe');
    if (idx === -1 && iframeForIndex && iframeForIndex.src) {
      try {
        const currentHost = new URL(iframeForIndex.src).hostname;
        idx = candidates.findIndex((btn) => {
          try {
            const candUrl = btn.getAttribute('data-url');
            if (!candUrl) return false;
            const candHost = new URL(candUrl).hostname;
            return currentHost === candHost || iframeForIndex.src.includes(candHost);
          } catch { return false; }
        });
      } catch { }
    }

    idx = (idx + direction + candidates.length) % candidates.length;
    const target = candidates[idx];

    if (target) {
      // Visually update navbar immediately (do NOT change iframe yet)
      toolbar.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
      target.classList.add('active');

      // Smooth scroll selected into view
      this.smoothScrollToButton(toolbar, target);

      // Set pending target and debounce the actual navigation
      this._pendingTarget = target;
      if (this._switchCommitTimer) {
        clearTimeout(this._switchCommitTimer);
        this._switchCommitTimer = null;
      }

      this._switchCommitTimer = setTimeout(() => {
        const btn = this._pendingTarget;
        this._switchCommitTimer = null;
        // Commit: now navigate iframe using existing click handler logic
        if (btn && document.body.contains(btn)) {
          const iframe = document.getElementById('main-iframe');
          const supportPage = document.getElementById('support-page');
          const splitViewBtn = document.getElementById('split-view-btn');
          const supportBtn = document.getElementById('support-btn');
          this.handleServiceButtonClick(btn, iframe, supportPage, splitViewBtn, supportBtn, toolbar);
          try { window.saveManager?.saveLastSelectedModel(btn.getAttribute('data-url')); } catch {}
        }
      }, this._shortcutNavDelay);
    }
  }

  // Best-effort focus of search input in known providers inside iframe
  focusSearchInIframe(iframe, url) {
    if (!iframe) return;
    // Delay a bit to allow navigation to occur; further attempts will run on iframe load
    const attempt = () => {
      try {
        // Best-effort: focus the frame so typing goes into the site
        iframe.focus();
        iframe.contentWindow?.focus();
        // Additionally, send a generic postMessage that some sites might handle (safe no-op otherwise)
        iframe.contentWindow?.postMessage({ type: 'AI_SIDE_PANEL_FOCUS_SEARCH' }, '*');
      } catch { }
    };
    setTimeout(attempt, 300);

    // Also set up a one-time listener to try again after loader hides
    const onLoad = () => {
      attempt();
      iframe.removeEventListener('load', onLoad);
    };
    iframe.addEventListener('load', onLoad, { once: true });
  }
}
