// ============================================================
// Jamu Dashboard - Module v1.0.6
// ============================================================
(function() {
'use strict';
const MODULE_ID = 'jamu-dashboard';
const VERSION = '1.0.6';

// ============================================================
// 0. DEBUG FLAG
// ============================================================
let DEBUG = true;
const log = (...args) => DEBUG && console.log('[Dashboard]', ...args);
const warn = (...args) => DEBUG && console.warn('[Dashboard]', ...args);
const error = (...args) => console.error('[Dashboard]', ...args);

log(`✅ v${VERSION} loaded successfully!`);

// ============================================================
// 1. AMBIL MANIFEST
// ============================================================
const manifest = window.__JAMU_MANIFEST__ || {};
const loaderVersion = window.__JAMU_VERSION__ || '2.0.0';

// ============================================================
// 2. STORAGE + CACHE
// ============================================================
const Storage = {
    get(keys) {
        const result = {};
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => {
            const val = localStorage.getItem(`jamu_${key}`);
            result[key] = val ? JSON.parse(val) : null;
        });
        return result;
    },
    set(obj) {
        for (const [key, value] of Object.entries(obj)) {
            localStorage.setItem(`jamu_${key}`, JSON.stringify(value));
        }
    }
};

const Cache = {
    _store: {},
    _etags: {},
    
    get(key, ttlMs = 5 * 60 * 1000) {
        const entry = this._store[key];
        if (!entry) return null;
        if (Date.now() - entry.fetchedAt > ttlMs) {
            delete this._store[key];
            return null;
        }
        return entry.data;
    },
    
    set(key, data, etag = null) {
        this._store[key] = { data, fetchedAt: Date.now() };
        if (etag) this._etags[key] = etag;
    },
    
    getEtag(key) {
        return this._etags[key] || null;
    },
    
    clear(key) {
        if (key) {
            delete this._store[key];
            delete this._etags[key];
        } else {
            this._store = {};
            this._etags = {};
        }
    }
};

// ============================================================
// 3. IDENTIFIER SERVICE
// ============================================================
const IdentifierService = {
    getDomain() {
        const url = window.location.href;
        const skipDomains = ['form.kemkes.go.id', 'skrining.kemkes.go.id', 'survey.kemkes.go.id'];
        for (const domain of skipDomains) {
            if (url.includes(domain)) return 'skipped';
        }
        if (url.includes('epuskesmas.id')) return 'epuskesmas';
        if (url.includes('bpjs-kesehatan.go.id')) return 'bpjs';
        if (url.includes('asik.kemkes.go.id')) return 'asik';
        if (url.includes('sehatindonesiaku.kemkes.go.id')) return 'asik';
        if (url.includes('sehatindonesiaku')) return 'asik';
        return 'other';
    },
    
    getEpuskesmasIdentifier() {
        try {
            if (window.AppLayoutConfig?.webSocket?.puskesmasId) {
                const match = window.AppLayoutConfig.webSocket.puskesmasId.match(/(\d+)/);
                if (match) {
                    const id = match[1].replace(/^0+/, '');
                    log(`🔍 Found ePuskesmas ID from AppLayoutConfig: ${id}`);
                    return id;
                }
            }
            const userMenu = document.querySelector("#menu_user .label-default");
            if (userMenu) {
                const match = userMenu.textContent.trim().match(/(\d+)/);
                if (match) {
                    const id = match[1].replace(/^0+/, '');
                    log(`🔍 Found ePuskesmas ID from user menu: ${id}`);
                    return id;
                }
            }
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const content = script.textContent || '';
                if (content.includes('puskesmasId')) {
                    const match = content.match(/puskesmasId["']?\s*:\s*["']?(\d+)/);
                    if (match) {
                        const id = match[1].replace(/^0+/, '');
                        log(`🔍 Found ePuskesmas ID from script: ${id}`);
                        return id;
                    }
                }
            }
            const urlMatch = window.location.href.match(/puskesmas[=\/](\d+)/i);
            if (urlMatch) {
                const id = urlMatch[1].replace(/^0+/, '');
                log(`🔍 Found ePuskesmas ID from URL: ${id}`);
                return id;
            }
        } catch (e) {
            error('Error getting ePuskesmas ID:', e);
        }
        return null;
    },
    
    getBpjsIdentifier() {
        try {
            const hiddenSpans = document.querySelectorAll('.hidden-xs');
            for (const span of hiddenSpans) {
                const match = span.textContent.trim().match(/\((\d{8})\)/);
                if (match) {
                    log(`🔍 Found BPJS ID from hidden span: ${match[1]}`);
                    return match[1];
                }
            }
            const userHeader = document.querySelector('.user-header p');
            if (userHeader) {
                const match = userHeader.textContent.trim().match(/\b(\d{8})\b/);
                if (match) {
                    log(`🔍 Found BPJS ID from user header: ${match[1]}`);
                    return match[1];
                }
            }
            const bodyText = document.body.textContent;
            const matches = bodyText.match(/\b(\d{8})\b/g);
            if (matches && matches.length > 0) {
                const found = matches.find(c => c.startsWith('10')) || matches[0];
                log(`🔍 Found BPJS ID from body: ${found}`);
                return found;
            }
        } catch (e) {
            error('Error getting BPJS ID:', e);
        }
        return null;
    },
    
    getAsikIdentifier() {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const parsed = JSON.parse(userData);
                    if (parsed?.user?.kode_sarana) {
                        log(`🔍 Found ASIK ID from user: ${parsed.user.kode_sarana}`);
                        return parsed.user.kode_sarana;
                    }
                    if (parsed?.kode_sarana) {
                        log(`🔍 Found ASIK ID from user: ${parsed.kode_sarana}`);
                        return parsed.kode_sarana;
                    }
                } catch (e) {}
            }
            const userEksternal = localStorage.getItem('user_eksternal');
            if (userEksternal) {
                try {
                    const parsed = JSON.parse(userEksternal);
                    if (parsed?.kode_sarana) {
                        log(`🔍 Found ASIK ID from user_eksternal: ${parsed.kode_sarana}`);
                        return parsed.kode_sarana;
                    }
                } catch (e) {}
            }
            if (window.__asikData?.kode_sarana) {
                log(`🔍 Found ASIK ID from window: ${window.__asikData.kode_sarana}`);
                return window.__asikData.kode_sarana;
            }
            const keys = ['userData', 'userInfo', 'profile', 'asik_user', 'currentUser'];
            for (const key of keys) {
                let data = localStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed?.kode_sarana) {
                            log(`🔍 Found ASIK ID from ${key}: ${parsed.kode_sarana}`);
                            return parsed.kode_sarana;
                        }
                        if (parsed?.user?.kode_sarana) {
                            log(`🔍 Found ASIK ID from ${key}.user: ${parsed.user.kode_sarana}`);
                            return parsed.user.kode_sarana;
                        }
                        if (parsed?.data?.kode_sarana) {
                            log(`🔍 Found ASIK ID from ${key}.data: ${parsed.data.kode_sarana}`);
                            return parsed.data.kode_sarana;
                        }
                    } catch (e) {}
                }
                data = sessionStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed?.kode_sarana) {
                            log(`🔍 Found ASIK ID from ${key} (session): ${parsed.kode_sarana}`);
                            return parsed.kode_sarana;
                        }
                        if (parsed?.user?.kode_sarana) {
                            log(`🔍 Found ASIK ID from ${key}.user (session): ${parsed.user.kode_sarana}`);
                            return parsed.user.kode_sarana;
                        }
                        if (parsed?.data?.kode_sarana) {
                            log(`🔍 Found ASIK ID from ${key}.data (session): ${parsed.data.kode_sarana}`);
                            return parsed.data.kode_sarana;
                        }
                    } catch (e) {}
                }
            }
            const selectors = ['[data-kode-sarana]', '[data-kode-puskesmas]', '.kode-sarana'];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const value = el.dataset.kodeSarana || el.dataset.kodePuskesmas || el.textContent.trim();
                    if (value) {
                        log(`🔍 Found ASIK ID from selector ${sel}: ${value}`);
                        return value;
                    }
                }
            }
            const bodyText = document.body.textContent;
            const matches = bodyText.match(/\b(\d{11})\b/g);
            if (matches && matches.length > 0) {
                log(`🔍 Found ASIK ID from body: ${matches[0]}`);
                return matches[0];
            }
        } catch (e) {
            error('Error getting ASIK ID:', e);
        }
        return null;
    },
    
    getCurrentIdentifier() {
        const domain = this.getDomain();
        log(`🔍 Current domain: ${domain}`);
        let identifier = null;
        let source = '';
        
        if (domain === 'skipped') {
            return { domain, identifier: null, source: 'skipped', isSkipped: true };
        }
        
        switch (domain) {
            case 'epuskesmas':
                identifier = this.getEpuskesmasIdentifier();
                source = 'ePuskesmas';
                break;
            case 'bpjs':
                identifier = this.getBpjsIdentifier();
                source = 'BPJS';
                break;
            case 'asik':
                identifier = this.getAsikIdentifier();
                source = 'ASIK';
                break;
            default:
                return { domain, identifier: null, source: 'unknown' };
        }
        
        log(`🔍 Final identifier: ${identifier} (source: ${source})`);
        return { domain, identifier, source };
    }
};

