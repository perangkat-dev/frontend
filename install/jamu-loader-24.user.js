// ==UserScript==
// @name         Jamu Loader OK
// @namespace    http://jamu.local
// @version      2.4.0
// @match        *://*/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_log
// @grant        GM_info
// ==/UserScript==

(function() {
    'use strict';

    console.log("🚀 [Loader] Menyala dan bersiap...");

    // ============================================================
    //  KONFIGURASI
    // ============================================================
    var CONFIG = {
        STORAGE_URL: "https://onhxygwiigcmlfqveken.supabase.co/storage/v1/object/public/secure-scripts/dashboard-main.js",
        CACHE_KEY: "jamu_dashboard_script",
        CACHE_TTL: 24 *60 * 60 * 1000, // 24 jam dalam milidetik. tambah ini di depan 24 *
        VERSION: "2.4.0"
    };

    // ============================================================
    //  CACHE MANAGEMENT
    // ============================================================
    function getCachedScript() {
        try {
            var raw = localStorage.getItem(CONFIG.CACHE_KEY);
            if (!raw) return null;

            var cached = JSON.parse(raw);
            var now = Date.now();

            // Cek apakah cache masih valid (belum 24 jam)
            if (cached.timestamp && (now - cached.timestamp) < CONFIG.CACHE_TTL) {
                var ageMinutes = Math.round((now - cached.timestamp) / 60000);
                console.log("📦 [Loader] Cache dashboard script valid (usia: " + ageMinutes + " menit)");
                return cached.script;
            } else {
                var ageHours = Math.round((now - cached.timestamp) / 3600000);
                console.log("⏰ [Loader] Cache dashboard script expired (usia: " + ageHours + " jam)");
                return null;
            }
        } catch (e) {
            console.warn("[Loader] Gagal baca cache:", e);
            return null;
        }
    }

    function setCachedScript(script) {
        try {
            var cacheData = {
                script: script,
                timestamp: Date.now(),
                version: CONFIG.VERSION
            };
            localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cacheData));
            console.log("💾 [Loader] Dashboard script disimpan ke cache (24 jam)");
        } catch (e) {
            console.warn("[Loader] Gagal simpan cache:", e);
        }
    }

    function clearCache() {
        localStorage.removeItem(CONFIG.CACHE_KEY);
        console.log("🗑️ [Loader] Cache dashboard script dihapus");
    }

    // ============================================================
    //  LOAD DASHBOARD
    // ============================================================
    function loadDashboard() {
        // ✅ CEK CACHE DULU
        var cachedScript = getCachedScript();
        if (cachedScript) {
            console.log("🚀 [Loader] Menjalankan dashboard dari cache...");
            try {
                var run = new Function(cachedScript);
                run();
                console.log("✅ [Loader] Dashboard dari cache berhasil dieksekusi");
                return;
            } catch (e) {
                console.error("❌ [Loader] Gagal eksekusi dari cache:", e);
                // Jika gagal, hapus cache dan coba lagi
                clearCache();
            }
        }

        // 📡 CACHE MISS → AMBIL DARI STORAGE
        console.log("📥 [Loader] Mengambil dashboard dari Supabase Storage...");
        var url = CONFIG.STORAGE_URL + "?_t=" + new Date().getTime();

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(res) {
                if (res.status === 200) {
                    console.log("✅ [Loader] Dashboard berhasil diunduh");
                    // Simpan ke cache
                    setCachedScript(res.responseText);
                    // Eksekusi
                    try {
                        var run = new Function(res.responseText);
                        run();
                        console.log("✅ [Loader] Dashboard dari storage berhasil dieksekusi");
                    } catch (e) {
                        console.error("❌ [Loader] Gagal eksekusi dashboard:", e);
                    }
                } else {
                    console.error("❌ [Loader] Gagal unduh dashboard. Status: " + res.status);
                }
            },
            onerror: function(err) {
                console.error("❌ [Loader] Error network:", err);
            }
        });
    }

    // ============================================================
    //  JEMBATAN ANTI-CORS
    // ============================================================
    window.addEventListener("message", function(event) {
        if (event.data && event.data.type === "FROM_DASHBOARD_FETCH") {

            var SUPABASE_URL = "https://onhxygwiigcmlfqveken.supabase.co/functions/v1/verify-tier-modules";
            var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uaHh5Z3dpaWdjbWxmcXZla2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDc2MTgsImV4cCI6MjEwMjk4MzYxOH0.jACeW-4FgF_l9_LntpzoSI0StJ-VsVtvPF8ukamc54M";

            console.log("🔄 [Loader-Bridge] Meneruskan request ke Edge Function...");

            GM_xmlhttpRequest({
                method: "POST",
                url: SUPABASE_URL,
                headers: {
                    "Content-Type": "application/json",
                    "apikey": ANON_KEY,
                    "Authorization": "Bearer " + ANON_KEY
                },
                data: JSON.stringify({
                    tipe_id: event.data.tipe_id,
                    id_nilai: event.data.id_nilai
                }),
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            var parsed = JSON.parse(response.responseText);
                            window.postMessage({
                                type: "FROM_LOADER_RESPONSE",
                                response: parsed
                            }, "*");
                        } catch (e) {
                            console.error("❌ [Loader-Bridge] Gagal parse JSON:", e);
                            window.postMessage({
                                type: "FROM_LOADER_RESPONSE",
                                response: { success: false, message: "Invalid response" }
                            }, "*");
                        }
                    } else {
                        console.error("❌ [Loader-Bridge] Error: " + response.status);
                        window.postMessage({
                            type: "FROM_LOADER_RESPONSE",
                            response: { success: false, message: "Server error: " + response.status }
                        }, "*");
                    }
                }
            });
        }
    });

    // ============================================================
    //  FORCE REFRESH (untuk debugging)
    // ============================================================
    // Ketik di console: JamuLoader.refresh()
    window.JamuLoader = {
        version: CONFIG.VERSION,
        clearCache: clearCache,
        refresh: function() {
            clearCache();
            loadDashboard();
        }
    };

    // ============================================================
    //  START
    // ============================================================
    // Tunggu DOM siap, tapi jalankan secepat mungkin
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadDashboard);
    } else {
        loadDashboard();
    }

    console.log("💡 [Loader] Ketik JamuLoader.refresh() di console untuk force refresh");
    console.log("💡 [Loader] Ketik JamuLoader.clearCache() untuk hapus cache");

})();
