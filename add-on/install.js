/**
 * Install page script for Jamu Script Manager
 * Handles automatic installation of .user.js files
 */

// DOM Elements
const loadingState = document.getElementById('loadingState');
const installState = document.getElementById('installState');
const successState = document.getElementById('successState');
const scriptName = document.getElementById('scriptName');
const sourceUrl = document.getElementById('sourceUrl');
const metaName = document.getElementById('metaName');
const metaAuthor = document.getElementById('metaAuthor');
const metaVersion = document.getElementById('metaVersion');
const metaDescription = document.getElementById('metaDescription');
const metaMatch = document.getElementById('metaMatch');
const scriptPreview = document.getElementById('scriptPreview');
const installBtn = document.getElementById('installBtn');
const cancelBtn = document.getElementById('cancelBtn');
const closeBtn = document.getElementById('closeBtn');
const statusMessage = document.getElementById('statusMessage');
const statusTitle = document.getElementById('statusTitle');
const statusDetail = document.getElementById('statusDetail');

// State
let scriptData = null;
let isAndroid = false;

// ===== UTILITY FUNCTIONS =====

/**
 * Detect if running on Android
 */
function detectAndroid() {
  return /android/i.test(navigator.userAgent) || 
         /Android/i.test(navigator.platform) ||
         (typeof window.orientation !== 'undefined' && /android/i.test(navigator.vendor));
}

/**
 * Parse URL parameters
 */
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    url: params.get('url'),
    filename: params.get('filename') || 'script.user.js'
  };
}

/**
 * Show status message
 */
function showStatus(title, detail, type = 'success') {
  statusMessage.className = 'status-message show ' + type;
  statusTitle.textContent = title;
  statusDetail.textContent = detail;
}

/**
 * Clear status
 */
function clearStatus() {
  statusMessage.className = 'status-message';
  statusMessage.classList.remove('show', 'success', 'error');
}

// ===== FETCH FUNCTIONS =====

/**
 * Fetch script content - Simple version
 */
async function fetchScript(url) {
  try {
    console.log('📥 Fetching script from:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/javascript, text/javascript, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    
    // Validate it's a user script
    if (!content.includes('==UserScript==') || !content.includes('==/UserScript==')) {
      throw new Error('File does not contain valid UserScript metadata');
    }
    
    console.log('✅ Script fetched successfully, length:', content.length);
    return content;
  } catch (e) {
    console.error('❌ Fetch error:', e);
    throw new Error(`Failed to fetch script: ${e.message}`);
  }
}

// ===== PARSE FUNCTIONS =====

/**
 * Parse metadata from script
 */
function parseMetadata(source) {
  const metadata = {
    name: 'Unknown',
    namespace: 'Unknown',
    version: 'Unknown',
    description: 'No description',
    author: 'Unknown',
    match: [],
    include: [],
    exclude: [],
    runAt: 'document-end'
  };
  
  const lines = source.split('\n');
  let inMetadata = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === '// ==UserScript==') {
      inMetadata = true;
      continue;
    }
    
    if (trimmed === '// ==/UserScript==') {
      break;
    }
    
    if (inMetadata) {
      const match = trimmed.match(/^\/\/\s*@(\w+)\s+(.+)$/);
      if (match) {
        const key = match[1].toLowerCase();
        const value = match[2].trim();
        
        switch (key) {
          case 'name':
            metadata.name = value;
            break;
          case 'namespace':
            metadata.namespace = value;
            break;
          case 'version':
            metadata.version = value;
            break;
          case 'description':
            metadata.description = value;
            break;
          case 'author':
            metadata.author = value;
            break;
          case 'match':
            metadata.match.push(value);
            break;
          case 'include':
            metadata.include.push(value);
            break;
          case 'exclude':
            metadata.exclude.push(value);
            break;
          case 'run-at':
            metadata.runAt = value;
            break;
        }
      }
    }
  }
  
  return metadata;
}

/**
 * Update UI with script metadata
 */
function updateUI(metadata) {
  scriptName.textContent = metadata.name;
  metaName.textContent = metadata.name;
  metaAuthor.textContent = metadata.author;
  metaVersion.textContent = metadata.version;
  metaDescription.textContent = metadata.description;
  
  let matchDisplay = 'All URLs';
  if (metadata.match && metadata.match.length > 0) {
    matchDisplay = metadata.match.join(', ');
  } else if (metadata.include && metadata.include.length > 0) {
    matchDisplay = metadata.include.join(', ');
  }
  metaMatch.textContent = matchDisplay;
}

