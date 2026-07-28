/**
 * Background script for Simple User Script Manager
 * Central logic hub for all extension operations
 */

// ===== IMPORTS =====
import { 
  generateId, 
  shouldRunScript, 
  sanitizeSource,
  isValidUserScript
} from './utils.js';
import { getScripts, addScript, deleteScript, toggleScript } from './storage.js';
import { parseScript } from './parser.js';

// ===== WEBREQUEST INTERCEPTOR (TERBATAS) =====
// HANYA untuk .user.js URL langsung

const pendingScripts = new Map();

/**
 * Validate user script by fetching content
 */
async function validateUserScript(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'Range': 'bytes=0-10240',
        'Accept': 'application/javascript, text/javascript, */*'
      }
    });
    
    if (!response.ok) return false;
    
    const content = await response.text();
    return isValidUserScript(content);
  } catch (e) {
    return false;
  }
}

/**
 * Handle web requests - ONLY for .user.js files
 * This handles direct URL access
 */
browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    try {
      const url = details.url;
      
      // Skip if not a GET request
      if (details.method !== 'GET') return;
      
      // Skip browser-internal requests
      if (url.startsWith('moz-extension://') || 
          url.startsWith('chrome://') || 
          url.startsWith('about:')) {
        return;
      }
      
      // ONLY process .user.js files (not all .js)
      if (!url.toLowerCase().endsWith('.user.js')) {
        return;
      }
      
      console.log('🔍 Direct .user.js URL detected:', url);
      
      // Check if this URL was recently intercepted (avoid loops)
      const recentCheck = pendingScripts.get(url);
      if (recentCheck && Date.now() - recentCheck < 5000) {
        console.log('⏭️ Skipping recent detection for:', url);
        return;
      }
      
      // Validate before opening install page
      const isValid = await validateUserScript(url);
      
      if (!isValid) {
        console.log('⏭️ Not a valid user script, skipping');
        return;
      }
      
      console.log('✅ Valid user script confirmed');
      
      pendingScripts.set(url, Date.now());
      
      // Clean up old entries
      for (const [key, timestamp] of pendingScripts.entries()) {
        if (Date.now() - timestamp > 60000) {
          pendingScripts.delete(key);
        }
      }
      
      // Get the tab
      let tab = null;
      try {
        if (details.tabId && details.tabId > 0) {
          tab = await browser.tabs.get(details.tabId).catch(() => null);
        }
      } catch (e) {}
      
      // Open install page
      const installUrl = browser.runtime.getURL('install.html') + 
        `?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(url.split('/').pop() || 'script.user.js')}`;
      
      if (tab) {
        browser.tabs.update(tab.id, { url: installUrl });
      } else {
        browser.tabs.create({ url: installUrl });
      }
      
    } catch (e) {
      console.error('WebRequest error:', e);
    }
  },
  { 
    urls: ["<all_urls>"], 
    types: ["main_frame"] // ONLY main frame navigation
  },
  ["blocking"]
);

// ===== MESSAGE HANDLERS =====

