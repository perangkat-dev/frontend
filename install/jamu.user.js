// ==UserScript==
// @name         Jamu Loader Bootstrap
// @namespace    http://jamuloader.local
// @version      3.0.0
// @description  Bootstrap ringan untuk Jamu Loader dengan Firebase & GM_API support
// @match        *://*/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_listValues
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // 1. KONFIGURASI
    // ============================================================
    const VERSION = "3.0.0";
    const MANIFEST_URL = "https://raw.githubusercontent.com/perangkat-dev/frontend/refs/heads/main/global-manifest.json";
    const DASHBOARD_ID = "jamu-dashboard";
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyAs8xWwoDUYpt3RGCFsiuhl1wWxgkRXPps",
        authDomain: "nomor-surat-erm.firebaseapp.com",
        databaseURL: "https://nomor-surat-erm-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "nomor-surat-erm",
        storageBucket: "nomor-surat-erm.firebasestorage.app",
        messagingSenderId: "1071094616903",
        appId: "1:1071094616903:web:60cdf62c93f34a97c2f262"
    };

    // ============================================================
    // 2. LOAD MANIFEST
    // ============================================================
    async function loadManifest() {
        try {
            console.log(`[JamuLoader] 📡 Fetching manifest...`);
            const res = await fetch(MANIFEST_URL);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const manifest = await res.json();
            console.log(`[JamuLoader] ✅ Manifest loaded`);
            return manifest;
        } catch (err) {
            console.error(`[JamuLoader] ❌ Manifest failed:`, err);
            return null;
        }
    }

    // ============================================================
    // 3. LOAD FIREBASE LIBRARY (SEKALI SAJA)
    // ============================================================
    function loadFirebaseLibraries() {
        return new Promise((resolve, reject) => {
            // Cek apakah Firebase sudah ada
            if (typeof firebase !== 'undefined') {
                console.log(`[JamuLoader] ✅ Firebase already loaded`);
                resolve(true);
                return;
            }

            console.log(`[JamuLoader] 📡 Loading Firebase libraries...`);
            
            let loaded = 0;
            const checkLoaded = () => {
                loaded++;
                if (loaded >= 2) {
                    // Verifikasi Firebase benar-benar tersedia
                    if (typeof firebase !== 'undefined') {
                        console.log(`[JamuLoader] ✅ Firebase libraries loaded successfully`);
                        resolve(true);
                    } else {
                        reject(new Error('Firebase not available after loading'));
                    }
                }
            };

            const onError = (err) => {
                console.error(`[JamuLoader] ❌ Failed to load Firebase:`, err);
                reject(err);
            };

            // Load Firebase App
            const script1 = document.createElement('script');
            script1.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
            script1.onload = checkLoaded;
            script1.onerror = onError;
            document.head.appendChild(script1);

            // Load Firebase Database
            const script2 = document.createElement('script');
            script2.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js';
            script2.onload = checkLoaded;
            script2.onerror = onError;
            document.head.appendChild(script2);

            // Timeout safety
            setTimeout(() => {
                if (typeof firebase === 'undefined') {
                    reject(new Error('Firebase load timeout'));
                }
            }, 10000);
        });
    }

    // ============================================================
    // 4. INIT FIREBASE (SETELAH LIBRARY LOAD)
    // ============================================================
    function initFirebase() {
        try {
            if (typeof firebase === 'undefined') {
                console.warn('[JamuLoader] ⚠️ Firebase library not available');
                return null;
            }

            let app;
            try {
                app = firebase.app();
            } catch(e) {
                app = firebase.initializeApp(FIREBASE_CONFIG);
            }

            const db = firebase.database();
            console.log(`[JamuLoader] ✅ Firebase initialized`);
            return { app, db };
        } catch (err) {
            console.error(`[JamuLoader] ❌ Firebase init failed:`, err);
            return null;
        }
    }

    // ============================================================
    // 5. INJECT DASHBOARD
    // ============================================================
    async function loadDashboard(manifest, firebaseInstance) {
        const dashboard = manifest.modules?.find(m => m.id === DASHBOARD_ID);
        if (!dashboard) {
            console.error(`[JamuLoader] ❌ Dashboard "${DASHBOARD_ID}" not found`);
            return;
        }

        console.log(`[JamuLoader] 📡 Fetching dashboard...`);

        try {
            const res = await fetch(dashboard.scriptUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const code = await res.text();
            console.log(`[JamuLoader] ✅ Dashboard loaded (${code.length} chars)`);

            // Inject dashboard dengan GM_API dan Firebase instance
            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    try {
                        // ===== GM_API SHIM (agar module bisa pakai GM_*) =====
                        if (typeof GM_setValue === 'undefined') {
                            window.GM_setValue = function(key, value) {
                                try {
                                    localStorage.setItem('GM_' + key, JSON.stringify(value));
                                    console.log('[GM_API] setValue:', key);
                                } catch(e) {
                                    console.warn('[GM_API] setValue error:', e);
                                }
                            };
                            
                            window.GM_getValue = function(key, defaultValue) {
                                try {
                                    const val = localStorage.getItem('GM_' + key);
                                    return val ? JSON.parse(val) : defaultValue;
                                } catch(e) {
                                    return defaultValue;
                                }
                            };
                            
                            window.GM_deleteValue = function(key) {
                                try {
                                    localStorage.removeItem('GM_' + key);
                                } catch(e) {}
                            };
                            
                            window.GM_listValues = function() {
                                try {
                                    const keys = [];
                                    for (let i = 0; i < localStorage.length; i++) {
                                        const key = localStorage.key(i);
                                        if (key && key.startsWith('GM_')) {
                                            keys.push(key.substring(3));
                                        }
                                    }
                                    return keys;
                                } catch(e) { return []; }
                            };
                            
                            window.GM_addStyle = function(css) {
                                try {
                                    const style = document.createElement('style');
                                    style.textContent = css;
                                    document.head.appendChild(style);
                                } catch(e) {}
                            };
                            
                            console.log('[JamuLoader] ✅ GM_API Shim installed');
                        }

                        // ===== FIREBASE INSTANCE UNTUK MODULE =====
                        window.__JAMU_FIREBASE__ = ${JSON.stringify(firebaseInstance)};
                        
                        // ===== MANIFEST & VERSION =====
                        window.__JAMU_MANIFEST__ = ${JSON.stringify(manifest)};
                        window.__JAMU_VERSION__ = "${VERSION}";
                        
                        // ===== EXECUTE DASHBOARD =====
                        ${code}
                    } catch (err) {
                        console.error('[JamuLoader] ❌ Dashboard error:', err);
                    }
                })();
            `;
            (document.head || document.documentElement).appendChild(script);
            script.remove();

            console.log(`[JamuLoader] ✅ Dashboard injected`);

        } catch (err) {
            console.error(`[JamuLoader] ❌ Dashboard failed:`, err);
        }
    }

    // ============================================================
    // 6. START
    // ============================================================
    async function init() {
        console.log(`[JamuLoader] 🚀 Bootstrap v${VERSION} starting...`);
        
        try {
            // 1. Load manifest
            const manifest = await loadManifest();
            if (!manifest) {
                console.error('[JamuLoader] ❌ Cannot continue without manifest');
                return;
            }

            // 2. Load Firebase library (untuk semua module yang butuh)
            await loadFirebaseLibraries();
            
            // 3. Init Firebase
            const firebaseInstance = initFirebase();
            
            // 4. Load Dashboard (dengan Firebase instance)
            await loadDashboard(manifest, firebaseInstance);
            
        } catch (err) {
            console.error('[JamuLoader] ❌ Initialization failed:', err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();