// ===== STORAGE FUNCTIONS =====

/**
 * Get scripts from storage
 */
async function getScripts() {
  try {
    const result = await browser.storage.local.get('userScripts');
    return result.userScripts || [];
  } catch (e) {
    console.error('Error getting scripts:', e);
    return [];
  }
}

/**
 * Check if script already installed
 */
async function checkExistingScript(metadata) {
  try {
    const scripts = await getScripts();
    const existing = scripts.find(s => 
      s.metadata && metadata &&
      s.metadata.namespace === metadata.namespace &&
      s.metadata.name === metadata.name
    );
    
    if (existing) {
      return {
        installed: true,
        currentVersion: existing.metadata.version || '0.0.0',
        script: existing
      };
    }
    
    return { installed: false };
  } catch (e) {
    console.error('Error checking existing script:', e);
    return { installed: false };
  }
}

/**
 * Compare versions
 */
function compareVersions(v1, v2) {
  const parts1 = String(v1).split('.').map(Number);
  const parts2 = String(v2).split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  
  return 0;
}

// ===== UI FUNCTIONS =====

/**
 * Toggle preview - Dengan event listener, bukan inline onclick
 */
function togglePreview() {
  const preview = document.getElementById('scriptPreview');
  if (preview.style.display === 'none') {
    preview.style.display = 'block';
    preview.textContent = scriptData ? scriptData.source : 'No source available';
  } else {
    preview.style.display = 'none';
  }
}

/**
 * Show "Already Installed" notification - Safe version (no innerHTML)
 */
function showAlreadyInstalledNotification(metadata, isOlderVersion = false) {
  loadingState.style.display = 'none';
  installState.style.display = 'none';
  successState.style.display = 'block';
  
  const icon = isOlderVersion ? '⚠️' : 'ℹ️';
  const title = isOlderVersion ? 'Older Version Detected' : 'Script Already Installed';
  const message = isOlderVersion 
    ? `You have version ${metadata.version} installed. This is an older version.`
    : `"${metadata.name}" version ${metadata.version} is already installed.`;
  
  document.querySelector('.install-success-icon').textContent = icon;
  document.querySelector('.install-success-text').textContent = title;
  document.querySelector('.install-success-sub').textContent = message;
  
  const actionsDiv = document.querySelector('.install-actions');
  actionsDiv.innerHTML = '';
  
  // Close button
  const closeBtnEl = document.createElement('button');
  closeBtnEl.className = 'btn-secondary';
  closeBtnEl.id = 'closeBtn';
  closeBtnEl.textContent = 'Close';
  closeBtnEl.addEventListener('click', handleClose);
  actionsDiv.appendChild(closeBtnEl);
  
  // Action button (Reinstall or Update)
  const actionBtn = document.createElement('button');
  actionBtn.className = 'btn-primary';
  if (!isOlderVersion) {
    actionBtn.id = 'reinstallBtn';
    actionBtn.textContent = 'Reinstall';
  } else {
    actionBtn.id = 'updateBtn';
    actionBtn.textContent = 'Update Anyway';
  }
  actionBtn.addEventListener('click', () => {
    handleInstall(true);
  });
  actionsDiv.appendChild(actionBtn);
}

/**
 * Show Update Notification - Safe version (no innerHTML)
 */
