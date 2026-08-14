// ============================================================
// Module: draggable-ui
// Nama: Draggable UI
// Versi: 1.0.0
// Kategori: lainnya
// Tier: dasar
// Deskripsi: 
// Dependencies: 
// Bypass Whitelist: true
// Tanggal: 15/8/2026, 03.21.23
// ============================================================
// ==UserScript==
// @name         Draggable UI
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log('Draggable UI script loaded!');
    
    // Create draggable div
    const div = document.createElement('div');
    div.innerHTML = 'Draggable Box';
    div.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 150px;
        height: 50px;
        background: #4CAF50;
        color: white;
        padding: 10px;
        border-radius: 5px;
        cursor: move;
        z-index: 10000;
        text-align: center;
        line-height: 30px;
    `;
    document.body.appendChild(div);
    
    // Make draggable
    let isDragging = false;
    let offsetX, offsetY;
    
    div.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - div.offsetLeft;
        offsetY = e.clientY - div.offsetTop;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            div.style.left = (e.clientX - offsetX) + 'px';
            div.style.top = (e.clientY - offsetY) + 'px';
            div.style.right = 'auto';
            div.style.bottom = 'auto';
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
})();