// ============================================================
// Dashboard Module untuk Jamu Loader
// ============================================================
(function() {
    'use strict';

    const MODULE_ID = 'jamu-dashboard';
    const MODULE_VERSION = '1.0.0';

    console.log(`[Dashboard] v${MODULE_VERSION} starting...`);

    // ============================================================
    // 1. AMBIL MANIFEST DARI GLOBAL
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
    // 3. DETECT DOMAIN
    // ============================================================
    function getDomain() {
        const url = window.location.href;
        if (url.includes('epuskesmas.id')) return 'epuskesmas';
        if (url.includes('bpjs-kesehatan.go.id')) return 'bpjs';
        if (url.includes('sehatindonesiaku.kemkes.go.id')) return 'asik';
        if (url.includes('asik.kemkes.go.id')) return 'asik';
        if (url.includes('sehatindonesiaku')) return 'asik';
        return 'other';
    }

    // ============================================================
    // 4. GET IDENTIFIER (SEDERHANA)
    // ============================================================
    function getIdentifier() {
        const domain = getDomain();
        try {
            if (domain === 'epuskesmas') {
                if (window.AppLayoutConfig?.webSocket?.puskesmasId) {
                    const match = window.AppLayoutConfig.webSocket.puskesmasId.match(/(\d+)/);
                    if (match) return match[1].replace(/^0+/, '');
                }
                const userMenu = document.querySelector("#menu_user .label-default");
                if (userMenu) {
                    const match = userMenu.textContent.trim().match(/(\d+)/);
                    if (match) return match[1].replace(/^0+/, '');
                }
            }
            if (domain === 'bpjs') {
                const spans = document.querySelectorAll('.hidden-xs');
                for (const span of spans) {
                    const match = span.textContent.trim().match(/\((\d{8})\)/);
                    if (match) return match[1];
                }
            }
            if (domain === 'asik') {
                const userData = localStorage.getItem('user');
                if (userData) {
                    try {
                        const parsed = JSON.parse(userData);
                        if (parsed?.user?.kode_sarana) return parsed.user.kode_sarana;
                        if (parsed?.kode_sarana) return parsed.kode_sarana;
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return null;
    }

    // ============================================================
    // 5. GET WHITELIST
    // ============================================================
    async function getWhitelist() {
        const url = manifest.whitelist?.url || 'https://perangkat-dev.github.io/frontend/whitelist.json';
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.warn('[Dashboard] Whitelist fetch failed:', err);
            return [];
        }
    }

    // ============================================================
    // 6. VALIDATE
    // ============================================================
    async function validateAccess() {
        const domain = getDomain();
        const identifier = getIdentifier();

        if (domain === 'other' || !identifier) {
            return { allowed: true, tier: 'all' };
        }

        const whitelist = await getWhitelist();
        const matched = whitelist.find(item => {
            const ids = item.identifiers || {};
            return Object.values(ids).some(
                val => val && val.toLowerCase().trim() === identifier.toLowerCase().trim()
            );
        });

        if (!matched) {
            return { allowed: false, tier: null };
        }

        const isActive = matched.active !== false;
        const userTier = matched.tier || 'dasar';

        return {
            allowed: true,
            tier: isActive ? userTier : 'dasar',
            puskesmas: matched,
            isActive: isActive
        };
    }

    // ============================================================
    // 7. INJECT MODULES
    // ============================================================
    async function injectModules() {
        const validation = await validateAccess();
        if (!validation.allowed) {
            console.warn('[Dashboard] ❌ Akses ditolak');
            return;
        }

        const moduleStates = (await Storage.get('moduleStates')).moduleStates || {};
        const modules = manifest.modules || [];

        console.log(`[Dashboard] 📋 Validasi: ${validation.tier}`);

        for (const mod of modules) {
            if (mod.id === MODULE_ID) continue;
            if (moduleStates[mod.id] === false) continue;

            const shouldInject = (mod.matches || []).some(p => {
                if (p === '<all_urls>' || p === '') return true;
                try {
                    const escaped = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                    return new RegExp(`^${escaped}$`).test(window.location.href);
                } catch { return window.location.href.includes(p); }
            });
            if (!shouldInject) continue;

            const userTier = validation.tier || 'all';
            if (userTier !== 'all') {
                const modTier = mod.tier || 'dasar';
                const tierLevel = { dasar: 0, pro: 1, max: 2 };
                if ((tierLevel[modTier] || 0) > (tierLevel[userTier] || 0)) {
                    console.log(`[Dashboard] ⏭️ ${mod.id} (${modTier}) diblokir (tier: ${userTier})`);
                    continue;
                }
            }

            console.log(`[Dashboard] 🚀 Inject: ${mod.id}`);
            try {
                const cached = await Storage.get([`script_${mod.id}`]);
                let code = cached[`script_${mod.id}`]?.code;
                if (!code) {
                    const res = await fetch(mod.scriptUrl);
                    code = await res.text();
                    await Storage.set({ [`script_${mod.id}`]: { code, version: mod.version, fetchedAt: Date.now() } });
                }
                const script = document.createElement('script');
                script.textContent = code;
                (document.head || document.documentElement).appendChild(script);
                script.remove();
            } catch (err) {
                console.error(`[Dashboard] ❌ Failed ${mod.id}:`, err);
            }
        }
    }

    // ============================================================
    // 8. INIT
    // ============================================================
    async function init() {
        console.log(`[Dashboard] ✅ Ready (v${MODULE_VERSION})`);
        await injectModules();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
