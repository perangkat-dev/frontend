// ============================================================
// Jamu Dashboard - Module v1.1.0
// CHANGELOG:
// - v1.1.0: Tambah ErrorLogger (local + remote beacon)
// - v1.1.0: Tambah UI Tab "Logs" untuk melihat error
// - v1.1.0: Runtime error catching via custom event
// - v1.1.0: Badge error indicator di floating button
// ============================================================
(function() {
'use strict';
const MODULE_ID = 'jamu-dashboard';
const VERSION = '1.1.0';
console.log(`[Dashboard] ✅ v${VERSION} loaded successfully!`);

// ============================================================
// 1. AMBIL MANIFEST
// ============================================================
const manifest = window.__JAMU_MANIFEST__ || {};
const loaderVersion = window.__JAMU_VERSION__ || '2.0.0';

// ============================================================
// 2. STORAGE
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

// ============================================================
// 3. ERROR LOGGER & TELEMETRY 🆕 [BARU]
// ============================================================
const ErrorLogger = {
    MAX_LOCAL_LOGS: 50,

    // Simpan error secara lokal
    logLocal(moduleId, errorType, message, url = window.location.href) {
        try {
            const logs = this.getLocalLogs();
            logs.unshift({
                moduleId,
                errorType, // 'fetch', 'injection', 'runtime', 'whitelist', 'manifest'
                message: (message || 'Unknown error').substring(0, 300),
                url,
                timestamp: Date.now(),
                userAgent: navigator.userAgent.substring(0, 120),
                loaderVersion,
                dashboardVersion: VERSION
            });
            // Batasi jumlah log agar localStorage tidak bengkak
            while (logs.length > this.MAX_LOCAL_LOGS) logs.pop();
            localStorage.setItem('jamu_error_logs', JSON.stringify(logs));

            // Update badge indicator di floating button
            this.updateBadge();
        } catch (e) {
            console.warn('[ErrorLogger] Failed to save local log:', e);
        }
    },

    getLocalLogs() {
        try {
            return JSON.parse(localStorage.getItem('jamu_error_logs') || '[]');
        } catch {
            return [];
        }
    },

    clearLocalLogs() {
        localStorage.removeItem('jamu_error_logs');
        this.updateBadge();
    },

    // Update badge merah di floating button jika ada error
    updateBadge() {
        const btn = document.getElementById('dashboard-floating-btn');
        if (!btn) return;
        const logs = this.getLocalLogs();
        const recentErrors = logs.filter(l => (Date.now() - l.timestamp) < 24 * 60 * 60 * 1000);
        let badge = btn.querySelector('.jamu-error-badge');
        if (recentErrors.length > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'jamu-error-badge';
                badge.style.cssText = `
                    position: absolute; top: -4px; right: -4px;
                    min-width: 20px; height: 20px; padding: 0 6px;
                    background: #ef4444; color: #fff;
                    border-radius: 10px; font-size: 11px; font-weight: 700;
                    display: flex; align-items: center; justify-content: center;
                    font-family: -apple-system, sans-serif;
                    box-shadow: 0 2px 6px rgba(239,68,68,0.5);
                `;
                btn.appendChild(badge);
            }
            badge.textContent = recentErrors.length > 99 ? '99+' : recentErrors.length;
        } else if (badge) {
            badge.remove();
        }
    },

    // Kirim ke Google Apps Script (Fire-and-forget)
    async sendRemoteBeacon(moduleId, errorType, message) {
        const trackingUrl = manifest.trackingEndpoint || null;
        if (!trackingUrl) return;

        const info = IdentifierService.getCurrentIdentifier();
        const payload = {
            moduleId,
            errorType,
            message: (message || '').substring(0, 300),
            url: window.location.href,
            timestamp: Date.now(),
            identifier: info.identifier || 'unknown',
            identifierSource: info.source || 'unknown',
            domain: info.domain || 'unknown',
            loaderVersion,
            dashboardVersion: VERSION,
            userAgent: navigator.userAgent.substring(0, 150)
        };

        try {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            if (navigator.sendBeacon) {
                navigator.sendBeacon(trackingUrl, blob);
            } else {
                fetch(trackingUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
        } catch (err) {
            console.warn('[ErrorLogger] Remote beacon failed (non-fatal):', err);
        }
    },

    // Helper: Log + kirim beacon sekaligus
    report(moduleId, errorType, message) {
        console.error(`[Jamu Error] [${errorType}] ${moduleId}:`, message);
        this.logLocal(moduleId, errorType, message);
        this.sendRemoteBeacon(moduleId, errorType, message);
    }
};

// ============================================================
// 4. IDENTIFIER SERVICE
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
                if (match) return match[1].replace(/^0+/, '');
            }
            const userMenu = document.querySelector("#menu_user .label-default");
            if (userMenu) {
                const match = userMenu.textContent.trim().match(/(\d+)/);
                if (match) return match[1].replace(/^0+/, '');
            }
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const content = script.textContent || '';
                if (content.includes('puskesmasId')) {
                    const match = content.match(/puskesmasId["']?\s*:\s*["']?(\d+)/);
                    if (match) return match[1].replace(/^0+/, '');
                }
            }
        } catch (e) {}
        return null;
    },
    getBpjsIdentifier() {
        try {
            const hiddenSpans = document.querySelectorAll('.hidden-xs');
            for (const span of hiddenSpans) {
                const match = span.textContent.trim().match(/\((\d{8})\)/);
                if (match) return match[1];
            }
            const userHeader = document.querySelector('.user-header p');
            if (userHeader) {
                const match = userHeader.textContent.trim().match(/\b(\d{8})\b/);
                if (match) return match[1];
            }
            const bodyText = document.body.textContent;
            const matches = bodyText.match(/\b(\d{8})\b/g);
            if (matches && matches.length > 0) {
                return matches.find(c => c.startsWith('10')) || matches[0];
            }
        } catch (e) {}
        return null;
    },
    getAsikIdentifier() {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const parsed = JSON.parse(userData);
                    if (parsed?.user?.kode_sarana) return parsed.user.kode_sarana;
                    if (parsed?.kode_sarana) return parsed.kode_sarana;
                } catch (e) {}
            }
            const userEksternal = localStorage.getItem('user_eksternal');
            if (userEksternal) {
                try {
                    const parsed = JSON.parse(userEksternal);
                    if (parsed?.kode_sarana) return parsed.kode_sarana;
                } catch (e) {}
            }
            if (window.__asikData?.kode_sarana) {
                return window.__asikData.kode_sarana;
            }
            const keys = ['userData', 'userInfo', 'profile', 'asik_user', 'currentUser'];
            for (const key of keys) {
                let data = localStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed?.kode_sarana) return parsed.kode_sarana;
                        if (parsed?.user?.kode_sarana) return parsed.user.kode_sarana;
                        if (parsed?.data?.kode_sarana) return parsed.data.kode_sarana;
                    } catch (e) {}
                }
                data = sessionStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed?.kode_sarana) return parsed.kode_sarana;
                        if (parsed?.user?.kode_sarana) return parsed.user.kode_sarana;
                        if (parsed?.data?.kode_sarana) return parsed.data.kode_sarana;
                    } catch (e) {}
                }
            }
            const selectors = ['[data-kode-sarana]', '[data-kode-puskesmas]', '.kode-sarana'];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const value = el.dataset.kodeSarana || el.dataset.kodePuskesmas || el.textContent.trim();
                    if (value) return value;
                }
            }
            const bodyText = document.body.textContent;
            const matches = bodyText.match(/\b(\d{11})\b/g);
            if (matches && matches.length > 0) return matches[0];
        } catch (e) {}
        return null;
    },
    getCurrentIdentifier() {
        const domain = this.getDomain();
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
        return { domain, identifier, source };
    }
};

