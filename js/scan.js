let html5QrScannerInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  const lksInput = document.getElementById("lks");
  if (lksInput) lksInput.value = "";

  // Sembunyikan dropdown jika mengklik di luar area input nama barang
  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("search-nama-results");
    const inputNama = document.getElementById("nama_barang");
    const btnUnlock = document.getElementById("btn-unlock-nama");

    if (dropdown && !dropdown.contains(e.target) && e.target !== inputNama && e.target !== btnUnlock) {
      dropdown.classList.remove("show");
    }
  });
});

function handleLksKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const barcodeInput = document.getElementById("barcode");
    if (barcodeInput) barcodeInput.focus();
  }
}

// Buka/Tutup Mode Pencarian Nama Barang
function toggleCariNama() {
  const inputNama = document.getElementById("nama_barang");
  const btnUnlock = document.getElementById("btn-unlock-nama");

  if (inputNama.readOnly) {
    inputNama.readOnly = false;
    inputNama.style.background = "#ffffff";
    inputNama.style.color = "var(--text-main)";
    btnUnlock.style.background = "#dc2626"; // Berubah merah (Cancel)
    inputNama.focus();
    cariBarangByNamaManual();
  } else {
    kunciInputNama();
  }
}

function kunciInputNama() {
  const inputNama = document.getElementById("nama_barang");
  const btnUnlock = document.getElementById("btn-unlock-nama");
  const dropdown = document.getElementById("search-nama-results");

  inputNama.readOnly = true;
  inputNama.style.background = "#f8fafc";
  inputNama.style.color = "var(--text-muted)";
  btnUnlock.style.background = "#059669"; // Berubah hijau (Search)
  if (dropdown) dropdown.classList.remove("show");
}

// Pencarian Barang berdasarkan Nama (A-Z & Contains)
function cariBarangByNamaManual() {
  const keyword = document.getElementById("nama_barang").value.trim().toLowerCase();
  const dropdown = document.getElementById("search-nama-results");

  if (!dropdown) return;
  if (!keyword) {
    dropdown.classList.remove("show");
    dropdown.innerHTML = "";
    return;
  }

  const tx = db.transaction("master_barang", "readonly");
  const store = tx.objectStore("master_barang");
  const req = store.getAll();

  req.onsuccess = () => {
    const allItems = req.result || [];
    
    let matches = allItems.filter(item => 
      item.nama_barang && item.nama_barang.toLowerCase().includes(keyword)
    );

    matches.sort((a, b) => a.nama_barang.localeCompare(b.nama_barang));

    if (matches.length === 0) {
      dropdown.innerHTML = `<div style="padding: 8px 10px; font-size: 0.7rem; color: var(--text-muted); text-align: center;">Tidak ada barang yang cocok</div>`;
    } else {
      dropdown.innerHTML = matches.slice(0, 30).map(item => `
        <div class="search-item" onclick="pilihBarangDariNama('${item.barcode}', '${item.nama_barang.replace(/'/g, "\\'")}')">
          <span class="item-nama">${item.nama_barang}</span>
          <span class="item-barcode">Barcode: ${item.barcode}</span>
        </div>
      `).join('');
    }

    dropdown.classList.add("show");
  };
}

// Handler Saat Item Hasil Pencarian Diklik
function pilihBarangDariNama(barcode, namaBarang) {
  document.getElementById("barcode").value = barcode;
  document.getElementById("nama_barang").value = namaBarang;
  
  playBeep();
  kunciInputNama();

  const qtyInput = document.getElementById("qty");
  if (qtyInput) {
    qtyInput.focus();
    qtyInput.select();
  }
}

function simpanLokasiLKS() {
  const lksInput = document.getElementById("lks");
  const currentLKS = lksInput ? lksInput.value.trim().toUpperCase() : "";

  if (!currentLKS) return showToast("Kode Lokasi tidak boleh kosong!", "error");

  const tx = db.transaction(["input_so"], "readwrite");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const allData = req.result || [];
    
    const dataLKS = allData.filter(item => {
      const itemLKS = item.lks ? item.lks.toString().trim().toUpperCase() : "";
      return itemLKS === currentLKS && item.status !== "saved";
    });

    if (dataLKS.length === 0) {
      return showToast(`Tidak ada data scan aktif di ${currentLKS} untuk disimpan!`, "error");
    }

    showCustomConfirm({
      title: "Simpan & Finalisasi?",
      msg: `Simpan permanen ${dataLKS.length} item dari ${currentLKS} ke Laporan dan bersihkan tabel scan?`,
      iconType: "save",
      btnConfirmText: "Ya, Simpan",
      onConfirm: () => {
        const txUpdate = db.transaction(["input_so"], "readwrite");
        const storeUpdate = txUpdate.objectStore("input_so");

        dataLKS.forEach(item => {
          item.status = "saved";
          storeUpdate.put(item);
        });

        txUpdate.oncomplete = () => {
          resetFormScan();
          if (lksInput) lksInput.value = "";
          showToast(`Data ${currentLKS} berhasil disimpan ke Laporan!`, "success");
          refreshUI();
          if (lksInput) lksInput.focus();
        };
      }
    });
  };
}