// ============================================================
// 4. WHITELIST & VALIDASI
// ============================================================
async function getWhitelist(forceRefresh = false) {
    const url = manifest.whitelist?.url || 'https://perangkat-dev.github.io/frontend/whitelist.json';
    const TTL_24H = 24 * 60 * 60 * 1000;
    
    if (!forceRefresh) {
        const cached = Cache.get('whitelist', TTL_24H);
        if (cached) {
            log(`📋 Whitelist from cache (${cached.length} entries)`);
            return cached;
        }
    }
    
    log(`📡 Fetching whitelist${forceRefresh ? ' (force)' : ''}: ${url}`);
    
    try {
        const headers = {};
        const cachedEtag = Cache.getEtag('whitelist');
        if (cachedEtag && !forceRefresh) {
            headers['If-None-Match'] = cachedEtag;
        }
        
        const res = await fetch(url, { 
            cache: 'no-store',
            headers 
        });
        
        if (res.status === 304) {
            log(`📋 Whitelist not modified (304)`);
            const cached = Cache.get('whitelist', Infinity);
            return cached || [];
        }
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const etag = res.headers.get('etag');
        
        Cache.set('whitelist', list, etag);
        log(`📋 Whitelist loaded: ${list.length} entries`);
        return list;
    } catch (err) {
        warn('Whitelist fetch failed:', err);
        const cached = Cache.get('whitelist', Infinity);
        return cached || [];
    }
}

