function renderLaporanUI() {
  if (!db) return;

  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const allData = req.result || [];
    
    // Filter hanya data yang sudah difinalisasi/saved
    const savedData = allData.filter(item => item.status === "saved");

    // Grouping data berdasarkan Lokasi / LKS
    const rekapLKS = {};
    savedData.forEach(item => {
      const lksKey = item.lks ? String(item.lks).trim().toUpperCase() : "TANPA LOKASI";
      if (!rekapLKS[lksKey]) {
        rekapLKS[lksKey] = {
          lks: lksKey,
          totalItem: 0,
          totalQty: 0,
          items: []
        };
      }
      rekapLKS[lksKey].totalItem += 1;
      rekapLKS[lksKey].totalQty += (parseInt(item.qty) || 0);
      rekapLKS[lksKey].items.push(item);
    });

    const listLKS = Object.values(rekapLKS);

    // Update Counter Jumlah Lokasi Terdata
    const countEl = document.getElementById("count-rekap-lks");
    if (countEl) {
      countEl.innerText = `${listLKS.length} Lokasi Terdata`;
    }

    const tbody = document.getElementById("tabel-laporan-rekap");
    if (!tbody) return;

    if (listLKS.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding:12px;">Belum ada laporan lokasi yang disimpan.</td></tr>`;
      return;
    }

    tbody.innerHTML = listLKS.map((row, index) => `
      <tr>
        <td><b>${index + 1}</b></td>
        <td><b>${row.lks}</b></td>
        <td>${row.totalItem} Barang</td>
        <td><b>${row.totalQty} Pcs</b></td>
        <td>
          <div class="action-btn-group">
            <button class="btn-icon edit" title="Lihat Detail Rincian" onclick="bukaDetailLKS('${row.lks}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-icon edit" title="Edit Data Lokasi Ini" onclick="editDataLKS('${row.lks}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon delete" title="Hapus Laporan Lokasi Ini" onclick="hapusLaporanLKS('${row.lks}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  };
}

// Buka Modal Rincian Barang Per Lokasi
function bukaDetailLKS(lksKode) {
  const modal = document.getElementById("modal-detail-lks");
  const titleEl = document.getElementById("modal-detail-title");
  const tbody = document.getElementById("tabel-detail-lks-body");

  if (titleEl) titleEl.innerText = `Rincian Barang - Lokasi ${lksKode}`;

  const tx = db.transaction("input_so", "readonly");
  const req = tx.objectStore("input_so").getAll();

  req.onsuccess = () => {
    const allData = req.result || [];
    const itemsLKS = allData.filter(item => {
      const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
      return itemLKS === lksKode && item.status === "saved";
    });

    if (tbody) {
      if (itemsLKS.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:10px; color: var(--text-muted);">Tidak ada rincian data.</td></tr>`;
      } else {
        tbody.innerHTML = itemsLKS.map((item, idx) => `
          <tr>
            <td><b>${idx + 1}</b></td>
            <td><code>${item.barcode}</code></td>
            <td>${item.nama_barang}</td>
            <td><b>${item.qty}</b></td>
          </tr>
        `).join('');
      }
    }

    if (modal) modal.classList.add("show");
  };
}

function tutupModalDetailLKS() {
  const modal = document.getElementById("modal-detail-lks");
  if (modal) modal.classList.remove("show");
}

// Edit/Kembalikan Data Lokasi ke Halaman Scan
function editDataLKS(lksKode) {
  showCustomConfirm({
    title: `Edit Data Lokasi?`,
    msg: `Kembalikan data Lokasi ${lksKode} ke menu Scan untuk diedit kembali?`,
    iconType: "save",
    btnConfirmText: "Ya, Edit",
    onConfirm: () => {
      const tx = db.transaction(["input_so"], "readwrite");
      const store = tx.objectStore("input_so");
      const req = store.getAll();

      req.onsuccess = () => {
        const allData = req.result || [];
        const itemsLKS = allData.filter(item => {
          const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
          return itemLKS === lksKode && item.status === "saved";
        });

        itemsLKS.forEach(item => {
          item.status = "active";
          store.put(item);
        });

        tx.oncomplete = () => {
          const lksInput = document.getElementById("lks");
          if (lksInput) lksInput.value = lksKode;

          showToast(`Data Lokasi ${lksKode} siap dikoreksi di menu Scan!`, "success");
          switchNav("scan", "Scan Data");
        };
      };
    }
  });
}

// Hapus Seluruh Data Laporan Per Lokasi (Judul Umum: "Hapus Data?")
function hapusLaporanLKS(lksKode) {
  showCustomConfirm({
    title: "Hapus Data?",
    msg: `Yakin ingin menghapus semua data scan di lokasi ${lksKode}?`,
    iconType: "trash",
    btnConfirmText: "Ya, Hapus",
    btnConfirmClass: "btn-danger",
    onConfirm: () => {
      const tx = db.transaction(["input_so"], "readwrite");
      const store = tx.objectStore("input_so");
      const req = store.getAll();

      req.onsuccess = () => {
        const allData = req.result || [];
        const itemsLKS = allData.filter(item => {
          const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
          return itemLKS === lksKode && item.status === "saved";
        });

        itemsLKS.forEach(item => {
          store.delete(item.id);
        });

        tx.oncomplete = () => {
          showToast(`Laporan Lokasi ${lksKode} berhasil dihapus!`, "success");
          refreshUI();
        };
      };
    }
  });
}