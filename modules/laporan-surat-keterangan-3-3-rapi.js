(function(__meta__){
(function() {
    'use strict';

    // Lindungi dari rename obfuscator (PENTING!)
    var _GM_xmlhttpRequest = window['GM_xmlhttpRequest'];

    // ============================================================
    // KONFIGURASI SUPABASE
    // ============================================================
    var SUPABASE_URL = 'https://ltqxbrfkrgosriieprlc.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_XgXljVXTRZAU-qoZao_h7w_vE6rtWPP';

    console.log('📊 Laporan Surat Keterangan (Supabase) dimulai...');

    // ============================================================
    // LABEL JENIS SURAT
    // ============================================================
    var JENIS_LABEL = {
        'sehat': 'Surat Sehat',
        'sakit': 'Surat Sakit',
        'butawarna': 'Surat Buta Warna',
        'bebasnarkoba': 'Surat Bebas Narkoba'
    };

    // ============================================================
    // NAMA BULAN
    // ============================================================
    var NAMA_BULAN = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    // ============================================================
    // FUNGSI: Capitalize Each Word
    // ============================================================
    function capitalizeWords(str) {
        if (str === null || str === undefined || str === '') {
            return '-';
        }
        str = String(str);
        if (str === '-') {
            return str;
        }
        return str.toLowerCase().replace(/\b\w/g, function(char) {
            return char.toUpperCase();
        });
    }

    // ============================================================
    // FUNGSI: Ekstrak Umur
    // ============================================================
    function extractUmur(umurStr) {
        if (umurStr === null || umurStr === undefined || umurStr === '') {
            return '-';
        }
        umurStr = String(umurStr);
        if (umurStr === '-') {
            return '-';
        }
        var match = umurStr.match(/(\d+)\s*Thn/i);
        return match ? match[1] : umurStr;
    }

    // ============================================================
    // FUNGSI: Ekstrak Kode ICD-10
    // ============================================================
    function extractICD(diagnosaText) {
        if (diagnosaText === null || diagnosaText === undefined || diagnosaText === '') {
            return '-';
        }
        diagnosaText = String(diagnosaText);
        if (diagnosaText === '-') {
            return '-';
        }

        var pattern = /([A-Z]\d{2}(?:\.\d{1,2})?)\s*-\s*[^;]+/g;
        var codes = [];
        var match;

        while ((match = pattern.exec(diagnosaText)) !== null) {
            codes.push(match[1]);
        }

        if (codes.length === 0) {
            var simplePattern = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
            var simpleCodes = diagnosaText.match(simplePattern);
            if (simpleCodes && simpleCodes.length > 0) {
                return simpleCodes.join('; ');
            }
            return '-';
        }

        // Manual unique (hindari Set + spread operator)
        var uniqueCodes = [];
        var k;
        for (k = 0; k < codes.length; k++) {
            if (uniqueCodes.indexOf(codes[k]) === -1) {
                uniqueCodes.push(codes[k]);
            }
        }
        return uniqueCodes.join('; ');
    }

    // ============================================================
    // BUAT TOMBOL FLOATING
    // ============================================================
    function createFloatingIcon() {
        if (document.getElementById('laporan-supabase-btn')) {
            return;
        }

        var container = document.createElement('div');
        container.id = 'laporan-supabase-btn';
        container.style.cssText = 'position: fixed;'
            + 'bottom: 100px;'
            + 'right: 30px;'
            + 'z-index: 999999;'
            + 'cursor: pointer;'
            + 'width: 60px;'
            + 'height: 60px;'
            + 'background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);'
            + 'border-radius: 50%;'
            + 'box-shadow: 0 4px 15px rgba(59, 130, 246, 0.5);'
            + 'display: flex;'
            + 'align-items: center;'
            + 'justify-content: center;'
            + 'color: white;'
            + 'font-size: 28px;'
            + 'border: 2px solid white;'
            + 'user-select: none;'
            + 'transition: all 0.3s;';
        container.textContent = '📊';

        container.onmouseover = function() {
            container.style.transform = 'scale(1.1)';
            container.style.boxShadow = '0 6px 25px rgba(59, 130, 246, 0.7)';
        };
        container.onmouseout = function() {
            container.style.transform = 'scale(1)';
            container.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.5)';
        };

        var tooltip = document.createElement('div');
        tooltip.style.cssText = 'position: absolute;'
            + 'bottom: 70px;'
            + 'right: 0;'
            + 'background: #333;'
            + 'color: white;'
            + 'padding: 8px 16px;'
            + 'border-radius: 6px;'
            + 'font-size: 12px;'
            + 'white-space: nowrap;'
            + 'opacity: 0;'
            + 'transition: opacity 0.3s;'
            + 'pointer-events: none;'
            + 'font-family: Arial, sans-serif;';
        tooltip.textContent = '📊 Laporan Surat';
        container.appendChild(tooltip);

        container.addEventListener('mouseenter', function() {
            tooltip.style.opacity = '1';
        });
        container.addEventListener('mouseleave', function() {
            tooltip.style.opacity = '0';
        });

        container.addEventListener('click', openPopup);
        document.body.appendChild(container);
    }

    // ============================================================
    // GET PERIODE TEXT
    // ============================================================
    function getPeriodeText(periode) {
        var now = new Date();
        var bulan = NAMA_BULAN[now.getMonth()];
        var tahun = now.getFullYear();

        if (periode === 'all') {
            return 'Semua Data';
        }
        if (periode === 'hari_ini') {
            return now.getDate() + ' ' + bulan + ' ' + tahun;
        }
        if (periode === 'minggu_ini') {
            var start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            var end = new Date(now);
            end.setDate(now.getDate() + (6 - now.getDay()));
            return start.getDate() + ' - ' + end.getDate() + ' ' + bulan + ' ' + tahun;
        }
        if (periode === 'bulan_ini') {
            return bulan + ' ' + tahun;
        }
        return bulan + ' ' + tahun;
    }

    // ============================================================
    // POPUP LAPORAN
    // ============================================================
    function openPopup() {
        if (document.getElementById('laporan-supabase-popup')) {
            document.getElementById('laporan-supabase-popup').style.display = 'flex';
            return;
        }

        var overlay = document.createElement('div');
        overlay.id = 'laporan-supabase-popup';
        overlay.style.cssText = 'position: fixed;'
            + 'top: 0;'
            + 'left: 0;'
            + 'width: 100%;'
            + 'height: 100%;'
            + 'background: rgba(0,0,0,0.7);'
            + 'z-index: 9999999;'
            + 'display: flex;'
            + 'justify-content: center;'
            + 'align-items: center;'
            + 'font-family: Arial, sans-serif;';

        var popup = document.createElement('div');
        popup.style.cssText = 'background: white;'
            + 'padding: 25px;'
            + 'border-radius: 12px;'
            + 'max-width: 1200px;'
            + 'width: 95%;'
            + 'max-height: 90vh;'
            + 'overflow-y: auto;'
            + 'box-shadow: 0 4px 30px rgba(0,0,0,0.3);';

        popup.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #3b82f6; padding-bottom:15px; margin-bottom:20px;">'
            + '<div>'
            + '<h2 id="popup-judul" style="margin:0; color:#333; font-size:20px;">📋 Laporan Surat Keterangan</h2>'
            + '<p id="popup-periode" style="margin:5px 0 0 0; color:#6c757d; font-size:14px;">Periode: Agustusan 2026</p>'
            + '</div>'
            + '<button id="close-popup" style="background:none; border:none; font-size:28px; cursor:pointer; color:#6c757d; padding:0 10px;">×</button>'
            + '</div>'
            + '<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; padding:12px 16px; background:#f8f9fa; border-radius:8px; margin-bottom:20px;">'
            + '<div style="display:flex; gap:6px; align-items:center;">'
            + '<label style="font-weight:bold; font-size:13px;">Jenis Surat:</label>'
            + '<select id="filter-jenis" style="padding:5px 10px; border:1px solid #ddd; border-radius:5px; font-size:13px;">'
            + '<option value="sehat">Surat Sehat</option>'
            + '<option value="sakit">Surat Sakit</option>'
            + '<option value="butawarna">Surat Buta Warna</option>'
            + '<option value="bebasnarkoba">Surat Bebas Narkoba</option>'
            + '</select>'
            + '</div>'
            + '<div style="display:flex; gap:6px; align-items:center;">'
            + '<label style="font-weight:bold; font-size:13px;">Periode:</label>'
            + '<select id="filter-periode" style="padding:5px 10px; border:1px solid #ddd; border-radius:5px; font-size:13px;">'
            + '<option value="all">Semua Data</option>'
            + '<option value="hari_ini">Hari Ini</option>'
            + '<option value="minggu_ini">Minggu Ini</option>'
            + '<option value="bulan_ini" selected>Bulan Ini</option>'
            + '</select>'
            + '</div>'
            + '<button id="btn-tampilkan" style="padding:6px 20px; background:#3b82f6; color:white; border:none; border-radius:5px; cursor:pointer; font-size:13px;">🔍 Tampilkan</button>'
            + '<button id="btn-print" style="padding:6px 20px; background:#22c55e; color:white; border:none; border-radius:5px; cursor:pointer; font-size:13px;">🖨️ Cetak/PDF</button>'
            + '<button id="btn-export-excel" style="padding:6px 20px; background:#f59e0b; color:white; border:none; border-radius:5px; cursor:pointer; font-size:13px;">📥 Export Excel</button>'
            + '</div>'
            + '<div id="laporan-container">'
            + '<div style="text-align:center; padding:40px; color:#6c757d;">'
            + '<div style="font-size:40px; margin-bottom:10px;">📊</div>'
            + '<div>Klik Tampilkan untuk memuat data</div>'
            + '</div>'
            + '</div>'
            + '<div style="margin-top:15px; padding-top:15px; border-top:1px solid #ddd; text-align:center; font-size:12px; color:#6c757d;">'
            + 'Dicetak nih: <span id="print-date">-</span>'
            + '</div>';

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        document.getElementById('close-popup').addEventListener('click', function() {
            overlay.remove();
        });
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        document.getElementById('btn-tampilkan').addEventListener('click', loadLaporan);
        document.getElementById('btn-print').addEventListener('click', printLaporan);
        document.getElementById('btn-export-excel').addEventListener('click', exportExcel);

        var periode = document.getElementById('filter-periode').value;
        document.getElementById('popup-periode').textContent = 'Periode: ' + getPeriodeText(periode);

        setTimeout(loadLaporan, 300);
    }

    // ============================================================
    // LOAD LAPORAN
    // ============================================================
    function loadLaporan() {
        var jenis = document.getElementById('filter-jenis').value;
        var periode = document.getElementById('filter-periode').value;
        var container = document.getElementById('laporan-container');

        document.getElementById('popup-judul').textContent = '📋 Laporan ' + (JENIS_LABEL[jenis] || 'Surat Keterangan');
        document.getElementById('popup-periode').textContent = 'Periode: ' + getPeriodeText(periode);
        document.getElementById('print-date').textContent = new Date().toLocaleString('id-ID');

        container.innerHTML = '<div style="text-align:center; padding:40px; color:#6c757d;">⏳ Memuat data...</div>';

        var query = SUPABASE_URL + '/rest/v1/surat_keterangan?select=*';
        query += '&jenis_surat=eq.' + jenis;

        var now = new Date();
        if (periode === 'hari_ini') {
            var today = now.toISOString().split('T')[0];
            query += '&created_at=gte.' + today + 'T00:00:00';
            query += '&created_at=lt.' + today + 'T23:59:59';
        } else if (periode === 'minggu_ini') {
            var start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            var end = new Date(now);
            end.setDate(now.getDate() + (6 - now.getDay()));
            query += '&created_at=gte.' + start.toISOString().split('T')[0] + 'T00:00:00';
            query += '&created_at=lt.' + end.toISOString().split('T')[0] + 'T23:59:59';
        } else if (periode === 'bulan_ini') {
            var month = String(now.getMonth() + 1);
            if (month.length < 2) {
                month = '0' + month;
            }
            var year = now.getFullYear();
            query += '&created_at=gte.' + year + '-' + month + '-01T00:00:00';
            query += '&created_at=lt.' + year + '-' + month + '-31T23:59:59';
        }

        query += '&order=created_at.desc';

        console.log('📡 Query:', query);

        _GM_xmlhttpRequest({
            method: 'GET',
            url: query,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY
            },
            onload: function(response) {
                console.log('📥 Response status:', response.status);
                try {
                    var data = JSON.parse(response.responseText);
                    console.log('📊 Data:', data.length, 'baris');
                    renderTable(data, jenis);
                } catch(e) {
                    console.error('❌ Error:', e);
                    container.innerHTML = '<div style="text-align:center; padding:40px; color:#dc3545;">❌ Error: ' + e.message + '</div>';
                }
            },
            onerror: function(error) {
                console.error('❌ Error:', error);
                container.innerHTML = '<div style="text-align:center; padding:40px; color:#dc3545;">❌ Gagal mengambil data</div>';
            }
        });
    }

    // ============================================================
    // RENDER TABLE
    // ============================================================
    function renderTable(data, jenis) {
        var container = document.getElementById('laporan-container');

        if (!data || data.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#6c757d;">'
                + '<div style="font-size:40px; margin-bottom:10px;">📭</div>'
                + '<div>Tidak ada data</div>'
                + '</div>';
            return;
        }

        var columns = [];

        var commonColumns = [
            { key: 'created_at', label: 'Tanggal', format: function(v) { return v ? new Date(v).toLocaleDateString('id-ID') : '-'; } },
            { key: 'no_surat', label: 'No Surat' },
            { key: 'nama', label: 'Nama', format: function(v) { return capitalizeWords(v); } },
            { key: 'umur', label: 'Umur', format: function(v) { return extractUmur(v); } },
            { key: 'jenis_kelamin', label: 'JK', format: function(v) {
                if (v === 'Laki-laki') return 'L';
                if (v === 'Perempuan') return 'P';
                return v;
            } },
            { key: 'kelurahan', label: 'Alamat', format: function(v) { return capitalizeWords(v); } }
        ];

        var extraColumns = {
            'sehat': [
                { key: 'keperluan', label: 'Keperluan', format: function(v) { return capitalizeWords(v); } },
                { key: 'tarif', label: 'Tarif', align: 'right', format: function(v) {
                    var num = parseInt(v);
                    if (!isNaN(num) && num > 0) {
                        return num.toLocaleString('id-ID');
                    }
                    return '-';
                } }
            ],
            'sakit': [
                { key: 'diagnosa', label: 'Diagnosa (ICD-10)', format: function(v) { return extractICD(v); } },
                { key: 'selama', label: 'Lama (hari)' }
            ],
            'butawarna': [
                { key: 'visus_od', label: 'Visus OD' },
                { key: 'visus_os', label: 'Visus OS' },
                { key: 'buta_warna', label: 'Buta Warna' }
            ],
            'bebasnarkoba': [
                { key: 'sample', label: 'Sample' },
                { key: 'kesimpulan', label: 'Kesimpulan' }
            ]
        };

        var i;
        for (i = 0; i < commonColumns.length; i++) {
            columns.push(commonColumns[i]);
        }
        var extra = extraColumns[jenis] || [];
        for (i = 0; i < extra.length; i++) {
            columns.push(extra[i]);
        }

        var html = '<div style="overflow-x:auto; margin-top:10px;">';
        html += '<table style="width:100%; border-collapse:collapse; font-size:12px; border:2px solid #000000;" id="laporan-table">';

        html += '<thead><tr style="background:#ffffff; color:#000000; border:2px solid #000000;">';
        html += '<th style="padding:8px 10px; border:2px solid #000000; text-align:center; font-weight:bold;">No</th>';
        for (i = 0; i < columns.length; i++) {
            var col = columns[i];
            var align = col.align || 'left';
            html += '<th style="padding:8px 10px; border:2px solid #000000; text-align:' + align + '; font-weight:bold;">' + col.label + '</th>';
        }
        html += '</tr></thead>';

        html += '<tbody>';
        var totalTarif = 0;

        for (var idx = 0; idx < data.length; idx++) {
            var row = data[idx];
            var bg = (idx % 2 === 0) ? '#ffffff' : '#f8f9fa';
            html += '<tr style="background:' + bg + ';">';
            html += '<td style="padding:6px 10px; border:1px solid #000000; text-align:center;">' + (idx + 1) + '</td>';

            for (var j = 0; j < columns.length; j++) {
                var col2 = columns[j];
                var value = row[col2.key];
                if (value === null || value === undefined) {
                    value = '-';
                }
                var align2 = col2.align || 'left';

                if (col2.format) {
                    value = col2.format(value);
                }

                if (col2.key !== 'no_surat' && typeof value === 'string' && value.length > 35) {
                    value = value.substring(0, 32) + '...';
                }

                html += '<td style="padding:6px 10px; border:1px solid #000000; text-align:' + align2 + ';">' + value + '</td>';
            }

            html += '</tr>';

            if (jenis === 'sehat') {
                var tarif = parseInt(row.tarif);
                if (!isNaN(tarif)) {
                    totalTarif += tarif;
                }
            }
        }

        html += '</tbody></table></div>';

        html += '<div style="margin-top:12px; padding:12px 16px; background:#f8f9fa; border-radius:8px; font-size:14px; display:flex; flex-wrap:wrap; gap:20px; border:1px solid #000000;">';
        html += '<span>📊 Total: <strong>' + data.length + '</strong> surat</span>';
        if (jenis === 'sehat' && totalTarif > 0) {
            html += '<span>💰 Total Tarif: <strong>Rp ' + totalTarif.toLocaleString('id-ID') + '</strong></span>';
        }
        html += '</div>';

        container.innerHTML = html;
    }

    // ============================================================
    // PRINT LAPORAN
    // ============================================================
    function printLaporan() {
        var table = document.querySelector('#laporan-table');
        if (!table) {
            alert('⚠️ Tidak ada data untuk dicetak!');
            return;
        }

        var judul = document.getElementById('popup-judul').textContent;
        var periode = document.getElementById('popup-periode').textContent;
        var printDate = document.getElementById('print-date').textContent;

        var printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) {
            alert('⚠️ Popup diblokir! Izinkan popup untuk mencetak.');
            return;
        }

        var summaryDiv = document.querySelector('#laporan-container > div:last-child');
        var summaryHTML = summaryDiv ? summaryDiv.outerHTML : '';

        var htmlContent = '<html>'
            + '<head>'
            + '<title>' + judul + '</title>'
            + '<meta charset="UTF-8">'
            + '<style>'
            + '* { margin: 0; padding: 0; box-sizing: border-box; }'
            + 'body { font-family: Arial, sans-serif; padding: 20px; background: white; }'
            + '.header { text-align: center; border-bottom: 2px solid #000000; padding-bottom: 15px; margin-bottom: 20px; }'
            + '.header h1 { font-size: 18px; margin-bottom: 5px; }'
            + '.header p { font-size: 13px; color: #333; margin: 3px 0; }'
            + 'table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; border: 2px solid #000000 !important; }'
            + 'table th { background: #ffffff !important; color: #000000 !important; padding: 5px 6px; border: 2px solid #000000 !important; text-align: left; font-weight: bold !important; }'
            + 'table td { padding: 4px 6px; border: 1px solid #000000 !important; }'
            + 'table tbody tr:nth-child(even) { background: #f2f2f2; }'
            + '.summary { margin-top: 15px; font-size: 13px; border: 1px solid #000000; padding: 12px 16px; border-radius: 8px; }'
            + '.footer { margin-top: 25px; padding-top: 15px; border-top: 1px solid #000000; text-align: center; font-size: 10px; color: #666; }'
            + '@page { size: A4 landscape; margin: 8mm; }'
            + '@media print { body { padding: 0; } }'
            + '</style>'
            + '</head>'
            + '<body>'
            + '<div class="header">'
            + '<h1>' + judul + '</h1>'
            + '<p>' + periode + '</p>'
            + '<p>Puskesmas Kedawung</p>'
            + '</div>'
            + table.outerHTML
            + '<div class="summary">' + summaryHTML + '</div>'
            + '<div class="footer">Dicetaknih: ' + printDate + '</div>'
            + '<scr' + 'ipt>'
            + 'window.onload = function() {'
            + 'setTimeout(function() {'
            + 'window.print();'
            + 'setTimeout(function() { window.close(); }, 1000);'
            + '}, 500);'
            + '};'
            + '</scr' + 'ipt>'
            + '</body>'
            + '</html>';

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    }

    // ============================================================
    // EXPORT EXCEL (CSV)
    // ============================================================
    function exportExcel() {
        var table = document.querySelector('#laporan-table');
        if (!table) {
            alert('⚠️ Tidak ada data untuk di-export!');
            return;
        }

        var rows = table.querySelectorAll('tr');
        var csv = '';

        for (var i = 0; i < rows.length; i++) {
            var cells = rows[i].querySelectorAll('th, td');
            var rowData = [];
            for (var j = 0; j < cells.length; j++) {
                var text = cells[j].textContent.trim();
                if (text.indexOf(',') !== -1 || text.indexOf('"') !== -1 || text.indexOf('\n') !== -1) {
                    text = '"' + text.replace(/"/g, '""') + '"';
                }
                rowData.push(text);
            }
            csv += rowData.join(',') + '\n';
        }

        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Laporan_Surat_' + new Date().toISOString().split('T')[0] + '.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // ============================================================
    // INIT
    // ============================================================
    if (document.readyState === 'complete') {
        setTimeout(createFloatingIcon, 1500);
    } else {
        window.addEventListener('load', function() {
            setTimeout(createFloatingIcon, 1500);
        });
    }

})();
})(typeof __meta__ !== 'undefined' ? __meta__ : {});
