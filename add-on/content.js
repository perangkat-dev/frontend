/**
 * Content script for Simple User Script Manager
 * Injects and executes user scripts on web pages
 * Also detects .user.js links for automatic installation
 */

// ===== LINK DETECTION =====

/**
 * Check if URL is a user script file
 */
function isUserScriptUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith('.user.js') || lower.endsWith('.js');
}

/**
 * Handle click on user script links - Improved version
 */
function handleLinkClick(event) {
    const link = event.target.closest('a[href]');
    if (!link) return;
    
    const href = link.href;
    if (!href) return;
    
    // Check if it's a .user.js or .js URL
    if (!isUserScriptUrl(href)) return;
    
    // Check if it's on known user script sites
    const hostname = window.location.hostname.toLowerCase();
    const isKnownHost = 
        hostname.includes('greasyfork.org') ||
        hostname.includes('openuserjs.org') ||
        hostname.includes('userscripts.org');
    
    // Also check link attributes
    const linkText = link.textContent.toLowerCase();
    const isInstallLink = 
        linkText.includes('install') ||
        linkText.includes('download') ||
        link.dataset.action === 'install' ||
        link.id === 'install-link' ||
        link.classList.contains('install-link') ||
        link.classList.contains('install') ||
        link.getAttribute('data-install') === 'true';
    
    // If not on known host and not an install link, skip
    if (!isInstallLink && !isKnownHost) {
        console.log('⏭️ Not an install link, skipping:', href);
        return;
    }
    
    console.log('🔍 User script link clicked:', href);
    
    // Prevent all default behaviors
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Send to background
    browser.runtime.sendMessage({
        action: 'installFromUrl',
        data: { url: href }
    }).then(response => {
        console.log('📨 Response from background:', response);
        if (!response || !response.success) {
            console.error('Install failed:', response?.error || 'Unknown error');
            // Fallback: open in new tab
            window.open(href, '_blank');
        }
    }).catch((error) => {
        console.error('Error sending to background:', error);
        // Fallback: open in new tab
        window.open(href, '_blank');
    });
}

/**
 * Handle all clicks at capture phase (before other handlers)
 */
function setupLinkDetection() {
    // Use capture phase to catch clicks before page's own handlers
    document.addEventListener('click', handleLinkClick, true);
    
    // Also handle mousedown as fallback
    document.addEventListener('mousedown', (event) => {
        const link = event.target.closest('a[href]');
        if (!link) return;
        const href = link.href;
        if (!href) return;
        if (!isUserScriptUrl(href)) return;
        
        // Only process if it's an install link
        const hostname = window.location.hostname.toLowerCase();
        const isKnownHost = 
            hostname.includes('greasyfork.org') ||
            hostname.includes('openuserjs.org') ||
            hostname.includes('userscripts.org');
        
        if (!isKnownHost) return;
        
        // Prevent default on mousedown for known hosts
        event.preventDefault();
        event.stopPropagation();
    }, true);
}

/**
 * Watch for dynamically added links
 */
function watchForLinks() {
    const observer = new MutationObserver(() => {
        // Click handler already works for dynamically added elements
    });
    
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// ===== SCRIPT INJECTION =====

/**
 * Generate a unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Convert wildcard pattern to regex
 */
function wildcardToRegex(pattern) {
    if (!pattern) return null;
    let regexPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regexPattern = regexPattern.replace(/\\\*/g, '.*');
    return new RegExp(`^${regexPattern}$`);
}

/**
 * Match URL against pattern
 */
function urlMatches(url, pattern) {
    if (!url || !pattern) return false;
    try {
        const regex = wildcardToRegex(pattern);
        return regex ? regex.test(url) : false;
    } catch (e) {
        console.warn('Invalid pattern:', pattern, e);
        return false;
    }
}

/**
 * Check if script should run on given URL
 */
function shouldRunScript(script, url) {
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

/**
 * Inject a single user script into the page
 */
function injectScript(script) {
    if (!script || !script.source) {
        console.warn('⚠️ Cannot inject script: missing source');
        return;
    }
    
    try {
        console.log(`📝 Injecting script: ${script.metadata?.name || 'Unnamed'}`);
        
        const scriptElement = document.createElement('script');
        scriptElement.textContent = script.source;
        scriptElement.setAttribute('data-userscript-id', script.id || 'unknown');
        scriptElement.setAttribute('data-userscript-name', 
            script.metadata?.name || 'Unnamed Script');
        
        const cspMeta = document.querySelector('meta[name="csp-nonce"]');
        if (cspMeta) {
            const nonce = cspMeta.getAttribute('content');
            if (nonce) {
                scriptElement.setAttribute('nonce', nonce);
            }
        }
        
        const target = document.head || document.documentElement;
        if (target) {
            target.appendChild(scriptElement);
            console.log(`✅ Script injected successfully`);
            
            setTimeout(() => {
                if (scriptElement.parentNode) {
                    scriptElement.remove();
                }
            }, 100);
        }
        
    } catch (e) {
        console.error('❌ Error injecting script:', e);
    }
}

/**
 * Get scripts from background script
 */
async function getMatchingScripts(url) {
    try {
        const response = await browser.runtime.sendMessage({
            action: 'getMatchingScripts',
            data: { url }
        });
        
        if (response && response.success) {
            return response.scripts || [];
        }
        return [];
    } catch (e) {
        console.error('❌ Error getting matching scripts:', e);
        return [];
    }
}

/**
 * Main execution function
 */
async function executeScripts() {
    try {
        const url = window.location.href;
        const scripts = await getMatchingScripts(url);
        
        if (!scripts || scripts.length === 0) {
            return;
        }
        
        const groupedScripts = {
            'document-start': [],
            'document-end': [],
            'document-idle': []
        };
        
        for (const script of scripts) {
            const runAt = script.metadata?.runAt || 'document-end';
            if (groupedScripts[runAt]) {
                groupedScripts[runAt].push(script);
            }
        }
        
        if (groupedScripts['document-start'].length > 0) {
            for (const script of groupedScripts['document-start']) {
                injectScript(script);
            }
        }
        
        if (groupedScripts['document-end'].length > 0) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    for (const script of groupedScripts['document-end']) {
                        injectScript(script);
                    }
                });
            } else {
                for (const script of groupedScripts['document-end']) {
                    injectScript(script);
                }
            }
        }
        
        if (groupedScripts['document-idle'].length > 0) {
            if (document.readyState === 'complete') {
                for (const script of groupedScripts['document-idle']) {
                    injectScript(script);
                }
            } else {
                window.addEventListener('load', () => {
                    for (const script of groupedScripts['document-idle']) {
                        injectScript(script);
                    }
                });
            }
        }
        
    } catch (e) {
        console.error('❌ Error executing scripts:', e);
    }
}

// ===== INIT =====

console.log('🔄 Jamu Script Manager content script loaded');

// Setup link detection
setupLinkDetection();
watchForLinks();

// Execute scripts
executeScripts();

// SPA support
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        console.log(`🔄 URL changed to ${currentUrl}`);
        lastUrl = currentUrl;
        setTimeout(() => {
            executeScripts();
        }, 500);
    }
});

try {
    observer.observe(document, {
        subtree: true,
        childList: true
    });
} catch (e) {
    console.warn('⚠️ Could not start URL observer:', e.message);
}