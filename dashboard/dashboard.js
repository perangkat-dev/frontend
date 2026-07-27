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
    // 2. AMBIL DAFTAR MODULE
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
    // 3. STORAGE (untuk cache script)
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
    // 4. 🔥 BARU: INJECT MODULE
    // ============================================================
    async function injectModule(moduleId) {
        const modules = getModules();
        const mod = modules.find(m => m.id === moduleId);
        
        if (!mod) {
            console.error(`[Dashboard] ❌ Module "${moduleId}" not found`);
            return false;
        }

        // Skip dashboard module
        if (mod.id === MODULE_ID) {
            console.log(`[Dashboard] ⏭️ Skip dashboard module`);
            return false;
        }

        console.log(`[Dashboard] 🚀 Injecting: ${mod.id} (${mod.tier || 'dasar'})`);

        try {
            // Cek cache
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

            // Inject ke halaman
            const script = document.createElement('script');
            script.textContent = code;
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
    // 5. 🔥 BARU: INJECT SEMUA MODULE (DENGAN FILTER)
    // ============================================================
    async function injectAllModules(options = {}) {
        const { 
            tier = null,        // filter by tier: 'dasar', 'pro', 'max'
            category = null,    // filter by category: 'skrining', 'tools', dll
            excludeDashboard = true  // skip dashboard module
        } = options;

        let modules = getModules();
        
        // Filter
        if (excludeDashboard) {
            modules = modules.filter(m => m.id !== MODULE_ID);
        }
        if (tier) {
            modules = modules.filter(m => m.tier === tier);
        }
        if (category) {
            modules = modules.filter(m => m.category === category);
        }

        console.log(`[Dashboard] 📦 Injecting ${modules.length} modules...`);

        let success = 0;
        let failed = 0;

        for (const mod of modules) {
            // Cek URL match
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
    // 6. TAMPILKAN DAFTAR MODULE DI CONSOLE
    // ============================================================
    function listModules() {
        const modules = getModules();
        console.log(`[Dashboard] 📦 Total modules: ${modules.length}`);
        console.log(`[Dashboard] ========================================`);

        if (modules.length === 0) {
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

    // ============================================================
    // 7. TAMPILKAN STATISTIK
    // ============================================================
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
        Object.keys(byTier).forEach(t => {
            console.log(`  ${t}: ${byTier[t]}`);
        });
        console.log(`[Dashboard] By Category:`);
        Object.keys(byCategory).forEach(c => {
            console.log(`  ${c}: ${byCategory[c]}`);
        });
        console.log(`[Dashboard] ========================================`);
    }

    // ============================================================
    // 8. EXPOSE KE WINDOW
    // ============================================================
    window.JamuDashboard = {
        version: VERSION,
        loaderVersion: loaderVersion,
        manifest: manifest,

        // Fungsi
        getModules: getModules,
        getModuleCount: getModuleCount,
        getModuleById: getModuleById,
        getModulesByTier: getModulesByTier,
        getModulesByCategory: getModulesByCategory,
        listModules: listModules,
        showStats: showStats,

        // 🔥 BARU: Inject functions
        injectModule: injectModule,
        injectAllModules: injectAllModules,

        // Status
        status: 'ready',
        timestamp: new Date().toISOString()
    };

    // ============================================================
    // 9. AUTO-RUN: INJECT MODULES (OPSIONAL)
    // ============================================================
    console.log(`[Dashboard] 🌐 Ready to manage modules!`);
    console.log(`[Dashboard] 📦 Menampilkan daftar module...`);
    listModules();
    showStats();

    console.log(`[Dashboard] 💡 Ketik JamuDashboard.listModules() untuk menampilkan ulang`);
    console.log(`[Dashboard] 💡 Ketik JamuDashboard.showStats() untuk melihat statistik`);
    console.log(`[Dashboard] 💡 Ketik JamuDashboard.injectAllModules() untuk inject semua module`);
    console.log(`[Dashboard] 💡 Ketik JamuDashboard.injectModule('data-pasien-reader') untuk inject module tertentu`);

})();