async function getUserTier(forceRefresh = false) {
    const TTL_2H = 2 * 60 * 60 * 1000;
    
    if (!forceRefresh) {
        const cached = Cache.get('userTier', TTL_2H);
        if (cached !== null) {
            log(`👤 User tier from cache: ${cached}`);
            return cached;
        }
    }
    
    const info = IdentifierService.getCurrentIdentifier();
    log(`🔍 Identifier Info:`, info);
    
    if (info.domain === 'skipped' || info.domain === 'other' || !info.identifier) {
        log(`🌐 Domain: ${info.domain}, returning 'unknown' (bypass modules allowed)`);
        Cache.set('userTier', 'unknown');
        return 'unknown';
    }
    
    const whitelist = await getWhitelist(forceRefresh);
    log(`📋 Checking whitelist for identifier: ${info.identifier}`);
    
    const matched = whitelist.find(item => {
        const ids = item.identifiers || {};
        for (const [key, value] of Object.entries(ids)) {
            if (value) {
                const normalizedWhitelist = value.toLowerCase().trim();
                const normalizedIdentifier = info.identifier.toLowerCase().trim();
                if (normalizedWhitelist === normalizedIdentifier) {
                    log(`✅ Matched via ${key}!`);
                    return true;
                }
            }
        }
        return false;
    });
    
    if (!matched) {
        log(`🚫 Identifier "${info.identifier}" NOT in whitelist, returning 'none'`);
        Cache.set('userTier', 'none');
        return 'none';
    }
    
    const isActive = matched.active !== false;
    if (!isActive) {
        log(`🚫 Matched but INACTIVE, returning 'none'`);
        Cache.set('userTier', 'none');
        return 'none';
    }
    
    const userTier = matched.tier || 'dasar';
    log(`✅ Matched: ${matched.id}, Active: true, Tier: ${userTier}`);
    Cache.set('userTier', userTier);
    return userTier;
}

// ============================================================
// 5. FUNGSI MODULE
// ============================================================
function getModules() {
    return manifest.modules || [];
}

