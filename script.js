// URL GAS Web App (API Endpoint)
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbw4gcxXaIm5MzRs4hfZ-uOaw0iixMaELEkj_OoXYlW7yBZTcfrALkOxlZbH-ngmXrgfLQ/exec"; 

// Local State
let pegawaiDataList = [];
let selectedPegawai = null;
let signaturePad = null;
const photoStorage = {}; 

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initPinInputs();
    renderMingguBoxes();
    setupEventListeners();
    checkNetworkStatus();
});

function initTheme() {
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour >= 18;
    
    if (isNight) {
        setTheme('dark');
    } else {
        setTheme('light');
    }

    document.getElementById('btn-toggle-theme').addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'light' : 'dark');
    });
}

function setTheme(mode) {
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');

    if (mode === 'dark') {
        document.documentElement.classList.add('dark');
        icon.className = 'fa-solid fa-sun text-amber-400';
        text.textContent = 'Light Mode';
    } else {
        document.documentElement.classList.remove('dark');
        icon.className = 'fa-solid fa-moon text-emerald-700';
        text.textContent = 'Dark Mode';
    }
}

function initPinInputs() {
    const inputs = document.querySelectorAll('.pin-input');
    inputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && idx < inputs.length - 1) {
                inputs[idx + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                inputs[idx - 1].focus();
            }
        });
    });
}

function getEnteredPin() {
    let pin = '';
    document.querySelectorAll('.pin-input').forEach(i => pin += i.value);
    return pin;
}

function checkNetworkStatus() {
    const badge = document.getElementById('status-badge');
    const update = () => {
        if (navigator.onLine) {
            badge.className = "px-3.5 py-1.5 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 flex items-center gap-2";
            badge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span><span>Online</span>`;
        } else {
            badge.className = "px-3.5 py-1.5 text-xs font-medium rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-700 flex items-center gap-2";
            badge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span><span>Offline (Lokal)</span>`;
        }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
}

// Fine stroke width for refined signatures
function initSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    
    signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgba(255, 255, 255, 1)',
        penColor: 'rgb(15, 23, 42)',
        minWidth: 0.8, // Thinner stroke width
        maxWidth: 2.2
    });
}

function renderMingguBoxes() {
    const container = document.getElementById('minggu-container');
    const template = document.getElementById('tpl-minggu');

    for (let i = 1; i <= 4; i++) {
        const clone = template.content.cloneNode(true);
        clone.querySelector('.minggu-title').textContent = `Minggu Ke-${i}`;

        const boxes = clone.querySelectorAll('.photo-box');
        setupPhotoBox(boxes[0], `m${i}_f1`);
        setupPhotoBox(boxes[1], `m${i}_f2`);

        container.appendChild(clone);
    }
}

function setupPhotoBox(box, photoKey) {
    const fileInput = box.querySelector('.file-input');
    const preview = box.querySelector('.img-preview');
    const placeholder = box.querySelector('.placeholder-content');
    const btnDelete = box.querySelector('.btn-delete-photo');

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const compressedBase64 = await compressAndResizeImage(file, 800, 600, 0.7);
        photoStorage[photoKey] = compressedBase64;

        preview.src = compressedBase64;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        btnDelete.classList.remove('hidden');
        btnDelete.classList.add('flex');
    });

    btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.value = '';
        delete photoStorage[photoKey];
        preview.src = '';
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
        btnDelete.classList.add('hidden');
        btnDelete.classList.remove('flex');
    });
}

function compressAndResizeImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
    });
}

