// ==UserScript==
// @name         Jamu Loader
// @namespace    http://jamuloader.local
// @version      1.0
// @description  Meredakan Pegal
// @match        https://*.epuskesmas.id/*
// @match        https://*.kemkes.go.id/* 
// @match        https://*.bpjs-kesehatan.go.id/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // 1. KONFIGURASI & CONSTANTS
    // ============================================================
    const EXTENSION_VERSION = "1.0";
    const DEFAULT_CHECK_INTERVAL = 60 * 60 * 1000;
    const DEFAULT_MANIFEST_URL = "https://perangkat-dev.github.io/frontend/global-manifest.json";
    const WHITELIST_URL = "https://perangkat-dev.github.io/frontend/whitelist.json";

    const WHITELIST_CONFIG = {
        CACHE_KEY: "jamu_whitelist_cache",
        CACHE_DURATION: 5 * 60 * 1000,
        MAX_RETRIES: 2,
        RETRY_DELAY: 1000,
        PRE_FETCH_DELAY: 500
    };

    const DEBUG_MODE = localStorage.getItem('jamu_debug') === 'true';

    const CATEGORIES = [
        { value: "all", label: "Semua", icon: "🎯" },
        { value: "skrining", label: "Skrining", icon: "📋" },
        { value: "tools", label: "Tools", icon: "🔧" },
        { value: "dashboard", label: "Dashboard", icon: "📊" },
        { value: "laporan", label: "Laporan", icon: "📄" },
        { value: "administrasi", label: "Administrasi", icon: "📁" },
        { value: "lainnya", label: "Lainnya", icon: "📦" }
    ];

    const TIERS = {
    dasar: { label: "Dasar", color: "#34d399", bg: "rgba(52, 211, 153, 0.12)" },
    pro: { label: "Pro", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)" },
    max: { label: "Max", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)" }
    };

    function getCategoryLabel(catValue) {
        const found = CATEGORIES.find(c => c.value === catValue);
        return found ? found.label : catValue || "Lainnya";
    }

    function getCategoryColor(catValue) {
        const colors = {
            skrining: { bg: "#34d399", text: "#34d399", border: "rgba(52, 211, 153, 0.3)" },
            tools: { bg: "#00d4aa", text: "#00d4aa", border: "rgba(0, 212, 170, 0.3)" },
            dashboard: { bg: "#3b82f6", text: "#3b82f6", border: "rgba(59, 130, 246, 0.3)" },
            laporan: { bg: "#f59e0b", text: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" },
            administrasi: { bg: "#8b5cf6", text: "#8b5cf6", border: "rgba(139, 92, 246, 0.3)" },
            lainnya: { bg: "#64748b", text: "#64748b", border: "rgba(100, 116, 139, 0.3)" }
        };
        return colors[catValue] || colors.lainnya;
    }

    function getTierInfo(tier) {
        return TIERS[tier] || TIERS.dasar;
    }

    function log(...args) { console.log("[JamuLoader]", ...args); }
    function debug(...args) { if (DEBUG_MODE) console.log("[JamuLoader DEBUG]", ...args); }
    function warn(...args) { console.warn("[JamuLoader]", ...args); }
    function error(...args) { console.error("[JamuLoader]", ...args); }

    let TRACKING_ENDPOINT = "";
    let TRACKING_KEY = "";
    let isUIOpen = false;
    let whitelistCache = null;
    let whitelistCacheTimestamp = 0;
    let whitelistFetchPromise = null;
    let whitelistUrl = null;

    // ============================================================
    // 2. STORAGE WRAPPER
    // ============================================================
    const JamuStorage = {
        async get(keys) {
            const result = {};
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach(key => {
                const val = localStorage.getItem(`jamu_${key}`);
                result[key] = val ? JSON.parse(val) : null;
            });
            return result;
        },
        async set(obj) {
            for (const [key, value] of Object.entries(obj)) {
                localStorage.setItem(`jamu_${key}`, JSON.stringify(value));
            }
        }
    };

    // ============================================================
    // 3. IDENTIFIER SERVICE (MULTI-WEBSITE)
    // ============================================================
    const IdentifierService = {
        getDomain() {
            const url = window.location.href;
            const skipDomains = ['form.kemkes.go.id', 'skrining.kemkes.go.id', 'survey.kemkes.go.id'];
            for (const domain of skipDomains) {
                if (url.includes(domain)) {
                    return 'skipped';
                }
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
    // 4. WHITELIST SERVICE
    // ============================================================
    const WhitelistService = {
        async getWhitelist(forceRefresh = false) {
            console.log(`[JamuLoader] 🔍 getWhitelist called, forceRefresh: ${forceRefresh}`);
            if (!forceRefresh && whitelistCache && Array.isArray(whitelistCache)) {
                const age = Date.now() - whitelistCacheTimestamp;
                if (age < WHITELIST_CONFIG.CACHE_DURATION) {
                    return whitelistCache;
                }
            }
            if (!forceRefresh) {
                const cached = await this.getCachedWhitelist();
                if (cached) {
                    whitelistCache = cached;
                    whitelistCacheTimestamp = Date.now();
                    return cached;
                }
            }
            if (whitelistFetchPromise) {
                return await whitelistFetchPromise;
            }
            whitelistFetchPromise = this.fetchWhitelistWithRetry();
            try {
                const data = await whitelistFetchPromise;
                return data;
            } finally {
                whitelistFetchPromise = null;
            }
        },

      async fetchWhitelistWithRetry() {
    // 🔥 PASTIKAN URL ADALAH STRING
    let url = typeof whitelistUrl === 'string' ? whitelistUrl : WHITELIST_URL;
    console.log(`[JamuLoader] 🔍 fetchWhitelistWithRetry: url = ${url}`);

    if (!url) {
        console.warn(`[JamuLoader] ⚠️ URL whitelist kosong!`);
        return [];
    }

    for (let attempt = 1; attempt <= WHITELIST_CONFIG.MAX_RETRIES; attempt++) {
        try {
            console.log(`[JamuLoader] 🔍 Attempt ${attempt} fetching whitelist from: ${url}`);
            const res = await fetchWithTimeout(url, 5000);
            console.log(`[JamuLoader] 🔍 Response status: ${res.status}`);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            console.log(`[JamuLoader] 🔍 Whitelist data:`, data);

            const list = Array.isArray(data) ? data : [];
            whitelistCache = list;
            whitelistCacheTimestamp = Date.now();
            await this.setCachedWhitelist(list);
            return list;
        } catch (err) {
            console.warn(`[JamuLoader] ⚠️ Attempt ${attempt} failed:`, err.message);
            if (attempt < WHITELIST_CONFIG.MAX_RETRIES) {
                await new Promise(r => setTimeout(r, WHITELIST_CONFIG.RETRY_DELAY * attempt));
            }
        }
    }

    console.warn(`[JamuLoader] ⚠️ Semua attempt gagal, mencoba cache...`);
    const cached = await this.getCachedWhitelist();
    if (cached) {
        whitelistCache = cached;
        whitelistCacheTimestamp = Date.now();
        console.log(`[JamuLoader] ✅ Whitelist dari cache:`, cached);
        return cached;
    }

    console.warn(`[JamuLoader] ❌ Tidak ada whitelist (cache kosong)`);
    return [];
},

        async getCachedWhitelist() {
            try {
                const raw = localStorage.getItem(WHITELIST_CONFIG.CACHE_KEY);
                if (!raw) return null;
                const { data, timestamp } = JSON.parse(raw);
                if (Date.now() - timestamp > WHITELIST_CONFIG.CACHE_DURATION) return null;
                return data;
            } catch (e) { return null; }
        },

        async setCachedWhitelist(data) {
            try {
                localStorage.setItem(WHITELIST_CONFIG.CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
            } catch (e) {}
        },

        async preFetchWhitelist(url) {
            whitelistUrl = url;
            if (!url) return;
            const cached = await this.getCachedWhitelist();
            if (cached) {
                whitelistCache = cached;
                whitelistCacheTimestamp = Date.now();
                return;
            }
            this.getWhitelist(true).catch(() => {});
        },

        async refresh() {
            whitelistFetchPromise = null;
            return await this.getWhitelist(true);
        },

        clearCache() {
            localStorage.removeItem(WHITELIST_CONFIG.CACHE_KEY);
            whitelistCache = null;
            whitelistCacheTimestamp = 0;
        }
    };

    // ============================================================
    // 5. CORE LOGIC
    // ============================================================
    async function fetchWithTimeout(url, timeoutMs = 10000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
        } finally { clearTimeout(timer); }
    }

    async function refreshDefaultManifest() {
        try {
            const res = await fetchWithTimeout(DEFAULT_MANIFEST_URL);
            const manifest = await res.json();
            await JamuStorage.set({ cachedManifest: manifest, lastManifestFetch: Date.now(), lastManifestError: false });
            loadConfigFromManifest(manifest);
            await checkMinVersion(manifest);
            await checkForUpdates(manifest);
            if (manifest.whitelist?.url) {
                setTimeout(() => {
                    WhitelistService.preFetchWhitelist(manifest.whitelist.url);
                }, WHITELIST_CONFIG.PRE_FETCH_DELAY);
            }
            return manifest;
        } catch (err) {
            await JamuStorage.set({ lastManifestError: true });
            warn("Manifest fetch failed:", err.message);
            return null;
        }
    }

    async function refreshCustomManifest() {
        const { manifestUrl, customManifestEnabled } = await JamuStorage.get(["manifestUrl", "customManifestEnabled"]);
        if (!manifestUrl || customManifestEnabled === false) return null;
        try {
            const res = await fetchWithTimeout(manifestUrl);
            const manifest = await res.json();
            await JamuStorage.set({ cachedCustomManifest: manifest });
            return manifest;
        } catch (err) {
            warn("Custom manifest fetch failed:", err.message);
            return null;
        }
    }

    function loadConfigFromManifest(manifest) {
        if (manifest.tracking?.endpoint) { TRACKING_ENDPOINT = manifest.tracking.endpoint; TRACKING_KEY = manifest.tracking.key || ""; }
        else { TRACKING_ENDPOINT = ""; TRACKING_KEY = ""; }
        if (manifest.whitelist?.url) { whitelistUrl = manifest.whitelist.url; }
    }

    function versionLessThan(a, b) {
        const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0, nb = pb[i] || 0;
            if (na < nb) return true; if (na > nb) return false;
        }
        return false;
    }

    async function checkMinVersion(manifest) {
        if (!manifest.minExtensionVersion) { await JamuStorage.set({ versionBlocked: false, versionRequired: null }); return; }
        const required = manifest.minExtensionVersion;
        if (versionLessThan(EXTENSION_VERSION, required)) {
            await JamuStorage.set({ versionBlocked: true, versionRequired: required });
            showToast(`⚠️ Versi Jamu Loader (${EXTENSION_VERSION}) terlalu lama. Diperlukan: ${required}`, "error");
        } else {
            await JamuStorage.set({ versionBlocked: false, versionRequired: required });
        }
    }

    async function checkForUpdates(manifest) {
        const storageData = await JamuStorage.get(["installedVersions", "moduleStates"]);
        const installedVersions = storageData.installedVersions || {};
        const moduleStates = storageData.moduleStates || {};
        const modules = manifest.modules || [];
        const updatesFound = [];
        let moduleStatesChanged = false;
        for (const mod of modules) {
            const installed = installedVersions[mod.id];
            if (installed === undefined) {
                installedVersions[mod.id] = mod.version;
                if (mod.defaultEnabled === false) {
                    moduleStates[mod.id] = false;
                    moduleStatesChanged = true;
                }
            } else if (installed !== mod.version) {
                updatesFound.push(mod);
            }
        }
        await JamuStorage.set({ installedVersions });
        if (moduleStatesChanged) {
            await JamuStorage.set({ moduleStates });
        }
        const { pendingUpdates: existing = [] } = await JamuStorage.get(["pendingUpdates"]);
        const merged = [...new Set([...(existing || []), ...updatesFound.map((m) => m.id)])];
        await JamuStorage.set({ pendingUpdates: merged });
        if (updatesFound.length > 0) showToast(`🔄 ${updatesFound.length} modul memiliki pembaruan`, "info");
    }

    async function getModuleScript(mod) {
        const cached = await JamuStorage.get([`script_${mod.id}`]);
        const cachedData = cached[`script_${mod.id}`];
        if (cachedData && cachedData.version === mod.version) return cachedData.code;
        const res = await fetchWithTimeout(mod.scriptUrl);
        const code = await res.text();
        await JamuStorage.set({ [`script_${mod.id}`]: { code, version: mod.version, fetchedAt: Date.now() } });
        return code;
    }

    function todayDate() { return new Date().toISOString().slice(0, 10); }
    async function shouldTrack(moduleId, username) {
        if (!TRACKING_ENDPOINT) return false;
        const { trackingLog = {} } = await JamuStorage.get(["trackingLog"]);
        return trackingLog[`${moduleId}::${username}`] !== todayDate();
    }
    async function markTracked(moduleId, username) {
        const { trackingLog = {} } = await JamuStorage.get(["trackingLog"]);
        trackingLog[`${moduleId}::${username}`] = todayDate();
        await JamuStorage.set({ trackingLog });
    }
    async function sendTracking(moduleId, moduleName, tabUrl, username, hostname) {
        if (!TRACKING_ENDPOINT) return;
        try {
            await fetch(TRACKING_ENDPOINT, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: TRACKING_KEY, timestamp: Date.now(), moduleId, moduleName, url: tabUrl, username, hostname })
            });
        } catch (err) { warn("Tracking failed:", err.message); }
    }

    function matchUrlPattern(pattern, url) {
        if (pattern === "<all_urls>" || pattern === "") return true;
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
        try { return new RegExp(`^${escaped}$`).test(url); } catch { return url.includes(pattern); }
    }

    function isDomainMatch(pattern, currentUrl) {
        if (!pattern || !currentUrl) return false;
        if (pattern === "<all_urls>" || pattern === "") return true;
        try {
            const url = new URL(currentUrl);
            const currentDomain = url.hostname.replace(/^www\./, '');
            let patternDomain = pattern.replace(/^https?:\/\//, '').split('/')[0];
            patternDomain = patternDomain.replace(/^\*\./, '').replace(/^www\./, '');
            if (pattern.includes('*.')) {
                return currentDomain.endsWith(patternDomain) || currentDomain === patternDomain;
            }
            return currentDomain === patternDomain || currentDomain.endsWith('.' + patternDomain);
        } catch {
            return false;
        }
    }

    function isEpuskesmasModule(mod) {
        return (mod.matches || []).some(p => p.includes("epuskesmas.id"));
    }

    // ============================================================
    // 6. SETUP ASIK INTERCEPTOR
    // ============================================================
    function setupAsikInterceptor() {
        if (!window.location.href.includes('sehatindonesiaku') && !window.location.href.includes('asik.kemkes.go.id')) return;
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            if (typeof url === 'string' && (url.includes('/user-management/me') || url.includes('/me') || url.includes('/api/user'))) {
                return originalFetch.apply(this, args).then(async (response) => {
                    const cloned = response.clone();
                    try {
                        const data = await cloned.json();
                        let kodeSarana = null;
                        if (data?.data?.kode_sarana) {
                            kodeSarana = data.data.kode_sarana;
                        } else if (data?.kode_sarana) {
                            kodeSarana = data.kode_sarana;
                        }
                        if (kodeSarana) {
                            window.__asikData = { kode_sarana };
                            debug(`✅ ASIK data captured:`, kodeSarana);
                        }
                    } catch (e) {}
                    return response;
                });
            }
            return originalFetch.apply(this, args);
        };
    }

    // ============================================================
    // 7. VALIDASI AKSES
    // ============================================================
   async function validateAccess() {
    const info = IdentifierService.getCurrentIdentifier();
    console.log(`[JamuLoader] 🔍 STEP 1: Info:`, info);
    debug(`🔍 Domain: ${info.domain}, Identifier: ${info.identifier}, Source: ${info.source}`);

    if (info.domain === 'skipped') {
        debug(`⏭️ Domain dilewati (skip validation): ${window.location.href}`);
        return { allowed: true, reason: 'Skipped domain', data: info, skipValidation: true, tier: 'all' };
    }

    if (info.domain === 'other') {
        debug(`⚠️ Domain tidak dikenali, mengizinkan akses`);
        return { allowed: true, reason: 'Unknown domain', data: info, tier: 'all' };
    }

    if (!info.identifier) {
        debug(`❌ Identifier tidak ditemukan`);
        return { allowed: false, reason: 'No identifier found', data: info };
    }

    try {
        const whitelist = await WhitelistService.getWhitelist();
        console.log(`[JamuLoader] 🔍 STEP 2: Whitelist:`, whitelist);
        debug(`📋 Whitelist length: ${whitelist?.length || 0}`);

        if (!whitelist || !Array.isArray(whitelist) || whitelist.length === 0) {
            debug(`⚠️ Whitelist kosong, mengizinkan akses (fallback)`);
            return { allowed: true, reason: 'Whitelist empty (fallback)', data: info, tier: 'all' };
        }

        // 🔥 CARI PUSKESMAS DI WHITELIST
        const matchedItem = whitelist.find(item => {
            const ids = item.identifiers || {};
            return Object.values(ids).some(
                val => val && val.toLowerCase().trim() === info.identifier.toLowerCase().trim()
            );
        });

        console.log(`[JamuLoader] 🔍 STEP 3: matchedItem:`, matchedItem);

        if (!matchedItem) {
            debug(`❌ Identifier tidak terdaftar di whitelist`);
            return { allowed: false, reason: 'Not in whitelist', data: info };
        }

        // 🔥 AMBIL TIER DARI WHITELIST
        const userTier = matchedItem.tier || 'dasar';
        const isActive = matchedItem.active !== false;

        console.log(`[JamuLoader] 📋 Puskesmas: ${matchedItem.id} | Active: ${isActive} | Tier: ${userTier}`);

        if (isActive) {
            console.log(`[JamuLoader] 🟢 Puskesmas ACTIVE (${info.identifier}) → tier: ${userTier}`);
            return {
                allowed: true,
                reason: `Active - tier: ${userTier}`,
                data: info,
                tier: userTier,
                puskesmas: matchedItem
            };
        } else {
            // Inactive → forced dasar
            console.log(`[JamuLoader] 🟡 Puskesmas INACTIVE (${info.identifier}) → tier: dasar (forced)`);
            return {
                allowed: true,
                reason: 'Inactive - only dasar modules allowed',
                data: info,
                tier: 'dasar',
                puskesmas: matchedItem
            };
        }

    } catch (e) {
        console.error(`[JamuLoader] ⚠️ Gagal validasi whitelist:`, e);
        return { allowed: true, reason: 'Whitelist error (fallback)', data: info, tier: 'all' };
    }
}

    // ============================================================
    // 8. INJEKSI MODUL (DENGAN DEPENDENCIES & TIER)
    // ============================================================
    async function injectModulesIntoPage() {
        const storageData = await JamuStorage.get([
            "versionBlocked", "cachedManifest", "cachedCustomManifest",
            "customManifestEnabled", "moduleStates"
        ]);

        const versionBlocked = storageData.versionBlocked || false;
        const cachedManifest = storageData.cachedManifest;
        const cachedCustomManifest = storageData.cachedCustomManifest;
        const customManifestEnabled = storageData.customManifestEnabled !== false;
        const moduleStates = storageData.moduleStates || {};

        if (versionBlocked || !cachedManifest) return;

        const validation = await validateAccess();
if (validation.skipValidation) {
    debug(`⏭️ Skip validation mode: tetap inject module`);
} else if (!validation.allowed) {
    warn(`⛔ Akses ditolak: ${validation.reason}`);
    showToast(`⛔ Akses ditolak: ${validation.reason}`, "error");
    return;
}

debug(`✅ Akses diizinkan: ${validation.reason}`);
// 🔥 TAMBAHKAN: Pastikan validation.tier tidak 'all'
console.log(`[JamuLoader] 🔍 validation.tier setelah validateAccess(): ${validation.tier}`);

        debug(`✅ Akses diizinkan: ${validation.reason}`);

        const defaultModules = cachedManifest.modules || [];
        const customModules = (customManifestEnabled !== false && cachedCustomManifest) ? (cachedCustomManifest.modules || []) : [];
        const defaultIds = new Set(defaultModules.map(m => m.id));
        const allModules = [...defaultModules, ...customModules.filter(m => !defaultIds.has(m.id))];
        const currentUrl = window.location.href;

        const whitelistUrl = cachedManifest.whitelist?.url || null;
        if (whitelistUrl && !whitelistCache) {
            const cached = await WhitelistService.getCachedWhitelist();
            if (cached) {
                whitelistCache = cached;
                whitelistCacheTimestamp = Date.now();
            } else {
                WhitelistService.preFetchWhitelist(whitelistUrl);
            }
        }

        console.log(`[JamuLoader] ========================================`);
        console.log(`[JamuLoader] 📋 START INJECTING MODULES`);
        console.log(`[JamuLoader] 📌 Validation tier: ${validation.tier || 'undefined'}`);
        console.log(`[JamuLoader] 📌 Total modules: ${allModules.length}`);
        console.log(`[JamuLoader] ========================================`);

        for (const mod of allModules) {
            console.log(`[JamuLoader] 📦 Module: ${mod.id} | Tier: ${mod.tier || 'undefined'} | Enabled: ${moduleStates[mod.id] !== false}`);

            if (moduleStates[mod.id] === false) {
                console.log(`[JamuLoader] ⏭️ Module ${mod.id} disabled by user`);
                continue;
            }

            const shouldInject = (mod.matches || []).some((p) => matchUrlPattern(p, currentUrl));
            if (!shouldInject) {
                console.log(`[JamuLoader] ⏭️ Module ${mod.id} URL mismatch: ${currentUrl}`);
                continue;
            }

           // 🔥 FILTER TIER - BANDINGKAN DENGAN USER TIER
const userTier = validation.tier || 'dasar';
console.log(`[JamuLoader] 🔍 User Tier yang digunakan: ${userTier}`);

if (userTier === 'all') {
    // Jika tier 'all', izinkan SEMUA module (fallback/domain lain)
    console.log(`[JamuLoader] ✅ ALLOWED: ${mod.id} (${mod.tier || 'dasar'}) - Tier: all`);
} else if (userTier === 'dasar') {
    if (mod.tier && mod.tier !== 'dasar') {
        console.log(`[JamuLoader] ❌ BLOCKED: ${mod.id} (${mod.tier}) - User tier: dasar`);
        continue;
    } else {
        console.log(`[JamuLoader] ✅ ALLOWED: ${mod.id} (${mod.tier || 'dasar'}) - User tier: dasar`);
    }
} else if (userTier === 'pro') {
    // 🔥 Perbaikan: tambahkan 'free' ke daftar yang diizinkan
    if (mod.tier && mod.tier !== 'free' && mod.tier !== 'dasar' && mod.tier !== 'pro') {
        console.log(`[JamuLoader] ❌ BLOCKED: ${mod.id} (${mod.tier}) - User tier: pro`);
        continue;
    } else {
        console.log(`[JamuLoader] ✅ ALLOWED: ${mod.id} (${mod.tier || 'dasar'}) - User tier: pro`);
    }
} else if (userTier === 'max') {
    console.log(`[JamuLoader] ✅ ALLOWED: ${mod.id} (${mod.tier || 'dasar'}) - User tier: max`);
} else {
    // Fallback
    console.log(`[JamuLoader] ✅ ALLOWED: ${mod.id} (${mod.tier || 'dasar'}) - Fallback`);
}

                // ===== CEK DEPENDENCIES =====
                if (mod.dependencies && mod.dependencies.length > 0) {
                    let allDepsLoaded = true;
                    let missingDeps = [];
                    for (const depId of mod.dependencies) {
                        const depExists = allModules.some(m => m.id === depId);
                        if (!depExists) { missingDeps.push(depId); allDepsLoaded = false; continue; }
                        if (moduleStates[depId] === false) { missingDeps.push(depId); allDepsLoaded = false; }
                    }
                    if (!allDepsLoaded) {
                        warn(`⏳ Dependency belum siap untuk ${mod.id}: ${missingDeps.join(', ')}. Skipping.`);
                        continue;
                    }
                }

           // ===== VALIDASI PER-MODUL (Gunakan hasil dari validateAccess) =====
if (!validation.skipValidation && isEpuskesmasModule(mod) && whitelistUrl) {
    // 🔥 CUKUP PAKAI validation.allowed
    if (!validation.allowed) {
        warn(`⛔ Akses ditolak oleh validasi global. Blocking ${mod.id}.`);
        continue;
        }

    }
            // ===== INJECT MODULE =====
            console.log(`[JamuLoader] 🚀 INJECTING: ${mod.id} (tier: ${mod.tier || 'dasar'})`);
            log(`Injecting: ${mod.id}`);
            try {
                const code = await getModuleScript(mod);
                const meta = {
                    id: mod.id,
                    version: mod.version,
                    name: mod.name,
                    category: mod.category || "lainnya",
                    description: mod.description || "",
                    tier: mod.tier || "dasar"
                };

                const script = document.createElement("script");
                script.textContent = `(function() {
                    try {
                        window.__meta__ = ${JSON.stringify(meta)};
                        var meta = window.__meta__;
                        ${code}
                        console.log(\`[JamuLoader] ✅ \${meta.id} executed\`);
                    } catch (err) {
                        console.error(\`[JamuLoader] ❌ Error in \${meta.id}:\`, err);
                    }
                })();`;
                (document.head || document.documentElement).appendChild(script);
                script.remove();

                if (TRACKING_ENDPOINT) {
                    const info = IdentifierService.getCurrentIdentifier();
                    const username = info.identifier || "-";
                    const hostname = new URL(currentUrl).hostname;
                    if (await shouldTrack(mod.id, username)) {
                        await sendTracking(mod.id, mod.name, currentUrl, username, hostname);
                        await markTracked(mod.id, username);
                    }
                }
            } catch (err) {
                console.error(`[JamuLoader] Failed to prepare injection for ${mod.id}:`, err);
            }
        }
        console.log(`[JamuLoader] ========================================`);
        console.log(`[JamuLoader] 🏁 FINISH INJECTING MODULES`);
        console.log(`[JamuLoader] ========================================`);
    }

    // ============================================================
    // 9. UI OVERLAY (DENGAN DESCRIPTION & TIER)
    // ============================================================
    let currentFilter = "all";
    let searchQuery = "";
    let uiState = {
        modules: [],
        moduleStates: {},
        pendingUpdates: [],
        lastManifestFetch: null,
        manifestUrl: "",
        currentTabUrl: window.location.href,
        versionBlocked: false,
        versionRequired: null,
        customManifestEnabled: true,
        hasCustomManifest: false,
        lastManifestError: false
    };

    let toastTimer = null;
    let shadowRoot = null;

    function showToast(msg, type = "success") {
        const toastEl = shadowRoot?.getElementById("jamu-toast");
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.className = `toast show ${type}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 2200);
    }

    function matchUrlPatternList(patterns, currentUrl) {
        if (!currentUrl || !patterns?.length) return false;
        return patterns.some(p => {
            if (p === "<all_urls>" || p === "") return true;
            const escaped = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
            try { return new RegExp(`^${escaped}$`).test(currentUrl); } catch { return currentUrl.includes(p); }
        });
    }

    function renderModuleList() {
    const { modules, moduleStates, pendingUpdates, versionBlocked, currentTabUrl } = uiState;
    const listEl = shadowRoot?.getElementById("module-list");
    if (!listEl) return;

    let currentDomain = '';
    try {
        const url = new URL(currentTabUrl);
        currentDomain = url.hostname.replace(/^www\./, '');
    } catch {
        currentDomain = '';
    }

    let domainFilteredModules = modules.filter(mod => {
        if (!mod.matches || mod.matches.length === 0) return false;
        return mod.matches.some(pattern => isDomainMatch(pattern, currentTabUrl));
    });

    let filteredModules = [...domainFilteredModules];

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filteredModules = filteredModules.filter(mod =>
            (mod.name || mod.id).toLowerCase().includes(q) ||
            (mod.version || "").toLowerCase().includes(q) ||
            (mod.description || "").toLowerCase().includes(q) ||
            (mod.matches || []).join(" ").toLowerCase().includes(q)
        );
    }

    if (currentFilter !== "all") {
        filteredModules = filteredModules.filter(mod => mod.category === currentFilter);
    }

    const moduleCountEl = shadowRoot?.getElementById("module-count");
    if (moduleCountEl) {
        moduleCountEl.textContent = domainFilteredModules.length > 0
            ? `${domainFilteredModules.length} module${domainFilteredModules.length !== 1 ? "s" : ""} for ${currentDomain}`
            : `No modules for ${currentDomain}`;
    }

    const statusUrlEl = shadowRoot?.getElementById("current-url");
    if (statusUrlEl) {
        statusUrlEl.textContent = currentDomain || '-';
    }

    const activeOnTab = domainFilteredModules.filter(
        (m) => moduleStates[m.id] !== false && matchUrlPatternList(m.matches, currentTabUrl)
    );

    const statusActiveEl = shadowRoot?.getElementById("active-count");
    if (statusActiveEl) {
        // 🔥 Tampilkan user tier di status bar
        const userTier = uiState.userTier || 'dasar';
        const tierInfo = getTierInfo(userTier);
        const tierLabel = tierInfo.label || 'Dasar';
        const activeCount = activeOnTab.length > 0 ? `${activeOnTab.length} active` : "";
        statusActiveEl.textContent = `${activeCount} ${activeCount ? '|' : ''} Tier: ${tierLabel}`;
    }

    listEl.innerHTML = "";

    if (domainFilteredModules.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🌐</div>
                <p>No modules for <strong>${currentDomain || 'this domain'}</strong></p>
                <p class="empty-sub">Modules are filtered by domain match</p>
            </div>
        `;
        return;
    }

    if (filteredModules.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p>No modules match your search</p>
                <p class="empty-sub">Try different keywords or category</p>
            </div>
        `;
        return;
    }

    filteredModules.forEach(mod => {
        const enabled = moduleStates[mod.id] !== false;
        const hasUpdate = pendingUpdates.includes(mod.id);
        const tierInfo = getTierInfo(mod.tier);
        const card = document.createElement("div");
        card.className = `module-card ${enabled ? "enabled" : ""} ${hasUpdate ? "has-update" : ""} ${versionBlocked ? "version-blocked" : ""}`;

        const matchLabel = mod.matches?.length > 0 ?
            (mod.matches.length === 1 ?
                mod.matches[0].replace("https://", "").replace("http://", "").substring(0, 35) :
                `${mod.matches.length} URLs`
            ) : "All pages";

        const categoryColor = getCategoryColor(mod.category);
        const categoryLabel = getCategoryLabel(mod.category);

        card.innerHTML = `
            <div class="module-icon" style="background: ${categoryColor.bg}15; border-color: ${categoryColor.border};">${mod.icon || "◈"}</div>
            <div class="module-body">
                <div class="module-name" title="${mod.name || mod.id}">${mod.name || mod.id}</div>
                ${mod.description ? `<div class="module-desc" style="font-size:10px;color:var(--text3);margin-top:2px;">${mod.description}</div>` : ''}
                <div class="module-meta">
                    <span class="module-version ${hasUpdate ? "has-update" : ""}" title="${hasUpdate ? "Update available" : "Current version"}">v${mod.version}${hasUpdate ? " ↑" : ""}</span>
                    <span class="category-badge" style="background: ${categoryColor.bg}15; color: ${categoryColor.text}; border-color: ${categoryColor.border}">${categoryLabel}</span>
                    ${mod.tier ? `<span class="badge" style="background: ${tierInfo.bg}; color: ${tierInfo.color};">${tierInfo.label}</span>` : ''}
                    <span class="module-matches" title="${mod.matches?.join(', ') || 'All pages'}">${matchLabel}</span>
                </div>
            </div>
            <div class="module-actions">
                ${hasUpdate ? `<button class="update-module-btn" data-id="${mod.id}">UPDATE</button>` : ""}
                <label class="toggle">
                    <input type="checkbox" ${enabled ? "checked" : ""} data-id="${mod.id}" />
                    <span class="toggle-track"></span>
                </label>
            </div>
        `;

        card.querySelector(".toggle input").addEventListener("change", async (e) => {
            uiState.moduleStates[mod.id] = e.target.checked;
            await JamuStorage.set({ moduleStates: uiState.moduleStates });
            showToast(`✓ ${mod.name || mod.id} ${e.target.checked ? 'enabled' : 'disabled'}`, "success");
            renderModuleList();
            injectModulesIntoPage();
        });

        const updateBtn = card.querySelector(".update-module-btn");
        if (updateBtn) {
            updateBtn.addEventListener("click", async () => {
                updateBtn.textContent = "...";
                updateBtn.disabled = true;
                try {
                    await JamuStorage.set({ [`script_${mod.id}`]: null });
                    await getModuleScript(mod);
                    uiState.pendingUpdates = uiState.pendingUpdates.filter(id => id !== mod.id);
                    await JamuStorage.set({ pendingUpdates: uiState.pendingUpdates });
                    showToast(`✓ ${mod.name || mod.id} updated`, "success");
                    renderModuleList();
                    injectModulesIntoPage();
                } catch {
                    showToast("Update failed", "error");
                    updateBtn.textContent = "UPDATE";
                    updateBtn.disabled = false;
                }
            });
        }
        listEl.appendChild(card);
    });
}

    function renderDropdownMenu() {
        const menu = shadowRoot?.getElementById("dropdown-menu");
        if (!menu) return;
        menu.innerHTML = "";
        CATEGORIES.forEach(cat => {
            const isActive = currentFilter === cat.value;
            const item = document.createElement("div");
            item.className = `dropdown-item ${isActive ? "active" : ""}`;
            item.innerHTML = `<span class="item-icon">${cat.icon}</span><span>${cat.label}</span>`;
            item.onclick = () => {
                currentFilter = cat.value;
                const selectedSpan = shadowRoot?.getElementById("dropdown-selected");
                if (selectedSpan) selectedSpan.textContent = cat.label;
                renderDropdownMenu();
                renderModuleList();
            };
            menu.appendChild(item);
        });
    }

   async function loadUIState() {
    const { cachedManifest, moduleStates = {}, pendingUpdates = [], lastManifestFetch, manifestUrl, versionBlocked, versionRequired, customManifestEnabled = true, cachedCustomManifest, lastManifestError = false } = await JamuStorage.get([
        "cachedManifest", "moduleStates", "pendingUpdates", "lastManifestFetch", "manifestUrl", "versionBlocked", "versionRequired", "customManifestEnabled", "cachedCustomManifest", "lastManifestError"
    ]);
    uiState.modules = cachedManifest?.modules || [];
    uiState.moduleStates = moduleStates || {};
    uiState.pendingUpdates = pendingUpdates || [];
    uiState.lastManifestFetch = lastManifestFetch;
    uiState.manifestUrl = manifestUrl || "";
    uiState.currentTabUrl = window.location.href;
    uiState.versionBlocked = versionBlocked || false;
    uiState.versionRequired = versionRequired || null;
    uiState.customManifestEnabled = customManifestEnabled !== false;
    uiState.hasCustomManifest = !!(manifestUrl && cachedCustomManifest);
    uiState.lastManifestError = lastManifestError || false;

    // 🔥 TAMBAHKAN INI DI SINI (setelah uiState.lastManifestError)
    try {
        const validation = await validateAccess();
        uiState.userTier = validation.tier || 'dasar';
    } catch (e) {
        uiState.userTier = 'dasar';
    }

    if (uiState.manifestUrl) {
        const input = shadowRoot?.getElementById("manifest-url-input");
        if (input) input.value = uiState.manifestUrl;
    }
    const badge = shadowRoot?.getElementById("manifest-status-badge");
    if (badge) {
        if (!uiState.lastManifestFetch && !uiState.lastManifestError) {
            badge.textContent = "NOT SET";
            badge.className = "status-badge not-set";
        } else if (uiState.lastManifestError) {
            badge.textContent = "FAILED";
            badge.className = "status-badge failed";
        } else {
            badge.textContent = "CONNECTED";
            badge.className = "status-badge connected";
        }
    }
    const formatTime = (ts) => {
        if (!ts) return "Never synced";
        const diff = Math.round((Date.now() - ts) / 1000);
        if (diff < 60) return "Synced just now";
        if (diff < 3600) return `Synced ${Math.floor(diff / 60)}m ago`;
        return `Synced ${new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };
    const lastFetched = shadowRoot?.getElementById("last-fetched");
    if (lastFetched) lastFetched.textContent = formatTime(uiState.lastManifestFetch);
    const toggle = shadowRoot?.getElementById("custom-manifest-toggle");
    if (toggle) toggle.checked = uiState.customManifestEnabled !== false;
    const inputEnabled = uiState.customManifestEnabled !== false;
    const urlInput = shadowRoot?.getElementById("manifest-url-input");
    const saveBtn = shadowRoot?.getElementById("btn-save-url");
    if (urlInput) urlInput.disabled = !inputEnabled;
    if (saveBtn) saveBtn.disabled = !inputEnabled;
    const versionBlockedBanner = shadowRoot?.getElementById("version-blocked-banner");
    if (versionBlockedBanner) {
        versionBlockedBanner.classList.toggle("hidden", !uiState.versionBlocked);
        if (uiState.versionBlocked) {
            const detail = shadowRoot?.getElementById("version-blocked-detail");
            if (detail) detail.innerHTML = `Versi Anda: ${EXTENSION_VERSION} — Diperlukan: ${uiState.versionRequired || "?"}. Semua modul dinonaktifkan sementara.`;
        }
    }
    const updateBanner = shadowRoot?.getElementById("update-banner");
    if (updateBanner) {
        updateBanner.classList.toggle("hidden", uiState.pendingUpdates.length === 0);
        const text = shadowRoot?.getElementById("update-banner-text");
        if (text) text.textContent = `${uiState.pendingUpdates.length} update${uiState.pendingUpdates.length !== 1 ? "s" : ""} available`;
    }
    renderModuleList();
}
   function getCSS() {
    return `
        :host { all: initial; display: block; position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
        :host([data-visible="true"]) { pointer-events: auto; }
        .jamu-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1; opacity: 0; pointer-events: none; transition: opacity 0.25s ease; }
        .jamu-backdrop.open { opacity: 1; pointer-events: auto; }
        .jamu-popup { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.96); width: 500px; max-height: 82vh; background: #0d0f12; color: #c8d0db; border: 1px solid #252a31; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6); z-index: 2; opacity: 0; pointer-events: none; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; }
        .jamu-popup.open { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
        .jamu-popup #app { display: flex; flex-direction: column; max-height: 82vh; }
        .header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #131619; border-bottom: 1px solid #252a31; flex-shrink: 0; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .logo-text { font-family: 'Courier New', monospace; font-weight: 700; font-size: 16px; color: #00d4aa; letter-spacing: -1px; line-height: 1; }
        .header-info { display: flex; flex-direction: column; gap: 2px; }
        .title { font-weight: 700; font-size: 17px; color: #e8edf3; letter-spacing: 0.3px; }
        .subtitle-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .subtitle { font-size: 11px; color: #e8edf3; font-family: 'Courier New', monospace; }
        .custom-indicator { font-size: 9px; font-family: 'Courier New', monospace; color: #00d4aa; opacity: 0.7; }
        .header-right { display: flex; gap: 4px; }
        .icon-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: transparent; border: 1px solid #252a31; border-radius: 4px; color: #5a6472; cursor: pointer; font-size: 14px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .icon-btn:hover { border-color: #00d4aa; color: #00d4aa; background: rgba(0,212,170,0.12); }
        .icon-btn.spinning { animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .version-blocked-banner, .update-banner { padding: 10px 16px; flex-shrink: 0; border-bottom: 1px solid; }
        .version-blocked-banner { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.2); }
        .version-blocked-text strong { font-size: 12px; font-weight: 600; color: #ef4444; display: block; }
        .version-blocked-text span { font-size: 11px; color: #ef4444; font-family: 'Courier New', monospace; opacity: 0.8; }
        .update-banner { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.2); display: flex; align-items: center; gap: 10px; }
        .update-banner-text { flex: 1; color: #f59e0b; font-size: 12px; font-weight: 500; }
        .hidden { display: none !important; }
        .settings-panel { background: #131619; border-bottom: 1px solid #252a31; flex-shrink: 0; }
        .settings-content { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
        .settings-label { font-size: 10px; font-weight: 600; color: #5a6472; text-transform: uppercase; letter-spacing: 1px; font-family: 'Courier New', monospace; }
        .settings-version-row, .settings-status-row, .settings-custom-header { display: flex; align-items: center; justify-content: space-between; }
        .settings-version-badge, .status-badge { font-family: 'Courier New', monospace; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 3px; }
        .settings-version-badge { color: #00d4aa; background: rgba(0,212,170,0.12); border: 1px solid rgba(0,212,170,0.3); }
        .status-badge.connected { color: #00d4aa; background: rgba(0,212,170,0.12); border: 1px solid rgba(0,212,170,0.3); }
        .status-badge.failed { color: #ef4444; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); }
        .status-badge.not-set { color: #5a6472; background: #1a1e23; border: 1px solid #252a31; }
        .settings-divider { border: none; border-top: 1px solid #252a31; margin: 2px 0; }
        .input-row { display: flex; gap: 8px; margin-top: 2px; }
        .url-input { flex: 1; background: #1a1e23; border: 1px solid #2e3640; border-radius: 4px; padding: 6px 10px; color: #e8edf3; font-family: 'Courier New', monospace; font-size: 11px; outline: none; transition: border-color 0.2s; }
        .url-input:focus { border-color: #00d4aa; }
        .url-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .save-btn { background: #00d4aa; color: #000; border: none; border-radius: 4px; padding: 6px 14px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: 'Courier New', monospace; transition: all 0.2s; white-space: nowrap; }
        .save-btn:hover { opacity: 0.85; }
        .save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .settings-meta { font-size: 10px; color: #5a6472; font-family: 'Courier New', monospace; margin-top: 2px; }
        .search-category-container { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: #131619; border-bottom: 1px solid #252a31; flex-shrink: 0; }
        .search-input-wrapper { flex: 1; display: flex; align-items: center; gap: 8px; background: #1a1e23; border: 1px solid #2e3640; border-radius: 4px; padding: 0 10px; transition: all 0.2s; }
        .search-input-wrapper:focus-within { border-color: #00d4aa; box-shadow: 0 0 0 2px rgba(0,212,170,0.12); }
        .search-icon { color: #5a6472; font-size: 13px; opacity: 0.7; }
        .search-input { flex: 1; background: transparent; border: none; padding: 7px 0; color: #e8edf3; font-family: 'Courier New', monospace; font-size: 12px; outline: none; }
        .search-input::placeholder { color: #5a6472; }
        .clear-search-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: transparent; border: none; border-radius: 4px; color: #5a6472; cursor: pointer; font-size: 13px; transition: all 0.2s; }
        .clear-search-btn:hover { background: #131619; color: #ef4444; }
        .category-dropdown { position: relative; flex-shrink: 0; }
        .dropdown-btn { display: flex; align-items: center; gap: 6px; padding: 7px 12px; background: #1a1e23; border: 1px solid #2e3640; border-radius: 4px; color: #e8edf3; font-family: 'Courier New', monospace; font-size: 11px; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
        .dropdown-btn:hover { border-color: #00d4aa; background: rgba(0,212,170,0.12); }
        .dropdown-arrow { font-size: 9px; transition: transform 0.2s; }
        .dropdown-btn.open .dropdown-arrow { transform: rotate(180deg); }
        .dropdown-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; min-width: 150px; background: #131619; border: 1px solid #252a31; border-radius: 6px; overflow: hidden; z-index: 100; display: none; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .dropdown-menu.open { display: block; }
        .dropdown-item { display: flex; align-items: center; gap: 10px; padding: 8px 14px; font-size: 12px; font-family: 'Courier New', monospace; color: #5a6472; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .dropdown-item:hover { background: #1a1e23; color: #e8edf3; }
        .dropdown-item.active { color: #00d4aa; background: rgba(0,212,170,0.12); }
        .dropdown-item .item-icon { font-size: 13px; }
        .module-list { flex: 1; overflow-y: auto; padding: 6px 0; min-height: 100px; background: #0d0f12; scrollbar-width: thin; scrollbar-color: #2e3640 transparent; }
        .module-list::-webkit-scrollbar { width: 4px; }
        .module-list::-webkit-scrollbar-track { background: transparent; }
        .module-list::-webkit-scrollbar-thumb { background: #2e3640; border-radius: 2px; }
        .module-card { display: flex; align-items: center; padding: 12px 16px; gap: 14px; border-bottom: 1px solid #252a31; transition: all 0.2s; cursor: default; background: #0d0f12; }
        .module-card:last-child { border-bottom: none; }
        .module-card:hover { background: #131619; }
        .module-card.has-update { background: rgba(245,158,11,0.04); }
        .module-card.version-blocked { opacity: 0.5; pointer-events: none; filter: grayscale(0.5); }
        .module-icon { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; transition: all 0.2s; border: 1px solid #2e3640; background: #1a1e23; }
        .module-card.enabled .module-icon { border-color: #00d4aa; background: rgba(0,212,170,0.12); }
        .module-body { flex: 1; min-width: 0; }
        .module-name { font-weight: 600; font-size: 13px; color: #e8edf3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; }
        .module-desc { font-size: 10px; color: #5a6472; margin-top: 2px; line-height: 1.3; }
        .module-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
        .module-version { font-family: 'Courier New', monospace; font-size: 10px; color: #e8edf3; background: #1a1e23; padding: 1px 6px; border-radius: 3px; border: 1px solid #252a31; }
        .module-version.has-update { color: #f59e0b; border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.12); }
        .category-badge { font-size: 9px; font-family: 'Courier New', monospace; padding: 2px 10px; border-radius: 12px; font-weight: 500; border: 1px solid; white-space: nowrap; }
        .module-matches { font-size: 10px; color: #5a6472; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; font-family: 'Courier New', monospace; }
        .module-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .update-module-btn { background: transparent; border: 1px solid rgba(245,158,11,0.5); border-radius: 3px; color: #f59e0b; font-size: 9px; font-family: 'Courier New', monospace; font-weight: 600; padding: 3px 8px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .update-module-btn:hover { background: rgba(245,158,11,0.12); border-color: #f59e0b; }
        .toggle { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
        .toggle-small { width: 30px; height: 17px; }
        .toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .toggle-track { position: absolute; inset: 0; background: #2e3640; border-radius: 10px; cursor: pointer; transition: all 0.2s; }
        .toggle-track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #5a6472; border-radius: 50%; transition: all 0.2s; }
        .toggle-small .toggle-track::after { width: 13px; height: 13px; top: 2px; left: 2px; }
        .toggle input:checked + .toggle-track { background: #00d4aa; }
        .toggle input:checked + .toggle-track::after { transform: translateX(16px); background: #000; }
        .toggle-small input:checked + .toggle-track::after { transform: translateX(13px); }
        .empty-state { padding: 32px 20px; text-align: center; color: #5a6472; }
        .empty-icon { font-size: 32px; margin-bottom: 12px; opacity: 0.3; color: #00d4aa; }
        .empty-state p { font-size: 13px; color: #5a6472; }
        .empty-sub { font-size: 11px !important; margin-top: 4px; font-family: 'Courier New', monospace; opacity: 0.6; }
        .status-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #131619; border-top: 1px solid #252a31; flex-shrink: 0; }
        .status-url { font-family: 'Courier New', monospace; font-size: 10px; color: #5a6472; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
        .status-active { font-family: 'Courier New', monospace; font-size: 10px; color: #00d4aa; font-weight: 500; white-space: nowrap; }
        .toast { position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(10px); background: #1a1e23; border: 1px solid #2e3640; border-radius: 5px; padding: 8px 18px; font-size: 12px; color: #e8edf3; white-space: nowrap; opacity: 0; transition: all 0.2s; z-index: 3; pointer-events: none; }
        .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
        .toast.success { border-color: #00d4aa; color: #00d4aa; }
        .toast.error { border-color: #ef4444; color: #ef4444; }

        /* ===== FLOATING BUTTON (HANYA SATU!) ===== */
        #jamu-mobile-button {
            position: fixed !important;
            bottom: 24px !important;
            right: 24px !important;
            width: 56px !important;
            height: 56px !important;
            border-radius: 50% !important;
            background: #00d4aa !important;
            color: #000 !important;
            border: none !important;
            box-shadow: 0 4px 20px rgba(0,212,170,0.5) !important;
            font-size: 26px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            z-index: 999999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-family: 'Courier New', monospace !important;
            touch-action: manipulation !important;
            user-select: none !important;
            -webkit-tap-highlight-color: transparent !important;
            transition: transform 0.2s, opacity 0.2s !important;
            pointer-events: auto !important;
        }
        #jamu-mobile-button:active { transform: scale(0.85) !important; }

        /* Sembunyikan di desktop, tampil di mobile */
        @media (min-width: 769px) { #jamu-mobile-button { display: none !important; } }
        @media (max-width: 768px) { #jamu-mobile-button { display: flex !important; } }

        /* ===== RESPONSIVE MOBILE ===== */
        @media (max-width: 480px) {
            .jamu-popup { width: 98% !important; max-height: 90vh !important; border-radius: 8px !important; }
            .header { padding: 10px 12px !important; flex-wrap: wrap !important; }
            .header-left { gap: 8px !important; flex-wrap: wrap !important; }
            .logo-text { font-size: 14px !important; }
            .subtitle { font-size: 10px !important; }
            .header-right { gap: 2px !important; }
            .icon-btn { width: 24px !important; height: 24px !important; font-size: 12px !important; }
            .search-category-container { flex-wrap: wrap !important; padding: 8px 12px !important; gap: 6px !important; }
            .search-input-wrapper { flex: 1 1 100% !important; }
            .search-input { font-size: 11px !important; padding: 5px 0 !important; }
            .dropdown-btn { font-size: 10px !important; padding: 4px 8px !important; }
            .module-card { flex-wrap: wrap !important; padding: 10px 12px !important; gap: 6px !important; }
            .module-icon { width: 28px !important; height: 28px !important; font-size: 14px !important; }
            .module-body { flex: 1 1 100% !important; min-width: 0 !important; }
            .module-name { font-size: 12px !important; white-space: normal !important; word-break: break-word !important; }
            .module-desc { font-size: 9px !important; }
            .module-meta { gap: 4px !important; flex-wrap: wrap !important; }
            .module-version { font-size: 9px !important; padding: 1px 4px !important; }
            .category-badge { font-size: 8px !important; padding: 1px 6px !important; }
            .module-matches { font-size: 8px !important; max-width: 80px !important; }
            .module-actions { flex: 1 1 100% !important; justify-content: flex-end !important; gap: 4px !important; }
            .update-module-btn { font-size: 8px !important; padding: 2px 6px !important; }
            .toggle { width: 30px !important; height: 17px !important; flex-shrink: 0 !important; }
            .toggle-track::after { width: 13px !important; height: 13px !important; }
            .toggle input:checked + .toggle-track::after { transform: translateX(13px) !important; }
            .badge { font-size: 9px !important; padding: 1px 6px !important; }
            .modal { width: 95% !important; max-width: 95vw !important; }
            .modal-body { padding: 16px !important; }
            .grid-2 { grid-template-columns: 1fr !important; gap: 12px !important; }
            .status-bar { flex-wrap: wrap !important; padding: 6px 12px !important; gap: 4px !important; }
            .status-url { font-size: 9px !important; max-width: 120px !important; }
            .status-active { font-size: 9px !important; }
        }
        @media (max-width: 380px) {
            .module-name { font-size: 11px !important; }
            .module-version { font-size: 8px !important; }
            .category-badge { font-size: 7px !important; padding: 1px 4px !important; }
            .module-matches { font-size: 7px !important; max-width: 60px !important; }
            .toggle { width: 26px !important; height: 15px !important; }
            .toggle-track::after { width: 11px !important; height: 11px !important; }
            .toggle input:checked + .toggle-track::after { transform: translateX(11px) !important; }
            .header-right .icon-btn { width: 20px !important; height: 20px !important; font-size: 10px !important; }
        }
    `;
}

    // 🔥 Deteksi mobile
