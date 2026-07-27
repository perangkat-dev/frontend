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
    // 3. TAMPILKAN DAFTAR MODULE DI CONSOLE
    // ============================================================
    function listModules() {
        const modules = getModules();
        console.log(`[Dashboard] 📦 Total modules: ${modules.length}`);
        console.log(`[Dashboard] ========================================`);

        if (modules.length === 0) {
            console.log(`[Dashboard] ⚠️ Tidak ada module di manifest`);
            return;
        }

        // Tampilkan per kategori
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
    // 4. TAMPILKAN STATISTIK
    // ============================================================
    function showStats() {
        const modules = getModules();
        const total = modules.length;
        const byTier = {
            dasar: 0,
            pro: 0,
            max: 0,
            undefined: 0
        };
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
    // 5. EXPOSE KE WINDOW
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
        
        // Status
        status: 'ready',
        timestamp: new Date().toISOString()
    };

    // ============================================================
    // 6. AUTO-RUN SAAT LOAD
    // ============================================================
    console.log(`[Dashboard] 🌐 Ready to manage modules!`);
    console.log(`[Dashboard] 📦 Menampilkan daftar module...`);
    listModules();
    showStats();

    console.log(`[Dashboard] 💡 Ketik JamuDashboard.listModules() untuk menampilkan ulang`);
    console.log(`[Dashboard] 💡 Ketik JamuDashboard.showStats() untuk melihat statistik`);

})();
