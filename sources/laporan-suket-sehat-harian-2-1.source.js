// ============================================================
// Module: laporan-suket-sehat-harian-2-1
// Nama: Laporan Suket Sehat Harian 2.1
// Versi: 2.1
// Kategori: administrasi
// Tier: dasar
// Deskripsi: Laporan Penerimaan Harian dari Supabase (format POS)
// Dependencies: 
// Bypass Whitelist: false
// Tanggal: 15/8/2026, 03.24.45
// ============================================================
(function(__meta__){
// ==UserScript==
// @name         Laporan Suket Sehat Harian 2.1
// @namespace    http://jamu.local/
// @version      2.1
// @description  Laporan Penerimaan Harian dari Supabase (format POS)
// @match        https://*.epuskesmas.id/dashboardsip
// @grant        GM_xmlhttpRequest
// @connect      ltqxbrfkrgosriieprlc.supabase.co
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // 🔑 KONFIGURASI SUPABASE
    // ============================================================
    const SUPABASE_URL = 'https://ltqxbrfkrgosriieprlc.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_XgXljVXTRZAU-qoZao_h7w_vE6rtWPP';
    // ============================================================

    console.log('💰 Laporan Keuangan Harian (Supabase) dimulai...');

    // ============================================================
    // EKSTRAK NOMOR URUT DARI NO SURAT
    // ============================================================
    function extractNomorUrut(noSurat) {
        if (!noSurat || noSurat === '-') return '-';

        // Format: 400.7/0025/KEUR/PKM.KDG/VIII/2026
        // Ambil bagian setelah slash pertama: 0025

        const parts = noSurat.split('/');
        if (parts.length >= 2) {
            // Ambil bagian kedua (index 1) = "0025"
            const nomor = parts[1];
            // Validasi: apakah ini angka 4 digit?
            if (/^\d{4}$/.test(nomor)) {
                return nomor;
            }
            // Jika bukan 4 digit, coba cari pola angka 4 digit
            const match = noSurat.match(/\/(\d{4})\//);
            if (match) {
                return match[1];
            }
            return nomor;
        }

        // Fallback: cari angka 4 digit
        const match = noSurat.match(/\b(\d{4})\b/);
        return match ? match[1] : noSurat.substring(0, 10);
    }

    // ============================================================
    // BUAT TOMBOL FLOATING
    // ============================================================
    function createFloatingIcon() {
        if (document.getElementById('keuangan-supabase-btn')) return;

        const container = document.createElement('div');
        container.id = 'keuangan-supabase-btn';
        container.style.cssText = `
            position: fixed;
            bottom: 170px;
            right: 30px;
            z-index: 999999;
            cursor: pointer;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            border-radius: 50%;
            box-shadow: 0 4px 15px rgba(34, 197, 94, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 28px;
            border: 2px solid white;
            user-select: none;
            transition: all 0.3s;
        `;
        container.textContent = '💰';

        container.onmouseover = () => {
            container.style.transform = 'scale(1.1)';
            container.style.boxShadow = '0 6px 25px rgba(34, 197, 94, 0.7)';
        };
        container.onmouseout = () => {
            container.style.transform = 'scale(1)';
            container.style.boxShadow = '0 4px 15px rgba(34, 197, 94, 0.5)';
        };

        const tooltip = document.createElement('div');
        tooltip.style.cssText = `
            position: absolute;
            bottom: 70px;
            right: 0;
            background: #333;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
            font-family: Arial, sans-serif;
        `;
        tooltip.textContent = '💰 Laporan Keuangan';
        container.appendChild(tooltip);

        container.addEventListener('mouseenter', () => tooltip.style.opacity = '1');
        container.addEventListener('mouseleave', () => tooltip.style.opacity = '0');

        container.addEventListener('click', openPopup);
        document.body.appendChild(container);
    }

    // ============================================================
    // POPUP KEUANGAN
    // ============================================================
    function openPopup() {
        if (document.getElementById('keuangan-supabase-popup')) {
            document.getElementById('keuangan-supabase-popup').style.display = 'flex';
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'keuangan-supabase-popup';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 9999999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: Arial, sans-serif;
        `;

        const popup = document.createElement('div');
        popup.style.cssText = `
            background: white;
            padding: 25px;
            border-radius: 12px;
            max-width: 800px;
            width: 95%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 30px rgba(0,0,0,0.3);
        `;

        const today = new Date().toISOString().split('T')[0];

        popup.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #22c55e; padding-bottom:15px; margin-bottom:20px;">
                <h2 style="margin:0; color:#333; font-size:20px;">💰 Laporan Penerimaan Harian</h2>
                <button id="close-keuangan-popup" style="background:none; border:none; font-size:28px; cursor:pointer; color:#6c757d; padding:0 10px;">×</button>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:12px 16px; background:#f8f9fa; border-radius:8px; margin-bottom:20px;">
                <div style="display:flex; gap:8px; align-items:center;">
                    <label style="font-weight:bold; font-size:13px;">📅 Tanggal:</label>
                    <input type="date" id="keuangan-tanggal" value="${today}" style="padding:6px 12px; border:1px solid #ddd; border-radius:5px; font-size:13px;">
                </div>
                <button id="btn-tampilkan-keuangan" style="padding:6px 20px; background:#22c55e; color:white; border:none; border-radius:5px; cursor:pointer; font-size:13px;">🔍 Tampilkan</button>
                <button id="btn-print-pos" style="padding:6px 20px; background:#3b82f6; color:white; border:none; border-radius:5px; cursor:pointer; font-size:13px;">🖨️ Cetak POS</button>
            </div>

            <div id="keuangan-container" style="
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                min-height: 200px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                white-space: pre-wrap;
                overflow: auto;
                border: 1px solid #ddd;
            ">
                <div style="text-align:center; color:#6c757d; padding:40px;">
                    <div style="font-size:40px; margin-bottom:10px;">💰</div>
                    <div>Pilih tanggal dan klik Tampilkan</div>
                </div>
            </div>

            <div style="margin-top:15px; padding-top:15px; border-top:1px solid #ddd; text-align:center; font-size:11px; color:#6c757d;">
                Format untuk printer POS 58mm | Dicetak: <span id="keuangan-print-date">-</span>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        document.getElementById('close-keuangan-popup').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        document.getElementById('btn-tampilkan-keuangan').addEventListener('click', loadKeuangan);
        document.getElementById('btn-print-pos').addEventListener('click', printKeuangan);

        setTimeout(loadKeuangan, 300);
    }

    // ============================================================
    // LOAD KEUANGAN
    // ============================================================
    function loadKeuangan() {
        const tanggal = document.getElementById('keuangan-tanggal').value;
        const container = document.getElementById('keuangan-container');

        if (!tanggal) {
            container.textContent = '⚠️ Silakan pilih tanggal';
            return;
        }

        container.textContent = '⏳ Memuat data...';
        document.getElementById('keuangan-print-date').textContent = new Date().toLocaleString('id-ID');

        // 🔥 Hanya ambil Surat Sehat (jenis_surat=eq.sehat)
        const query = SUPABASE_URL + '/rest/v1/surat_keterangan?select=no_surat,tarif,keperluan,petugas,created_at&jenis_surat=eq.sehat&created_at=gte.' + tanggal + 'T00:00:00&created_at=lt.' + tanggal + 'T23:59:59&order=no_surat.asc';

        console.log('📡 Query:', query);

        GM_xmlhttpRequest({
            method: 'GET',
            url: query,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY
            },
            onload: function(response) {
                console.log('📥 Response status:', response.status);
                try {
                    const data = JSON.parse(response.responseText);
                    console.log('📊 Data:', data.length, 'baris');
                    generateLaporan(data, tanggal);
                } catch(e) {
                    console.error('❌ Error:', e);
                    container.textContent = '❌ Error: ' + e.message;
                }
            },
            onerror: function() {
                container.textContent = '❌ Gagal mengambil data';
            }
        });
    }

    // ============================================================
    // GENERATE LAPORAN - DENGAN NOMOR URUT
    // ============================================================
    function generateLaporan(data, tanggal) {
        const container = document.getElementById('keuangan-container');
        const maxChars = 32;
        const line = '='.repeat(maxChars);
        const dash = '-'.repeat(maxChars);

        const dateObj = new Date(tanggal + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        let output = '';

        output += centerText('PUSKESMAS KEDAWUNG', maxChars) + '\n';
        output += line + '\n';
        output += centerText('LAPORAN PENERIMAAN HARIAN', maxChars) + '\n';
        output += line + '\n';
        output += `Tanggal : ${formattedDate}\n`;
        output += dash + '\n';

        output += padText('No', 3) + ' ' + padText('No Surat', 10) + ' ' + padText('Tarif', 8) + '\n';
        output += dash + '\n';

        let totalTarif = 0;
        data.forEach((row, i) => {
            const tarif = parseInt(row.tarif) || 0;
            totalTarif += tarif;

            // 🔥 FIX: Ambil NOMOR URUT saja (contoh: 0025)
            const noSurat = extractNomorUrut(row.no_surat);

            output += padText(String(i + 1), 3) + ' ' + padText(noSurat, 10) + ' ' + padText(tarif.toLocaleString('id-ID'), 8) + '\n';

            // Baris kedua: Keperluan (indentasi)
            if (row.keperluan && row.keperluan !== '-') {
                const keperluan = row.keperluan.length > 28 ? row.keperluan.substring(0, 25) + '...' : row.keperluan;
                output += '    ' + keperluan + '\n';
            }
        });

        output += line + '\n';
        output += `Total Transaksi : ${data.length}\n`;
        output += `Total Tarif     : Rp ${totalTarif.toLocaleString('id-ID')}\n`;
        output += line + '\n';
        output += `Dicetak : ${new Date().toLocaleString('id-ID')}\n`;

        container.textContent = output;

        window._keuanganData = { output, total: data.length, totalTarif };
    }

    // ============================================================
    // PRINT KEUANGAN
    // ============================================================
    function printKeuangan() {
        const data = window._keuanganData;
        if (!data) {
            alert('⚠️ Silakan tampilkan data terlebih dahulu!');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) {
            alert('⚠️ Popup diblokir! Izinkan popup untuk mencetak.');
            return;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Laporan Keuangan</title>
                <meta charset="UTF-8">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Courier New', monospace; font-size: 9px; padding: 10px; max-width: 58mm; margin: 0 auto; background: white; }
                    .content { white-space: pre-wrap; word-break: break-all; }
                    @page { size: 58mm auto; margin: 3mm; }
                    @media print { body { padding: 5px; } }
                </style>
            </head>
            <body>
                <div class="content">${data.output}</div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 1000);
                        }, 500);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    // ============================================================
    // HELPER FUNCTIONS
    // ============================================================
    function centerText(text, maxChars) {
        const padding = Math.max(0, maxChars - text.length);
        return ' '.repeat(Math.floor(padding / 2)) + text + ' '.repeat(Math.ceil(padding / 2));
    }

    function padText(text, length) {
        const str = String(text);
        if (str.length >= length) return str.substring(0, length);
        return str + ' '.repeat(length - str.length);
    }

    // ============================================================
    // INIT
    // ============================================================
    if (document.readyState === 'complete') {
        setTimeout(createFloatingIcon, 1500);
    } else {
        window.addEventListener('load', () => setTimeout(createFloatingIcon, 1500));
    }

})();
})(typeof __meta__ !== 'undefined' ? __meta__ : {});