/**
 * Utility functions for Simple User Script Manager
 */

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function wildcardToRegex(pattern) {
  if (!pattern) return null;
  let regexPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  regexPattern = regexPattern.replace(/\\\*/g, '.*');
  return new RegExp(`^${regexPattern}$`);
}

export function urlMatches(url, pattern) {
  if (!url || !pattern) return false;
  try {
    const regex = wildcardToRegex(pattern);
    return regex ? regex.test(url) : false;
  } catch (e) {
    console.warn('Invalid pattern:', pattern, e);
    return false;
  }
}

export function shouldRunScript(script, url) {
  if (!script || !script.enabled || !script.metadata) {
    return false;
  }
  
  const metadata = script.metadata;
  
  if (metadata.exclude && metadata.exclude.length > 0) {
    for (const pattern of metadata.exclude) {
      if (urlMatches(url, pattern)) {
        return false;
      }
    }
  }
  
  if (metadata.match && metadata.match.length > 0) {
    for (const pattern of metadata.match) {
      if (urlMatches(url, pattern)) {
        return true;
      }
    }
    return false;
  }
  
  if (metadata.include && metadata.include.length > 0) {
    for (const pattern of metadata.include) {
      if (urlMatches(url, pattern)) {
        return true;
      }
    }
    return false;
  }
  
  return true;
}

export async function getCurrentTabUrl() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      return tabs[0].url || '';
    }
    return '';
  } catch (e) {
    console.error('Error getting current tab URL:', e);
    return '';
  }
}

export function debounce(fn, delay) {
  let timeoutId = null;
  return function (...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

export function isSafeString(str) {
  if (!str) return true;
  const dangerousPatterns = [
    /eval\s*\(/i,
    /Function\s*\(/i,
    /document\.write/i,
    /innerHTML\s*=/i,
    /outerHTML\s*=/i
  ];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(str)) {
      return false;
    }
  }
  return true;
}

export function sanitizeSource(source) {
  if (!source) return '';
  const warnings = [];
  const dangerousPatterns = [
    { pattern: /eval\s*\(/i, message: 'Uses eval()' },
    { pattern: /Function\s*\(/i, message: 'Uses Function constructor' },
    { pattern: /document\.write/i, message: 'Uses document.write' }
  ];
  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(source)) {
      warnings.push(message);
    }
  }
  if (warnings.length > 0) {
    console.warn('Script contains potentially dangerous patterns:', warnings.join(', '));
  }
  return source;
}

export function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
    return obj1 === obj2;
  }
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  return true;
}

// ===== USER SCRIPT DETECTION FUNCTIONS =====

/**
 * Check if content is a valid user script
 * Validates presence of required metadata
 * @param {string} content - File content to validate
 * @returns {boolean} True if content is a valid user script
 */
export function isValidUserScript(content) {
  if (!content || typeof content !== 'string') return false;
  
  // Must have UserScript metadata block
  if (!content.includes('// ==UserScript==')) return false;
  if (!content.includes('// ==/UserScript==')) return false;
  
  // Must have @name metadata
  if (!/\/\/\s*@name\s+/.test(content)) return false;
  
  // Must have @namespace metadata
  if (!/\/\/\s*@namespace\s+/.test(content)) return false;
  
  return true;
}

/**
 * Check if URL points to a JavaScript file
 * @param {string} url - URL to check
 * @returns {boolean} True if URL appears to be a JS file
 */
export function isJavaScriptUrl(url) {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Check file extension
    if (pathname.endsWith('.js') || pathname.endsWith('.user.js')) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if content looks like a user script (quick check)
 * @param {string} content - File content
 * @returns {boolean} True if content appears to be a user script
 */
export function looksLikeUserScript(content) {
  if (!content || typeof content !== 'string') return false;
  
  if (content.includes('==UserScript==') && content.includes('==/UserScript==')) {
    return true;
  }
  
  const patterns = [
    /\/\/\s*@name\s+/i,
    /\/\/\s*@namespace\s+/i,
    /\/\/\s*@version\s+/i,
    /\/\/\s*@match\s+/i,
    /\/\/\s*@grant\s+/i,
    /\/\/\s*@require\s+/i
  ];
  
  let matchCount = 0;
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      matchCount++;
    }
  }
  
  return matchCount >= 2;
}