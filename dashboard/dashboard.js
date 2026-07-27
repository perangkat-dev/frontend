// ============================================================
// Jamu Dashboard - Module v1.0.0
// ============================================================
(function() {
    'use strict';

    const MODULE_ID = 'jamu-dashboard';
    const VERSION = '1.0.0';

    console.log(`[Dashboard] ✅ v${VERSION} loaded successfully!`);

    // ============================================================
    // 1. AMBIL MANIFEST
    // ============================================================
    const manifest = window.__JAMU_MANIFEST__ || {};
    const loaderVersion = window.__JAMU_VERSION__ || '2.0.0';

    console.log(`[Dashboard] 📡 Version: ${loaderVersion}`);
    console.log(`[Dashboard] 📡 Manifest:`, manifest);

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
    // 3. FUNGSI MODULE
    // ============================================================
    function getModules() {
        return manifest.modules || [];
    }

    function getModuleCount() {
        return getModules().length;
    }

    function getModuleById(id) {
        return getModules().find(m => m.id === id);
    }

    function getModulesByTier(tier) {
        return getModules().filter(m => m.tier === tier);
    }

    function getModulesByCategory(category) {
        return getModules().filter(m => m.category === category);
    }

    // ============================================================
    // 4. INJECT MODULE
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

            // 🔥 Inject dengan meta
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
        let modules = getModules().filter(m => m.id !== MODULE_ID);
        console.log(`[Dashboard] 📦 Injecting ${modules.length} modules...`);

        let success = 0;
        let failed = 0;

        for (const mod of modules) {
            const shouldInject = (mod.matches || []).some(p => {
                if (p === '<all_urls>' || p === '') return true;
                try {
                    const escaped = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                    return new RegExp(`^${escaped}$`).test(window.location.href);
                } catch { return window.location.href.includes(p); }
            });

            if (!shouldInject) {
                console.log(`[Dashboard] ⏭️ ${mod.id} URL mismatch`);
                continue;
            }

            const result = await injectModule(mod.id);
            if (result) success++;
            else failed++;
        }

        console.log(`[Dashboard] ✅ Injected: ${success}, Failed: ${failed}`);
        return { success, failed };
    }

    // ============================================================
    // 5. 🔥 BARU: UI COMPONENTS
    // ============================================================

    let isUIOpen = false;
    let uiContainer = null;
    let shadowRoot = null;

    // --- CSS ---
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
            :host([data-visible="true"]) {
                pointer-events: auto;
            }

            .backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(4px);
                z-index: 1;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.25s ease;
            }
            .backdrop.open {
                opacity: 1;
                pointer-events: auto;
            }

            .popup {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.96);
                width: 480px;
                max-height: 80vh;
                background: #0d0f12;
                color: #e8edf3;
                border: 1px solid #252a31;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                z-index: 2;
                opacity: 0;
                pointer-events: none;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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
                padding: 12px 16px;
                background: #131619;
                border-bottom: 1px solid #252a31;
                flex-shrink: 0;
            }
            .header-title {
                font-weight: 600;
                font-size: 16px;
                color: #00d4aa;
            }
            .header-close {
                background: none;
                border: none;
                color: #5a6472;
                font-size: 20px;
                cursor: pointer;
                padding: 0 4px;
            }
            .header-close:hover {
                color: #ef4444;
            }

            .body {
                flex: 1;
                overflow-y: auto;
                padding: 12px 16px;
                scrollbar-width: thin;
                scrollbar-color: #2e3640 transparent;
            }
            .body::-webkit-scrollbar {
                width: 4px;
            }
            .body::-webkit-scrollbar-thumb {
                background: #2e3640;
                border-radius: 2px;
            }

            .module-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                border-radius: 6px;
                margin-bottom: 4px;
                background: #1a1e23;
                border: 1px solid #252a31;
                transition: all 0.2s;
            }
            .module-item:hover {
                background: #22262f;
            }

            .module-icon {
                font-size: 18px;
                margin-right: 10px;
                flex-shrink: 0;
            }

            .module-info {
                flex: 1;
                min-width: 0;
            }
            .module-name {
                font-size: 13px;
                font-weight: 500;
                color: #e8edf3;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .module-meta {
                font-size: 10px;
                color: #5a6472;
            }
            .module-meta .tier-badge {
                display: inline-block;
                padding: 0 6px;
                border-radius: 3px;
                font-size: 9px;
                font-weight: 600;
                margin-right: 4px;
            }
            .tier-dasar { background: rgba(52,211,153,0.15); color: #34d399; }
            .tier-pro { background: rgba(245,158,11,0.15); color: #f59e0b; }
            .tier-max { background: rgba(139,92,246,0.15); color: #8b5cf6; }

            .module-toggle {
                flex-shrink: 0;
                margin-left: 8px;
            }
            .toggle-input {
                display: none;
            }
            .toggle-track {
                width: 32px;
                height: 18px;
                background: #2e3640;
                border-radius: 10px;
                cursor: pointer;
                transition: background 0.2s;
                display: block;
                position: relative;
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
                transition: all 0.2s;
            }
            .toggle-input:checked + .toggle-track {
                background: #00d4aa;
            }
            .toggle-input:checked + .toggle-track::after {
                transform: translateX(14px);
                background: #000;
            }

            .status-bar {
                display: flex;
                justify-content: space-between;
                padding: 8px 16px;
                border-top: 1px solid #252a31;
                background: #131619;
                font-size: 10px;
                color: #5a6472;
                flex-shrink: 0;
            }
            .status-bar .active-count {
                color: #00d4aa;
            }

            .empty-state {
                padding: 32px 16px;
                text-align: center;
                color: #5a6472;
                font-size: 13px;
            }

            /* Floating button */
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
            #dashboard-floating-btn:active {
                transform: scale(0.85) !important;
            }
            @media (max-width: 480px) {
                .popup { width: 95% !important; }
                #dashboard-floating-btn { width: 48px !important; height: 48px !important; font-size: 20px !important; bottom: 16px !important; right: 16px !important; }
            }
        `;
    }

    // --- CREATE UI ---
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
                    <span class="header-title">📊 Jamu Dashboard</span>
                    <button class="header-close" id="dashboard-close">✕</button>
                </div>
                <div class="body" id="dashboard-body">
                    <div class="empty-state">Loading modules...</div>
                </div>
                <div class="status-bar">
                    <span id="dashboard-status">Ready</span>
                    <span class="active-count" id="dashboard-active">0 active</span>
                </div>
            </div>
        `;

        shadow.appendChild(template.content.cloneNode(true));
        document.body.appendChild(container);

        // Floating button
        const btn = document.createElement('button');
        btn.id = 'dashboard-floating-btn';
        btn.textContent = '📊';
        btn.setAttribute('aria-label', 'Buka Jamu Dashboard');
        document.body.appendChild(btn);

        uiContainer = container;

        // Events
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
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            toggleUI(!isUIOpen);
        }, { passive: false });

        closeBtn.addEventListener('click', () => toggleUI(false));
        backdrop.addEventListener('click', () => toggleUI(false));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isUIOpen) toggleUI(false);
        });

        // Render awal
        renderModuleList();
    }

    // --- RENDER MODULE LIST ---
    async function renderModuleList() {
        const body = shadowRoot?.getElementById('dashboard-body');
        if (!body) return;

        const modules = getModules().filter(m => m.id !== MODULE_ID);
        const moduleStates = (await Storage.get('moduleStates')).moduleStates || {};

        if (!modules.length) {
            body.innerHTML = `<div class="empty-state">Tidak ada module</div>`;
            return;
        }

        // Cek URL match
        const url = window.location.href;
        const matchedModules = modules.filter(m => {
            return (m.matches || []).some(p => {
                if (p === '<all_urls>' || p === '') return true;
                try {
                    const escaped = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                    return new RegExp(`^${escaped}$`).test(url);
                } catch { return url.includes(p); }
            });
        });

        const html = matchedModules.map(m => {
            const enabled = moduleStates[m.id] !== false;
            const tierClass = `tier-${m.tier || 'dasar'}`;
            const tierLabel = m.tier || 'dasar';

            return `
                <div class="module-item" data-id="${m.id}">
                    <span class="module-icon">${m.icon || '📦'}</span>
                    <div class="module-info">
                        <div class="module-name" title="${m.name || m.id}">${m.name || m.id}</div>
                        <div class="module-meta">
                            <span class="tier-badge ${tierClass}">${tierLabel}</span>
                            v${m.version || '1.0'}
                            <span style="color:#5a6472;margin-left:4px;">${m.matches?.length || 0} URL</span>
                        </div>
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

        body.innerHTML = html;

        // Event toggle
        body.querySelectorAll('.toggle-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const id = e.target.dataset.id;
                const checked = e.target.checked;
                const states = await Storage.get('moduleStates');
                const moduleStates = states.moduleStates || {};
                moduleStates[id] = checked;
                await Storage.set({ moduleStates });

                if (checked) {
                    // Inject module saat diaktifkan
                    await injectModule(id);
                }

                console.log(`[Dashboard] ${id} ${checked ? 'enabled' : 'disabled'}`);
                renderModuleList();
            });
        });

        // Update status
        const statusEl = shadowRoot?.getElementById('dashboard-status');
        const activeEl = shadowRoot?.getElementById('dashboard-active');
        if (statusEl) statusEl.textContent = `${matchedModules.length} modules on this page`;
        if (activeEl) {
            const activeCount = matchedModules.filter(m => moduleStates[m.id] !== false).length;
            activeEl.textContent = `${activeCount} active`;
        }
    }

    // ============================================================
    // 6. LIST & STATS (Console)
    // ============================================================
    function listModules() {
        const modules = getModules();
        console.log(`[Dashboard] 📦 Total modules: ${modules.length}`);
        console.log(`[Dashboard] ========================================`);
        if (!modules.length) {
            console.log(`[Dashboard] ⚠️ Tidak ada module di manifest`);
            return;
        }
        const categories = {};
        modules.forEach(m => {
            const cat = m.category || 'lainnya';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(m);
        });
        Object.keys(categories).forEach(cat => {
            console.log(`[Dashboard] 📁 ${cat.toUpperCase()}:`);
            categories[cat].forEach(m => {
                console.log(`  ${m.icon || '◈'} ${m.id} (v${m.version}) - Tier: ${m.tier || 'dasar'}`);
                console.log(`    📌 ${m.matches?.join(', ') || 'all'}`);
            });
            console.log(`[Dashboard] ----------------------------------------`);
        });
    }

    function showStats() {
        const modules = getModules();
        const total = modules.length;
        const byTier = { dasar: 0, pro: 0, max: 0, undefined: 0 };
        const byCategory = {};
        modules.forEach(m => {
            const tier = m.tier || 'undefined';
            byTier[tier] = (byTier[tier] || 0) + 1;
            const cat = m.category || 'lainnya';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
        });
        console.log(`[Dashboard] 📊 STATISTIK`);
        console.log(`[Dashboard] ========================================`);
        console.log(`[Dashboard] Total modules: ${total}`);
        console.log(`[Dashboard] By Tier:`);
        Object.keys(byTier).forEach(t => console.log(`  ${t}: ${byTier[t]}`));
        console.log(`[Dashboard] By Category:`);
        Object.keys(byCategory).forEach(c => console.log(`  ${c}: ${byCategory[c]}`));
        console.log(`[Dashboard] ========================================`);
    }

    // ============================================================
    // 7. EXPOSE
    // ============================================================
    window.JamuDashboard = {
        version: VERSION,
        loaderVersion: loaderVersion,
        manifest: manifest,
        getModules,
        getModuleCount,
        getModuleById,
        getModulesByTier,
        getModulesByCategory,
        listModules,
        showStats,
        injectModule,
        injectAllModules,
        createUI,
        status: 'ready',
        timestamp: new Date().toISOString()
    };

    // ============================================================
    // 8. AUTO-RUN
    // ============================================================
    console.log(`[Dashboard] 🌐 Ready to manage modules!`);
    listModules();
    showStats();

    // 🔥 Tampilkan UI setelah load
    createUI();

    console.log(`[Dashboard] 💡 Klik tombol 📊 di pojok kanan bawah untuk membuka UI`);
    console.log(`[Dashboard] 💡 Ketik JamuDashboard.createUI() untuk membuat ulang UI`);

})();
