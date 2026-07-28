// ============================================================
// Jamu Dashboard - Module v1.0.2 (Stabil)
// ============================================================
(function() {
    'use strict';

    const MODULE_ID = 'jamu-dashboard';
    const VERSION = '1.0.2';

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
    // 4. WHITELIST & VALIDASI
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

    async function getUserTier() {
        const info = IdentifierService.getCurrentIdentifier();
        if (info.domain === 'skipped' || info.domain === 'other' || !info.identifier) {
            return 'all';
        }

        const whitelist = await getWhitelist();
        const matched = whitelist.find(item => {
            const ids = item.identifiers || {};
            return Object.values(ids).some(
                val => val && val.toLowerCase().trim() === info.identifier.toLowerCase().trim()
            );
        });

        if (!matched) return 'all';
        const isActive = matched.active !== false;
        return isActive ? (matched.tier || 'dasar') : 'dasar';
    }

    // ============================================================
    // 5. FUNGSI MODULE
    // ============================================================
    function getModules() {
        return manifest.modules || [];
    }

    function isModuleAllowedByTier(modTier, userTier) {
        if (userTier === 'all') return true;
        const tierLevel = { dasar: 0, pro: 1, max: 2 };
        const modLevel = tierLevel[modTier] || 0;
        const userLevel = tierLevel[userTier] || 0;
        return modLevel <= userLevel;
    }

    // ============================================================
    // 6. INJECT MODULE
    // ============================================================
    async function injectModule(moduleId) {
        const modules = getModules();
        const mod = modules.find(m => m.id === moduleId);

        if (!mod) {
            console.error(`[Dashboard] ❌ Module "${moduleId}" not found`);
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
                        console.error('[JamuLoader] ❌ Error in ' + '${mod.id}' + ':', err);
                    }
                })();
            `;
            (document.head || document.documentElement).appendChild(script);
            script.remove();

            console.log(`[Dashboard] ✅ ${mod.id} injected successfully`);
            return true;
        } catch (err) {
            console.error(`[Dashboard] ❌ Failed to inject ${mod.id}:`, err);
            return false;
        }
    }

    async function injectAllModules() {
        const userTier = await getUserTier();
        console.log(`[Dashboard] 👤 User Tier: ${userTier}`);

        let modules = getModules().filter(m => m.id !== MODULE_ID);
        console.log(`[Dashboard] 📦 Total modules: ${modules.length}`);

        if (userTier !== 'all') {
            modules = modules.filter(m => isModuleAllowedByTier(m.tier || 'dasar', userTier));
            console.log(`[Dashboard] 📦 Modules allowed by tier: ${modules.length}`);
        }

        const moduleStates = (await Storage.get('moduleStates')).moduleStates || {};

        let success = 0;
        let failed = 0;
        let skipped = 0;

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
    // 7. UI MODERN CARD
    // ============================================================

    let isUIOpen = false;
    let uiContainer = null;
    let shadowRoot = null;
    let searchQuery = '';

    function getUICSS() {
        return `
            :host {
                all: initial;
                display: block;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            }
            :host([data-visible="true"]) { pointer-events: auto; }

            .backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.7);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 1;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            .backdrop.open {
                opacity: 1;
                pointer-events: auto;
            }

            .popup {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.95);
                width: 580px;
                max-height: 85vh;
                background: #0d0f12;
                color: #e8edf3;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 24px 80px rgba(0,0,0,0.7);
                z-index: 2;
                opacity: 0;
                pointer-events: none;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex;
                flex-direction: column;
            }
            .popup.open {
                opacity: 1;
                pointer-events: auto;
                transform: translate(-50%, -50%) scale(1);
            }

            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                background: #131619;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                flex-shrink: 0;
            }
            .header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .header-logo {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                object-fit: contain;
            }
            .header-title {
                font-weight: 700;
                font-size: 18px;
                color: #e8edf3;
                letter-spacing: -0.3px;
            }
            .header-title .jamu {
                color: #00d4aa;
            }
            .header-tier {
                display: inline-block;
                padding: 2px 12px;
                border-radius: 20px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-left: 4px;
            }
            .header-tier.dasar {
                background: rgba(52,211,153,0.15);
                color: #34d399;
                border: 1px solid rgba(52,211,153,0.3);
            }
            .header-tier.pro {
                background: rgba(245,158,11,0.15);
                color: #f59e0b;
                border: 1px solid rgba(245,158,11,0.3);
            }
            .header-tier.max {
                background: rgba(139,92,246,0.15);
                color: #8b5cf6;
                border: 1px solid rgba(139,92,246,0.3);
            }
            .header-tier.all {
                background: rgba(255,255,255,0.06);
                color: #5a6472;
                border: 1px solid rgba(255,255,255,0.06);
            }
            .header-close {
                background: none;
                border: none;
                color: #5a6472;
                font-size: 20px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 6px;
                transition: all 0.2s;
                line-height: 1;
            }
            .header-close:hover {
                background: rgba(239,68,68,0.1);
                color: #ef4444;
            }

            .body {
                flex: 1;
                overflow-y: auto;
                padding: 16px 20px;
                scrollbar-width: thin;
                scrollbar-color: #2e3640 transparent;
            }
            .body::-webkit-scrollbar { width: 4px; }
            .body::-webkit-scrollbar-track { background: transparent; }
            .body::-webkit-scrollbar-thumb { background: #2e3640; border-radius: 2px; }

            .search-bar {
                position: relative;
                margin-bottom: 16px;
            }
            .search-input {
                width: 100%;
                padding: 10px 14px 10px 36px;
                background: #1a1e23;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 10px;
                color: #e8edf3;
                font-size: 13px;
                font-family: inherit;
                outline: none;
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .search-input:focus {
                border-color: #00d4aa;
                box-shadow: 0 0 0 3px rgba(0,212,170,0.1);
            }
            .search-input::placeholder {
                color: #5a6472;
            }
            .search-icon {
                position: absolute;
                left: 12px;
                top: 50%;
                transform: translateY(-50%);
                color: #5a6472;
                font-size: 14px;
            }
            .search-clear {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: #5a6472;
                cursor: pointer;
                font-size: 14px;
                display: none;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;
            }
            .search-clear:hover {
                color: #ef4444;
                background: rgba(239,68,68,0.1);
            }
            .search-clear.visible {
                display: block;
            }

            .stats-bar {
                display: flex;
                gap: 16px;
                padding: 10px 0 14px 0;
                border-bottom: 1px solid rgba(255,255,255,0.04);
                margin-bottom: 14px;
                font-size: 12px;
                color: #5a6472;
            }
            .stats-bar .stat-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .stats-bar .stat-number {
                color: #e8edf3;
                font-weight: 600;
            }
            .stats-bar .stat-number.active {
                color: #00d4aa;
            }

            .module-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }

            .module-card {
                background: #131619;
                border: 1px solid rgba(255,255,255,0.04);
                border-radius: 12px;
                padding: 14px 16px;
                transition: all 0.2s ease;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .module-card:hover {
                border-color: rgba(255,255,255,0.08);
                background: #181c22;
                transform: translateY(-1px);
            }
            .module-card-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 8px;
            }
            .module-card-left {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                min-width: 0;
                flex: 1;
            }
            .module-icon {
                font-size: 20px;
                line-height: 1;
                flex-shrink: 0;
                margin-top: 2px;
            }
            .module-info {
                min-width: 0;
                flex: 1;
            }
            .module-name {
                font-weight: 600;
                font-size: 13px;
                color: #e8edf3;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .module-desc {
                font-size: 11px;
                color: #5a6472;
                margin-top: 2px;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                line-height: 1.3;
            }
            .module-card-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-top: 4px;
            }
            .module-meta {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .tier-badge {
                display: inline-block;
                padding: 1px 8px;
                border-radius: 12px;
                font-size: 9px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            .tier-dasar {
                background: rgba(52,211,153,0.12);
                color: #34d399;
            }
            .tier-pro {
                background: rgba(245,158,11,0.12);
                color: #f59e0b;
            }
            .tier-max {
                background: rgba(139,92,246,0.12);
                color: #8b5cf6;
            }
            .module-version {
                font-size: 10px;
                color: #5a6472;
                font-family: monospace;
            }
            .module-urls {
                font-size: 9px;
                color: #3a4452;
                font-family: monospace;
            }

            .module-toggle {
                flex-shrink: 0;
            }
            .toggle-input {
                display: none;
            }
            .toggle-track {
                width: 34px;
                height: 20px;
                background: #2e3640;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.25s ease;
                display: block;
                position: relative;
                border: 2px solid transparent;
            }
            .toggle-track::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 14px;
                height: 14px;
                background: #5a6472;
                border-radius: 50%;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .toggle-input:checked + .toggle-track {
                background: #00d4aa;
                border-color: #00d4aa;
            }
            .toggle-input:checked + .toggle-track::after {
                transform: translateX(14px);
                background: #000;
            }

            .status-bar {
                display: flex;
                justify-content: space-between;
                padding: 10px 20px;
                border-top: 1px solid rgba(255,255,255,0.04);
                background: #131619;
                font-size: 11px;
                color: #5a6472;
                flex-shrink: 0;
            }
            .status-bar .active-count {
                color: #00d4aa;
                font-weight: 600;
            }

            .empty-state {
                padding: 40px 20px;
                text-align: center;
                color: #5a6472;
                font-size: 13px;
                grid-column: 1 / -1;
            }
            .empty-state .empty-icon {
                font-size: 32px;
                margin-bottom: 8px;
                opacity: 0.4;
            }

            #dashboard-floating-btn {
                position: fixed !important;
                bottom: 24px !important;
                right: 24px !important;
                width: 56px !important;
                height: 56px !important;
                border-radius: 50% !important;
                background: #00d4aa !important;
                color: #000 !important;
                border: none !important;
                box-shadow: 0 4px 24px rgba(0,212,170,0.3) !important;
                font-size: 24px !important;
                cursor: pointer !important;
                z-index: 999999 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                touch-action: manipulation !important;
                user-select: none !important;
                transition: transform 0.2s, box-shadow 0.2s !important;
                font-family: 'Courier New', monospace !important;
                font-weight: 700 !important;
            }
            #dashboard-floating-btn:hover {
                transform: scale(1.05) !important;
                box-shadow: 0 6px 32px rgba(0,212,170,0.4) !important;
            }
            #dashboard-floating-btn:active {
                transform: scale(0.9) !important;
            }
            #dashboard-floating-btn img {
                width: 32px;
                height: 32px;
                display: block;
                object-fit: contain;
                pointer-events: none;
            }

            @media (max-width: 640px) {
                .popup {
                    width: 95% !important;
                    max-height: 90vh !important;
                    border-radius: 12px !important;
                }
                .module-grid {
                    grid-template-columns: 1fr !important;
                }
                .header-title {
                    font-size: 15px !important;
                }
                .header-logo {
                    width: 28px !important;
                    height: 28px !important;
                }
                #dashboard-floating-btn {
                    width: 48px !important;
                    height: 48px !important;
                    font-size: 20px !important;
                    bottom: 16px !important;
                    right: 16px !important;
                }
                .body {
                    padding: 12px 14px !important;
                }
                .module-card {
                    padding: 12px 14px !important;
                }
            }
            @media (max-width: 400px) {
                .header {
                    padding: 12px 14px !important;
                }
                .module-card {
                    padding: 10px 12px !important;
                }
                .module-name {
                    font-size: 12px !important;
                }
            }
        `;
    }

    // ============================================================
    // 8. CREATE UI
    // ============================================================
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
                        <img src="https://perangkat-dev.github.io/frontend/logo.svg" class="header-logo" alt="Jamu Loader" />
                        <span class="header-title"><span class="jamu">Jamu</span> Loader</span>
                        <span class="header-tier" id="dashboard-tier">Loading...</span>
                    </div>
                    <button class="header-close" id="dashboard-close">✕</button>
                </div>
                <div class="body" id="dashboard-body">
                    <div class="search-bar">
                        <span class="search-icon">🔍</span>
                        <input type="text" class="search-input" id="search-input" placeholder="Cari module..." />
                        <button class="search-clear" id="search-clear">✕</button>
                    </div>
                    <div class="stats-bar" id="stats-bar">
                        <span class="stat-item">📦 <span class="stat-number" id="stat-total">0</span> modules</span>
                        <span class="stat-item">✅ <span class="stat-number active" id="stat-active">0</span> active</span>
                        <span class="stat-item" id="stat-tier-display">👤 Tier: <span id="stat-tier-label">-</span></span>
                    </div>
                    <div class="module-grid" id="module-grid">
                        <div class="empty-state">
                            <div class="empty-icon">📦</div>
                            Loading modules...
                        </div>
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
        btn.textContent = '📊';
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
                renderModuleList();
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

        renderModuleList();
    }

    // ============================================================
    // 9. RENDER MODULE LIST
    // ============================================================
    async function renderModuleList() {
        const grid = shadowRoot?.getElementById('module-grid');
        if (!grid) return;

        const userTier = await getUserTier();
        const tierBadge = shadowRoot?.getElementById('dashboard-tier');
        if (tierBadge) {
            const tierLabel = userTier === 'all' ? 'All Access' : userTier.charAt(0).toUpperCase() + userTier.slice(1);
            tierBadge.textContent = tierLabel;
            tierBadge.className = `header-tier ${userTier}`;
        }

        const statTier = shadowRoot?.getElementById('stat-tier-label');
        if (statTier) {
            statTier.textContent = userTier === 'all' ? 'All' : userTier.charAt(0).toUpperCase() + userTier.slice(1);
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
                const desc = (m.description || '').toLowerCase();
                return name.includes(q) || id.includes(q) || desc.includes(q);
            });
        }

        const statTotal = shadowRoot?.getElementById('stat-total');
        const statActive = shadowRoot?.getElementById('stat-active');
        if (statTotal) statTotal.textContent = matchedModules.length;
        if (statActive) {
            const activeCount = matchedModules.filter(m => moduleStates[m.id] !== false).length;
            statActive.textContent = activeCount;
        }

        if (!matchedModules.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    ${searchQuery.trim() ? 'Tidak ada module yang cocok dengan pencarian' : 'Tidak ada module yang match atau diizinkan'}
                </div>
            `;
            return;
        }

        let html = '';
        matchedModules.forEach(m => {
            const enabled = moduleStates[m.id] !== false;
            const tierClass = `tier-${m.tier || 'dasar'}`;
            const tierLabel = m.tier || 'dasar';
            const description = m.description || '';

            html += `
                <div class="module-card" data-id="${m.id}">
                    <div class="module-card-header">
                        <div class="module-card-left">
                            <span class="module-icon">${m.icon || '📦'}</span>
                            <div class="module-info">
                                <div class="module-name" title="${m.name || m.id}">${m.name || m.id}</div>
                                ${description ? `<div class="module-desc">${description}</div>` : ''}
                            </div>
                        </div>
                        <div class="module-toggle">
                            <label>
                                <input type="checkbox" class="toggle-input" ${enabled ? 'checked' : ''} data-id="${m.id}" />
                                <span class="toggle-track"></span>
                            </label>
                        </div>
                    </div>
                    <div class="module-card-footer">
                        <div class="module-meta">
                            <span class="tier-badge ${tierClass}">${tierLabel}</span>
                            <span class="module-version">v${m.version || '1.0'}</span>
                            <span class="module-urls">${m.matches?.length || 0} URL(s)</span>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;

        grid.querySelectorAll('.toggle-input').forEach(input => {
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
    // 10. LIST & STATS (Console)
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
        console.log(`[Dashboard] 📊 Total: ${modules.length}`);
    }

    // ============================================================
    // 11. EXPOSE
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
        status: 'ready'
    };

    // ============================================================
    // 12. AUTO-RUN
    // ============================================================
    console.log(`[Dashboard] ✅ v${VERSION} loaded!`);

    (async function() {
        const userTier = await getUserTier();
        console.log(`[Dashboard] 👤 User Tier: ${userTier}`);
        await injectAllModules();
        createUI();
    })();

    console.log(`[Dashboard] 💡 Klik tombol 📊 di pojok kanan bawah untuk membuka UI`);

})();