function isMobileDevice() {
    // Cek user agent
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());

    // Cek screen size
    const isSmallScreen = window.innerWidth < 768 || window.innerHeight < 768;

    // Cek touch support
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Cek apakah di Firefox dengan mode HP (viewport kecil tapi UA desktop)
    const isFirefoxMobileMode = window.innerWidth <= 500 && window.innerHeight <= 900;

    return isMobileUA || isSmallScreen || hasTouch || isFirefoxMobileMode;
}

    // ── CREATE UI WITH SHADOW DOM ──────────────────────────────
    function createUI() {
    if (document.getElementById("jamu-overlay-container")) return;

    // ===== OVERLAY =====
    const container = document.createElement("div");
    container.id = "jamu-overlay-container";
    container.setAttribute("data-visible", "false");
    shadowRoot = container.attachShadow({ mode: "closed" });

    const template = document.createElement("template");
    template.innerHTML = `
        <style>${getCSS()}</style>
        <div class="jamu-backdrop" id="jamu-backdrop"></div>
        <div class="jamu-popup" id="jamu-popup">
            <div id="app">
                <div class="header">
                    <div class="header-left">
                        <div class="logo">
                            <img src="https://perangkat-dev.github.io/frontend/logo.svg" class="logo-svg" alt="Jamu Loader" />
                        </div>
                        <div class="header-info">
                            <div class="logo-text">Jamu Loader</div>
                            <div class="subtitle-row">
                                <span class="subtitle" id="module-count">Loading...</span>
                                <span class="custom-indicator hidden" id="custom-indicator">⬡ custom</span>
                            </div>
                        </div>
                    </div>
                    <div class="header-right">
                        <button class="icon-btn" id="btn-refresh" title="Refresh Manifest">⟳</button>
                        <button class="icon-btn" id="btn-settings" title="Settings">⚙</button>
                        <button class="icon-btn" id="btn-close" title="Close">✕</button>
                    </div>
                </div>
                <div class="version-blocked-banner hidden" id="version-blocked-banner"><div class="version-blocked-text"><strong>⛔ Extension perlu diperbarui</strong><span id="version-blocked-detail">Versi Anda tidak didukung.</span></div></div>
                <div class="update-banner hidden" id="update-banner"><span class="update-icon">⚡</span><span class="update-banner-text" id="update-banner-text">Updates available</span><button class="save-btn" id="btn-update-all" style="padding:4px 12px;font-size:10px;">Update All</button></div>
                <div class="settings-panel hidden" id="settings-panel">
                    <div class="settings-content">
                        <div class="settings-version-row"><span class="settings-label">Extension</span><span class="settings-version-badge" id="settings-version">v${EXTENSION_VERSION}</span></div>
                        <div class="settings-status-row"><span class="settings-label">Default Manifest</span><span class="status-badge not-set" id="manifest-status-badge">NOT SET</span></div>
                        <hr class="settings-divider">
                        <div class="settings-custom-header"><span class="settings-label">Custom Manifest</span><label class="toggle toggle-small"><input type="checkbox" id="custom-manifest-toggle" checked><span class="toggle-track"></span></label></div>
                        <div class="input-row"><input type="text" class="url-input" id="manifest-url-input" placeholder="https://..."><button class="save-btn" id="btn-save-url">Save</button></div>
                        <div class="settings-meta" id="last-fetched">Never synced</div>
                    </div>
                </div>
                <div class="search-category-container">
                    <div class="search-input-wrapper"><span class="search-icon">🔍</span><input type="text" class="search-input" id="search-input" placeholder="Cari module..."><button class="clear-search-btn hidden" id="btn-clear-search">✕</button></div>
                    <div class="category-dropdown" id="category-dropdown"><div class="dropdown-btn" id="dropdown-btn"><span id="dropdown-selected">Kategori</span><span class="dropdown-arrow">▼</span></div><div class="dropdown-menu" id="dropdown-menu"></div></div>
                </div>
                <div class="module-list" id="module-list"><div class="empty-state"><div class="empty-icon">◈</div><p>No modules loaded</p><p class="empty-sub">Check your manifest URL in ⚙ settings</p></div></div>
                <div class="status-bar"><span class="status-url" id="current-url">-</span><span class="status-active" id="active-count">0 active</span></div>
            </div>
        </div>
        <div class="toast" id="jamu-toast"></div>
    `;

    shadowRoot.appendChild(template.content.cloneNode(true));
    document.body.appendChild(container);

    // ===== VARIABEL =====
    const backdrop = shadowRoot.getElementById("jamu-backdrop");
    const popup = shadowRoot.getElementById("jamu-popup");
    const closeBtn = shadowRoot.getElementById("btn-close");
    const btnRefresh = shadowRoot.getElementById("btn-refresh");
    const btnSettings = shadowRoot.getElementById("btn-settings");
    const settingsPanel = shadowRoot.getElementById("settings-panel");
    const btnSaveUrl = shadowRoot.getElementById("btn-save-url");
    const btnUpdateAll = shadowRoot.getElementById("btn-update-all");
    const searchInput = shadowRoot.getElementById("search-input");
    const btnClearSearch = shadowRoot.getElementById("btn-clear-search");
    const customToggle = shadowRoot.getElementById("custom-manifest-toggle");
    const dropdownBtn = shadowRoot.getElementById("dropdown-btn");
    const dropdownMenu = shadowRoot.getElementById("dropdown-menu");

    // ===== TOGGLE MODAL =====
    const toggleModal = (show) => {
        isUIOpen = show;
        container.setAttribute("data-visible", show ? "true" : "false");
        backdrop.classList.toggle("open", show);
        popup.classList.toggle("open", show);
        if (show) {
            renderDropdownMenu();
            loadUIState();
        }
    };

    // ===== FLOATING BUTTON MOBILE =====
    function createMobileButton() {
    const oldBtn = document.getElementById('jamu-mobile-button');
    if (oldBtn) oldBtn.remove();

    const btn = document.createElement('div');
    btn.id = 'jamu-mobile-button';
    btn.textContent = '🍵';
    btn.setAttribute('aria-label', 'Buka Jamu Loader');
    document.body.appendChild(btn);

    let lastClick = 0;
    const handleToggle = function(e) {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastClick < 300) return;
        lastClick = now;
        toggleModal(!isUIOpen);
    };

    btn.addEventListener('click', handleToggle);
    btn.addEventListener('touchstart', handleToggle, { passive: false });
}

    // 🔥 Tampilkan tombol mobile
    createMobileButton();

    // ===== EVENT BINDINGS =====
    closeBtn.addEventListener("click", () => toggleModal(false));
    backdrop.addEventListener("click", () => toggleModal(false));

    // Keyboard Shortcut
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === "Q" || e.key === "q")) {
            e.preventDefault();
            toggleModal(!isUIOpen);
        }
        if (e.key === "Escape" && isUIOpen) {
            toggleModal(false);
        }
    });

    btnSettings.addEventListener("click", () => {
        settingsPanel.classList.toggle("hidden");
    });

    btnRefresh.addEventListener("click", async () => {
        btnRefresh.classList.add("spinning");
        try {
            await WhitelistService.refresh();
            await refreshDefaultManifest();
            await refreshCustomManifest();
            await loadUIState();
            await injectModulesIntoPage();
            showToast("✓ Manifest & Whitelist refreshed", "success");
        } catch (err) {
            console.error("[JamuLoader] Refresh failed:", err);
            showToast("Failed to refresh", "error");
        } finally {
            btnRefresh.classList.remove("spinning");
        }
    });

    customToggle.addEventListener("change", async (e) => {
        uiState.customManifestEnabled = e.target.checked;
        await JamuStorage.set({ customManifestEnabled: e.target.checked });
        loadUIState();
    });

    btnSaveUrl.addEventListener("click", async () => {
        const url = shadowRoot.getElementById("manifest-url-input").value.trim();
        if (!url) {
            showToast("Enter a manifest URL", "error");
            return;
        }
        btnSaveUrl.textContent = "...";
        btnSaveUrl.disabled = true;
        try {
            await JamuStorage.set({ manifestUrl: url, customManifestEnabled: true, cachedCustomManifest: null });
            await refreshCustomManifest();
            showToast("✓ Custom manifest saved & loaded", "success");
            settingsPanel.classList.add("hidden");
            await loadUIState();
        } catch {
            showToast("Error saving", "error");
        } finally {
            btnSaveUrl.textContent = "Save";
            btnSaveUrl.disabled = false;
        }
    });

    btnUpdateAll.addEventListener("click", async () => {
        btnUpdateAll.textContent = "...";
        btnUpdateAll.disabled = true;
        try {
            const modules = uiState.modules || [];
            for (const mod of modules) {
                if (uiState.pendingUpdates.includes(mod.id)) {
                    await JamuStorage.set({ [`script_${mod.id}`]: null });
                    await getModuleScript(mod);
                }
            }
            uiState.pendingUpdates = [];
            await JamuStorage.set({ pendingUpdates: [] });
            showToast("✓ All modules updated", "success");
            await loadUIState();
            injectModulesIntoPage();
        } catch {
            showToast("Update failed", "error");
        } finally {
            btnUpdateAll.textContent = "Update All";
            btnUpdateAll.disabled = false;
        }
    });

    searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.trim();
        btnClearSearch.classList.toggle("hidden", !searchQuery);
        renderModuleList();
    });

    btnClearSearch.addEventListener("click", () => {
        searchQuery = "";
        searchInput.value = "";
        btnClearSearch.classList.add("hidden");
        searchInput.focus();
        renderModuleList();
    });

    dropdownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle("open");
        dropdownBtn.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
        const shadowHost = document.getElementById("jamu-overlay-container");
        if (shadowHost && shadowHost.shadowRoot) {
            const btn = shadowHost.shadowRoot.getElementById("dropdown-btn");
            const menu = shadowHost.shadowRoot.getElementById("dropdown-menu");
            if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.remove("open");
                btn.classList.remove("open");
            }
        }
    });

    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            uiState.currentTabUrl = url;
            renderModuleList();
        }
    }).observe(document, { subtree: true, childList: true });

    renderDropdownMenu();
    loadUIState();
    log("UI created successfully with Shadow DOM - Press Ctrl+Shift+Q to toggle");
}

    // ============================================================
    // 10. INITIALIZATION
    // ============================================================
    async function init() {
        log(`Initializing Jamu Loader v${EXTENSION_VERSION}...`);
        setupAsikInterceptor();
        await refreshDefaultManifest();
        await refreshCustomManifest();
        createUI();
        await injectModulesIntoPage();
        setInterval(() => {
            WhitelistService.refresh().catch(() => {});
        }, WHITELIST_CONFIG.CACHE_DURATION);
        setInterval(async () => {
            await refreshDefaultManifest();
            await loadUIState();
        }, DEFAULT_CHECK_INTERVAL);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
