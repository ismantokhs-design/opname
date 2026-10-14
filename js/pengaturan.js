// Fungsi Utama Import File (Otomatis Deteksi .json atau .txt)
function importFileManual(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  const reader = new FileReader();

  reader.onload = function(e) {
    const fileContent = e.target.result;

    // A. PROSES FILE JSON
    if (fileName.endsWith('.json')) {
      try {
        const parsedData = JSON.parse(fileContent);
        if (Array.isArray(parsedData)) {
          simpanArrayKeMasterDB(parsedData, true);
        } else {
          showToast("Format JSON harus berupa Array [ ... ]!", "error");
        }
      } catch (err) {
        showToast("File JSON tidak valid!", "error");
      }
    } 
    // B. PROSES FILE TEKS (.txt)
    else if (fileName.endsWith('.txt')) {
      const lines = fileContent.split(/\r?\n/);
      const dataMaster = [];

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Pisahkan barcode dan nama barang berdasarkan koma (,), titik koma (;), atau tab (\t)
        const parts = trimmed.split(/[,;\t]/);
        if (parts.length >= 2) {
          const barcode = parts[0].trim();
          // Gabungkan sisa kolom jika nama barang mengandung karakter pemisah
          const namaBarang = parts.slice(1).join(" ").trim();

          if (barcode && namaBarang) {
            dataMaster.push({
              barcode: barcode,
              nama_barang: namaBarang
            });
          }
        }
      });

      if (dataMaster.length > 0) {
        simpanArrayKeMasterDB(dataMaster, true);
      } else {
        showToast("Format .txt tidak valid! Gunakan format: Barcode, Nama Barang", "error");
      }
    } else {
      showToast("Gunakan file berformat .json atau .txt!", "error");
    }

    // Reset nilai input file
    event.target.value = "";
  };

  reader.readAsText(file);
}