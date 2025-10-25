// Main Application Entry Point
import { SplitViewManager } from './modules/splitView.js';
import { SettingsManager } from './modules/settings.js';
import { NavBarManager } from './modules/navBar.js';
import { SaveManager } from './modules/saveManager.js';
import { CustomLinkManager } from './modules/customLink.js';
import { ContentExtractorManager } from './modules/contentExtractor.js';
import SupportMessage from './modules/supportMessage.js';

class SidePanelApp {
  constructor() {
    // Initialize all managers
    this.saveManager = new SaveManager();
    this.customLinkManager = new CustomLinkManager();
    this.settingsManager = new SettingsManager();
    this.navBarManager = new NavBarManager();
    this.splitViewManager = new SplitViewManager();
    this.contentExtractorManager = new ContentExtractorManager();
    this.supportMessage = new SupportMessage();

    // Make managers globally available for cross-module communication
    window.saveManager = this.saveManager;
    window.customLinkManager = this.customLinkManager;
    window.settingsManager = this.settingsManager;
    window.navBarManager = this.navBarManager;
    window.splitViewManager = this.splitViewManager;
    window.contentExtractorManager = this.contentExtractorManager;
    window.supportMessage = this.supportMessage;

    // Define global variables for compatibility
    window.buttons = document.querySelectorAll('.btn[data-url]');
    window.iframe = document.querySelector('iframe');
    window.supportBtn = document.getElementById('support-btn');
    window.supportPage = document.getElementById('support-page');
  }

  async initialize() {
    // CRITICAL: Let browser paint the UI first!
    // navbar and loader are visible from inline CSS
    // This ensures no blank screen while JS initializes
    
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Initialize navbar handlers immediately (clicks, drag-drop, etc.)
    this.navBarManager.init();
    
    // Initialize split view immediately to avoid race conditions
    this.splitViewManager.initialize();
    
    // Load the initial URL (loader stays visible while iframe loads)
    this.navBarManager.loadInitialUrl();
    
    // Defer non-critical initialization to not block rendering
    requestAnimationFrame(() => {
      // Apply toggle visibility (may manipulate DOM)
      this.settingsManager.initializeToggles();
      
      // Everything else can wait
      setTimeout(() => {
        this.settingsManager.setLanguage();
        this.customLinkManager.renderCustomLinks();
        this.supportMessage.init();
      }, 50);
    });
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded - Starting initialization');
  
  // UI is immediately visible:
  // - Navbar (toolbar) is visible from HTML/CSS
  // - Loader is visible by default, showing while AI content loads
  const loader = document.querySelector('.loader');
  if (loader) {
    console.log('Loader visible - navbar already showing, AI content will load');
  } else {
    console.error('Loader element not found!');
  }

  const app = new SidePanelApp();
  console.log('App instance created, starting initialization');
  await app.initialize();
  console.log('App initialization complete');

  // Route background command messages at app level as a backup
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'AI_MODEL_SWITCH') {
        window.navBarManager?.switchModel(msg.direction === 'prev' ? -1 : 1);
      }
    });
  } catch (_) {}
});

// Legacy compatibility - expose functions that might be called externally
window.toggleLoadingState = (show, label) => {
  if (window.navBarManager) {
    window.navBarManager.toggleLoadingState(show, label);
  }
};

window.addCustomLink = (url) => {
  if (window.customLinkManager) {
    return window.customLinkManager.addCustomLink(url);
  }
  return null;
};

window.deleteCustomLink = (id) => {
  if (window.customLinkManager) {
    return window.customLinkManager.deleteCustomLink(id);
  }
  return null;
};

window.getCustomLinks = () => {
  if (window.customLinkManager) {
    return window.customLinkManager.getCustomLinks();
  }
  return [];
};

window.saveCustomLinks = (links) => {
  if (window.customLinkManager) {
    window.customLinkManager.saveCustomLinks(links);
  }
};

window.restoreButtonOrder = () => {
  if (window.saveManager) {
    window.saveManager.restoreButtonOrder();
  }
};