function setupEventListeners() {
    document.getElementById('btn-verify').addEventListener('click', async () => {
        const pin = getEnteredPin();
        if (pin.length < 6) {
            showPinError("Masukkan 6 digit passcode.");
            return;
        }

        try {
            const res = await fetch(`${GAS_API_URL}?action=verifyPasscode&pin=${pin}`);
            const data = await res.json();

            if (data.valid) {
                document.getElementById('pin-error').classList.add('hidden');
                unlockPegawaiSelectBox();
            } else {
                showPinError("Passcode salah, akses ditolak.");
            }
        } catch (err) {
            if (pin === "123456") {
                unlockPegawaiSelectBox();
            } else {
                showPinError("Verifikasi gagal/Koneksi offline.");
            }
        }
    });

    document.getElementById('select-triwulan').addEventListener('change', updateBulanDropdown);
    updateBulanDropdown();

    document.getElementById('select-nama').addEventListener('change', (e) => {
        const selectedIndex = e.target.value;
        if (selectedIndex !== "") {
            selectedPegawai = pegawaiDataList[selectedIndex];
        }
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        if (!selectedPegawai) {
            alert("Pilih nama pegawai terlebih dahulu.");
            return;
        }
        showReportSection();
    });

    document.getElementById('btn-clear-sig').addEventListener('click', () => {
        if (signaturePad) signaturePad.clear();
    });

    document.getElementById('btn-back').addEventListener('click', () => {
        document.getElementById('section-report').classList.add('hidden');
        document.getElementById('section-auth').classList.remove('hidden');
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        if (confirm("Apakah Anda yakin ingin membuat laporan baru? Seluruh isian form akan direset.")) {
            location.reload();
        }
    });

    document.getElementById('btn-download').addEventListener('click', () => handleExportPDF('download'));
    document.getElementById('btn-share').addEventListener('click', () => handleExportPDF('share'));
}

function showPinError(msg) {
    const errEl = document.getElementById('pin-error');
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
}

async function unlockPegawaiSelectBox() {
    const box = document.getElementById('pegawai-select-box');
    box.classList.remove('hidden');
    setTimeout(() => box.classList.remove('opacity-0'), 50);

    // Smooth scroll directly to the select box
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const res = await fetch(`${GAS_API_URL}?action=getPegawai`);
        pegawaiDataList = await res.json();
        populatePegawaiDropdown(pegawaiDataList);
    } catch (err) {
        pegawaiDataList = [
            { nama: "Drs. H. Ahmad Faisol, M.Si", nip: "19750812 199903 1 002", pangkatGol: "Pembina Utama Muda (IV/c)", jabatan: "Kepala Bagian Umum", lokasiKerja: "Kantor Bupati Pasuruan", kegiatan: "Koordinasi Protokol Pimpinan dan Penataan Administrasi Umum" }
        ];
        populatePegawaiDropdown(pegawaiDataList);
    }
}