const handlers = {
  /**
   * Ping - untuk mengecek koneksi
   */
  ping: async () => {
    return { success: true, message: 'Background is ready' };
  },

  /**
   * Install a new script or update existing
   */
  install: async (data) => {
    try {
      if (!data || !data.source) {
        return { success: false, error: 'No script source provided' };
      }
      
      const parseResult = parseScript(data.source);
      
      if (!parseResult.valid) {
        return { 
          success: false, 
          error: parseResult.error || 'Invalid script format' 
        };
      }
      
      const sanitizedSource = sanitizeSource(parseResult.source);
      
      const existingScripts = await getScripts();
      const existing = existingScripts.find(s => 
        s.metadata && parseResult.metadata &&
        s.metadata.namespace === parseResult.metadata.namespace &&
        s.metadata.name === parseResult.metadata.name
      );
      
      const script = {
        id: existing ? existing.id : generateId(),
        enabled: true,
        metadata: parseResult.metadata,
        source: sanitizedSource,
        installedAt: existing ? existing.installedAt : Date.now(),
        updatedAt: Date.now(),
        filename: data.filename || 'unknown.js'
      };
      
      await addScript(script);
      
      return {
        success: true,
        message: existing ? 'Script updated successfully' : 'Script installed successfully',
        scriptId: script.id,
        isUpdate: !!existing
      };
      
    } catch (e) {
      console.error('Install error:', e);
      return { success: false, error: `Installation failed: ${e.message}` };
    }
  },

  /**
   * Delete a script
   */
  delete: async (data) => {
    try {
      if (!data || !data.id) {
        return { success: false, error: 'No script ID provided' };
      }
      
      const deleted = await deleteScript(data.id);
      
      if (!deleted) {
        return { success: false, error: 'Script not found' };
      }
      
      return { success: true, message: 'Script deleted successfully' };
      
    } catch (e) {
      console.error('Delete error:', e);
      return { success: false, error: `Delete failed: ${e.message}` };
    }
  },

  /**
   * Toggle script enabled status
   */
  toggle: async (data) => {
    try {
      if (!data || !data.id) {
        return { success: false, error: 'No script ID provided' };
      }
      
      const newStatus = await toggleScript(data.id);
      
      if (newStatus === null) {
        return { success: false, error: 'Script not found' };
      }
      
      return { 
        success: true, 
        message: `Script ${newStatus ? 'enabled' : 'disabled'}`,
        enabled: newStatus
      };
      
    } catch (e) {
      console.error('Toggle error:', e);
      return { success: false, error: `Toggle failed: ${e.message}` };
    }
  },

  /**
   * Get list of all scripts
   */
  list: async () => {
    try {
      const scripts = await getScripts();
      const sanitizedList = scripts.map(script => ({
        id: script.id,
        enabled: script.enabled,
        metadata: {
          name: script.metadata.name,
          namespace: script.metadata.namespace,
          version: script.metadata.version || 'Unknown',
          description: script.metadata.description || '',
          author: script.metadata.author || 'Unknown'
        },
        installedAt: script.installedAt,
        updatedAt: script.updatedAt,
        filename: script.filename
      }));
      
      return { 
        success: true, 
        scripts: sanitizedList,
        count: sanitizedList.length
      };
      
    } catch (e) {
      console.error('List error:', e);
      return { success: false, error: `Failed to list scripts: ${e.message}` };
    }
  },

  /**
   * Get scripts that should run on current URL
   */
  getMatchingScripts: async (data) => {
    try {
      if (!data || !data.url) {
        return { success: false, error: 'No URL provided' };
      }
      
      const scripts = await getScripts();
      const matchingScripts = scripts.filter(script => 
        shouldRunScript(script, data.url)
      );
      
      const scriptsForInjection = matchingScripts.map(script => ({
        id: script.id,
        source: script.source,
        metadata: {
          name: script.metadata.name,
          runAt: script.metadata.runAt || 'document-end',
          match: script.metadata.match || [],
          include: script.metadata.include || [],
          exclude: script.metadata.exclude || []
        }
      }));
      
      return {
        success: true,
        scripts: scriptsForInjection,
        count: scriptsForInjection.length
      };
      
    } catch (e) {
      console.error('Get matching scripts error:', e);
      return { success: false, error: `Failed to get matching scripts: ${e.message}` };
    }
  },

  /**
   * Install from URL - Called by content script
   */
  installFromUrl: async (data) => {
    try {
      if (!data || !data.url) {
        return { success: false, error: 'No URL provided' };
      }
      
      const url = data.url;
      console.log('📥 Installing from URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/javascript, text/javascript, */*'
        }
      });
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const content = await response.text();
      
      if (!isValidUserScript(content)) {
        return { success: false, error: 'Not a valid user script' };
      }
      
      const installUrl = browser.runtime.getURL('install.html') + 
        `?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(url.split('/').pop() || 'script.js')}`;
      
      await browser.tabs.create({ url: installUrl });
      
      return { success: true };
      
    } catch (e) {
      console.error('Install from URL error:', e);
      return { success: false, error: e.message };
    }
  }
};

// ===== MESSAGE DISPATCHER =====

async function dispatchMessage(message, sender) {
  try {
    const { action, data } = message || {};
    
    if (!action) {
      return { success: false, error: 'No action specified' };
    }
    
    const handler = handlers[action];
    
    if (!handler) {
      return { success: false, error: `Unknown action: ${action}` };
    }
    
    const result = await handler(data, sender);
    return result;
    
  } catch (e) {
    console.error('Message dispatch error:', e);
    return { success: false, error: `Internal error: ${e.message}` };
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  dispatchMessage(message, sender).then(result => {
    sendResponse(result);
  }).catch(error => {
    sendResponse({ success: false, error: error.message });
  });
  return true;
});

// ===== EXTENSION LIFECYCLE =====

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('✅ Jamu Script Manager installed');
  } else if (details.reason === 'update') {
    console.log('🔄 Jamu Script Manager updated to version', 
      browser.runtime.getManifest().version);
  }
});

console.log('✅ Jamu Script Manager background script loaded');