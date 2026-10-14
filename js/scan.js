let html5QrScannerInstance = null; // Menyimpan instansi scanner kamera

document.addEventListener("DOMContentLoaded", () => {
  const lksInput = document.getElementById("lks");
  if (lksInput) lksInput.value = "";
});

// Handler Tekan Enter di Kolom LKS -> Fokus ke Barcode
function handleLksKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const barcodeInput = document.getElementById("barcode");
    if (barcodeInput) {
      barcodeInput.focus();
    }
  }
}

// FUNGSI UTAMA: Simpan & Finalisasi Data Scan LKS ke Laporan
function simpanLokasiLKS() {
  const lksInput = document.getElementById("lks");
  const currentLKS = lksInput ? lksInput.value.trim().toUpperCase() : "";

  if (!currentLKS) return showToast("Kode LKS tidak boleh kosong!", "error");

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

    showCustomConfirm(`Simpan permanen ${dataLKS.length} item dari ${currentLKS} ke Laporan dan bersihkan tabel scan?`, () => {
      
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
      recentTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding:16px;">Tabel bersih. Siap untuk scan ${currentLKS || 'LKS baru'}.</td></tr>`;
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

// FUNGSI UTAMA TAMBAH / UPDATE ENTRY
function simpanInputSO() {
  const editId = document.getElementById("edit-id-so").value;
  const lks = document.getElementById("lks").value.trim();
  const barcode = document.getElementById("barcode").value.trim();
  const nama = document.getElementById("nama_barang").value;
  const qty = parseInt(document.getElementById("qty").value) || 0;

  if (!lks) return showToast("Lokasi / LKS belum diisi!", "error");
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

function resetFormScan() {
  document.getElementById("edit-id-so").value = "";
  document.getElementById("barcode").value = "";
  document.getElementById("nama_barang").value = "";
  document.getElementById("qty").value = "1";

  const btnSimpan = document.getElementById("btn-simpan-entry");
  if (btnSimpan) {
    btnSimpan.innerText = "+ Simpan Entry";
    btnSimpan.style.background = "var(--primary)";
  }
}

function hapusInputSO(id) {
  showCustomConfirm("Yakin ingin menghapus item SO ini?", () => {
    const tx = db.transaction("input_so", "readwrite");
    const store = tx.objectStore("input_so");
    store.delete(id);

    tx.oncomplete = () => {
      resetFormScan();
      showToast("Data SO Dihapus!", "success");
      refreshUI();
    };
  });
}

// ==========================================
// FUNGSI AKSI: SCANNER KAMERA BARCODE
// ==========================================
function bukaKameraScan() {
  const lks = document.getElementById("lks").value.trim();
  if (!lks) {
    return showToast("Lokasi / LKS harus diisi dulu!", "error");
  }

  const modal = document.getElementById("modal-camera");
  if (modal) modal.classList.add("show");

  if (html5QrScannerInstance) {
    html5QrScannerInstance.stop().catch(() => {});
  }

  html5QrScannerInstance = new Html5Qrcode("interactive");

  html5QrScannerInstance.start(
    { facingMode: "environment" },
    {
      fps: 15,
      qrbox: { width: 260, height: 120 }
    },
    (decodedText) => {
      document.getElementById("barcode").value = decodedText;
      playBeep();
      tutupKameraScan();

      cariBarangOtomatis();
      showToast("Barcode terbaca: " + decodedText, "success");
    },
    (errorMessage) => {
      // Ignore reading errors
    }
  ).catch(err => {
    showToast("Gagal mengakses kamera. Izinkan akses kamera!", "error");
    tutupKameraScan();
  });
}

function tutupKameraScan() {
  const modal = document.getElementById("modal-camera");
  if (modal) modal.classList.remove("show");

  if (html5QrScannerInstance) {
    html5QrScannerInstance.stop().then(() => {
      html5QrScannerInstance = null;
    }).catch(() => {
      html5QrScannerInstance = null;
    });
  }
}