// ============================================================
// 5. WHITELIST & VALIDASI
// ============================================================
async function getWhitelist() {
    const url = manifest.whitelist?.url || 'https://perangkat-dev.github.io/frontend/whitelist.json';
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        ErrorLogger.report('whitelist', 'whitelist', `Fetch failed: ${err.message}`);
        return [];
    }
}

async function getUserTier() {
    const info = IdentifierService.getCurrentIdentifier();
    console.log(`[Dashboard] 🔍 Identifier Info:`, info);
    if (info.domain === 'skipped' || info.domain === 'other' || !info.identifier) {
        console.log(`[Dashboard] ⚠️ No valid identifier, tier: all`);
        return 'all';
    }
    const whitelist = await getWhitelist();
    const matched = whitelist.find(item => {
        const ids = item.identifiers || {};
        return Object.values(ids).some(
            val => val && val.toLowerCase().trim() === info.identifier.toLowerCase().trim()
        );
    });
    if (!matched) {
        console.log(`[Dashboard] ⚠️ Identifier not in whitelist, tier: all`);
        return 'all';
    }
    const isActive = matched.active !== false;
    const userTier = isActive ? (matched.tier || 'dasar') : 'dasar';
    console.log(`[Dashboard] ✅ Matched: ${matched.id}, Active: ${isActive}, Tier: ${userTier}`);
    return userTier;
}

