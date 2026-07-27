// ============================================================
// Dashboard Module untuk Jamu Loader
// ============================================================
(function(__meta__) {
    'use strict';

    const MODULE_ID = 'jamu-dashboard';
    const MODULE_VERSION = '1.0.0';

    // ============================================================
    // 1. AMBIL DATA DARI GLOBAL
    // ============================================================
    const manifest = window.__JAMU_MANIFEST__ || {};
    const loaderVersion = window.__JAMU_VERSION__ || '2.0.0';
    const WHITELIST_URL = manifest.whitelist?.url || 'https://perangkat-dev.github.io/frontend/whitelist.json';
    const DEFAULT_MANIFEST_URL = 'https://perangkat-dev.github.io/frontend/global-manifest.json';

    console.log(`[Dashboard] v${MODULE_VERSION} starting...`);

    // ============================================================
    // 2. STORAGE WRAPPER
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
    // 4. FETCH HELPERS
    // ============================================================
    async function fetchWithTimeout(url, timeoutMs = 10000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
        } finally { clearTimeout(timer); }
    }

    // ============================================================
    // 5. WHITELIST SERVICE (DIPINDAHKAN KE SINI)
    // ============================================================
    let whitelistCache = null;
    let whitelistCacheTimestamp = 0;
    const CACHE_DURATION = 5 * 60 * 1000;

    async function getWhitelist(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && whitelistCache && (now - whitelistCacheTimestamp) < CACHE_DURATION) {
            return whitelistCache;
        }

        try {
            const res = await fetchWithTimeout(WHITELIST_URL, 5000);
            const data = await res.json();
            whitelistCache = Array.isArray(data) ? data : [];
            whitelistCacheTimestamp = now;
            return whitelistCache;
        } catch (err) {
            console.warn('[Dashboard] Whitelist fetch failed:', err);
            return whitelistCache || [];
        }
    }

    // ============================================================
    // 6. VALIDASI AKSES
    // ============================================================
    async function validateAccess() {
        const info = IdentifierService.getCurrentIdentifier();

        if (info.domain === 'skipped') {
            return { allowed: true, tier: 'all', skipValidation: true };
        }

        if (info.domain === 'other' || !info.identifier) {
            return { allowed: true, tier: 'all' };
        }

        const whitelist = await getWhitelist();
        const matchedItem = whitelist.find(item => {
            const ids = item.identifiers || {};
            return Object.values(ids).some(
                val => val && val.toLowerCase().trim() === info.identifier.toLowerCase().trim()
            );
        });

        if (!matchedItem) {
            return { allowed: false, tier: null };
        }

        const isActive = matchedItem.active !== false;
        const userTier = matchedItem.tier || 'dasar';

        return {
            allowed: true,
            tier: isActive ? userTier : 'dasar',
            puskesmas: matchedItem,
            isActive: isActive
        };
    }

    // ============================================================
    // 7. GET MODULE SCRIPT
    // ============================================================
    async function getModuleScript(mod) {
        const cached = await Storage.get([`script_${mod.id}`]);
        const cachedData = cached[`script_${mod.id}`];
        if (cachedData && cachedData.version === mod.version) return cachedData.code;
        const res = await fetchWithTimeout(mod.scriptUrl);
        const code = await res.text();
        await Storage.set({ [`script_${mod.id}`]: { code, version: mod.version, fetchedAt: Date.now() } });
        return code;
    }

    // ============================================================
    // 8. INJECT MODULES (TANPA UI)
    // ============================================================
    async function injectModulesIntoPage() {
        const validation = await validateAccess();
        if (!validation.allowed) {
            console.warn('[Dashboard] Akses ditolak');
            return;
        }

        const moduleStates = (await Storage.get('moduleStates')).moduleStates || {};
        const modules = manifest.modules || [];

        for (const mod of modules) {
            if (mod.id === MODULE_ID) continue; // Skip dashboard module
            if (moduleStates[mod.id] === false) continue;

            const shouldInject = (mod.matches || []).some(p => matchUrlPattern(p, window.location.href));
            if (!shouldInject) continue;

            // Filter tier
            const userTier = validation.tier || 'all';
            if (userTier !== 'all') {
                const modTier = mod.tier || 'dasar';
                if (!isModuleAllowedByTier(modTier, userTier)) {
                    console.log(`[Dashboard] ⏭️ ${mod.id} (${modTier}) diblokir (tier: ${userTier})`);
                    continue;
                }
            }

            console.log(`[Dashboard] 🚀 Injecting: ${mod.id}`);
            try {
                const code = await getModuleScript(mod);
                const meta = {
                    id: mod.id,
                    version: mod.version,
                    name: mod.name,
                    category: mod.category || 'lainnya',
                    description: mod.description || '',
                    tier: mod.tier || 'dasar'
                };

                const script = document.createElement('script');
                script.textContent = `(function() {
                    try {
                        window.__meta__ = ${JSON.stringify(meta)};
                        var meta = window.__meta__;
                        ${code}
                        console.log('[JamuLoader] ✅ ' + meta.id + ' executed');
                    } catch (err) {
                        console.error('[JamuLoader] ❌ Error in ' + meta.id + ':', err);
                    }
                })();`;
                (document.head || document.documentElement).appendChild(script);
                script.remove();
            } catch (err) {
                console.error(`[Dashboard] Failed to inject ${mod.id}:`, err);
            }
        }
    }

    function matchUrlPattern(pattern, url) {
        if (pattern === '<all_urls>' || pattern === '') return true;
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        try { return new RegExp(`^${escaped}$`).test(url); } catch { return url.includes(pattern); }
    }

    function isModuleAllowedByTier(modTier, userTier) {
        const tierLevel = { dasar: 0, pro: 1, max: 2 };
        const modLevel = tierLevel[modTier] || 0;
        const userLevel = tierLevel[userTier] || 0;
        return modLevel <= userLevel;
    }

    // ============================================================
    // 9. INIT
    // ============================================================
    async function init() {
        console.log(`[Dashboard] v${MODULE_VERSION} initialized`);

        // Inject modules (tanpa UI untuk sekarang)
        await injectModulesIntoPage();

        console.log('[Dashboard] ✅ Ready');
    }

    // ============================================================
    // 10. START
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(__meta__);