function showUpdateNotification(metadata, oldVersion, source, filename, url) {
  loadingState.style.display = 'none';
  installState.style.display = 'none';
  successState.style.display = 'block';
  
  document.querySelector('.install-success-icon').textContent = '🔄';
  document.querySelector('.install-success-text').textContent = 'Update Available!';
  
  const subElement = document.querySelector('.install-success-sub');
  subElement.innerHTML = '';
  
  const nameStrong = document.createElement('strong');
  nameStrong.textContent = metadata.name;
  subElement.appendChild(nameStrong);
  subElement.appendChild(document.createElement('br'));
  
  const currentText = document.createTextNode(`Current version: ${oldVersion}`);
  subElement.appendChild(currentText);
  subElement.appendChild(document.createElement('br'));
  
  const newText = document.createTextNode(`New version: ${metadata.version}`);
  subElement.appendChild(newText);
  subElement.appendChild(document.createElement('br'));
  subElement.appendChild(document.createElement('br'));
  
  const updateText = document.createTextNode('Would you like to update?');
  subElement.appendChild(updateText);
  
  scriptData = {
    source: source,
    metadata: metadata,
    filename: filename,
    url: url,
    isUpdate: true
  };
  
  const actionsDiv = document.querySelector('.install-actions');
  actionsDiv.innerHTML = '';
  
  // Close button
  const closeBtnEl = document.createElement('button');
  closeBtnEl.className = 'btn-secondary';
  closeBtnEl.id = 'closeBtn';
  closeBtnEl.textContent = 'Close';
  closeBtnEl.addEventListener('click', handleClose);
  actionsDiv.appendChild(closeBtnEl);
  
  // Update button
  const updateBtnEl = document.createElement('button');
  updateBtnEl.className = 'btn-primary';
  updateBtnEl.id = 'updateBtn';
  updateBtnEl.textContent = 'Update Script';
  updateBtnEl.addEventListener('click', () => {
    handleInstall(true);
  });
  actionsDiv.appendChild(updateBtnEl);
}

/**
 * Show error state - Safe version (no innerHTML)
 */
function showErrorState(message) {
  loadingState.innerHTML = '';
  loadingState.style.cssText = 'text-align: center; padding: 40px 20px;';
  
  const iconDiv = document.createElement('div');
  iconDiv.style.cssText = 'font-size: 48px; margin-bottom: 16px;';
  iconDiv.textContent = '❌';
  loadingState.appendChild(iconDiv);
  
  const titleH3 = document.createElement('h3');
  titleH3.style.cssText = 'color: #2c3e50; margin-bottom: 8px;';
  titleH3.textContent = 'Failed to load script';
  loadingState.appendChild(titleH3);
  
  const messageP = document.createElement('p');
  messageP.style.cssText = 'color: #e74c3c; margin-bottom: 16px;';
  messageP.textContent = message;
  loadingState.appendChild(messageP);
  
  const closeBtnEl = document.createElement('button');
  closeBtnEl.className = 'btn-secondary';
  closeBtnEl.id = 'closeErrorBtn';
  closeBtnEl.style.cssText = 'padding: 10px 24px;';
  closeBtnEl.textContent = 'Close';
  closeBtnEl.addEventListener('click', handleClose);
  loadingState.appendChild(closeBtnEl);
}

// ===== CLOSE FUNCTIONS =====

/**
 * Handle close - Simple and reliable
 */
function handleClose() {
  console.log('🔄 Closing page...');
  
  // Method 1: Try browser.tabs.remove
  if (typeof browser !== 'undefined' && browser.tabs) {
    browser.tabs.getCurrent()
      .then(tab => {
        if (tab && tab.id) {
          return browser.tabs.remove(tab.id);
        }
        throw new Error('No tab');
      })
      .catch(() => {
        // Method 2: Try window.close
        try {
          window.close();
        } catch (e) {
          // Method 3: Redirect
          window.location.href = 'about:blank';
        }
      });
  } else {
    // Method 2: Try window.close
    try {
      window.close();
    } catch (e) {
      // Method 3: Redirect
      window.location.href = 'about:blank';
    }
  }
}

// ===== INSTALL FUNCTIONS =====

/**
 * Handle install - Safe version (no innerHTML)
 */