// ============================================================
// 6. FUNGSI MODULE
// ============================================================
function getModules() {
    return manifest.modules || [];
}

function isModuleAllowedByTier(modTier, userTier) {
    if (userTier === 'all') return true;
    const modTierSafe = modTier || 'dasar';
    const tierLevel = { dasar: 0, pro: 1, max: 2 };
    const modLevel = tierLevel[modTierSafe] ?? 0;
    const userLevel = tierLevel[userTier] ?? 0;
    return modLevel <= userLevel;
}

// ============================================================
// 7. INJECT MODULE 🔧 [DIMODIFIKASI - tambah observability]
// ============================================================
async function injectModule(moduleId) {
    const modules = getModules();
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) {
        ErrorLogger.report(moduleId, 'injection', `Module "${moduleId}" not found in manifest`);
        return false;
    }
    if (mod.id === MODULE_ID) {
        console.log(`[Dashboard] ⏭️ Skip dashboard module`);
        return false;
    }
    console.log(`[Dashboard] 🚀 Injecting: ${mod.id} (${mod.tier || 'dasar'})`);

    try {
        const cached = await Storage.get([`script_${mod.id}`]);
        let code = cached[`script_${mod.id}`]?.code;

        if (!code || cached[`script_${mod.id}`]?.version !== mod.version) {
            console.log(`[Dashboard] 📡 Fetching: ${mod.scriptUrl}`);
            const res = await fetch(mod.scriptUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status} saat fetch script`);
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
            tier: mod.tier || 'dasar'
        };

        const script = document.createElement('script');
        script.textContent = `
            (function() {
                try {
                    window.__meta__ = ${JSON.stringify(meta)};
                    ${code}
                    console.log('[JamuLoader] ✅ ' + '${mod.id}' + ' executed');
                } catch (err) {
                    console.error('[JamuLoader] ❌ Runtime error in ' + '${mod.id}' + ':', err);
                    window.dispatchEvent(new CustomEvent('jamu_module_error', {
                        detail: {
                            moduleId: '${mod.id}',
                            message: err.message,
                            stack: (err.stack || '').substring(0, 500)
                        }
                    }));
                }
            })();
        `;
        (document.head || document.documentElement).appendChild(script);
        script.remove();

        console.log(`[Dashboard] ✅ ${mod.id} injected successfully`);
        return true;

    } catch (err) {
        // 🔥 Laporkan error fetch/injection
        ErrorLogger.report(mod.id, 'injection', err.message);
        return false;
    }
}

// ============================================================
// 8. AUTO INJECT MODULES (DENGAN TIER FILTER)
// ============================================================
async function injectAllModules() {
    const userTier = await getUserTier();
    console.log(`[Dashboard] 👤 User Tier: ${userTier}`);
    let modules = getModules().filter(m => m.id !== MODULE_ID);
    console.log(`[Dashboard] 📦 Total modules: ${modules.length}`);

    if (userTier !== 'all') {
        const before = modules.length;
        modules = modules.filter(m => isModuleAllowedByTier(m.tier || 'dasar', userTier));
        console.log(`[Dashboard] 📦 Modules after tier filter: ${modules.length} (was ${before})`);
    }

    const moduleStates = (await Storage.get('moduleStates')).moduleStates || {};
    let success = 0, failed = 0, skipped = 0;

    for (const mod of modules) {
        if (moduleStates[mod.id] === false) {
            console.log(`[Dashboard] ⏭️ ${mod.id} disabled by user`);
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
            console.log(`[Dashboard] ⏭️ ${mod.id} URL mismatch`);
            skipped++;
            continue;
        }
        const result = await injectModule(mod.id);
        if (result) success++;
        else failed++;
    }

    console.log(`[Dashboard] ✅ Injected: ${success}, Failed: ${failed}, Skipped: ${skipped}`);
    return { success, failed, skipped };
}

// ============================================================
// 9. UI CLEAN 🔧 [DIMODIFIKASI - tambah tab navigation & log styles]
// ============================================================
let isUIOpen = false;
let uiContainer = null;
let shadowRoot = null;
let searchQuery = '';
let currentTab = 'modules'; // 🆕 'modules' | 'logs'

function getUICSS() {
    return `
        :host { all: initial; display: block; position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
        :host([data-visible="true"]) { pointer-events: auto; }
        .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 1; opacity: 0; pointer-events: none; transition: opacity 0.25s ease; }
        .backdrop.open { opacity: 1; pointer-events: auto; }
        .popup { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.96); width: 520px; max-height: 80vh; background: #0d0f12; color: #e8edf3; border: 1px solid #252a31; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6); z-index: 2; opacity: 0; pointer-events: none; transition: all 0.2s; display: flex; flex-direction: column; }
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
        .header-close { background: none; border: none; color: #5a6472; font-size: 20px; cursor: pointer; padding: 0 4px; }
        .header-close:hover { color: #ef4444; }

        /* 🆕 TAB NAVIGATION */
        .tab-nav { display: flex; border-bottom: 1px solid #252a31; background: #131619; flex-shrink: 0; }
        .tab-btn { flex: 1; padding: 10px 16px; background: none; border: none; color: #5a6472; font-size: 12px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; text-transform: uppercase; letter-spacing: 0.5px; }
        .tab-btn:hover { color: #e8edf3; background: rgba(255,255,255,0.03); }
        .tab-btn.active { color: #00d4aa; border-bottom-color: #00d4aa; }
        .tab-btn .tab-count { display: inline-block; margin-left: 6px; padding: 1px 7px; background: rgba(255,255,255,0.08); border-radius: 10px; font-size: 10px; }
        .tab-btn.active .tab-count { background: rgba(0,212,170,0.2); color: #00d4aa; }
        .tab-btn.has-error .tab-count { background: rgba(239,68,68,0.2); color: #ef4444; }

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

        /* 🆕 LOG ENTRIES */
        .log-toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
        .log-toolbar button { flex: 1; padding: 8px 12px; background: #1a1e23; border: 1px solid #252a31; border-radius: 6px; color: #e8edf3; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .log-toolbar button:hover { background: #22262f; border-color: #00d4aa; }
        .log-toolbar .btn-danger:hover { border-color: #ef4444; color: #ef4444; }
        .log-entry { padding: 10px 12px; border-radius: 8px; margin-bottom: 6px; background: #1a1e23; border-left: 3px solid #5a6472; font-size: 12px; }
        .log-entry.type-fetch { border-left-color: #f59e0b; }
        .log-entry.type-injection { border-left-color: #ef4444; }
        .log-entry.type-runtime { border-left-color: #8b5cf6; }
        .log-entry.type-whitelist { border-left-color: #3b82f6; }
        .log-entry.type-manifest { border-left-color: #ec4899; }
        .log-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .log-module { font-weight: 600; color: #e8edf3; font-size: 13px; }
        .log-type { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .log-type.fetch { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .log-type.injection { background: rgba(239,68,68,0.15); color: #ef4444; }
        .log-type.runtime { background: rgba(139,92,246,0.15); color: #8b5cf6; }
        .log-type.whitelist { background: rgba(59,130,246,0.15); color: #3b82f6; }
        .log-type.manifest { background: rgba(236,72,153,0.15); color: #ec4899; }
        .log-message { color: #e8edf3; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.5; word-break: break-word; margin-bottom: 4px; }
        .log-meta { color: #5a6472; font-size: 10px; display: flex; gap: 10px; flex-wrap: wrap; }

        .status-bar { display: flex; justify-content: space-between; padding: 8px 16px; border-top: 1px solid #252a31; background: #131619; font-size: 10px; color: #5a6472; flex-shrink: 0; }
        .status-bar .active-count { color: #00d4aa; }
        .empty-state { padding: 32px 16px; text-align: center; color: #5a6472; font-size: 13px; }

        #dashboard-floating-btn { position: fixed !important; bottom: 24px !important; right: 24px !important; width: 56px !important; height: 56px !important; border-radius: 50% !important; background: #00d4aa !important; color: #000 !important; border: none !important; box-shadow: 0 4px 20px rgba(0,212,170,0.4) !important; font-size: 24px !important; cursor: pointer !important; z-index: 999999 !important; display: flex !important; align-items: center !important; justify-content: center !important; touch-action: manipulation !important; user-select: none !important; transition: transform 0.2s !important; font-family: 'Courier New', monospace !important; }
        #dashboard-floating-btn:active { transform: scale(0.85) !important; }
        #dashboard-floating-btn img { width: 32px; height: 32px; display: block; object-fit: contain; pointer-events: none; }
        @media (max-width: 480px) {
            .popup { width: 95% !important; }
            #dashboard-floating-btn { width: 48px !important; height: 48px !important; font-size: 20px !important; bottom: 16px !important; right: 16px !important; }
            .module-name { font-size: 13px !important; }
            .module-info { flex-wrap: wrap; gap: 4px; }
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
                <button class="header-close" id="dashboard-close">✕</button>
            </div>
            <div class="tab-nav">
                <button class="tab-btn active" data-tab="modules">🧩 Modules <span class="tab-count" id="tab-count-modules">0</span></button>
                <button class="tab-btn" data-tab="logs">📋 Logs <span class="tab-count" id="tab-count-logs">0</span></button>
            </div>
            <div class="body" id="dashboard-body">
                <div id="tab-content-modules"></div>
                <div id="tab-content-logs" style="display:none;"></div>
            </div>
            <div class="status-bar">
                <span id="dashboard-status">Ready</span>
                <span class="active-count" id="dashboard-active">v${VERSION}</span>
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

    const toggleUI = (show) => {
        isUIOpen = show;
        container.setAttribute('data-visible', show ? 'true' : 'false');
        backdrop.classList.toggle('open', show);
        popup.classList.toggle('open', show);
        if (show) {
            updateTabCounts();
            if (currentTab === 'modules') renderModuleList();
            else renderLogList();
        }
    };

    btn.addEventListener('click', () => toggleUI(!isUIOpen));
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleUI(!isUIOpen); }, { passive: false });
    closeBtn.addEventListener('click', () => toggleUI(false));
    backdrop.addEventListener('click', () => toggleUI(false));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isUIOpen) toggleUI(false);
        if (e.ctrlKey && e.shiftKey && (e.key === 'Q' || e.key === 'q')) {
            e.preventDefault();
            toggleUI(!isUIOpen);
        }
    });

    // 🆕 TAB SWITCHING
    shadow.querySelectorAll('.tab-btn').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            const tab = tabBtn.dataset.tab;
            currentTab = tab;
            shadow.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
            shadow.getElementById('tab-content-modules').style.display = tab === 'modules' ? 'block' : 'none';
            shadow.getElementById('tab-content-logs').style.display = tab === 'logs' ? 'block' : 'none';
            if (tab === 'modules') renderModuleList();
            else renderLogList();
        });
    });

    // SEARCH (tetap di tab modules)
    renderModuleList();

    // 🆕 Update badge saat UI dibuka
    ErrorLogger.updateBadge();
}

// 🆕 ============================================================
// 9b. UPDATE TAB COUNTS
// ============================================================
async function updateTabCounts() {
    if (!shadowRoot) return;
    const modulesCount = getModules().filter(m => m.id !== MODULE_ID).length;
    const logsCount = ErrorLogger.getLocalLogs().length;
    const modulesTab = shadowRoot.querySelector('[data-tab="modules"]');
    const logsTab = shadowRoot.querySelector('[data-tab="logs"]');
    const modulesCountEl = shadowRoot.getElementById('tab-count-modules');
    const logsCountEl = shadowRoot.getElementById('tab-count-logs');
    if (modulesCountEl) modulesCountEl.textContent = modulesCount;
    if (logsCountEl) logsCountEl.textContent = logsCount;
    if (logsTab) logsTab.classList.toggle('has-error', logsCount > 0);
}

// 🆕 ============================================================
// 9c. RENDER LOG LIST
// ============================================================
function renderLogList() {
    const container = shadowRoot?.getElementById('tab-content-logs');
    if (!container) return;

    const logs = ErrorLogger.getLocalLogs();

    const toolbar = `
        <div class="log-toolbar">
            <button id="log-copy-btn">📋 Copy Semua</button>
            <button id="log-clear-btn" class="btn-danger">🗑️ Hapus Semua</button>
        </div>
    `;

    if (!logs.length) {
        container.innerHTML = toolbar + `<div class="empty-state">✅ Tidak ada error tercatat<br><small style="color:#5a6472">Sistem berjalan normal</small></div>`;
    } else {
        const html = logs.map(log => {
            const time = new Date(log.timestamp).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            const shortUrl = log.url ? log.url.replace(/^https?:\/\//, '').substring(0, 50) : '';
            return `
                <div class="log-entry type-${log.errorType}">
                    <div class="log-header">
                        <span class="log-module">${escapeHtml(log.moduleId)}</span>
                        <span class="log-type ${log.errorType}">${log.errorType}</span>
                    </div>
                    <div class="log-message">${escapeHtml(log.message)}</div>
                    <div class="log-meta">
                        <span>🕐 ${time}</span>
                        ${shortUrl ? `<span>🔗 ${escapeHtml(shortUrl)}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        container.innerHTML = toolbar + html;
    }

    // Bind toolbar buttons
    const copyBtn = container.querySelector('#log-copy-btn');
    const clearBtn = container.querySelector('#log-clear-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const text = logs.map(l =>
                `[${new Date(l.timestamp).toISOString()}] [${l.errorType}] ${l.moduleId}: ${l.message}\n  URL: ${l.url}`
            ).join('\n\n');
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.textContent = '✅ Tersalin!';
                setTimeout(() => copyBtn.textContent = '📋 Copy Semua', 1500);
            });
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Hapus semua log error?')) {
                ErrorLogger.clearLocalLogs();
                renderLogList();
                updateTabCounts();
            }
        });
    }
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================
// 10. RENDER MODULE LIST
// ============================================================
async function renderModuleList() {
    const container = shadowRoot?.getElementById('tab-content-modules');
    if (!container) return;
    const userTier = await getUserTier();
    const tierBadge = shadowRoot?.getElementById('dashboard-tier');
    if (tierBadge) {
        const tierLabel = userTier === 'all' ? 'All Access' : userTier.charAt(0).toUpperCase() + userTier.slice(1);
        tierBadge.textContent = tierLabel;
        tierBadge.className = `header-tier ${userTier}`;
    }
    const modules = getModules().filter(m => m.id !== MODULE_ID);
    const moduleStates = (await Storage.get('moduleStates')).moduleStates || {};
    let allowedModules = modules;
    if (userTier !== 'all') {
        allowedModules = modules.filter(m => isModuleAllowedByTier(m.tier || 'dasar', userTier));
    }
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

    const searchBar = `
        <div class="search-bar">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" id="search-input" placeholder="Cari module..." value="${escapeHtml(searchQuery)}" />
            <button class="search-clear ${searchQuery ? 'visible' : ''}" id="search-clear">✕</button>
        </div>
    `;

    if (!matchedModules.length) {
        container.innerHTML = searchBar + `<div class="empty-state">${searchQuery.trim() ? 'Tidak ada module yang cocok' : 'Tidak ada module di halaman ini'}</div>`;
    } else {
        const html = matchedModules.map(m => {
            const enabled = moduleStates[m.id] !== false;
            const tierClass = `tier-${m.tier || 'undefined'}`;
            const tierLabel = m.tier || 'undefined';
            const icon = m.icon || '📦';
            return `
                <div class="module-item" data-id="${m.id}">
                    <span class="module-icon">${icon}</span>
                    <div class="module-info">
                        <span class="module-name">${escapeHtml(m.name || m.id)}</span>
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
        container.innerHTML = searchBar + html;
    }

    // Re-bind search
    const searchInput = container.querySelector('#search-input');
    const searchClear = container.querySelector('#search-clear');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderModuleList();
        });
    }
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchQuery = '';
            renderModuleList();
        });
    }

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
// 11. LIST & STATS (Console)
// ============================================================
function listModules() {
    const modules = getModules();
    console.log(`[Dashboard] 📦 Total modules: ${modules.length}`);
    modules.forEach(m => {
        console.log(`  ${m.icon || '◈'} ${m.id} (v${m.version}) - Tier: ${m.tier || 'dasar'}`);
    });
}

function showStats() {
    const modules = getModules();
    const logs = ErrorLogger.getLocalLogs();
    console.log(`[Dashboard] 📊 Total modules: ${modules.length}`);
    console.log(`[Dashboard] 📋 Total error logs: ${logs.length}`);
}

// 🆕 ============================================================
// 11b. SHOW LOGS (Console)
// ============================================================
function showLogs() {
    const logs = ErrorLogger.getLocalLogs();
    console.group(`[Dashboard] 📋 Error Logs (${logs.length})`);
    logs.forEach(log => {
        console.log(`[${log.errorType}] ${log.moduleId}: ${log.message}`);
    });
    console.groupEnd();
    return logs;
}

// ============================================================
// 12. EXPOSE 🔧 [DIMODIFIKASI - expose ErrorLogger & showLogs]
// ============================================================
window.JamuDashboard = {
    version: VERSION,
    getModules,
    listModules,
    showStats,
    showLogs,
    injectModule,
    injectAllModules,
    createUI,
    getUserTier,
    ErrorLogger, // 🆕 expose untuk debugging
    status: 'ready'
};

// 🆕 ============================================================
// 13. GLOBAL RUNTIME ERROR LISTENER
// ============================================================
window.addEventListener('jamu_module_error', (event) => {
    const { moduleId, message, stack } = event.detail || {};
    if (moduleId) {
        ErrorLogger.report(moduleId, 'runtime', stack || message);
    }
});

// Tangkap error global yang tidak tertangkap (uncaught)
window.addEventListener('error', (event) => {
    // Hanya tangkap jika berasal dari modul Jamu (berdasarkan meta)
    if (window.__meta__?.id) {
        ErrorLogger.report(window.__meta__.id, 'runtime', event.message);
    }
});

// ============================================================
// 14. AUTO-RUN
// ============================================================
console.log(`[Dashboard] ✅ v${VERSION} loaded!`);
(async function() {
    const userTier = await getUserTier();
    console.log(`[Dashboard] 👤 User Tier: ${userTier}`);
    await injectAllModules();
    createUI();
    ErrorLogger.updateBadge(); // 🆕 update badge saat start
})();
console.log(`[Dashboard] 💡 Klik tombol 📊 di pojok kanan bawah untuk membuka UI`);
console.log(`[Dashboard] 💡 Akses logs via: JamuDashboard.showLogs()`);

})();
