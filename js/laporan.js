function renderLaporanUI() {
  if (!db) return;

  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    const tbody = document.getElementById("tabel-laporan-rekap");
    const countBadge = document.getElementById("count-rekap-lks");

    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding:20px;">Belum ada data SO yang tersimpan di Laporan.</td></tr>`;
      if (countBadge) countBadge.innerText = "0 Lokasi Terdata";
      return;
    }

    // Kelompokkan/Rekap data berdasarkan Kode LKS (Hanya yang status 'saved')
    const rekapLKS = {};
    data.forEach(item => {
      const lksKey = item.lks ? item.lks.toString().trim().toUpperCase() : "TANPA LKS";
      if (!rekapLKS[lksKey]) {
        rekapLKS[lksKey] = {
          lks: lksKey,
          totalItem: 0,
          totalQty: 0,
          items: []
        };
      }
      rekapLKS[lksKey].totalItem += 1;
      rekapLKS[lksKey].totalQty += parseInt(item.qty) || 0;
      rekapLKS[lksKey].items.push(item);
    });

    const listLKS = Object.values(rekapLKS);
    if (countBadge) countBadge.innerText = `${listLKS.length} Lokasi Terdata`;

    tbody.innerHTML = listLKS.map((row, index) => `
      <tr>
        <td><b>${index + 1}</b></td>
        <td><code style="font-weight: 700; color: var(--primary-dark);">${row.lks}</code></td>
        <td>${row.totalItem} Barang</td>
        <td><b>${row.totalQty}</b> Pcs</td>
        <td>
          <div class="action-btn-group">
            <button class="btn-icon edit" title="Lihat Detail Barang" onclick="lihatDetailLKS('${row.lks}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-icon edit" title="Edit Data LKS di Scan" onclick="editLksKeMenuScan('${row.lks}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon delete" title="Hapus Seluruh Data LKS" onclick="hapusDataLKS('${row.lks}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  };
}

// 1. FUNGSI AKSI: DETAIL RINCIAN LOKASI
function lihatDetailLKS(kodeLKS) {
  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    const itemsLKS = data.filter(item => (item.lks ? item.lks.trim().toUpperCase() : "") === kodeLKS);

    document.getElementById("modal-detail-title").innerText = `Rincian Barang - ${kodeLKS}`;
    const tbody = document.getElementById("tabel-detail-lks-body");

    if (itemsLKS.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:12px;">Tidak ada item data.</td></tr>`;
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

    const modal = document.getElementById("modal-detail-lks");
    if (modal) modal.classList.add("show");
  };
}

function tutupModalDetailLKS() {
  const modal = document.getElementById("modal-detail-lks");
  if (modal) modal.classList.remove("show");
}

// 2. FUNGSI AKSI EDIT: BUKA KEMBALI DATA LKS DI MENU SCAN
function editLksKeMenuScan(kodeLKS) {
  const tx = db.transaction("input_so", "readwrite");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    
    // Kembalikan status data LKS ini dari 'saved' menjadi 'active'
    data.forEach(item => {
      if ((item.lks ? item.lks.trim().toUpperCase() : "") === kodeLKS) {
        item.status = "active";
        store.put(item);
      }
    });

    tx.oncomplete = () => {
      // 1. Isi input LKS di menu scan dengan LKS yang diedit
      const lksInput = document.getElementById("lks");
      if (lksInput) lksInput.value = kodeLKS;

      // 2. Tampilkan Toast Notification
      showToast(`Membuka LKS ${kodeLKS} di menu Scan`, "success");

      // 3. Pindah langsung ke menu Scan Data
      switchNav('scan', 'Scan Data');
    };
  };
}

// 3. FUNGSI AKSI: HAPUS SELURUH REKAP LOKASI
function hapusDataLKS(kodeLKS) {
  showCustomConfirm(`Yakin ingin MENGHAPUS SEMUA DATA SCAN di lokasi ${kodeLKS}? Data tidak bisa dikembalikan!`, () => {
    const tx = db.transaction("input_so", "readwrite");
    const store = tx.objectStore("input_so");
    const req = store.getAll();

    req.onsuccess = () => {
      const data = req.result || [];
      data.forEach(item => {
        if ((item.lks ? item.lks.trim().toUpperCase() : "") === kodeLKS) {
          store.delete(item.id);
        }
      });

      tx.oncomplete = () => {
        showToast(`Seluruh data ${kodeLKS} berhasil dihapus!`, "success");
        refreshUI();
      };
    };
  });
}