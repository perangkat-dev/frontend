// ============================================================
// Jamu Dashboard - Module v1.0. (UI Clean)
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
    // 3. IDENTIFIER SERVICE (untuk whitelist)
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

    // ============================================================
    // 7. 🔥 AUTO INJECT MODULES (DENGAN TIER FILTER)
    // ============================================================
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
    // 8. UI (DENGAN TAMPILAN CLEAN)
    // ============================================================

    let isUIOpen = false;
    let uiContainer = null;
    let shadowRoot = null;

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
            .header-close { background: none; border: none; color: #5a6472; font-size: 20px; cursor: pointer; padding: 0 4px; }
            .header-close:hover { color: #ef4444; }
            .body { flex: 1; overflow-y: auto; padding: 12px 16px; scrollbar-width: thin; scrollbar-color: #2e3640 transparent; }
            .body::-webkit-scrollbar { width: 4px; }
            .body::-webkit-scrollbar-thumb { background: #2e3640; border-radius: 2px; }
            
            /* 🔥 SEARCH BAR - DIPERBAIKI LEBARNYA */
            .search-bar { margin-bottom: 12px; position: relative; }
            .search-input { 
                width: 100%; 
                padding: 8px 12px 8px 32px; 
                background: #1a1e23; 
                border: 1px solid #252a31; 
                border-radius: 6px; 
                color: #e8edf3; 
                font-size: 12px; 
                font-family: inherit; 
                outline: none; 
                transition: border-color 0.2s; 
                box-sizing: border-box; 
            }
            .search-input:focus { border-color: #00d4aa; }
            .search-input::placeholder { color: #5a6472; }
            .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #5a6472; font-size: 14px; }
            .search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #5a6472; cursor: pointer; font-size: 14px; display: none; padding: 0 4px; }
            .search-clear:hover { color: #ef4444; }
            .search-clear.visible { display: block; }

            /* 🔥 MODULE ITEM - CLEAN, HANYA NAMA + BADGE */
            .module-item { 
                display: flex; 
                align-items: center; 
                padding: 10px 14px; 
                border-radius: 8px; 
                margin-bottom: 4px; 
                background: #1a1e23; 
                border: 1px solid #252a31; 
                transition: all 0.2s; 
            }
            .module-item:hover { background: #22262f; }
            .module-icon { font-size: 20px; margin-right: 12px; flex-shrink: 0; }
            .module-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; }
            .module-name { 
                font-size: 15px; 
                font-weight: 500; 
                color: #e8edf3; 
                white-space: nowrap; 
                overflow: hidden; 
                text-overflow: ellipsis; 
            }
            .module-meta { 
                display: flex; 
                align-items: center; 
                gap: 4px; 
                flex-shrink: 0; 
            }
            .tier-badge { 
                display: inline-block; 
                padding: 2px 10px; 
                border-radius: 12px; 
                font-size: 10px; 
                font-weight: 600; 
                text-transform: uppercase; 
                letter-spacing: 0.3px; 
            }
            .tier-dasar { background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid rgba(52,211,153,0.2); }
            .tier-pro { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
            .tier-max { background: rgba(139,92,246,0.15); color: #8b5cf6; border: 1px solid rgba(139,92,246,0.2); }
            
            .module-toggle { flex-shrink: 0; margin-left: 12px; }
            .toggle-input { display: none; }
            .toggle-track { width: 32px; height: 18px; background: #2e3640; border-radius: 10px; cursor: pointer; transition: background 0.2s; display: block; position: relative; }
            .toggle-track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: #5a6472; border-radius: 50%; transition: all 0.2s; }
            .toggle-input:checked + .toggle-track { background: #00d4aa; }
            .toggle-input:checked + .toggle-track::after { transform: translateX(14px); background: #000; }
            
            .status-bar { display: flex; justify-content: space-between; padding: 8px 16px; border-top: 1px solid #252a31; background: #131619; font-size: 10px; color: #5a6472; flex-shrink: 0; }
            .status-bar .active-count { color: #00d4aa; }
            .empty-state { padding: 32px 16px; text-align: center; color: #5a6472; font-size: 13px; }
            
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
                box-shadow: 0 4px 20px rgba(0,212,170,0.4) !important; 
                font-size: 24px !important; 
                cursor: pointer !important; 
                z-index: 999999 !important; 
                display: flex !important; 
                align-items: center !important; 
                justify-content: center !important; 
                touch-action: manipulation !important; 
                user-select: none !important; 
                transition: transform 0.2s !important; 
                font-family: 'Courier New', monospace !important; 
            }
            #dashboard-floating-btn:active { transform: scale(0.85) !important; }
            @media (max-width: 480px) { 
                .popup { width: 95% !important; } 
                #dashboard-floating-btn { width: 48px !important; height: 48px !important; font-size: 20px !important; bottom: 16px !important; right: 16px !important; } 
                .module-name { font-size: 13px !important; }
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
                        <span class="header-title"><span class="jamu">🍵 Jamu</span> Loader v.1</span>
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
        });

        renderModuleList();

        // ===== SEARCH =====
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

    let searchQuery = '';

    // ============================================================
    // 🔥 RENDER MODULE LIST - CLEAN VERSION
    // ============================================================
    async function renderModuleList() {
        const container = shadowRoot?.getElementById('module-list-container');
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

        if (!matchedModules.length) {
            container.innerHTML = `<div class="empty-state">${searchQuery.trim() ? 'Tidak ada module yang cocok' : 'Tidak ada module di halaman ini'}</div>`;
            return;
        }

        // 🔥 RENDER: NAMA + BADGE SAJA
        const html = matchedModules.map(m => {
            const enabled = moduleStates[m.id] !== false;
            const tierClass = `tier-${m.tier || 'dasar'}`;
            const tierLabel = m.tier || 'dasar';
            const icon = m.icon || '📦';

            return `
                <div class="module-item" data-id="${m.id}">
                    <span class="module-icon">${icon}</span>
                    <div class="module-info">
                        <span class="module-name">${m.name || m.id}</span>
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
    // 9. LIST & STATS
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
    // 10. EXPOSE
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
    // 11. AUTO-RUN
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
