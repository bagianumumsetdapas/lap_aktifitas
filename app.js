/* ============================================================
   LAPORAN AKTIFITAS PEGAWAI — app.js
   PDF F4 (210x330) + Signature responsive + Segoe UI (opsional)
============================================================ */
(() => {
  'use strict';

  const CFG = window.APP_CONFIG;

  /* ========== STATE ========== */
  const STATE = {
    pegawaiList: [],
    pegawai: null,
    triwulan: null,
    bulan: null,
    photos: {},
    signature: null,
  };

  const TRIWULAN = {
    I:   ['Januari', 'Februari', 'Maret'],
    II:  ['April', 'Mei', 'Juni'],
    III: ['Juli', 'Agustus', 'September'],
    IV:  ['Oktober', 'November', 'Desember'],
  };
  const BULAN_INDEX = {
    Januari: 0, Februari: 1, Maret: 2, April: 3, Mei: 4, Juni: 5,
    Juli: 6, Agustus: 7, September: 8, Oktober: 9, November: 10, Desember: 11,
  };
  const MINGGU = ['Minggu I', 'Minggu II', 'Minggu III', 'Minggu IV'];

/* ========== UKURAN KERTAS FOLIO ========== */
const PAGE_W = 215;
const PAGE_H = 330;

/* ========== KONFIG LAYOUT ========== */
const MINGGU_PER_PAGE = 2;                 // 2 minggu per halaman
const MINGGU_BLOCK_H  = 98;                // estimasi tinggi 1 blok minggu (mm)
const PENGESAHAN_H    = 65;                // estimasi tinggi blok pengesahan (mm)

  /* ========== WARNA PDF ========== */
  const C_GREEN_DARK  = [21, 128, 61];
  const C_GREEN       = [34, 197, 94];
  const C_GREEN_DEEP  = [22, 163, 74];
  const C_GREEN_LIGHT = [220, 252, 231];
  const C_WHITE       = [255, 255, 255];
  const C_BLACK       = [0, 0, 0];
  const C_GRAY        = [110, 120, 115];

  /* ========== KONFIG FOTO ========== */
  const PHOTO_CFG = {
    maxWidth: 900,
    aspect: 8 / 5,
    quality: 0.65,
    radiusPercent: 0.03,
  };

  /* ========== DOM ========== */
  const $ = (id) => document.getElementById(id);
  const stepIndicator = $('stepIndicator');
  const step1 = $('step1');
  const step2 = $('step2');
  const step3 = $('step3');
  const namaSelect = $('namaSelect');
  const twSelect = $('twSelect');
  const btnNext1 = $('btnNext1');
  const step2Sub = $('step2Sub');
  const bulanGrid = $('bulanGrid');
  const btnBack2 = $('btnBack2');
  const step3Title = $('step3Title');
  const step3Sub = $('step3Sub');
  const mingguContainer = $('mingguContainer');
  const pengesahanLine = $('pengesahanLine');
  const signName = $('signName');
  const signNip = $('signNip');
  const btnBack3 = $('btnBack3');
  const btnDownload = $('btnDownload');
  const btnClearSig = $('btnClearSig');
  const toastEl = $('toast');

  /* ========== CACHE ========== */
  let LOGO_DATA_URL = null;
  let FONT_NAME = 'helvetica';
  let FONT_HAS_ITALIC = false;

  /* ========== INIT ========== */
  document.addEventListener('DOMContentLoaded', async () => {
    $('brandLogo').src = CFG.LOGO_URL;

    initTheme();
    initSignaturePad();
    bindEvents();
    loadPegawai();
    setStep(1);

    LOGO_DATA_URL = await fetchAsDataURL(CFG.LOGO_URL).catch(() => null);
    detectSegoeFont();
  });

  /* ========== THEME ========== */
  function initTheme() {
    const saved = localStorage.getItem('theme');
    const initial = saved || 'dark';
    document.documentElement.classList.toggle('dark', initial === 'dark');
    updateThemeBtn();
    $('themeToggle').addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      updateThemeBtn();
    });
  }
  function updateThemeBtn() {
    const isDark = document.documentElement.classList.contains('dark');
    $('themeToggle').textContent = isDark ? '🌙' : '☀️';
  }

  /* ========== TOAST ========== */
  let toastTimer = null;
  function toast(msg, duration = 3200) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  /* ========== STEP NAV ========== */
  function setStep(n) {
    step1.classList.toggle('hidden', n !== 1);
    step2.classList.toggle('hidden', n !== 2);
    step3.classList.toggle('hidden', n !== 3);
    stepIndicator.querySelectorAll('.step').forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle('active', s === n);
      el.classList.toggle('done', s < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Setiap masuk step 3, refit signature canvas
    if (n === 3) setTimeout(fitSignatureCanvas, 60);
  }

  /* ========== LOAD DATA ========== */
  async function loadPegawai() {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(CFG.SHEET_NAME)}&headers=0`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const json = JSON.parse(text.substring(47).slice(0, -2));
      const rows = (json.table && json.table.rows) || [];

      STATE.pegawaiList = rows
        .map((r) => {
          const c = r.c || [];
          return {
            no:          cell(c[0]),
            nama:        cell(c[1]),
            nip:         cell(c[2]),
            pangkatGol:  cell(c[3]),
            jabatan:     cell(c[4]),
            lokasiKerja: cell(c[5]),
            rencanaAksi: cell(c[6]),
          };
        })
        .filter((p) => p.nama && p.nama.toLowerCase() !== 'nama');

      renderNamaOptions();
    } catch (err) {
      console.error(err);
      namaSelect.innerHTML = `<option value="">❌ Gagal memuat data</option>`;
      toast('Gagal memuat data pegawai. Periksa SHEET_ID / akses sheet.');
    }
  }

  function cell(c) {
    if (!c) return '';
    if (c.f != null) return String(c.f);
    if (c.v != null) return String(c.v);
    return '';
  }

  function renderNamaOptions() {
    if (!STATE.pegawaiList.length) {
      namaSelect.innerHTML = `<option value="">— Data kosong —</option>`;
      return;
    }
    const opts = ['<option value="">— Pilih Nama —</option>'];
    STATE.pegawaiList.forEach((p) => {
      opts.push(`<option value="${escapeAttr(p.nama)}">${escapeHtml(p.nama)}</option>`);
    });
    namaSelect.innerHTML = opts.join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
    );
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* ========== EVENTS ========== */
  function bindEvents() {
    namaSelect.addEventListener('change', () => {
      btnNext1.disabled = !namaSelect.value || !twSelect.value;
    });
    twSelect.addEventListener('change', () => {
      btnNext1.disabled = !namaSelect.value || !twSelect.value;
    });
    btnNext1.addEventListener('click', goStep2);
    btnBack2.addEventListener('click', () => setStep(1));
    btnBack3.addEventListener('click', () => setStep(2));
    btnDownload.addEventListener('click', handleDownload);
    btnClearSig.addEventListener('click', () => {
      sigPad && sigPad.clear();
      STATE.signature = null;
    });
  }

  /* ========== STEP 1 → 2 ========== */
  function goStep2() {
    const nama = namaSelect.value;
    const tw = twSelect.value;
    if (!nama || !tw) return;
    const p = STATE.pegawaiList.find((x) => x.nama === nama);
    if (!p) { toast('Data pegawai tidak ditemukan'); return; }

    STATE.pegawai = p;
    STATE.triwulan = tw;
    STATE.photos = {};
    STATE.signature = null;
    sigPad && sigPad.clear();

    step2Sub.textContent = `Triwulan ${tw} — ${p.nama}`;
    renderBulanGrid(TRIWULAN[tw]);
    setStep(2);
  }

  function renderBulanGrid(bulanList) {
    bulanGrid.innerHTML = bulanList.map((b) => `
      <button class="bulan-card" data-bulan="${b}">
        <div class="bulan-name">${b}</div>
        <div class="bulan-year">${CFG.TAHUN}</div>
      </button>
    `).join('');

    bulanGrid.querySelectorAll('.bulan-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        STATE.bulan = btn.dataset.bulan;
        goStep3();
      });
    });
  }

  /* ========== STEP 2 → 3 ========== */
  function goStep3() {
    const p = STATE.pegawai;
    const b = STATE.bulan;

    step3Title.textContent = `Laporan ${b} ${CFG.TAHUN}`;
    step3Sub.textContent = `${p.nama} — ${p.jabatan}`;

    const mIdx = BULAN_INDEX[b];
    const lastDay = new Date(CFG.TAHUN, mIdx + 1, 0).getDate();
    pengesahanLine.textContent =
      `${CFG.KOTA_PENGESAHAN}, ${lastDay} ${b} ${CFG.TAHUN} — Yang membuat laporan,`;
    signName.textContent = p.nama;
    signNip.textContent = `NIP. ${p.nip}`;

    renderMinggu();
    setStep(3);
  }

  function renderMinggu() {
    const p = STATE.pegawai;
    mingguContainer.innerHTML = MINGGU.map((m) => `
      <div class="card glass minggu-card">
        <h2 class="minggu-title">${m} ${STATE.bulan} ${CFG.TAHUN}</h2>
        <div class="minggu-info">
          <div>
            <div class="info-lbl">Kegiatan</div>
            <div class="info-val">${escapeHtml(p.rencanaAksi || '-')}</div>
          </div>
          <div>
            <div class="info-lbl">Lokasi</div>
            <div class="info-val">${escapeHtml(p.lokasiKerja || '-')}</div>
          </div>
        </div>
        <div class="photo-grid">
          ${[0, 1].map((i) => `
            <div class="photo-box" data-minggu="${m}" data-idx="${i}">
              <div class="photo-lbl">Foto ${i + 1}</div>
              <div class="photo-drop" data-role="drop">
                <span class="plus">+</span>
              </div>
              <input type="file" accept="image/*" hidden data-role="file" />
              <button type="button" class="photo-remove hidden" data-role="remove">Hapus foto</button>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    mingguContainer.querySelectorAll('.photo-box').forEach((box) => {
      const minggu = box.dataset.minggu;
      const idx = Number(box.dataset.idx);
      const drop = box.querySelector('[data-role="drop"]');
      const fileInput = box.querySelector('[data-role="file"]');
      const removeBtn = box.querySelector('[data-role="remove"]');

      drop.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        fileInput.value = '';
        await handlePhotoUpload(minggu, idx, file, drop, removeBtn);
      });
      removeBtn.addEventListener('click', () => {
        removePhoto(minggu, idx);
        drop.innerHTML = `<span class="plus">+</span>`;
        removeBtn.classList.add('hidden');
      });
    });
  }

  /* ========== KOMPRES + CROP + ROUNDED ========== */
  async function handlePhotoUpload(minggu, idx, file, drop, removeBtn) {
    drop.innerHTML = `<span class="busy">Mengompres…</span>`;
    try {
      const dataUrl = await compressCropRounded(file, PHOTO_CFG);
      if (!STATE.photos[minggu]) STATE.photos[minggu] = [null, null];
      STATE.photos[minggu][idx] = dataUrl;
      drop.innerHTML = `<img src="${dataUrl}" alt="Foto" />`;
      removeBtn.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      drop.innerHTML = `<span class="plus">+</span>`;
      toast('Gagal memproses foto.');
    }
  }

  function removePhoto(minggu, idx) {
    if (STATE.photos[minggu]) STATE.photos[minggu][idx] = null;
  }

  async function compressCropRounded(file, opts) {
    const { maxWidth, aspect, quality, radiusPercent } = opts;
    const img = await loadImageFromFile(file);
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    let sx = 0, sy = 0, sw = iw, sh = ih;
    if (iw / ih > aspect) {
      sw = ih * aspect;
      sx = (iw - sw) / 2;
    } else {
      sh = iw / aspect;
      sy = (ih - sh) / 2;
    }

    const outW = Math.min(maxWidth, Math.round(sw));
    const outH = Math.round(outW / aspect);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);

    const r = Math.round(Math.min(outW, outH) * radiusPercent);
    ctx.save();
    roundedPath(ctx, 0, 0, outW, outH, r);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    ctx.restore();

    return canvas.toDataURL('image/jpeg', quality);
  }

  function roundedPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  async function fetchAsDataURL(url) {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return await blobToDataURL(blob);
  }

  /* ============================================================
     SIGNATURE PAD — RESPONSIVE
     - CSS pakai aspect-ratio 3:1 → proporsi sama di semua device
     - Fit canvas = ukuran CSS × devicePixelRatio
     - ResizeObserver → refit otomatis ketika ukuran berubah
  ============================================================ */
  let sigPad = null;

  function initSignaturePad() {
    const canvas = $('signatureCanvas');

    sigPad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(255,255,255,0)',
      penColor: '#052e16',
      minWidth: 0.5,
      maxWidth: 2.5,
      throttle: 8,
      velocityFilterWeight: 0.6,
    });

    sigPad.addEventListener('endStroke', () => {
      STATE.signature = sigPad.isEmpty() ? null : sigPad.toDataURL('image/png');
    });

    // Resize otomatis saat ukuran canvas berubah (window resize / rotasi HP)
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => fitSignatureCanvas());
      ro.observe(canvas);
    }
    window.addEventListener('orientationchange', () => setTimeout(fitSignatureCanvas, 200));

    // Fit awal (delay sedikit agar layout step 3 sudah settle)
    setTimeout(fitSignatureCanvas, 80);
  }

  function fitSignatureCanvas() {
    const canvas = $('signatureCanvas');
    if (!canvas || !sigPad) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return; // belum tampil

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const targetW = Math.round(rect.width * ratio);
    const targetH = Math.round(rect.height * ratio);

    if (canvas.width === targetW && canvas.height === targetH) return;

    // Simpan data lama (agar tidak hilang saat resize)
    const hadData = !sigPad.isEmpty();
    const data = hadData ? sigPad.toData() : null;
    const oldW = canvas.width || 1;
    const oldH = canvas.height || 1;

    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, rect.width, rect.height);

    sigPad.clear();

    // Scale titik-titik lama agar tanda tangan tetap proporsional
    if (data) {
      const scaleX = targetW / oldW;
      const scaleY = targetH / oldH;
      const scaled = data.map((stroke) =>
        stroke.map((pt) => ({
          x: pt.x * scaleX / ratio,
          y: pt.y * scaleY / ratio,
          time: pt.time,
        }))
      );
      try {
        sigPad.fromData(scaled);
        STATE.signature = sigPad.toDataURL('image/png');
      } catch (e) {
        console.warn('restore signature gagal', e);
      }
    }
  }

  /* ========== FONT SEGOE UI ========== */
  function detectSegoeFont() {
    const F = window.SEGOE_FONTS;
    if (!F || !F.regular) {
      console.info('[font] Segoe UI tidak di-embed — pakai helvetica');
      FONT_NAME = 'helvetica';
      return;
    }
    FONT_NAME = 'SegoeUI';
    FONT_HAS_ITALIC = !!F.italic;
    console.info('[font] Segoe UI siap dipakai');
  }

  function registerFontToDoc(doc) {
    if (FONT_NAME !== 'SegoeUI') return;
    const F = window.SEGOE_FONTS;
    try {
      if (F.regular) {
        doc.addFileToVFS('segoeui.ttf', F.regular);
        doc.addFont('segoeui.ttf', 'SegoeUI', 'normal');
      }
      if (F.bold) {
        doc.addFileToVFS('segoeuib.ttf', F.bold);
        doc.addFont('segoeuib.ttf', 'SegoeUI', 'bold');
      }
      if (F.italic) {
        doc.addFileToVFS('segoeuii.ttf', F.italic);
        doc.addFont('segoeuii.ttf', 'SegoeUI', 'italic');
      }
    } catch (e) {
      console.warn('Register font gagal, fallback ke helvetica', e);
      FONT_NAME = 'helvetica';
    }
  }

  /* ============================================================
     GENERATE PDF — FOLIO 215×330 mm
     - 2 minggu per halaman
     - Foto full width (2 sisi)
     - Tanda tangan rata tengah
     - Footer: text center + nomor halaman di kanan
  ============================================================ */
  async function handleDownload() {
    if (!STATE.pegawai || !STATE.bulan) return;

    btnDownload.disabled = true;
    btnDownload.textContent = 'Membuat PDF…';

    const { jsPDF } = window.jspdf;
    let status = 'Terunduh';

    try {
      // ⬇ KUNCI: format Folio 215×330 mm
      const doc = new jsPDF({
        unit: 'mm',
        format: [PAGE_W, PAGE_H],
        orientation: 'portrait',
        compress: true,
      });
      registerFontToDoc(doc);

      const W = PAGE_W;                 // 215
      const H = PAGE_H;                 // 330
      const margin = 15;
      const contentW = W - margin * 2;  // 185
      const BOTTOM = H - 14;            // 316 (batas bawah sebelum footer)

      const p = STATE.pegawai;
      const bulan = STATE.bulan;
      const year = CFG.TAHUN;

      /* ============================================================
         HEADER
      ============================================================ */
      if (LOGO_DATA_URL) {
        try { doc.addImage(LOGO_DATA_URL, 'PNG', margin, 8, 24, 24); }
        catch (e) { console.warn('logo addImage gagal', e); }
      }

      const titleX = W / 2 + 6;

      doc.setFont(FONT_NAME, 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...C_GREEN_DARK);
      doc.text('LAPORAN AKTIFITAS PEGAWAI', titleX, 18, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`BULAN : ${bulan.toUpperCase()} ${year}`, titleX, 26, { align: 'center' });

      doc.setDrawColor(...C_GREEN);
      doc.setLineWidth(1.2);
      doc.line(margin, 35, W - margin, 35);

      /* ============================================================
         KOTAK IDENTITAS
      ============================================================ */
      let y = 41;
      const idPadX = 6;
      const idPadY = 5;
      const labelW = 32;

      const idRows = [
        ['Nama', p.nama],
        ['NIP', p.nip],
        ['Pangkat/Gol', p.pangkatGol],
        ['Jabatan', p.jabatan],
        ['Unit Kerja', CFG.UNIT_KERJA],
      ];

      doc.setFontSize(10);
      let tmpY = 0;
      idRows.forEach(([k, v]) => {
        doc.setFont(FONT_NAME, 'normal');
        const lines = doc.splitTextToSize(v || '-', contentW - idPadX * 2 - labelW - 4);
        tmpY += Math.max(lines.length * 5, 6);
      });
      const idBoxH = tmpY + idPadY * 2;

      doc.setFillColor(...C_GREEN_LIGHT);
      doc.setDrawColor(...C_GREEN_DEEP);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, contentW, idBoxH, 4, 4, 'FD');

      let iy = y + idPadY + 4;
      doc.setTextColor(...C_BLACK);
      doc.setFontSize(10);
      idRows.forEach(([k, v]) => {
        doc.setFont(FONT_NAME, 'bold');
        doc.text(k, margin + idPadX, iy);
        doc.text(':', margin + idPadX + labelW, iy);
        doc.setFont(FONT_NAME, 'normal');
        const lines = doc.splitTextToSize(v || '-', contentW - idPadX * 2 - labelW - 4);
        doc.text(lines, margin + idPadX + labelW + 3, iy);
        iy += Math.max(lines.length * 5, 6);
      });

      y += idBoxH + 10;

      /* ============================================================
         MINGGU I–IV — 2 PER HALAMAN
      ============================================================ */
      for (let i = 0; i < MINGGU.length; i++) {
        const m = MINGGU[i];
        const pair = STATE.photos[m] || [null, null];
        const isLastMinggu = (i === MINGGU.length - 1);

        // Force 2 minggu per halaman: minggu ke-2 (index 2) mulai halaman baru
        const isStartOfPage = (i > 0 && i % MINGGU_PER_PAGE === 0);

        // Safety: kalau kegiatan panjang multi-baris & tidak muat → pindah halaman
        const needAfter = isLastMinggu ? PENGESAHAN_H : 0;
        const wontFit = (y + MINGGU_BLOCK_H + needAfter > BOTTOM);

        if (isStartOfPage || wontFit) {
          doc.addPage();
          y = 20; // reset y di halaman baru
        }

        /* ---- Bar judul minggu (hijau rounded, teks putih, rata tengah) ---- */
        const barH = 9;
        doc.setFillColor(...C_GREEN);
        doc.roundedRect(margin, y, contentW, barH, 2.5, 2.5, 'F');

        doc.setTextColor(...C_WHITE);
        doc.setFont(FONT_NAME, 'bold');
        doc.setFontSize(11);
        doc.text(`${m} ${bulan} ${year}`, W / 2, y + 6, { align: 'center' });

        doc.setTextColor(...C_BLACK);
        y += barH + 5; // ⬅ dikurangi dari 6 → 5

        /* ---- Kegiatan ---- */
        doc.setFontSize(10);
        doc.setFont(FONT_NAME, 'bold');
        doc.text('Kegiatan', margin + 2, y);
        doc.text(':', margin + 25, y);
        doc.setFont(FONT_NAME, 'normal');
        const kegLines = doc.splitTextToSize(p.rencanaAksi || '-', contentW - 30);
        doc.text(kegLines, margin + 28, y);
        y += kegLines.length * 5 + 1;

        /* ---- Lokasi ---- */
        doc.setFont(FONT_NAME, 'bold');
        doc.text('Lokasi', margin + 2, y);
        doc.text(':', margin + 25, y);
        doc.setFont(FONT_NAME, 'normal');
        doc.text(p.lokasiKerja || '-', margin + 28, y);
        y += 6; // ⬅ dikurangi dari 7 → 6

        /* ---- Foto: 2 side-by-side full width, rasio 8:5 ---- */
        const gap = 4;
        const photoW = (contentW - gap) / 2; // 90.5 mm
        const photoH = photoW * 5 / 8;       // 56.5 mm

        for (let j = 0; j < 2; j++) {
          const px = margin + j * (photoW + gap);
          if (pair[j]) {
            try {
              doc.addImage(pair[j], 'JPEG', px, y, photoW, photoH);
              doc.setDrawColor(...C_GREEN_DEEP);
              doc.setLineWidth(0.5);
              doc.roundedRect(px, y, photoW, photoH, 2.5, 2.5, 'S');
            } catch {
              drawEmptyBox(doc, px, y, photoW, photoH, j);
            }
          } else {
            drawEmptyBox(doc, px, y, photoW, photoH, j);
          }
        }
        y += photoH + 8; // ⬅ dikurangi dari 10 → 8
      }

            /* ============================================================
         PENGESAHAN — SEMUA RATA KANAN
      ============================================================ */
      if (y + PENGESAHAN_H > BOTTOM) {
        doc.addPage();
        y = 30;
      }
      y += 6;

      const mIdx = BULAN_INDEX[bulan];
      const lastDay = new Date(year, mIdx + 1, 0).getDate();
      const tgl = `${lastDay} ${bulan} ${year}`;

      // Posisi kanan (untuk semua teks + TTD)
      const rightX = W - margin - 65;
      const sigW = 55;
      const sigH = 28;

      doc.setFontSize(10);
      doc.setFont(FONT_NAME, 'normal');
      doc.setTextColor(...C_BLACK);

      // "Pasuruan, 30 September 2026" — RATA KANAN
      doc.text(`${CFG.KOTA_PENGESAHAN}, ${tgl}`, rightX, y);
      y += 5;

      // "Yang membuat laporan," — RATA KANAN
      doc.text('Yang membuat laporan,', rightX, y);
      y += 3;

      // TTD — RATA KANAN (sejajar dengan teks di atas)
      if (STATE.signature) {
        try {
          doc.addImage(STATE.signature, 'PNG', rightX, y, sigW, sigH);
        } catch (e) {
          console.warn('signature add failed', e);
        }
      }
      y += 30;

      // Nama (bold) — RATA KANAN
      doc.setFont(FONT_NAME, 'bold');
      doc.text(p.nama, rightX, y);

      // NIP — RATA KANAN
      doc.setFont(FONT_NAME, 'normal');
      doc.text(`NIP. ${p.nip}`, rightX, y + 5);

      /* ============================================================
         FOOTER (semua halaman)
         - Text tengah: LAPORAN AKTIFITAS SEPTEMBER 2026 • NIP - NAMA
         - Nomor halaman di pojok kanan
      ============================================================ */
      const totalPages = doc.getNumberOfPages();
      const footerText = `LAPORAN AKTIFITAS ${bulan.toUpperCase()} ${year} \u2022 ${p.nip} - ${p.nama}`;

      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // garis footer
        doc.setDrawColor(...C_GREEN);
        doc.setLineWidth(0.3);
        doc.line(margin, H - 14, W - margin, H - 14);

        // text footer (italic kalau ada, tengah)
        doc.setFont(FONT_NAME, FONT_HAS_ITALIC ? 'italic' : 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...C_GRAY);
        doc.text(footerText, W / 2, H - 8, { align: 'center' });

        // ⬇ NOMOR HALAMAN — pojok kanan
        doc.setFont(FONT_NAME, 'normal');
        doc.setFontSize(9);
        doc.text(`${i}`, W - margin, H - 8, { align: 'right' });
      }

      /* ---------- SAVE ---------- */
      const filename = `${p.nama} - ${bulan}.pdf`;
      doc.save(filename);

      toast('✅ Laporan berhasil diunduh');
    } catch (err) {
      console.error(err);
      status = 'Gagal';
      toast('❌ Gagal membuat PDF. Coba lagi.');
    } finally {
      btnDownload.disabled = false;
      btnDownload.textContent = '⬇ Unduh Laporan (PDF)';
      sendLog(status);
    }
  }

  function drawEmptyBox(doc, x, y, w, h, idx) {
    doc.setDrawColor(...C_GREEN_DEEP);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'S');
    doc.setTextColor(150);
    doc.setFontSize(8);
    doc.text(`Foto ${idx + 1}`, x + w / 2, y + h / 2, { align: 'center' });
    doc.setTextColor(0);
  }

  /* ========== LOG ========== */
  async function sendLog(status) {
    if (!CFG.APPS_SCRIPT_URL) return;
    const p = STATE.pegawai;
    const payload = {
      token: CFG.APPS_SCRIPT_TOKEN,
      no: p.no,
      nama: p.nama,
      jabatan: p.jabatan,
      bulan: STATE.bulan,
      status: status,
    };
    try {
      await fetch(CFG.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('Log gagal dikirim:', e);
    }
  }

})();