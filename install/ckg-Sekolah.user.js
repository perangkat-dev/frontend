// ==UserScript==
// @name         CKG Sekolah - Auto Answer Pemeriksaan Mandiri
// @namespace    puskesmas-kedawung
// @version      2.1
// @description  Mengisi jawaban otomatis 9 form Pemeriksaan Mandiri CKG. Menampilkan Popup Ringkasan di halaman awal setelah selesai.
// @author       you
// @match        https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah/detail-pemeriksaan*
// @match        https://form.kemkes.go.id/v2/skrining-form/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // =====================================================
  // KONFIGURASI STATE
  // =====================================================
  const K = {
    queue: 'ckg_aa_queue',
    idx: 'ckg_aa_idx',
    student: 'ckg_aa_student',
    running: 'ckg_aa_running',
    skipStreak: 'ckg_aa_skip',
    summary: 'ckg_aa_summary', // BARU: Menyimpan daftar jawaban yang telah diisi
  };

  // =====================================================
  // ATURAN AUTO-ANSWER
  // =====================================================
  const RULES = {
    'FRM000123': [ // Kesehatan Reproduksi Putri
      { match: 'Apakah sudah mengalami menstruasi?', answer: 'Ya' },
      { match: 'Pada usia berapa Anda mengalami menstruasi pertama?', answer: '8 tahun -16 tahun' }
    ],
    'FRM000118': [ // Perilaku Merokok
      { match: 'Apakah Anda merokok dalam setahun terakhir ini?', answer: 'Ya' },
      { match: 'Jika perokok, jenis rokok apa yang dikonsumsi?', answer: 'Rokok konvensional' }
    ],
    'FRM000181': [ // Faktor Risiko TB
      { match: 'batuk yang tidak sembuh-sembuh', answer: 'Tidak batuk' }
    ]
  };

  const FORMS_WITH_RANDOM_NUMBER = ['FRM000121', 'FRM000118'];
  const DEFAULT_NEGATIVE_KEYWORDS = [
    'Tidak batuk', 'Tidak ada serumen', 'Tidak ada infeksi', 'Tidak ada',
    'Normal', 'Non-Reaktif', 'Non Reaktif', 'Bukan frambusia',
    'Tidak', 'HBsAg Non', 'Anti HCV Non'
  ];
  const FORBIDDEN_BTN_WORDS = ['kirim', 'submit', 'selesai', 'simpan', 'complete', 'finish'];

  // =====================================================
  // UTILITAS
  // =====================================================
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function log(msg) {
    const el = document.getElementById('aa-log');
    if (el) {
      const line = document.createElement('div');
      line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      el.prepend(line);
      while (el.children.length > 15) el.removeChild(el.lastChild);
    }
    console.log('[CKG-AutoAnswer]', msg);
  }

  function showBadge(msg, isError) {
    GM_addStyle(`#aa-badge { position: fixed; bottom: 16px; right: 16px; z-index: 999999; max-width: 360px; padding: 10px 14px; border-radius: 8px; font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,.2); }`);
    let el = document.getElementById('aa-badge');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aa-badge';
      document.body.appendChild(el);
    }
    el.style.background = isError ? '#fde2e2' : '#d4edda';
    el.style.color = isError ? '#a11' : '#155724';
    el.textContent = msg;
  }

  function waitFor(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);
      const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { obs.disconnect(); resolve(el); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('timeout ' + selector)); }, timeout);
    });
  }

  function getInfoField(label) {
    const divs = Array.from(document.querySelectorAll('div'));
    const labelEl = divs.find(d => d.children.length === 0 && d.textContent.trim() === label);
    return labelEl?.nextElementSibling?.textContent.trim() || '';
  }

  function triggerNativeInput(inputEl, value) {
    const isCheck = inputEl.type === 'checkbox' || inputEl.type === 'radio';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, isCheck ? 'checked' : 'value').set;
    setter.call(inputEl, value);
    inputEl.dispatchEvent(new Event('click', { bubbles: true }));
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // =====================================================
  // HALAMAN AWAL: Queue Management & Popup Summary
  // =====================================================
  async function runOnListPage() {
    GM_addStyle(`
      #aa-panel { position: fixed; top: 80px; right: 16px; z-index: 999999; width: 320px; background: #fff; border: 1px solid #ccc; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,.15); font: 13px/1.4 system-ui, sans-serif; padding: 12px; }
      #aa-panel h3 { margin: 0 0 8px; font-size: 14px; color: #1a73e8; }
      #aa-panel button { margin: 2px 4px 2px 0; padding: 7px 11px; border-radius: 6px; border: 1px solid #ccc; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500; }
      #aa-panel button:hover { background: #eee; }
      #aa-panel button.primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }
      #aa-panel button.primary:hover { background: #1557b0; }
      #aa-panel .ckg-status { margin: 6px 0; font-size: 12px; color: #444; }
      #aa-log { max-height: 140px; overflow: auto; font-size: 11px; color: #666; border-top: 1px solid #eee; margin-top: 8px; padding-top: 6px; font-family: monospace; }
    `);

    const panel = document.createElement('div');
    panel.id = 'aa-panel';
    panel.innerHTML = `
      <h3>🤖 Auto Answer Mandiri</h3>
      <div class="ckg-status" id="aa-student-info">Membaca data siswa...</div>
      <div class="ckg-status" id="aa-progress"></div>
      <button id="aa-start" class="primary">▶️ Mulai Auto-Fill</button>
      <button id="aa-stop">⏸️ Berhenti</button>
      <button id="aa-reset">🔄 Reset Antrean</button>
      <button id="aa-show-summary" style="width:100%; margin-top:8px;">📋 Lihat Ringkasan Terakhir</button>
      <div id="aa-log"></div>
    `;
    document.body.appendChild(panel);

    const gender = getInfoField('Jenis Kelamin') || 'TIDAK_TERDETEKSI';
    const genderImg = document.querySelector('img[src*="icon-gender-"]');
    const nama = genderImg?.closest('.flex.items-center.gap-4')?.querySelector('div')?.textContent.trim() || 'Unknown';
    const kelas = genderImg?.closest('.flex.items-center.gap-4')?.nextElementSibling?.textContent.trim()
      || Array.from(document.querySelectorAll('div')).find(d => d.children.length === 0 && /kelas\s*\d+/i.test(d.textContent))?.textContent.trim()
      || 'Unknown';
    const sekolah = getInfoField('Nama Sekolah');

    const student = { nama, gender, kelas, sekolah };
    GM_setValue(K.student, student);

    document.getElementById('aa-student-info').textContent = `${nama} | ${gender} | ${kelas}`;
    log(`Siswa aktif: ${nama} (${gender}, ${kelas})`);

    function refreshProgress() {
      const queue = GM_getValue(K.queue, []);
      const idx = GM_getValue(K.idx, 0);
      document.getElementById('aa-progress').textContent =
        queue.length ? `Progres: ${idx}/${queue.length} form` : 'Belum ada antrean.';
    }

    function buildQueue() {
      const items = [];
      document.querySelectorAll('[id^="rowfrm" i]').forEach(el => {
        const frm = el.id.replace(/^row/i, '').toUpperCase();
        const layanan = el.closest('tr')?.querySelector('td.pl-4\\.5')?.textContent.trim()
          || el.closest('tr')?.querySelector('td')?.textContent.trim() || '';
        items.push({ id: el.id, frm, layanan, kategori: 'Pemeriksaan Mandiri' });
      });
      GM_setValue(K.queue, items);
      GM_setValue(K.idx, 0);
      log(`Antrean dibuat: ${items.length} form Pemeriksaan Mandiri`);
      refreshProgress();
      return items;
    }

    // ================== POPUP SUMMARY ==================
    function showSummaryPopup() {
      const summary = GM_getValue(K.summary, []);
      if (!summary || summary.length === 0) {
        alert('Belum ada ringkasan jawaban yang tersimpan.');
        return;
      }

      const studentData = GM_getValue(K.student, {});

      GM_addStyle(`
        #aa-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999999; display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; }
        #aa-modal { background: #fff; border-radius: 12px; width: 90%; max-width: 720px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
        #aa-modal-header { padding: 16px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        #aa-modal-header h2 { margin: 0; font-size: 18px; color: #1a73e8; }
        #aa-modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }
        #aa-modal-body { padding: 20px; overflow-y: auto; flex: 1; }
        #aa-modal-footer { padding: 16px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        #aa-modal-footer button { padding: 8px 14px; border-radius: 6px; border: 1px solid #ccc; background: #f5f5f5; cursor: pointer; font-size: 13px; font-weight: 500; }
        #aa-modal-footer button.primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }
        #aa-modal-footer button.danger { background: #dc3545; color: #fff; border-color: #dc3545; }
        .aa-summary-meta { background: #f0f8ff; padding: 10px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: #333; }
        .aa-form-group { margin-bottom: 12px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .aa-form-title { padding: 12px 14px; background: #f8f9fa; font-weight: 600; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
        .aa-form-title:hover { background: #e9ecef; }
        .aa-qa-list { padding: 14px; display: none; border-top: 1px solid #eee; background: #fff; }
        .aa-qa-list.active { display: block; }
        .aa-qa-item { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #eee; font-size: 13px; line-height: 1.5; }
        .aa-qa-item:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
        .aa-q { color: #333; display: block; }
        .aa-a { color: #1a73e8; font-weight: 600; display: inline-block; margin-top: 4px; }
        .aa-badge-count { background: #1a73e8; color: #fff; border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: normal; }
      `);

      const overlay = document.createElement('div');
      overlay.id = 'aa-modal-overlay';

      let bodyHTML = `
        <div class="aa-summary-meta">
          <strong>Siswa:</strong> ${studentData.nama || 'Unknown'} |
          <strong>Gender:</strong> ${studentData.gender || 'Unknown'} |
          <strong>Kelas:</strong> ${studentData.kelas || 'Unknown'}<br>
          <strong>Total Form Diisi:</strong> ${summary.length} form
        </div>
      `;

      summary.forEach((form, index) => {
        const answersHTML = form.jawaban.map(j => `
          <div class="aa-qa-item">
            <span class="aa-q">❓ ${j.q}</span>
            <span class="aa-a">💡 ${j.a}</span>
          </div>
        `).join('');

        bodyHTML += `
          <div class="aa-form-group">
            <div class="aa-form-title" data-target="aa-list-${index}">
              <span>${form.judul} <span style="color:#666; font-weight:normal;">(${form.frm})</span></span>
              <span class="aa-badge-count">${form.jawaban.length} Jawaban</span>
            </div>
            <div class="aa-qa-list" id="aa-list-${index}">
              ${answersHTML || '<em>Tidak ada pertanyaan yang dijawab.</em>'}
            </div>
          </div>
        `;
      });

      overlay.innerHTML = `
        <div id="aa-modal">
          <div id="aa-modal-header">
            <h2>📋 Ringkasan Auto-Answer</h2>
            <button id="aa-modal-close" title="Tutup">&times;</button>
          </div>
          <div id="aa-modal-body">
            ${bodyHTML}
          </div>
          <div id="aa-modal-footer">
            <button id="aa-copy-json">📋 Copy JSON</button>
            <button id="aa-export-json" class="primary">💾 Export JSON</button>
            <button id="aa-clear-done" class="danger">✅ Selesai & Bersihkan</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      document.getElementById('aa-modal-close').onclick = () => overlay.remove();

      document.querySelectorAll('.aa-form-title').forEach(title => {
        title.onclick = () => {
          const targetId = title.getAttribute('data-target');
          const list = document.getElementById(targetId);
          list.classList.toggle('active');
        };
      });

      document.getElementById('aa-copy-json').onclick = () => {
        const jsonStr = JSON.stringify(summary, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
          alert('JSON berhasil disalin ke clipboard!');
        }).catch(() => {
          alert('Gagal menyalin ke clipboard.');
        });
      };

      document.getElementById('aa-export-json').onclick = () => {
        const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ringkasan-auto-answer-${studentData.nama || 'siswa'}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      };

      document.getElementById('aa-clear-done').onclick = () => {
        GM_deleteValue(K.summary);
        GM_deleteValue(K.queue);
        GM_deleteValue(K.idx);
        overlay.remove();
        log('Ringkasan dan antrean dibersihkan. Siap untuk siswa berikutnya.');
        refreshProgress();
      };
    }
    // ================== END POPUP SUMMARY ==================

    async function clickNext() {
      const queue = GM_getValue(K.queue, []);
      let idx = GM_getValue(K.idx, 0);

      if (idx >= queue.length) {
        GM_setValue(K.running, false);
        log(`✅ SELESAI! Semua ${queue.length} form Pemeriksaan Mandiri sudah diisi.`);
        showBadge('✅ Selesai! Menampilkan Ringkasan...', false);
        refreshProgress();
        setTimeout(showSummaryPopup, 800); // Tampilkan popup setelah jeda
        return;
      }

      if (!GM_getValue(K.running, false)) return;

      const item = queue[idx];
      const container = document.getElementById(item.id);
      const btn = container?.querySelector('button, a, [role="button"]');

      if (!btn) {
        log(`Lewati (tombol tidak ada): ${item.frm} - ${item.layanan}`);
        GM_setValue(K.idx, idx + 1);
        refreshProgress();
        await sleep(400);
        return clickNext();
      }

      log(`➡️ Membuka form: ${item.frm} - ${item.layanan}`);
      showBadge(`Membuka ${item.frm}...`);
      const before = location.href;
      await sleep(700);
      btn.click();

      await sleep(2500);
      if (location.href === before && GM_getValue(K.running, false)) {
        const streak = GM_getValue(K.skipStreak, 0) + 1;
        GM_setValue(K.skipStreak, streak);
        log(`⚠️ Form tidak bisa dibuka: ${item.frm}. Dilewati.`);
        GM_setValue(K.idx, idx + 1);
        refreshProgress();

        if (streak >= 5) {
          GM_setValue(K.running, false);
          log('⛔ Berhenti: 5 form berturut-turut gagal dibuka.');
          return;
        }
        await sleep(500);
        return clickNext();
      }
      GM_setValue(K.skipStreak, 0);
    }

    document.getElementById('aa-start').onclick = () => {
      let queue = GM_getValue(K.queue, []);
      const idx = GM_getValue(K.idx, 0);
      if (!queue.length || idx >= queue.length) {
        queue = buildQueue();
      }
      GM_setValue(K.running, true);
      clickNext();
    };

    document.getElementById('aa-stop').onclick = () => {
      GM_setValue(K.running, false);
      log('⏸️ Dihentikan oleh pengguna.');
      showBadge('Dihentikan.', true);
    };

    document.getElementById('aa-reset').onclick = () => {
      GM_deleteValue(K.queue);
      GM_deleteValue(K.idx);
      GM_setValue(K.running, false);
      log('🔄 Antrean direset.');
      refreshProgress();
    };

    document.getElementById('aa-show-summary').onclick = showSummaryPopup;

    refreshProgress();

    if (GM_getValue(K.running, false)) {
      log('Melanjutkan antrean...');
      await sleep(800);
      clickNext();
    }
  }

  // =====================================================
  // HALAMAN FORM: Auto-Answer Logic
  // =====================================================
  function detectFormCode() {
    const questions = document.querySelectorAll('.sd-question[data-name]');
    if (questions.length > 0) {
      const dataName = questions[0].getAttribute('data-name') || '';
      const parts = dataName.split('|');
      if (parts.length >= 2) return parts[1].trim();
    }
    return null;
  }

  function getQuestionText(qEl) {
    const viewer = qEl.querySelector('.sv-title-actions__title .sv-string-viewer');
    const title = qEl.querySelector('.sv-title-actions__title');
    return (viewer || title)?.textContent.trim() || '';
  }

  function getRadioOptions(qEl) {
    return Array.from(qEl.querySelectorAll('input[type="radio"]')).map(r => ({
      input: r,
      value: r.value,
      label: r.closest('label')?.querySelector('.sd-item__control-label .sv-string-viewer')?.textContent.trim()
        || r.closest('label')?.textContent.trim() || ''
    }));
  }

  function findNegativeOption(options) {
    for (const keyword of DEFAULT_NEGATIVE_KEYWORDS) {
      const found = options.find(o => o.label.toLowerCase().includes(keyword.toLowerCase()));
      if (found) return found;
    }
    return options[options.length - 1] || null;
  }

  function findOptionByLabel(options, targetLabel) {
    let found = options.find(o => o.label.trim() === targetLabel.trim());
    if (found) return found;
    found = options.find(o => o.label.toLowerCase().includes(targetLabel.toLowerCase()));
    if (found) return found;
    found = options.find(o => targetLabel.toLowerCase().includes(o.label.toLowerCase()));
    return found || null;
  }

  function getAnswerForQuestion(frmCode, qEl) {
    const questionText = getQuestionText(qEl);
    const textInput = qEl.querySelector('textarea, input[type="text"], input.sd-input, input[type="number"]');
    const radios = qEl.querySelectorAll('input[type="radio"]');

    const formRules = RULES[frmCode] || [];
    for (const rule of formRules) {
      if (rule.match && questionText.toLowerCase().includes(rule.match.toLowerCase())) {
        return { type: 'specific', value: rule.answer };
      }
    }

    if (textInput && FORMS_WITH_RANDOM_NUMBER.includes(frmCode) && radios.length === 0) {
      return { type: 'random_number' };
    }

    if (radios.length > 0) {
      return { type: 'default_negative' };
    }

    if (textInput) {
      return { type: 'text', value: '0' };
    }

    return { type: 'skip' };
  }

  // Mengembalikan objek: { success, q, a }
  async function answerQuestion(qEl, frmCode) {
    const questionText = getQuestionText(qEl) || '(tanpa teks)';
    const answer = getAnswerForQuestion(frmCode, qEl);

    if (answer.type === 'skip') {
      log(`  ⏭️ Skip: ${questionText}`);
      return { success: false };
    }

    if (answer.type === 'text') {
      const textInput = qEl.querySelector('textarea, input[type="text"], input.sd-input, input[type="number"]');
      if (textInput) {
        triggerNativeInput(textInput, answer.value);
        log(`  ✏️ Teks: ${questionText} → "${answer.value}"`);
        return { success: true, q: questionText, a: answer.value };
      }
      return { success: false };
    }

    if (answer.type === 'random_number') {
      const textInput = qEl.querySelector('input[type="text"], input.sd-input, input[type="number"]');
      if (textInput) {
        const val = String(Math.floor(Math.random() * 2) + 1);
        triggerNativeInput(textInput, val);
        log(`  🎲 Random: ${questionText} → "${val}"`);
        return { success: true, q: questionText, a: val };
      }
      return { success: false };
    }

    if (answer.type === 'default_negative') {
      const options = getRadioOptions(qEl);
      if (options.length === 0) return { success: false };
      const target = findNegativeOption(options);
      if (target) {
        triggerNativeInput(target.input, true);
        log(`  ❌ Default: ${questionText} → "${target.label}"`);
        return { success: true, q: questionText, a: target.label };
      }
      return { success: false };
    }

    if (answer.type === 'specific') {
      const options = getRadioOptions(qEl);
      if (options.length === 0) return { success: false };
      const target = findOptionByLabel(options, answer.value);
      if (target) {
        triggerNativeInput(target.input, true);
        log(`  ✅ Khusus: ${questionText} → "${target.label}"`);
        return { success: true, q: questionText, a: target.label };
      } else {
        log(`  ⚠️ Opsi "${answer.value}" tidak ditemukan untuk: ${questionText}`);
        const fallback = findNegativeOption(options);
        if (fallback) {
          triggerNativeInput(fallback.input, true);
          log(`  ❌ Fallback: ${questionText} → "${fallback.label}"`);
          return { success: true, q: questionText, a: fallback.label };
        }
        return { success: false };
      }
    }

    return { success: false };
  }

  async function processForm() {
    const frmCode = detectFormCode();
    if (!frmCode) {
      showBadge('❌ Tidak dapat mendeteksi kode form.', true);
      return;
    }

    log(`═══ Auto-Answer: ${frmCode} ═══`);
    showBadge(`Mengisi ${frmCode}...`);

    const student = GM_getValue(K.student, {});
    log(`Siswa: ${student.nama || 'Unknown'} (${student.gender || 'Unknown'})`);

    const collectedAnswers = []; // BARU: Wadah untuk menampung jawaban form ini
    let totalAnswered = 0;
    let pageCount = 1;
    const MAX_PAGES = 20;

    while (pageCount <= MAX_PAGES) {
      log(`--- Halaman ${pageCount} ---`);

      const questions = Array.from(document.querySelectorAll('.sd-question[data-name]'));

      for (const qEl of questions) {
        const radios = qEl.querySelectorAll('input[type="radio"]');
        const isAnswered = Array.from(radios).some(r => r.checked);
        const textInput = qEl.querySelector('textarea, input[type="text"], input.sd-input, input[type="number"]');
        const textFilled = textInput && textInput.value.trim() !== '';

        if (isAnswered || textFilled) continue;

        const result = await answerQuestion(qEl, frmCode);
        if (result.success) {
          totalAnswered++;
          collectedAnswers.push({ q: result.q, a: result.a }); // BARU: Simpan ke array
          await sleep(600);
        }
      }

      const newQuestions = Array.from(document.querySelectorAll('.sd-question[data-name]')).filter(q => {
        const radios = q.querySelectorAll('input[type="radio"]');
        const answered = Array.from(radios).some(r => r.checked);
        const textInput = q.querySelector('textarea, input[type="text"], input.sd-input, input[type="number"]');
        const filled = textInput && textInput.value.trim() !== '';
        return !answered && !filled;
      });

      if (newQuestions.length > 0) {
        log(`  📋 ${newQuestions.length} pertanyaan conditional baru muncul`);
        for (const qEl of newQuestions) {
          const result = await answerQuestion(qEl, frmCode);
          if (result.success) {
            totalAnswered++;
            collectedAnswers.push({ q: result.q, a: result.a }); // BARU
            await sleep(600);
          }
        }
      }

      const nextBtn = document.querySelector(
        '.sd-navigation__next-btn, button[aria-label="Next"], input.sd-navigation__next-btn'
      );

      const isSubmitBtn = nextBtn && FORBIDDEN_BTN_WORDS.some(w =>
        (nextBtn.textContent || '').toLowerCase().includes(w));

      if (!nextBtn || nextBtn.disabled || isSubmitBtn) {
        log(`Halaman terakhir. Total dijawab: ${totalAnswered}`);
        break;
      }

      nextBtn.click();
      await sleep(900);
      pageCount++;
    }

    log(`═══ SELESAI: ${totalAnswered} pertanyaan dijawab ═══`);

    // BARU: Simpan hasil form ini ke Storage Summary
    const pageTitleEl = document.querySelector('h4.sd-page__title .sv-string-viewer, h4.sd-page__title');
    const pageTitle = pageTitleEl?.textContent.trim() || document.title;

    const summaryList = GM_getValue(K.summary, []);
    summaryList.push({
      frm: frmCode,
      judul: pageTitle,
      jawaban: collectedAnswers
    });
    GM_setValue(K.summary, summaryList);

    showBadge(`✅ ${frmCode} selesai! Kembali ke daftar...`, false);

    const idx = GM_getValue(K.idx, 0);
    GM_setValue(K.idx, idx + 1);

    const redirectUrl = new URLSearchParams(location.search).get('redirectUrl');
    if (redirectUrl && GM_getValue(K.running, false)) {
      await sleep(1000);
      location.href = decodeURIComponent(redirectUrl);
    } else if (!redirectUrl) {
      showBadge('Selesai, tapi tidak ada redirectUrl.', true);
      log('⚠️ Tidak ada redirectUrl - kembali manual.');
    }
  }

  async function runOnFormPage() {
    showBadge('Memuat form...');
    try {
      await waitFor('.sd-question[data-name]', 12000);
    } catch (e) {
      showBadge('❌ Form gagal dimuat.', true);
      GM_setValue(K.running, false);
      return;
    }
    await sleep(600);
    processForm();
  }

  // =====================================================
  // ENTRY POINT
  // =====================================================
  if (location.hostname === 'sehatindonesiaku.kemkes.go.id') {
    waitFor('[id^="rowfrm" i], [id^="row-FRM" i]', 12000)
      .then(runOnListPage)
      .catch(() => log('Tidak menemukan daftar pemeriksaan.'));
  } else if (location.hostname === 'form.kemkes.go.id') {
    runOnFormPage();
  }

  GM_registerMenuCommand('CKG-AA: Lihat Ringkasan Terakhir', () => {
    // Panggil event klik tombol show-summary jika ada, atau alert
    const btn = document.getElementById('aa-show-summary');
    if (btn) btn.click();
    else alert('Tombol tidak ditemukan. Pastikan Anda di halaman daftar.');
  });

  GM_registerMenuCommand('CKG-AA: Paksa Berhenti', () => {
    GM_setValue(K.running, false);
    alert('Dipaksa berhenti.');
  });

  GM_registerMenuCommand('CKG-AA: Reset Antrean', () => {
    GM_deleteValue(K.queue);
    GM_deleteValue(K.idx);
    GM_deleteValue(K.skipStreak);
    GM_setValue(K.running, false);
    alert('Antrean direset.');
  });

  GM_registerMenuCommand('CKG-AA: Hapus Ringkasan', () => {
    GM_deleteValue(K.summary);
    alert('Ringkasan dihapus.');
  });

})();