async function handleInstall(forceUpdate = false) {
  if (!scriptData) {
    showStatus('Error', 'No script data available', 'error');
    return;
  }
  
  try {
    const installBtnEl = document.getElementById('installBtn') || 
                         document.getElementById('updateBtn') ||
                         document.getElementById('reinstallBtn');
    
    if (installBtnEl) {
      installBtnEl.disabled = true;
      installBtnEl.innerHTML = '<span class="spinner"></span> Installing...';
    }
    clearStatus();
    
    const response = await browser.runtime.sendMessage({
      action: 'install',
      data: {
        source: scriptData.source,
        filename: scriptData.filename || 'script.user.js'
      }
    });
    
    if (response && response.success) {
      const isUpdate = response.isUpdate || forceUpdate;
      
      installState.style.display = 'none';
      successState.style.display = 'block';
      
      const icon = isUpdate ? '🔄' : '✅';
      const title = isUpdate ? 'Script Updated Successfully!' : 'Script Installed Successfully!';
      const message = isUpdate 
        ? `"${scriptData.metadata.name}" has been updated to version ${scriptData.metadata.version}`
        : `"${scriptData.metadata.name}" has been added to your collection.`;
      
      document.querySelector('.install-success-icon').textContent = icon;
      document.querySelector('.install-success-text').textContent = title;
      
      const subElement = document.querySelector('.install-success-sub');
      subElement.innerHTML = '';
      
      const messageText = document.createTextNode(message);
      subElement.appendChild(messageText);
      subElement.appendChild(document.createElement('br'));
      subElement.appendChild(document.createElement('br'));
      
      const countdownSpan = document.createElement('span');
      countdownSpan.style.cssText = 'font-size: 13px; color: #95a5a6;';
      countdownSpan.textContent = 'Closing in 5 seconds...';
      subElement.appendChild(countdownSpan);
      
      const actionsDiv = document.querySelector('.install-actions');
      actionsDiv.innerHTML = '';
      
      const closeBtnEl = document.createElement('button');
      closeBtnEl.className = 'btn-success';
      closeBtnEl.id = 'closeBtn';
      closeBtnEl.textContent = 'Close';
      closeBtnEl.addEventListener('click', handleClose);
      actionsDiv.appendChild(closeBtnEl);
      
      setTimeout(() => {
        handleClose();
      }, 5000);
      
    } else {
      showStatus(
        'Installation Failed',
        response?.error || 'Unknown error occurred',
        'error'
      );
      
      if (installBtnEl) {
        installBtnEl.disabled = false;
        installBtnEl.innerHTML = 'Install Script';
      }
    }
  } catch (e) {
    console.error('Install error:', e);
    showStatus('Error', e.message || 'Failed to install script', 'error');
    
    const installBtnEl = document.getElementById('installBtn') || 
                         document.getElementById('updateBtn') ||
                         document.getElementById('reinstallBtn');
    if (installBtnEl) {
      installBtnEl.disabled = false;
      installBtnEl.innerHTML = 'Install Script';
    }
  }
}

/**
 * Handle cancel
 */
function handleCancel() {
  if (confirm('Cancel installation? The script will not be installed.')) {
    handleClose();
  }
}

// ===== INIT =====

/**
 * Initialize install page
 */
async function init() {
  try {
    isAndroid = detectAndroid();
    console.log(`📱 Platform: ${isAndroid ? 'Android' : 'Desktop'}`);
    
    const params = getUrlParams();
    
    if (!params.url) {
      throw new Error('No script URL provided');
    }
    
    sourceUrl.textContent = params.url;
    
    // Fetch script content
    let source;
    try {
      source = await fetchScript(params.url);
    } catch (fetchError) {
      showErrorState(fetchError.message);
      return;
    }
    
    // Parse metadata
    const metadata = parseMetadata(source);
    console.log('📋 Parsed metadata:', metadata);
    
    // Check if script already installed
    const existing = await checkExistingScript(metadata);
    
    if (existing.installed) {
      const versionCompare = compareVersions(
        metadata.version || '0.0.0',
        existing.currentVersion
      );
      
      if (versionCompare > 0) {
        showUpdateNotification(metadata, existing.currentVersion, source, params.filename, params.url);
        return;
      } else if (versionCompare === 0) {
        showAlreadyInstalledNotification(metadata);
        return;
      } else {
        showAlreadyInstalledNotification(metadata, true);
        return;
      }
    }
    
    // New script - proceed with installation
    scriptData = {
      source: source,
      metadata: metadata,
      filename: params.filename,
      url: params.url
    };
    
    // Update UI
    updateUI(metadata);
    
    // Show source preview
    scriptPreview.textContent = source;
    
    // Switch to install state
    loadingState.style.display = 'none';
    installState.style.display = 'block';
    
    // Setup event listeners
    const toggleBtn = document.getElementById('togglePreviewBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', togglePreview);
    }
    
    if (installBtn) installBtn.addEventListener('click', handleInstall);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    if (closeBtn) closeBtn.addEventListener('click', handleClose);
    
    console.log('✅ Install page initialized for:', metadata.name);
    
  } catch (e) {
    console.error('❌ Init error:', e);
    showErrorState(e.message);
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);