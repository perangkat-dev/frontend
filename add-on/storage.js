/**
 * Storage wrapper for Simple User Script Manager
 * All storage operations go through this module
 */

// Storage key for scripts
const STORAGE_KEY = 'userScripts';

/**
 * Get all scripts from storage
 * @returns {Promise<Array>} Array of script objects
 */
export async function getScripts() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  } catch (e) {
    console.error('Error reading scripts from storage:', e);
    return [];
  }
}

/**
 * Save scripts to storage
 * @param {Array} scripts - Array of script objects
 * @returns {Promise<void>}
 */
export async function saveScripts(scripts) {
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: scripts });
  } catch (e) {
    console.error('Error saving scripts to storage:', e);
    throw new Error('Failed to save scripts');
  }
}

/**
 * Get a single script by ID
 * @param {string} id - Script ID
 * @returns {Promise<Object|null>} Script object or null if not found
 */
export async function getScript(id) {
  const scripts = await getScripts();
  return scripts.find(script => script.id === id) || null;
}

/**
 * Add a new script to storage
 * @param {Object} script - Script object
 * @returns {Promise<void>}
 */
export async function addScript(script) {
  const scripts = await getScripts();
  
  // Check for duplicate by namespace + name
  const duplicateIndex = scripts.findIndex(s => 
    s.metadata && script.metadata &&
    s.metadata.namespace === script.metadata.namespace &&
    s.metadata.name === script.metadata.name
  );
  
  if (duplicateIndex !== -1) {
    // Update existing script
    scripts[duplicateIndex] = {
      ...script,
      id: scripts[duplicateIndex].id,
      installedAt: scripts[duplicateIndex].installedAt,
      updatedAt: Date.now()
    };
  } else {
    // Add new script
    scripts.push(script);
  }
  
  await saveScripts(scripts);
}

/**
 * Delete a script by ID
 * @param {string} id - Script ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteScript(id) {
  const scripts = await getScripts();
  const filtered = scripts.filter(script => script.id !== id);
  
  if (filtered.length === scripts.length) {
    return false; // Script not found
  }
  
  await saveScripts(filtered);
  return true;
}

/**
 * Toggle script enabled status
 * @param {string} id - Script ID
 * @returns {Promise<boolean>} New enabled status or null if not found
 */
export async function toggleScript(id) {
  const scripts = await getScripts();
  const script = scripts.find(s => s.id === id);
  
  if (!script) {
    return null;
  }
  
  script.enabled = !script.enabled;
  await saveScripts(scripts);
  return script.enabled;
}

/**
 * Clear all scripts from storage
 * @returns {Promise<void>}
 */
export async function clearScripts() {
  try {
    await browser.storage.local.remove(STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing scripts:', e);
    throw new Error('Failed to clear scripts');
  }
}

/**
 * Get storage usage information
 * @returns {Promise<Object>} Storage usage info
 */
export async function getStorageInfo() {
  try {
    const bytes = await browser.storage.local.getBytesInUse();
    return {
      bytesUsed: bytes,
      bytesAvailable: 5242880, // 5MB limit for local storage
      scriptsCount: (await getScripts()).length
    };
  } catch (e) {
    console.error('Error getting storage info:', e);
    return {
      bytesUsed: 0,
      bytesAvailable: 5242880,
      scriptsCount: 0
    };
  }
}