function isModuleAllowedByTier(modTier, userTier, bypassWhitelist = false) {
    if (userTier === 'none') {
        log(`🚫 User blocked (not in whitelist / inactive), rejecting module`);
        return false;
    }
    
    if (bypassWhitelist === true) {
        log(`🌐 Bypass whitelist enabled, allowing module (userTier: ${userTier})`);
        return true;
    }
    
    if (userTier === 'unknown') {
        log(`🚫 Unknown user (domain other/skipped), rejecting non-bypass module`);
        return false;
    }
    
    const modTierSafe = modTier || 'dasar';
    const tierLevel = { dasar: 0, pro: 1, max: 2 };
    const modLevel = tierLevel[modTierSafe] ?? 0;
    const userLevel = tierLevel[userTier] ?? 0;
    const allowed = modLevel <= userLevel;
    
    log(`🔍 ${modTierSafe} (${modLevel}) <= ${userTier} (${userLevel}) = ${allowed}`);
    return allowed;
}

// ============================================================
// 6. INJECT MODULE
// ============================================================
async function injectModule(moduleId) {
    const modules = getModules();
    const mod = modules.find(m => m.id === moduleId);
    
    if (!mod) {
        error(`❌ Module "${moduleId}" not found`);
        return false;
    }
    
    if (mod.id === MODULE_ID) {
        log(`⏭️ Skip dashboard module`);
        return false;
    }
    
    const userTier = await getUserTier();
    
    if (!isModuleAllowedByTier(mod.tier || 'dasar', userTier, mod.bypassWhitelist)) {
        log(`⛔ Module ${mod.id} (tier: ${mod.tier}, bypass: ${mod.bypassWhitelist}) not allowed for userTier: ${userTier}`);
        return false;
    }
    
    log(`🚀 Injecting: ${mod.id} (tier: ${mod.tier || 'dasar'}, bypass: ${mod.bypassWhitelist})`);
    
    try {
        const cached = await Storage.get([`script_${mod.id}`]);
        let code = cached[`script_${mod.id}`]?.code;
        
        if (!code || cached[`script_${mod.id}`]?.version !== mod.version) {
            log(`📡 Fetching: ${mod.scriptUrl}`);
            const res = await fetch(mod.scriptUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            code = await res.text();
            await Storage.set({
                [`script_${mod.id}`]: {
                    code,
                    version: mod.version,
                    fetchedAt: Date.now()
                }
            });
        }
        
        const meta = {
            id: mod.id,
            version: mod.version,
            name: mod.name,
            category: mod.category || 'lainnya',
            description: mod.description || '',
            tier: mod.tier || 'dasar',
            bypassWhitelist: mod.bypassWhitelist === true
        };
        
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                try {
                    window.__meta__ = ${JSON.stringify(meta)};
                    ${code}
                    console.log('[JamuLoader] ✅ ' + '${mod.id}' + ' executed');
                } catch (err) {
                    console.error('[JamuLoader] ❌ Error in ' + '${mod.id}' + ':', err);
                }
            })();
        `;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
        
        log(`✅ ${mod.id} injected successfully`);
        return true;
    } catch (err) {
        error(`❌ Failed to inject ${mod.id}:`, err);
        return false;
    }
}

// ============================================================
// 7. AUTO INJECT MODULES
// ============================================================
async function injectAllModules() {
    const userTier = await getUserTier();
    log(`👤 User Tier: ${userTier}`);
    
    let modules = getModules().filter(m => m.id !== MODULE_ID);
    log(`📦 Total modules: ${modules.length}`);
    
    const before = modules.length;
    modules = modules.filter(m => isModuleAllowedByTier(m.tier || 'dasar', userTier, m.bypassWhitelist));
    log(`📦 Modules after filter: ${modules.length} (was ${before})`);
    
    modules.forEach(m => {
        const bypassTag = m.bypassWhitelist ? ' 🌐BYPASS' : '';
        log(`  ✅ ${m.id} (tier: ${m.tier || 'dasar'}${bypassTag})`);
    });
    
    const moduleStates = (await Storage.get('moduleStates')).moduleStates || {};
    let success = 0, failed = 0, skipped = 0;
    
    for (const mod of modules) {
        if (moduleStates[mod.id] === false) {
            log(`⏭️ ${mod.id} disabled by user`);
            skipped++;
            continue;
        }
        
        const shouldInject = (mod.matches || []).some(p => {
            if (p === '<all_urls>' || p === '') return true;
            try {
                const escaped = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                return new RegExp(`^${escaped}$`).test(window.location.href);
            } catch { return window.location.href.includes(p); }
        });
        
        if (!shouldInject) {
            log(`⏭️ ${mod.id} URL mismatch`);
            skipped++;
            continue;
        }
        
        const result = await injectModule(mod.id);
        if (result) success++;
        else failed++;
    }
    
    log(`✅ Injected: ${success}, Failed: ${failed}, Skipped: ${skipped}`);
    return { success, failed, skipped };
}

// ============================================================
// 8. REFRESH STATUS
// ============================================================
async function refreshStatus() {
    log('🔄 Refreshing status...');
    
    Cache.clear('userTier');
    Cache.clear('whitelist');
    
    const newTier = await getUserTier(true);
    
    if (shadowRoot) {
        const tierBadge = shadowRoot.getElementById('dashboard-tier');
        if (tierBadge) {
            let tierLabel, tierClass;
            if (newTier === 'none') {
                tierLabel = '🚫 Blocked';
                tierClass = 'header-tier none';
            } else if (newTier === 'unknown') {
                tierLabel = '🌐 Overlay';
                tierClass = 'header-tier unknown';
            } else if (newTier === 'all') {
                tierLabel = 'All Access';
                tierClass = 'header-tier all';
            } else {
                tierLabel = newTier.charAt(0).toUpperCase() + newTier.slice(1);
                tierClass = `header-tier ${newTier}`;
            }
            tierBadge.textContent = tierLabel;
            tierBadge.className = tierClass;
        }
        
        await renderModuleList();
    }
    
    log(`✅ Refresh complete. New tier: ${newTier}`);
    showToast(`✅ Status diperbarui: ${newTier.toUpperCase()}`, 'success');
    
    return newTier;
}

// ============================================================
// 9. TOAST NOTIFICATION
// ============================================================
function showToast(message, type = 'info', duration = 3000) {
    if (!shadowRoot) return;
    
    const existing = shadowRoot.getElementById('dashboard-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.id = 'dashboard-toast';
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    shadowRoot.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================================
// 10. UI CLEAN
// ============================================================
let isUIOpen = false;
let uiContainer = null;
let shadowRoot = null;
let searchQuery = '';

function getUICSS() {
    return `
        :host { all: initial; display: block; position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
        :host([data-visible="true"]) { pointer-events: auto; }
        .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 1; opacity: 0; pointer-events: none; transition: opacity 0.25s ease; }
        .backdrop.open { opacity: 1; pointer-events: auto; }
        .popup { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.96); width: 480px; max-height: 80vh; background: #0d0f12; color: #e8edf3; border: 1px solid #252a31; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6); z-index: 2; opacity: 0; pointer-events: none; transition: all 0.2s; display: flex; flex-direction: column; }
        .popup.open { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
        .header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #131619; border-bottom: 1px solid #252a31; flex-shrink: 0; }
        .header-left { display: flex; align-items: center; gap: 10px; }
        .header-title { font-weight: 600; font-size: 16px; color: #e8edf3; }
        .header-title .jamu { color: #00d4aa; }
        .header-tier { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .header-tier.dasar { background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid rgba(52,211,153,0.3); }
        .header-tier.pro { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
        .header-tier.max { background: rgba(139,92,246,0.15); color: #8b5cf6; border: 1px solid rgba(139,92,246,0.3); }
        .header-tier.all { background: rgba(255,255,255,0.06); color: #5a6472; border: 1px solid #252a31; }
        .header-tier.none { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .header-tier.unknown { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .header-actions { display: flex; gap: 8px; }
        .header-close { background: none; border: none; color: #5a6472; font-size: 20px; cursor: pointer; padding: 0 4px; transition: all 0.2s; }
        .header-close:hover { color: #ef4444; }
        .header-close.refreshing { animation: jamu-spin 0.8s linear infinite; color: #00d4aa !important; }
        .header-close:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes jamu-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .body { flex: 1; overflow-y: auto; padding: 12px 16px; scrollbar-width: thin; scrollbar-color: #2e3640 transparent; }
        .body::-webkit-scrollbar { width: 4px; }
        .body::-webkit-scrollbar-thumb { background: #2e3640; border-radius: 2px; }
        .search-bar { margin-bottom: 12px; position: relative; }
        .search-input { width: 100%; padding: 8px 12px 8px 32px; background: #1a1e23; border: 1px solid #252a31; border-radius: 6px; color: #e8edf3; font-size: 12px; font-family: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .search-input:focus { border-color: #00d4aa; }
        .search-input::placeholder { color: #5a6472; }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #5a6472; font-size: 14px; }
        .search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #5a6472; cursor: pointer; font-size: 14px; display: none; padding: 0 4px; }
        .search-clear:hover { color: #ef4444; }
        .search-clear.visible { display: block; }
        .module-item { display: flex; align-items: center; padding: 10px 14px; border-radius: 8px; margin-bottom: 4px; background: #1a1e23; border: 1px solid #252a31; transition: all 0.2s; }
        .module-item:hover { background: #22262f; }
        .module-icon { font-size: 20px; margin-right: 12px; flex-shrink: 0; }
        .module-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .module-name { font-size: 15px; font-weight: 500; color: #e8edf3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .module-meta { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .tier-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; min-width: 44px; text-align: center; }
        .tier-dasar { background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid rgba(52,211,153,0.3); }
        .tier-pro { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
        .tier-max { background: rgba(139,92,246,0.15); color: #8b5cf6; border: 1px solid rgba(139,92,246,0.3); }
        .tier-undefined { background: rgba(255,255,255,0.05); color: #5a6472; border: 1px solid rgba(255,255,255,0.05); }
        .module-toggle { flex-shrink: 0; margin-left: 12px; }
        .toggle-input { display: none; }
        .toggle-track { width: 32px; height: 18px; background: #2e3640; border-radius: 10px; cursor: pointer; transition: background 0.2s; display: block; position: relative; }
        .toggle-track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: #5a6472; border-radius: 50%; transition: all 0.2s; }
        .toggle-input:checked + .toggle-track { background: #00d4aa; }
        .toggle-input:checked + .toggle-track::after { transform: translateX(14px); background: #000; }
        .status-bar { display: flex; justify-content: space-between; padding: 8px 16px; border-top: 1px solid #252a31; background: #131619; font-size: 10px; color: #5a6472; flex-shrink: 0; }
        .status-bar .active-count { color: #00d4aa; }
        .empty-state { padding: 32px 16px; text-align: center; color: #5a6472; font-size: 13px; }
        #dashboard-floating-btn { position: fixed !important; bottom: 24px !important; right: 24px !important; width: 56px !important; height: 56px !important; border-radius: 50% !important; background: #00d4aa !important; color: #000 !important; border: none !important; box-shadow: 0 4px 20px rgba(0,212,170,0.4) !important; font-size: 24px !important; cursor: pointer !important; z-index: 999999 !important; display: flex !important; align-items: center !important; justify-content: center !important; touch-action: manipulation !important; user-select: none !important; transition: transform 0.2s !important; font-family: 'Courier New', monospace !important; }
        #dashboard-floating-btn:active { transform: scale(0.85) !important; }
        #dashboard-floating-btn img { width: 32px; height: 32px; display: block; object-fit: contain; pointer-events: none; }
        .toast { position: fixed; top: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; z-index: 2147483647; opacity: 0; transform: translateX(400px); transition: all 0.3s ease; pointer-events: none; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        .toast.show { opacity: 1; transform: translateX(0); }
        .toast-info { background: #1e293b; color: #e8edf3; border: 1px solid #334155; }
        .toast-success { background: #064e3b; color: #34d399; border: 1px solid #10b981; }
        .toast-error { background: #7f1d1d; color: #fca5a5; border: 1px solid #ef4444; }
        @media (max-width: 480px) { 
            .popup { width: 95% !important; } 
            #dashboard-floating-btn { width: 48px !important; height: 48px !important; font-size: 20px !important; bottom: 16px !important; right: 16px !important; } 
            .module-name { font-size: 13px !important; }
            .module-info { flex-wrap: wrap; gap: 4px; }
            .toast { top: 16px; right: 16px; left: 16px; }
        }
    `;
}

function createUI() {
    if (uiContainer) return;
    
    const container = document.createElement('div');
    container.id = 'dashboard-ui-container';
    container.setAttribute('data-visible', 'false');
    
    const shadow = container.attachShadow({ mode: 'closed' });
    shadowRoot = shadow;
    
    const template = document.createElement('template');
    template.innerHTML = `
        <style>${getUICSS()}</style>
        <div class="backdrop" id="dashboard-backdrop"></div>
        <div class="popup" id="dashboard-popup">
            <div class="header">
                <div class="header-left">
                    <span class="header-title"><span class="jamu">🍵 Jamu</span> Loader</span>
                    <span class="header-tier" id="dashboard-tier">Loading...</span>
                </div>
                <div class="header-actions">
                    <button class="header-close" id="dashboard-refresh" title="Refresh status (Ctrl+Shift+R)">🔄</button>
                    <button class="header-close" id="dashboard-close">✕</button>
                </div>
            </div>
            <div class="body" id="dashboard-body">
                <div class="search-bar">
                    <span class="search-icon">🔍</span>
                    <input type="text" class="search-input" id="search-input" placeholder="Cari module..." />
                    <button class="search-clear" id="search-clear">✕</button>
                </div>
                <div id="module-list-container">
                    <div class="empty-state">Loading modules...</div>
                </div>
            </div>
            <div class="status-bar">
                <span id="dashboard-status">Ready</span>
                <span class="active-count" id="dashboard-active">0 active</span>
            </div>
        </div>
    `;
    
    shadow.appendChild(template.content.cloneNode(true));
    document.body.appendChild(container);
    
    const btn = document.createElement('button');
    btn.id = 'dashboard-floating-btn';
    btn.innerHTML = `<img src="https://perangkat-dev.github.io/frontend/logo.svg" style="width:32px; height:32px; pointer-events:none;" alt="Jamu Loader" />`;
    document.body.appendChild(btn);
    
    uiContainer = container;
    
    const backdrop = shadow.getElementById('dashboard-backdrop');
    const popup = shadow.getElementById('dashboard-popup');
    const closeBtn = shadow.getElementById('dashboard-close');
    const refreshBtn = shadow.getElementById('dashboard-refresh');
    
    const toggleUI = (show) => {
        isUIOpen = show;
        container.setAttribute('data-visible', show ? 'true' : 'false');
        backdrop.classList.toggle('open', show);
        popup.classList.toggle('open', show);
        if (show) {
            renderModuleList();
        }
    };
    
    btn.addEventListener('click', () => toggleUI(!isUIOpen));
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleUI(!isUIOpen); }, { passive: false });
    closeBtn.addEventListener('click', () => toggleUI(false));
    backdrop.addEventListener('click', () => toggleUI(false));
    
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('refreshing');
        refreshBtn.disabled = true;
        try {
            await refreshStatus();
        } finally {
            refreshBtn.classList.remove('refreshing');
            refreshBtn.disabled = false;
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isUIOpen) toggleUI(false);
        if (e.ctrlKey && e.shiftKey && (e.key === 'Q' || e.key === 'q')) {
            e.preventDefault();
            toggleUI(!isUIOpen);
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
            e.preventDefault();
            refreshStatus();
        }
    });
    
    renderModuleList();
    
    const searchInput = shadow.getElementById('search-input');
    const searchClear = shadow.getElementById('search-clear');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            searchClear?.classList.toggle('visible', searchQuery.length > 0);
            renderModuleList();
        });
    }
    
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchQuery = '';
            searchInput.value = '';
            searchClear.classList.remove('visible');
            renderModuleList();
        });
    }
}

// ============================================================
// 11. RENDER MODULE LIST
// ============================================================
async function renderModuleList() {
    const container = shadowRoot?.getElementById('module-list-container');
    if (!container) return;
    
    const userTier = await getUserTier();
    const tierBadge = shadowRoot?.getElementById('dashboard-tier');
    
    if (tierBadge) {
        let tierLabel, tierClass;
        if (userTier === 'none') {
            tierLabel = '🚫 Blocked';
            tierClass = 'header-tier none';
        } else if (userTier === 'unknown') {
            tierLabel = '🌐 Overlay';
            tierClass = 'header-tier unknown';
        } else if (userTier === 'all') {
            tierLabel = 'All Access';
            tierClass = 'header-tier all';
        } else {
            tierLabel = userTier.charAt(0).toUpperCase() + userTier.slice(1);
            tierClass = `header-tier ${userTier}`;
        }
        tierBadge.textContent = tierLabel;
        tierBadge.className = tierClass;
    }
    
    if (userTier === 'none') {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🚫</div>
                <div style="font-size: 16px; font-weight: 600; color: #ef4444; margin-bottom: 8px;">
                    Akses Ditolak
                </div>
                <div style="font-size: 13px; color: #5a6472; line-height: 1.6;">
                    Puskesmas Anda tidak terdaftar dalam whitelist<br>
                    atau status akun nonaktif.<br><br>
                    Hubungi administrator untuk aktivasi.
                </div>
            </div>
        `;
        const statusEl = shadowRoot?.getElementById('dashboard-status');
        const activeEl = shadowRoot?.getElementById('dashboard-active');
        if (statusEl) statusEl.textContent = 'Access blocked';
        if (activeEl) activeEl.textContent = '0 active';
        return;
    }
    
    const modules = getModules().filter(m => m.id !== MODULE_ID);
    const moduleStates = (await Storage.get('moduleStates')).moduleStates || {};
    
    let allowedModules = modules.filter(m => isModuleAllowedByTier(m.tier || 'dasar', userTier, m.bypassWhitelist));
    
    const url = window.location.href;
    let matchedModules = allowedModules.filter(m => {
        return (m.matches || []).some(p => {
            if (p === '<all_urls>' || p === '') return true;
            try {
                const escaped = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                return new RegExp(`^${escaped}$`).test(url);
            } catch { return url.includes(p); }
        });
    });
    
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        matchedModules = matchedModules.filter(m => {
            const name = (m.name || m.id).toLowerCase();
            const id = m.id.toLowerCase();
            return name.includes(q) || id.includes(q);
        });
    }
    
    if (!matchedModules.length) {
        container.innerHTML = `<div class="empty-state">${searchQuery.trim() ? 'Tidak ada module yang cocok' : 'Tidak ada module di halaman ini'}</div>`;
        return;
    }
    
    const html = matchedModules.map(m => {
        const enabled = moduleStates[m.id] !== false;
        const tierClass = `tier-${m.tier || 'undefined'}`;
        const tierLabel = m.tier || 'undefined';
        const icon = m.icon || '📦';
        const bypassTag = m.bypassWhitelist ? ' <span style="color:#8b5cf6;font-size:10px;font-weight:600;">🌐</span>' : '';
        return `
            <div class="module-item" data-id="${m.id}">
                <span class="module-icon">${icon}</span>
                <div class="module-info">
                    <span class="module-name">${m.name || m.id}${bypassTag}</span>
                    <span class="module-meta">
                        <span class="tier-badge ${tierClass}">${tierLabel}</span>
                    </span>
                </div>
                <div class="module-toggle">
                    <label>
                        <input type="checkbox" class="toggle-input" ${enabled ? 'checked' : ''} data-id="${m.id}" />
                        <span class="toggle-track"></span>
                    </label>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    container.querySelectorAll('.toggle-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const checked = e.target.checked;
            const states = await Storage.get('moduleStates');
            const moduleStates = states.moduleStates || {};
            moduleStates[id] = checked;
            await Storage.set({ moduleStates });
            if (checked) {
                await injectModule(id);
            }
            renderModuleList();
        });
    });
    
    const statusEl = shadowRoot?.getElementById('dashboard-status');
    const activeEl = shadowRoot?.getElementById('dashboard-active');
    
    if (statusEl) statusEl.textContent = `${matchedModules.length} modules on this page${searchQuery.trim() ? ' (filtered)' : ''}`;
    if (activeEl) {
        const activeCount = matchedModules.filter(m => moduleStates[m.id] !== false).length;
        activeEl.textContent = `${activeCount} active`;
    }
}

// ============================================================
// 12. LIST & STATS (Console)
// ============================================================
function listModules() {
    const modules = getModules();
    log(`📦 Total modules: ${modules.length}`);
    modules.forEach(m => {
        log(`  ${m.icon || '◈'} ${m.id} (v${m.version}) - Tier: ${m.tier || 'dasar'}`);
    });
}

function showStats() {
    const modules = getModules();
    log(`📊 Total: ${modules.length}`);
}

// ============================================================
// 13. EXPOSE
// ============================================================
window.JamuDashboard = {
    version: VERSION,
    getModules,
    listModules,
    showStats,
    injectModule,
    injectAllModules,
    createUI,
    getUserTier,
    refreshStatus,
    clearCache: () => Cache.clear(),
    get debug() { return DEBUG; },
    set debug(value) { 
        DEBUG = !!value;
        log(`🔧 Debug mode ${DEBUG ? 'enabled' : 'disabled'}`);
    },
    status: 'ready'
};

// ============================================================
// 14. AUTO-RUN
// ============================================================
log(`✅ v${VERSION} loaded!`);

(async function() {
    const userTier = await getUserTier();
    log(`👤 User Tier: ${userTier}`);
    await injectAllModules();
    createUI();
    
    // Auto-refresh setiap 24 jam
    setInterval(() => {
        log('🔄 Auto-refresh (24h interval)');
        refreshStatus();
    }, 24 * 60 * 60 * 1000);
})();

log(`💡 Klik tombol 📊 di pojok kanan bawah untuk membuka UI`);
log(`💡 Tekan Ctrl+Shift+R untuk refresh status manual`);
log(`💡 Set window.JamuDashboard.debug = false untuk mematikan console log`);

})();
