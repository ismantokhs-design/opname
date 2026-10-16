function renderLaporanUI() {
  if (!db) return;

  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    
    // Kelompokkan data berdasarkan LKS (hanya yang status 'saved')
    const grouped = {};
    data.forEach(item => {
      if (item.status === "saved") {
        const lks = item.lks ? String(item.lks).trim().toUpperCase() : "TANPA LOKASI";
        if (!grouped[lks]) {
          grouped[lks] = {
            lks: lks,
            totalItems: 0,
            totalQty: 0,
            details: []
          };
        }
        grouped[lks].totalItems += 1;
        grouped[lks].totalQty += (parseInt(item.qty) || 0);
        grouped[lks].details.push(item);
      }
    });

    const lksKeys = Object.keys(grouped).sort();
    
    const countRekap = document.getElementById("count-rekap-lks");
    if (countRekap) countRekap.innerText = `${lksKeys.length} Lokasi Terdata`;

    const tbody = document.getElementById("tabel-laporan-rekap");
    if (!tbody) return;

    if (lksKeys.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding:12px;">Belum ada data lokasi yang disimpan.</td></tr>`;
      return;
    }

    tbody.innerHTML = lksKeys.map((lks, index) => {
      const row = grouped[lks];
      return `
        <tr>
          <td><b>${index + 1}</b></td>
          <td><code>${row.lks}</code></td>
          <td><b>${row.totalItems}</b> Item</td>
          <td><b>${row.totalQty}</b> Pcs</td>
          <td style="text-align: right;">
            <div class="action-btn-group" style="justify-content: flex-end;">
              <button class="btn-icon" title="Lihat Detail & Export" onclick="lihatDetailLKS('${row.lks}')" style="background: #e0f2fe; color: #0284c7;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn-icon" title="Export ke Text (.txt)" onclick="exportLokasiKeText('${row.lks}')" style="background: #ecfdf5; color: #059669;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };
}

function lihatDetailLKS(lksCode) {
  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    const filtered = data.filter(item => {
      const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
      return itemLKS === lksCode && item.status === "saved";
    });

    const modal = document.getElementById("modal-detail-lks");
    const titleEl = document.getElementById("modal-detail-title");
    const tbody = document.getElementById("tabel-detail-lks-body");

    if (titleEl) titleEl.innerText = `Rincian Barang - Lokasi: ${lksCode}`;
    
    if (tbody) {
      tbody.innerHTML = filtered.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><code>${item.barcode}</code></td>
          <td>${item.nama_barang}</td>
          <td><b>${item.qty}</b></td>
          <td><span style="font-size:0.65rem; color: #d97706;">${item.keterangan || '-'}</span></td>
        </tr>
      `).join('');
    }

    const modalCard = modal.querySelector(".modal-card");
    let exportBtnContainer = document.getElementById("modal-export-btn-container");
    if (!exportBtnContainer) {
      exportBtnContainer = document.createElement("div");
      exportBtnContainer.id = "modal-export-btn-container";
      exportBtnContainer.style.marginTop = "10px";
      modalCard.appendChild(exportBtnContainer);
    }
    exportBtnContainer.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="exportLokasiKeText('${lksCode}')" style="width: 100%; background: #059669; color: white; border: none;">
        📁 Export Lokasi ${lksCode} ke Text (.txt)
      </button>
    `;

    if (modal) modal.classList.add("show");
  };
}

function tutupModalDetailLKS() {
  const modal = document.getElementById("modal-detail-lks");
  if (modal) modal.classList.remove("show");
}

// Export 1 Lokasi Tertentu
function exportLokasiKeText(lksCode) {
  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    const filtered = data.filter(item => {
      const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
      return itemLKS === lksCode && item.status === "saved";
    });

    if (filtered.length === 0) {
      return showToast(`Tidak ada data untuk lokasi ${lksCode}`, "error");
    }

    const isKetEnabled = localStorage.getItem("keterangan_enabled") === "true";
    let fileContent = "";

    filtered.forEach(item => {
      const barcode = item.barcode || "";
      const qty = item.qty || 0;
      const ket = item.keterangan ? item.keterangan.trim() : "";

      if (isKetEnabled) {
        fileContent += `${barcode},${qty},${ket}\n`;
      } else {
        fileContent += `${barcode},${qty}\n`;
      }
    });

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lksCode}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`File ${lksCode}.txt berhasil di-export!`, "success");
  };
}

// Export Keseluruhan Semua Lokasi ke 1 File Text
function exportSemuaLokasiKeText() {
  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    const savedData = data.filter(item => item.status === "saved");

    if (savedData.length === 0) {
      return showToast("Belum ada data laporan yang tersimpan untuk di-export!", "error");
    }

    const isKetEnabled = localStorage.getItem("keterangan_enabled") === "true";
    let fileContent = "";

    savedData.forEach(item => {
      const barcode = item.barcode || "";
      const qty = item.qty || 0;
      const ket = item.keterangan ? item.keterangan.trim() : "";

      if (isKetEnabled) {
        fileContent += `${barcode},${qty},${ket}\n`;
      } else {
        fileContent += `${barcode},${qty}\n`;
      }
    });

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Semua_Lokasi_SO.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`File Rekap Semua_Lokasi_SO.txt berhasil di-export!`, "success");
  };
}