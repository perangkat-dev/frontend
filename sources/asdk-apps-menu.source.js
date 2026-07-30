// ============================================================
// Module: asdk-apps-menu
// Nama: ASDK Apps Menu
// Versi: 3.2
// Kategori: tools
// Tier: dasar
// Deskripsi: Floating draggable apps menu untuk ASDK
// Dependencies: 
// Bypass Whitelist: false
// Tanggal: 30/7/2026, 21.57.31
// ============================================================
// ==UserScript==
// @name         ASDK Apps Menu
// @namespace    http://jamu.local/
// @version      3.2
// @description  Floating draggable apps menu untuk ASDK
// @author       Jamu
// @match        https://asdk.kemkes.go.id/*
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // 1. Daftar aplikasi (URL absolute untuk hindari broken link)
    // ============================================
    const apps = [
        { name: 'Data Entry', url: 'https://asdk.kemkes.go.id/dhis-web-dataentry/index.action', icon: 'https://asdk.kemkes.go.id/icons/dhis-web-dataentry.png' },
        { name: 'Dashboard', url: 'https://asdk.kemkes.go.id/dhis-web-dashboard/index.action', icon: 'https://asdk.kemkes.go.id/icons/dhis-web-dashboard.png' },
        { name: 'Browser Cache Cleaner', url: 'https://asdk.kemkes.go.id/dhis-web-cache-cleaner/index.action', icon: 'https://asdk.kemkes.go.id/icons/dhis-web-cache-cleaner.png' },
        { name: 'Data Visualizer', url: 'https://asdk.kemkes.go.id/dhis-web-data-visualizer/index.action', icon: 'https://asdk.kemkes.go.id/icons/dhis-web-data-visualizer.png' },
        { name: 'Menu Management', url: 'https://asdk.kemkes.go.id/dhis-web-menu-management/index.action', icon: 'https://asdk.kemkes.go.id/icons/dhis-web-menu-management.png' },
        { name: 'import export ilp pkm', url: 'https://asdk.kemkes.go.id/api/apps/import-export-ilp-pkm/index.html', icon: 'https://asdk.kemkes.go.id/api/apps/import-export-ilp-pkm/icon-48.png' },
        { name: 'kelola wilayah pkm', url: 'https://asdk.kemkes.go.id/api/apps/kelola-wilayah-pkm/index.html', icon: 'https://asdk.kemkes.go.id/api/apps/kelola-wilayah-pkm/icon-48.png' },
        { name: 'dashboard pws ilp pkm', url: 'https://asdk.kemkes.go.id/api/apps/dashboard-pws-ilp-pkm/index.html', icon: 'https://asdk.kemkes.go.id/api/apps/dashboard-pws-ilp-pkm/icon-48.png' },
        { name: 'Kualitas Data ILP', url: 'https://asdk.kemkes.go.id/api/apps/kualitas-data-ilp/index.html', icon: 'https://asdk.kemkes.go.id/api/apps/kualitas-data-ilp/icon-48.png' }
    ];

    // ============================================
    // 2. CSS - Inject manual tanpa GM_addStyle
    // ============================================
    const css = `
        #dhis2-floating-menu-btn {
            position: fixed;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1976D2 0%, #0D47A1 100%);
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
            touch-action: none;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        #dhis2-floating-menu-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }
        #dhis2-floating-menu-btn.dragging {
            cursor: grabbing !important;
            transform: scale(1.1);
        }
        #dhis2-floating-menu {
            position: fixed;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.25);
            padding: 16px;
            z-index: 2147483646;
            width: 420px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: none;
        }
        #dhis2-floating-menu.visible {
            display: block !important;
            animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        #dhis2-floating-menu input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            margin-bottom: 12px;
            font-size: 14px;
            box-sizing: border-box;
            outline: none;
        }
        #dhis2-floating-menu input:focus {
            border-color: #1976D2;
        }
        .dhis2-apps-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }
        .dhis2-app-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-decoration: none;
            color: #333;
            padding: 12px 8px;
            border-radius: 6px;
            transition: background 0.2s;
            text-align: center;
        }
        .dhis2-app-item:hover {
            background: #E3F2FD;
        }
        .dhis2-app-item img {
            width: 48px;
            height: 48px;
            margin-bottom: 8px;
            object-fit: contain;
        }
        .dhis2-app-item span {
            font-size: 11px;
            line-height: 1.3;
            word-break: break-word;
        }
        .dhis2-menu-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
        }
        .dhis2-menu-header strong {
            font-size: 14px;
            color: #333;
        }
        .dhis2-menu-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #999;
            padding: 0 4px;
        }
        .dhis2-menu-close:hover {
            color: #333;
        }
        .drag-hint {
            font-size: 10px;
            color: #999;
            text-align: center;
            margin-top: 8px;
        }
    `;

    // Inject CSS manual
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // ============================================
    // 3. Buat tombol floating
    // ============================================
    const btn = document.createElement('button');
    btn.id = 'dhis2-floating-menu-btn';
    btn.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M7 16a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2a1 1 0 011-1zm6 0a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2a1 1 0 011-1zm6 0a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2a1 1 0 011-1zM7 10a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2a1 1 0 011-1zm6 0a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2a1 1 0 011-1zm6 0a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2a1 1 0 011-1zM7 4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm6 0a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V5a1 1 0 011-1zm6 0a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V5a1 1 0 011-1z"/>
        </svg>
    `;
    document.body.appendChild(btn);

    // ============================================
    // 4. Buat menu
    // ============================================
    const menu = document.createElement('div');
    menu.id = 'dhis2-floating-menu';
    menu.innerHTML = `
        <div class="dhis2-menu-header">
            <strong>Jamu</strong>
            <button class="dhis2-menu-close" onclick="document.getElementById('dhis2-floating-menu').classList.remove('visible')">✕</button>
        </div>
        <input type="text" id="dhis2-apps-search" placeholder="🔍 Cari aplikasi...">
        <div class="dhis2-apps-grid">
            ${apps.map(app => `
                <a href="${app.url}" class="dhis2-app-item" data-name="${app.name.toLowerCase()}">
                    <img src="${app.icon}" alt="${app.name}" onerror="this.style.display='none'">
                    <span>${app.name}</span>
                </a>
            `).join('')}
        </div>
        <div class="drag-hint">💡 Drag tombol biru untuk pindahkan</div>
    `;
    document.body.appendChild(menu);

    // ============================================
    // 5. Posisi persistent dari localStorage
    // ============================================
    const POS_KEY = 'dhis2_floating_menu_pos';
    const savedPos = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
    let btnLeft = savedPos.left !== undefined ? savedPos.left : 20;
    let btnTop = savedPos.top !== undefined ? savedPos.top : window.innerHeight - 80;

    btn.style.left = btnLeft + 'px';
    btn.style.top = btnTop + 'px';

    function clampPosition() {
        const maxLeft = window.innerWidth - btn.offsetWidth - 10;
        const maxTop = window.innerHeight - btn.offsetHeight - 10;
        btnLeft = Math.max(10, Math.min(btnLeft, maxLeft));
        btnTop = Math.max(10, Math.min(btnTop, maxTop));
        btn.style.left = btnLeft + 'px';
        btn.style.top = btnTop + 'px';
    }
    clampPosition();
    window.addEventListener('resize', clampPosition);

    // ============================================
    // 6. Drag logic
    // ============================================
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartLeft = 0;
    let dragStartTop = 0;
    let hasMoved = false;

    function onDragStart(e) {
        e.preventDefault();
        isDragging = true;
        hasMoved = false;
        const point = e.touches ? e.touches[0] : e;
        dragStartX = point.clientX;
        dragStartY = point.clientY;
        dragStartLeft = btnLeft;
        dragStartTop = btnTop;
        btn.classList.add('dragging');

        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('touchend', onDragEnd);
    }

    function onDragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const point = e.touches ? e.touches[0] : e;
        const deltaX = point.clientX - dragStartX;
        const deltaY = point.clientY - dragStartY;

        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            hasMoved = true;
        }

        btnLeft = dragStartLeft + deltaX;
        btnTop = dragStartTop + deltaY;

        const maxLeft = window.innerWidth - btn.offsetWidth - 10;
        const maxTop = window.innerHeight - btn.offsetHeight - 10;
        btnLeft = Math.max(10, Math.min(btnLeft, maxLeft));
        btnTop = Math.max(10, Math.min(btnTop, maxTop));

        btn.style.left = btnLeft + 'px';
        btn.style.top = btnTop + 'px';

        if (menu.classList.contains('visible')) {
            positionMenu();
        }
    }

    function onDragEnd() {
        isDragging = false;
        btn.classList.remove('dragging');

        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('touchend', onDragEnd);

        localStorage.setItem(POS_KEY, JSON.stringify({ left: btnLeft, top: btnTop }));

        if (!hasMoved) {
            toggleMenu();
        }
    }

    btn.addEventListener('mousedown', onDragStart);
    btn.addEventListener('touchstart', onDragStart, { passive: false });

    // ============================================
    // 7. Positioning menu
    // ============================================
    function positionMenu() {
        const btnRect = btn.getBoundingClientRect();
        const menuWidth = 420;
        const menuHeight = menu.offsetHeight || 500;

        let menuLeft = btnRect.left + btnRect.width / 2 - menuWidth / 2;
        let menuTop = btnRect.top - menuHeight - 10;

        if (menuLeft < 10) menuLeft = 10;
        if (menuLeft + menuWidth > window.innerWidth - 10) {
            menuLeft = window.innerWidth - menuWidth - 10;
        }
        if (menuTop < 10) menuTop = btnRect.bottom + 10;
        if (menuTop + menuHeight > window.innerHeight - 10) {
            menuTop = window.innerHeight - menuHeight - 10;
        }

        menu.style.left = menuLeft + 'px';
        menu.style.top = menuTop + 'px';
    }

    // ============================================
    // 8. Toggle menu
    // ============================================
    function toggleMenu() {
        if (menu.classList.contains('visible')) {
            menu.classList.remove('visible');
        } else {
            menu.classList.add('visible');
            positionMenu();
            setTimeout(() => {
                const searchInput = document.getElementById('dhis2-apps-search');
                if (searchInput) searchInput.focus();
            }, 100);
        }
    }

    // ============================================
    // 9. Close menu saat klik di luar
    // ============================================
    document.addEventListener('click', function(e) {
        if (menu.classList.contains('visible')) {
            if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                menu.classList.remove('visible');
            }
        }
    });

    // ============================================
    // 10. Search filter
    // ============================================
    document.addEventListener('input', function(e) {
        if (e.target && e.target.id === 'dhis2-apps-search') {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.dhis2-app-item').forEach(item => {
                const name = item.getAttribute('data-name');
                item.style.display = name.includes(term) ? 'flex' : 'none';
            });
        }
    });

    // ============================================
    // 11. Prevent menu close saat klik di dalam menu
    // ============================================
    menu.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    console.log('✅ DHIS2 Floating Apps Menu v3.2 loaded! Drag tombol biru untuk pindahkan.');
})();