function renderScanUI() {
  if (!db) return;

  const lksInput = document.getElementById("lks");
  const currentLKS = lksInput ? lksInput.value.trim().toUpperCase() : "";

  const txSO = db.transaction("input_so", "readonly");
  const reqSO = txSO.objectStore("input_so").getAll();

  reqSO.onsuccess = () => {
    const data = reqSO.result || [];

    const filteredData = data.filter(item => {
      const itemLKS = item.lks ? item.lks.toString().trim().toUpperCase() : "";
      return itemLKS === currentLKS && item.status !== "saved";
    });

    const recentTbody = document.getElementById("tabel-scan-recent");
    if (!recentTbody) return;

    if (filteredData.length === 0) {
      recentTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding:12px;">Tabel bersih. Siap untuk scan ${currentLKS || 'Lokasi baru'}.</td></tr>`;
      return;
    }

    recentTbody.innerHTML = filteredData.reverse().map((item, index) => `
      <tr>
        <td><b>${index + 1}</b></td>
        <td><code>${item.barcode}</code></td>
        <td>${item.nama_barang}</td>
        <td><b>${item.qty}</b></td>
        <td>
          <div class="action-btn-group">
            <button class="btn-icon edit" title="Edit QTY" onclick="persiapkanEditSO(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon delete" title="Hapus Entry" onclick="hapusInputSO(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  };
}

function cariBarangOtomatis() {
  const barcode = document.getElementById("barcode").value.trim();
  if (!barcode) return;

  const tx = db.transaction("master_barang", "readonly");
  const store = tx.objectStore("master_barang");
  const req = store.get(barcode);

  req.onsuccess = () => {
    if (req.result) {
      document.getElementById("nama_barang").value = req.result.nama_barang;
      playBeep();

      const qtyInput = document.getElementById("qty");
      qtyInput.focus();
      qtyInput.select();
    } else {
      document.getElementById("nama_barang").value = "Barang Tidak Ditemukan!";
    }
  };
}

function handleQtyKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    simpanInputSO();
  }
}

function simpanInputSO() {
  const editId = document.getElementById("edit-id-so").value;
  const lks = document.getElementById("lks").value.trim();
  const barcode = document.getElementById("barcode").value.trim();
  const nama = document.getElementById("nama_barang").value;
  const qty = parseInt(document.getElementById("qty").value) || 0;

  if (!lks) return showToast("Kode Lokasi belum diisi!", "error");
  if (!barcode || !qty) return showToast("Lengkapi barcode dan QTY terlebih dahulu!", "error");

  const tx = db.transaction("input_so", "readwrite");
  const store = tx.objectStore("input_so");

  if (editId) {
    const req = store.get(parseInt(editId));
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.lks = lks.toUpperCase();
        item.barcode = barcode;
        item.nama_barang = nama;
        item.qty = qty;
        store.put(item);
      }
    };

    tx.oncomplete = () => {
      resetFormScan();
      showToast("Data Entry Berhasil Diperbarui!", "success");
      const barcodeInput = document.getElementById("barcode");
      if (barcodeInput) barcodeInput.focus();
      refreshUI();
    };
  } else {
    store.add({ 
      lks: lks.toUpperCase(), 
      barcode, 
      nama_barang: nama, 
      qty, 
      status: "active",
      timestamp: new Date().toISOString() 
    });

    tx.oncomplete = () => {
      resetFormScan();
      showToast("Entry ditambahkan!", "success");
      const barcodeInput = document.getElementById("barcode");
      if (barcodeInput) barcodeInput.focus();
      refreshUI();
    };
  }
}

function persiapkanEditSO(id) {
  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.get(id);

  req.onsuccess = () => {
    const item = req.result;
    if (item) {
      document.getElementById("edit-id-so").value = item.id;
      document.getElementById("barcode").value = item.barcode;
      document.getElementById("nama_barang").value = item.nama_barang;
      document.getElementById("qty").value = item.qty;

      const btnSimpan = document.getElementById("btn-simpan-entry");
      if (btnSimpan) {
        btnSimpan.innerText = "✓ Update Entry";
        btnSimpan.style.background = "#0284c7";
      }

      const qtyInput = document.getElementById("qty");
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }

      showToast("Mode Edit: Silakan sesuaikan QTY", "success");
    }
  };
}

// Batal / Reset Seluruh Field Input Scan
function batalInputForm() {
  resetFormScan();
  showToast("Form berhasil di-reset", "success");
  
  const barcodeInput = document.getElementById("barcode");
  if (barcodeInput) barcodeInput.focus();
}

function resetFormScan() {
  document.getElementById("edit-id-so").value = "";
  document.getElementById("barcode").value = "";
  document.getElementById("nama_barang").value = "";
  document.getElementById("qty").value = "1";
  kunciInputNama();

  const btnSimpan = document.getElementById("btn-simpan-entry");
  if (btnSimpan) {
    btnSimpan.innerText = "+ Simpan Entry";
    btnSimpan.style.background = "var(--primary)";
  }
}

// Hapus Entry SO dengan Modal Dinamis
function hapusInputSO(id) {
  showCustomConfirm({
    title: "Hapus Entry SO?",
    msg: "Yakin ingin menghapus item SO ini dari daftar scan?",
    iconType: "trash",
    btnConfirmText: "Ya, Hapus",
    btnConfirmClass: "btn-danger",
    onConfirm: () => {
      const tx = db.transaction("input_so", "readwrite");
      const store = tx.objectStore("input_so");
      store.delete(id);

      tx.oncomplete = () => {
        resetFormScan();
        showToast("Data SO berhasil dihapus!", "success");
        refreshUI();
      };
    }
  });
}

// Modal Konfirmasi Custom Fleksibel & Dinamis
function showCustomConfirm(options) {
  const modal = document.getElementById("modal-confirm");
  if (!modal) return;

  const titleEl = modal.querySelector("h3");
  const msgEl = document.getElementById("modal-confirm-msg");
  const btnYa = document.getElementById("btn-modal-ya");
  const btnBatal = document.getElementById("btn-modal-batal");
  const iconContainer = modal.querySelector(".modal-card > div:first-child");

  if (typeof options === "string") {
    options = {
      title: "Simpan & Finalisasi?",
      msg: options,
      onConfirm: arguments[1]
    };
  }

  if (titleEl) titleEl.innerText = options.title || "Konfirmasi";
  if (msgEl) msgEl.innerText = options.msg || "Apakah Anda yakin?";
  if (btnYa) {
    btnYa.innerText = options.btnConfirmText || "Ya, Simpan";
    btnYa.style.background = options.btnConfirmClass === "btn-danger" ? "#dc2626" : "var(--primary)";
  }

  if (iconContainer) {
    if (options.iconType === "trash") {
      iconContainer.style.background = "#fee2e2";
      iconContainer.style.color = "#dc2626";
      iconContainer.innerHTML = `<svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
    } else {
      iconContainer.style.background = "#ecfdf5";
      iconContainer.style.color = "var(--primary)";
      iconContainer.innerHTML = `<svg style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
    }
  }

  modal.classList.add("show");

  btnYa.onclick = () => {
    modal.classList.remove("show");
    if (typeof options.onConfirm === "function") options.onConfirm();
  };

  btnBatal.onclick = () => {
    modal.classList.remove("show");
  };
}

// FUNGSI PERBAIKAN TOTAL KAMERA SCAN
function bukaKameraScan() {
  const lks = document.getElementById("lks").value.trim();
  if (!lks) {
    return showToast("Kode Lokasi harus diisi dulu!", "error");
  }

  const modal = document.getElementById("modal-camera");
  if (modal) modal.classList.add("show");

  // Jika ada scanner aktif, stop & bersihkan container DOM terlebih dahulu
  if (html5QrScannerInstance) {
    html5QrScannerInstance.stop().then(() => {
      html5QrScannerInstance = null;
      bersihkanContainerKamera();
      mulaikanScanner();
    }).catch(() => {
      html5QrScannerInstance = null;
      bersihkanContainerKamera();
      mulaikanScanner();
    });
  } else {
    bersihkanContainerKamera();
    mulaikanScanner();
  }
}

function bersihkanContainerKamera() {
  const container = document.getElementById("interactive");
  if (container) {
    container.innerHTML = "";
  }
}

function mulaikanScanner() {
  try {
    html5QrScannerInstance = new Html5Qrcode("interactive");

    html5QrScannerInstance.start(
      { facingMode: "environment" },
      {
        fps: 15,
        qrbox: { width: 220, height: 90 }
      },
      (decodedText) => {
        document.getElementById("barcode").value = decodedText;
        playBeep();
        tutupKameraScan();

        cariBarangOtomatis();
        showToast("Barcode terbaca: " + decodedText, "success");
      },
      (errorMessage) => {
        // Abaikan error per-frame scanning biasa
      }
    ).catch(err => {
      console.error("Kamera error:", err);
      showToast("Gagal mengakses kamera. Izinkan akses kamera!", "error");
      tutupKameraScan();
    });
  } catch (err) {
    console.error("Inisialisasi kamera error:", err);
    showToast("Fitur kamera gagal diinisialisasi!", "error");
    tutupKameraScan();
  }
}

function tutupKameraScan() {
  const modal = document.getElementById("modal-camera");
  if (modal) modal.classList.remove("show");

  if (html5QrScannerInstance) {
    html5QrScannerInstance.stop().then(() => {
      html5QrScannerInstance = null;
      bersihkanContainerKamera();
    }).catch(() => {
      html5QrScannerInstance = null;
      bersihkanContainerKamera();
    });
  } else {
    bersihkanContainerKamera();
  }
}