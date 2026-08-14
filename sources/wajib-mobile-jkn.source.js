// ============================================================
// Module: wajib-mobile-jkn
// Nama: Wajib Mobile JKN
// Versi: 2.0
// Kategori: skrining
// Tier: dasar
// Deskripsi: Mengganti tombol pendaftaran BPJS dengan pesan wajib Mobile JKN + audio lanjutan
// Dependencies: 
// Bypass Whitelist: false
// Tanggal: 14/8/2026, 18.47.39
// ============================================================
// ==UserScript==
// @name         Wajib Mobile JKN
// @namespace    puskesmas-kedawung
// @version      2.0
// @description  Mengganti tombol pendaftaran BPJS dengan pesan wajib Mobile JKN + audio lanjutan
// @author       Anda
// @match        https://*.epuskesmas.id/antreanpendaftaran*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PESAN_ID = 'pesan-mobile-jkn';

    // Teks yang akan dibacakan TTS setelah audio bpjs_aktif selesai
    const TEKS_TTS = 'Silahkan mendaftar menggunakan Mobile JKN';

    // Pesan menyesuaikan tema Bootstrap modal (warna, font-size, dll ikut modal asli)
    // Hanya judul tetap kuning & besar sesuai permintaan
    const PESAN_HTML = `
        <div id="${PESAN_ID}" style="width: 100%; padding: 4px 0 0;">
            <div style="
                font-size: 18px;
                font-weight: bold;
                color: #f9a825;
                text-align: center;
                margin-bottom: 10px;
                line-height: 1.4;
            ">
                SILAHKAN MENDAFTAR<br>MENGGUNAKAN MOBILE JKN
            </div>
            <div style="
                font-size: 16px;
                color: #555;
                text-align: center;
                line-height: 1.7;
                margin-bottom: 8px;
            ">
                Pendaftaran pasien BPJS melalui OFFLINE<br>
                <strong>tidak lagi tersedia</strong>.<br>
                Gunakan aplikasi <strong>Mobile JKN</strong> di smartphone Anda<br>
                untuk mendaftar antrian ke poli yang dituju.
            </div>
            <div style="
                background: #f8f9fa;
                border-radius: 6px;
                padding: 7px 12px;
                font-size: 14px;
                color: #777;
                text-align: center;
                border: 1px solid #e9ecef;
            ">
                📲 Download: <strong>Mobile JKN</strong> di Play Store / App Store
            </div>
        </div>
    `;

    // ── Audio TTS ────────────────────────────────────────────────
    // Intersep Audio.prototype.play untuk mendeteksi kapan bpjs_aktif.ogg selesai,
    // lalu langsung putar TTS "Silahkan mendaftar menggunakan Mobile JKN"
    const playAsli = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
        const hasil = playAsli.apply(this, arguments);
        if (this.src && this.src.includes('bpjs_aktif')) {
            this.addEventListener('ended', function onEnded() {
                this.removeEventListener('ended', onEnded);
                putarTTS();
            });
        }
        return hasil;
    };

    function putarTTS() {
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel(); // stop jika ada TTS sebelumnya
        const utt = new SpeechSynthesisUtterance(TEKS_TTS);
        utt.lang  = 'id-ID';
        utt.rate  = 0.9;
        utt.pitch = 1;
        speechSynthesis.speak(utt);
    }

    // ── Modal intersep ───────────────────────────────────────────
    function getVueInstance() {
        const el = document.getElementById('app');
        return el && el.__vue__ ? el.__vue__ : null;
    }

    function resetKeHalamanAwal() {
        // Stop TTS jika masih berjalan
        if (window.speechSynthesis) speechSynthesis.cancel();

        const vue = getVueInstance();
        if (vue && typeof vue.backToPendaftaran === 'function') {
            vue.backToPendaftaran();
        } else {
            location.reload();
        }
    }

    function intersepModalBPJS() {
        // Hanya intersep untuk pasien BPJS (formSelect == '1')
        const vue = getVueInstance();
        if (!vue || String(vue.formSelect) !== '1') return;

        const modal       = document.getElementById('modal_data_pasien');
        const modalFooter = modal ? modal.querySelector('.modal-footer') : null;
        if (!modalFooter) return;

        // Jangan duplikat
        if (modalFooter.querySelector('#' + PESAN_ID)) return;

        // Sembunyikan tombol asli
        modalFooter.querySelectorAll('button').forEach(btn => {
            btn.style.display = 'none';
        });

        // Sisipkan pesan
        modalFooter.insertAdjacentHTML('afterbegin', PESAN_HTML);
    }

    function bersihkanModal() {
        const modal       = document.getElementById('modal_data_pasien');
        const modalFooter = modal ? modal.querySelector('.modal-footer') : null;
        if (!modalFooter) return;

        const pesan = modalFooter.querySelector('#' + PESAN_ID);
        if (pesan) pesan.remove();

        modalFooter.querySelectorAll('button').forEach(btn => {
            btn.style.display = '';
        });
    }

    // Saat modal mulai tampil → intersep
    $(document).on('show.bs.modal', '#modal_data_pasien', function () {
        setTimeout(intersepModalBPJS, 100);
    });

    // Saat modal selesai ditutup → bersihkan + stop TTS + reset halaman (khusus BPJS)
    $(document).on('hidden.bs.modal', '#modal_data_pasien', function () {
        const vue = getVueInstance();
        const isBPJS = vue && String(vue.formSelect) === '1';
        bersihkanModal();
        if (isBPJS) resetKeHalamanAwal();
    });

})();