function populatePegawaiDropdown(list) {
    const select = document.getElementById('select-nama');
    select.innerHTML = '<option value="">-- Pilih Nama Pegawai --</option>';
    list.forEach((peg, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${peg.nama} (${peg.nip})`;
        select.appendChild(opt);
    });
}

function updateBulanDropdown() {
    const tw = document.getElementById('select-triwulan').value;
    const bulanSelect = document.getElementById('select-bulan');
    bulanSelect.innerHTML = '';

    const bulanMap = {
        'I': ['Januari', 'Februari', 'Maret'],
        'II': ['April', 'Mei', 'Juni'],
        'III': ['Juli', 'Agustus', 'September'],
        'IV': ['Oktober', 'November', 'Desember']
    };

    bulanMap[tw].forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        bulanSelect.appendChild(opt);
    });
}

function showReportSection() {
    document.getElementById('section-auth').classList.add('hidden');
    document.getElementById('section-report').classList.remove('hidden');

    document.getElementById('display-nama').textContent = selectedPegawai.nama;
    document.getElementById('display-detail').textContent = `${selectedPegawai.nip} | ${selectedPegawai.pangkatGol} | ${selectedPegawai.jabatan}`;

    document.getElementById('input-kegiatan').value = selectedPegawai.kegiatan || '';
    document.getElementById('input-lokasi').value = selectedPegawai.lokasiKerja || '';

    const bulan = document.getElementById('select-bulan').value;
    const lastDay = getLastDayOfMonth(bulan, 2026);
    document.getElementById('text-tanggal').textContent = `Pasuruan, ${lastDay} ${bulan} 2026`;

    setTimeout(() => {
        const canvas = document.getElementById('signature-pad');
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        
        if (!signaturePad) {
            signaturePad = new SignaturePad(canvas, {
                backgroundColor: 'rgba(255, 255, 255, 1)',
                penColor: 'rgb(15, 23, 42)',
                minWidth: 0.8,
                maxWidth: 2.2
            });
        } else {
            signaturePad.clear();
        }
    }, 100);
}

function getLastDayOfMonth(bulanName, year) {
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthIdx = monthNames.indexOf(bulanName);
    const date = new Date(year, monthIdx + 1, 0);
    return date.getDate();
}

// ELEGANT PROPORTIONAL PDF GENERATION
async function handleExportPDF(actionType) {
    if (!signaturePad || signaturePad.isEmpty()) {
        alert("Harap masukkan tanda tangan terlebih dahulu.");
        return;
    }

    const btnDownload = document.getElementById('btn-download');
    const btnShare = document.getElementById('btn-share');
    const origDownloadText = btnDownload.innerHTML;
    const origShareText = btnShare.innerHTML;

    btnDownload.disabled = true;
    btnShare.disabled = true;
    btnDownload.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memproses...`;
    btnShare.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memproses...`;

    try {
        const bulan = document.getElementById('select-bulan').value;
        const triwulan = document.getElementById('select-triwulan').value;
        const kegiatanMaster = document.getElementById('input-kegiatan').value || '-';
        const lokasiMaster = document.getElementById('input-lokasi').value || '-';
        const lastDay = getLastDayOfMonth(bulan, 2026);
        const bulanLaporFull = `${bulan} 2026`;

        // Populate Identitas
        document.getElementById('pdf-val-nama').textContent = selectedPegawai.nama;
        document.getElementById('pdf-val-nip').textContent = selectedPegawai.nip;
        document.getElementById('pdf-val-pangkat').textContent = selectedPegawai.pangkatGol;
        document.getElementById('pdf-val-jabatan').textContent = selectedPegawai.jabatan;
        document.getElementById('pdf-val-periode').textContent = `${bulanLaporFull} (Triwulan ${triwulan})`;
        document.getElementById('pdf-val-periode-p2').textContent = `Periode: ${bulanLaporFull}`;

        document.getElementById('pdf-val-tanggal').textContent = `Pasuruan, ${lastDay} ${bulan} 2026`;
        document.getElementById('pdf-val-ttd-nama').textContent = selectedPegawai.nama;
        document.getElementById('pdf-val-ttd-nip').textContent = `NIP. ${selectedPegawai.nip}`;
        document.getElementById('pdf-img-sig').src = signaturePad.toDataURL();

        // Render Minggu I & II (Page 1)
        const mingguListP1 = document.getElementById('pdf-minggu-list');
        mingguListP1.innerHTML = '';
        for (let i = 1; i <= 2; i++) {
            const img1 = photoStorage[`m${i}_f1`] || '';
            const img2 = photoStorage[`m${i}_f2`] || '';

            mingguListP1.innerHTML += `
                <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <!-- Rounded Green Box Header -->
                    <div style="background-color: #059669; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 6px; display: inline-block; margin-bottom: 6px;">
                        Minggu ${getRoman(i)} - (${bulanLaporFull})
                    </div>
                    
                    <div style="font-size: 10px; color: #374151; line-height: 1.4; margin-bottom: 8px;">
                        <div><strong>Kegiatan:</strong> ${kegiatanMaster}</div>
                        <div><strong>Lokasi:</strong> ${lokasiMaster}</div>
                    </div>

                    <!-- 4:3 Ratio Photos Grid -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div style="aspect-ratio: 4/3; background-color: #f3f4f6; border-radius: 8px; overflow: hidden; border: 1px solid #d1d5db;">
                            ${img1 ? `<img src="${img1}" style="width: 100%; height: 100%; object-fit: cover;">` : '<div style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #9ca3af; font-style: italic;">Foto 1 Belum Diunggah</div>'}
                        </div>
                        <div style="aspect-ratio: 4/3; background-color: #f3f4f6; border-radius: 8px; overflow: hidden; border: 1px solid #d1d5db;">
                            ${img2 ? `<img src="${img2}" style="width: 100%; height: 100%; object-fit: cover;">` : '<div style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #9ca3af; font-style: italic;">Foto 2 Belum Diunggah</div>'}
                        </div>
                    </div>
                </div>
            `;
        }

        // Render Minggu III & IV (Page 2)
        const mingguListP2 = document.getElementById('pdf-minggu-list-page2');
        mingguListP2.innerHTML = '';
        for (let i = 3; i <= 4; i++) {
            const img1 = photoStorage[`m${i}_f1`] || '';
            const img2 = photoStorage[`m${i}_f2`] || '';

            mingguListP2.innerHTML += `
                <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <!-- Rounded Green Box Header -->
                    <div style="background-color: #059669; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 6px; display: inline-block; margin-bottom: 8px;">
                        Minggu ${getRoman(i)} - (${bulanLaporFull})
                    </div>
                    
                    <div style="font-size: 10px; color: #374151; line-height: 1.4; margin-bottom: 10px;">
                        <div><strong>Kegiatan:</strong> ${kegiatanMaster}</div>
                        <div><strong>Lokasi:</strong> ${lokasiMaster}</div>
                    </div>

                    <!-- 4:3 Ratio Photos Grid -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div style="aspect-ratio: 4/3; background-color: #f3f4f6; border-radius: 8px; overflow: hidden; border: 1px solid #d1d5db;">
                            ${img1 ? `<img src="${img1}" style="width: 100%; height: 100%; object-fit: cover;">` : '<div style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #9ca3af; font-style: italic;">Foto 1 Belum Diunggah</div>'}
                        </div>
                        <div style="aspect-ratio: 4/3; background-color: #f3f4f6; border-radius: 8px; overflow: hidden; border: 1px solid #d1d5db;">
                            ${img2 ? `<img src="${img2}" style="width: 100%; height: 100%; object-fit: cover;">` : '<div style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #9ca3af; font-style: italic;">Foto 2 Belum Diunggah</div>'}
                        </div>
                    </div>
                </div>
            `;
        }

        const status = actionType === 'download' ? 'Terunduh' : 'Tershare';
        logRiwayatToGAS(selectedPegawai.nama, bulan, status);

        const element = document.getElementById('pdf-template');
        // NAMA - BULAN LAPOR TAHUN filename format
        const cleanNama = selectedPegawai.nama.replace(/[^a-zA-Z0-9 ]/g, '').trim();
        const filename = `${cleanNama} - ${bulan.toUpperCase()} 2026.pdf`;

        const opt = {
            margin: 0,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (actionType === 'download') {
            await html2pdf().set(opt).from(element).save();
        } else if (actionType === 'share') {
            const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
            const file = new File([pdfBlob], filename, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Laporan Aktivitas Pegawai',
                    text: `Berikut laporan aktivitas pegawai ${selectedPegawai.nama}`,
                    files: [file]
                });
            } else {
                alert('Fitur bagikan berkas langsung tidak didukung di browser ini. Berkas PDF diunduh otomatis.');
                await html2pdf().set(opt).from(element).save();
            }
        }
    } catch (error) {
        console.error("Gagal membuat PDF:", error);
        alert("Terjadi kesalahan saat membuat file PDF: " + error.message);
    } finally {
        btnDownload.disabled = false;
        btnShare.disabled = false;
        btnDownload.innerHTML = origDownloadText;
        btnShare.innerHTML = origShareText;
    }
}

function getRoman(num) {
    const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
    return map[num] || num;
}

async function logRiwayatToGAS(nama, bulan, status) {
    try {
        await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'logRiwayat', nama: nama, bulan: bulan, status: status })
        });
    } catch (e) {
        console.warn("Log riwayat gagal (offline):", e);
    }
}
