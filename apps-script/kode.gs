/**
 * ============================================================================
 * KARYAWAN APP - BACKEND LOGIC (PENGELUARAN UPDATE)
 * ============================================================================
 * Fitur Baru: Edit & Hapus Pengeluaran
 */

const CONFIG = {
  DB_ID: '1iz7B7MzBqIU4u72N4SyoeOA0NTA4EiNnYSIHE8hDpV0',
  STOK_ID: '1m3Kzzw0H84NVxBXmhIvcrQDQ6q2MmciTmbwV_cqKtJY',
  FOTO_FOLDER_ID: '16nDd0ozjr6eR3JcKmyBEnB-16HDqa9jb',
  NOTIF_EMAIL: 'alfiannurhuda1@gmail.com', // Ganti dengan email admin Anda
  TELEGRAM_TOKEN: '',                      // Isi token bot Telegram Anda jika ingin menggunakan notif WA/Telegram alternatif
  TELEGRAM_CHAT_ID: ''                     // Isi Chat ID Telegram Anda
};

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Karyawan App')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Endpoint untuk menerima HTTP POST dari Vue.js PWA
function doPost(e) {
  try {
    // Parsing payload dari request Vue
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload;
    
    let result = {};

    // Router sederhana berdasarkan parameter 'action'
    switch(action) {
      case 'login':
        result = loginUser(payload);
        break;
      case 'getStok':
        result = getStokMobile(payload.toko);
        break;
      case 'simpanAbsensi':
        result = simpanAbsensi(payload);
        break;
      case 'batchUpdateStok':
        result = batchUpdateStokMobile(payload);
        break;
      case 'gantiKataSandi':
        result = gantiKataSandi(payload);
        break;
      case 'simpanLaporanSalah':
        result = simpanLaporanSalah(payload);
        break;
      case 'tambahPengeluaran':
        result = tambahPengeluaranMobile(payload);
        break;
      case 'hapusPengeluaran':
        result = hapusPengeluaranMobile(payload);
        break;
      case 'editPengeluaran':
        result = editPengeluaranMobile(payload);
        break;
      case 'getDashboardSummary':
        result = getDashboardSummary(payload.toko);
        break;
      default:
        result = response(false, "Action tidak ditemukan");
    }

    // Kembalikan output dalam format JSON murni
    return ContentService.createTextOutput(JSON.stringify(result))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify(response(false, error.toString())))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

function getUserInfo() {
  // Pastikan scope 'https://www.googleapis.com/auth/userinfo.email' ada di appsscript.json
  var email = Session.getActiveUser().getEmail();
  return email; 
}

// --- AUTH BARU (MANUAL LOGIN) ---
function loginUser(payload) {
  try {
    const emailInput = String(payload.email).toLowerCase().trim();
    const passInput = String(payload.password).trim();

    if (!emailInput || !passInput) return response(false, "Email dan Password wajib diisi.");

    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    const shValidasi = ss.getSheetByName("validasi");
    if (!shValidasi) return response(false, "Sheet validasi tidak ditemukan.");
    
    const dataVal = shValidasi.getDataRange().getValues();
    let user = null;

    // Asumsi Struktur Sheet Validasi:
    // Kolom A: Email | Kolom B: Nama | Kolom C: Shift | Kolom D: Konter | Kolom E: Status | Kolom F: Password
    for (let i = 1; i < dataVal.length; i++) {
      const emailSheet = String(dataVal[i][0]).toLowerCase().trim();
      const passSheet = String(dataVal[i][5]); // Kolom F (index 5) untuk Password
      const statusSheet = String(dataVal[i][4]).toLowerCase().trim();
      // LOG UNTUK DEBUG (Lihat di Logger Apps Script)
      Logger.log("Mengecek Baris " + (i+1) + ": " + emailSheet + " | Pass: " + passSheet);
      
      if (emailSheet === emailInput && passSheet === passInput) {
        if (statusSheet !== 'aktif') return response(false, "Akun Anda dinonaktifkan.");
        
        user = { 
          nama: dataVal[i][1], 
          shift: dataVal[i][2], 
          konter: dataVal[i][3], 
          email: emailInput 
        }; 
        break;
      }
    }

    if (!user) return response(false, "Email atau Password salah.");

    // --- Ambil Koordinat Konter (Tetap sama) ---
    let target = { lat: null, long: null, radius: 50 };
    const sheetLoc = ss.getSheetByName("konter_list");
    if (sheetLoc) {
      const dataLoc = sheetLoc.getDataRange().getValues();
      for (let j = 1; j < dataLoc.length; j++) {
        if (String(dataLoc[j][0]).toLowerCase() === String(user.konter).toLowerCase()) {
          target.lat = String(dataLoc[j][7]).replace(',', '.').trim();
          target.long = String(dataLoc[j][8]).replace(',', '.').trim();
          const rad = parseInt(dataLoc[j][9]);
          if (!isNaN(rad) && rad > 0) target.radius = rad;
          break;
        }
      }
    }

    // --- Cek Status Absen Hari Ini (Tetap sama) ---
    const sheetAbsen = ss.getSheetByName("data_absensi");
    let sudahMasuk = false;
    let jamMasuk = "-";
    if (sheetAbsen) {
      const dataAbsen = sheetAbsen.getDataRange().getValues();
      const today = new Date().toDateString();
      for (let k = dataAbsen.length - 1; k >= 1; k--) {
        const rowDateObj = new Date(dataAbsen[k][0]);
        if (String(dataAbsen[k][1]) === user.nama && rowDateObj.toDateString() === today && String(dataAbsen[k][2]) === 'Masuk') {
          sudahMasuk = true;
          jamMasuk = Utilities.formatDate(rowDateObj, Session.getScriptTimeZone(), "HH:mm");
          break;
        }
      }
    }

    return response(true, "Login Sukses", { user, target, status: { sudahMasuk, jamMasuk } });

  } catch (e) { 
    return response(false, "Error Login: " + e.toString()); 
  }
}

/**
 * FITUR: GANTI KATA SANDI
 */
function gantiKataSandi(payload) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    const sheet = ss.getSheetByName("validasi");
    const data = sheet.getDataRange().getValues();
    const emailUser = payload.email.toLowerCase().trim();
    
    let rowIndex = -1;

    // Cari baris berdasarkan Email
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === emailUser) {
        // Cek apakah sandi lama cocok (Sandi ada di Kolom F / Index 5)
        if (String(data[i][5]) !== String(payload.sandiLama)) {
          return { success: false, msg: "Kata sandi lama salah!" };
        }
        rowIndex = i + 1; // +1 karena index array vs baris sheet
        break;
      }
    }

    if (rowIndex === -1) return { success: false, msg: "User tidak ditemukan." };

    // Update sandi baru di Kolom F (kolom ke-6)
    sheet.getRange(rowIndex, 6).setValue(payload.sandiBaru);
    
    return { success: true, msg: "Kata sandi berhasil diperbarui!" };

  } catch (e) {
    return { success: false, msg: "Error: " + e.toString() };
  }
}

// --- ABSENSI ---
function simpanAbsensi(payload) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    let sheet = ss.getSheetByName("data_absensi");

    // Buat sheet jika belum ada
    if (!sheet) {
      sheet = ss.insertSheet("data_absensi");
      sheet.appendRow(["Waktu", "Nama", "Status", "Lokasi", "Link Foto", "Keterangan", "Lat", "Long"]);
    }

    let fotoUrl = "-";

    // Upload foto (tanpa setSharing)
    if (payload.fotoBase64 && CONFIG.FOTO_FOLDER_ID.length > 5) {
      try {
        const folder = DriveApp.getFolderById(CONFIG.FOTO_FOLDER_ID);

        const blob = Utilities.newBlob(
          Utilities.base64Decode(payload.fotoBase64.split(',')[1]),
          'image/png',
          `Absen_${payload.nama}_${Date.now()}.png`
        );

        const file = folder.createFile(blob); // ✅ aman
        fotoUrl = file.getUrl();              // ✅ aman

      } catch (err) {
        Logger.log("Upload foto gagal: " + err);
        fotoUrl = "Upload gagal";
      }
    }

    // Format waktu
    const timestamp = "'" + Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "dd/MM/yyyy HH:mm:ss"
    );

    const namaToko = payload.toko || "-";

    // Simpan ke sheet
    sheet.appendRow([
      timestamp,
      payload.nama,
      payload.jenis,
      namaToko,
      fotoUrl,
      payload.ket,
      "'" + payload.lat,
      "'" + payload.long
    ]);

    return response(true, "Absensi Berhasil!");

  } catch (e) {
    return response(false, "Gagal Absen: " + e.toString());
  }
}

// --- DATA STOK ---
function getStokMobile(toko) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheetName = resolveSheetName(toko);
    const sheet = ss.getSheetByName(sheetName);
    if(!sheet) return response(false, `Data toko '${sheetName}' tidak ditemukan.`);

    // Kita ambil datanya, tapi kita harus ingat range-nya dimulai dari baris berapa
    const START_ROW_RAW = 3; // Karena range B3:I307
    const rawRange = sheet.getRange("B3:I307");
    const rawValues = rawRange.getDisplayValues(); 
    
    const pengData = sheet.getRange("N15:R28").getDisplayValues();
    const uangData = sheet.getRange("K48:L57").getDisplayValues();
    const saldoData = sheet.getRange("N65:S65").getDisplayValues()[0];

    let results = [];

    // FIX: Tambahkan parameter 'rowIdx' agar bisa menghitung baris asli
    const parseStandard = (r, cat, brand, rowIdx) => ({ 
      kategori: cat, 
      brand: brand || r[0], 
      nama: r[1], 
      awal: r[2], 
      topup: r[3], 
      stok: r[4], 
      harga: r[6]||'0', 
      tipe: 'barang',
      row: START_ROW_RAW + rowIdx // <--- INI FIX-NYA: Hitung baris asli (3 + index)
    });

    let curBrand = 'Perdana';
    
    // 1. Proses Perdana (Baris 3 - 45 di sheet)
    rawValues.slice(0, 43).forEach((r, i) => { 
      if(r[0] && r[0]!=='-') curBrand = r[0]; 
      if(r[1] && r[1]!=='#N/A') results.push(parseStandard(r, 'Perdana', curBrand, i)); 
    });

    // 2. Proses Voucher (Baris 49 - 130 di sheet)
    // Offset i adalah 46 karena slice dimulai dari index 46
    rawValues.slice(46, 128).forEach((r, i) => { 
      let realIdx = i + 46;
      if(r[0] && r[0]!=='-') curBrand = r[0]; 
      if(r[1] && r[1]!=='#N/A') results.push(parseStandard(r, 'Voucher', curBrand, realIdx)); 
    });

    // 3. Proses Aksesoris (Baris 136 - 307 di sheet)
    rawValues.slice(133, 305).forEach((r, i) => { 
      let realIdx = i + 133;
      if(r[0] && r[0] !== "#N/A" && r[0] !== "-") {
          results.push({ 
            kategori: 'Aksesoris', 
            brand: 'Aksesoris', 
            nama: r[0], 
            awal: r[2], 
            topup: r[3], 
            stok: r[4], 
            harga: r[6]||'0', 
            tipe: 'barang',
            row: START_ROW_RAW + realIdx // <--- FIX: Row ID untuk Aksesoris
          });
      }
    });

    // 4. Pengeluaran (Sudah benar sebelumnya, tetap dipertahankan)
    pengData.forEach((r, i) => { 
      if(r[0] || r[4]) results.push({ kategori:'Pengeluaran', row: 15+i, nama: r[4]||'Biaya', harga: r[0]||'0', tipe:'uang' }); 
    });

    // 5. Uang Cash (Sudah benar)
    for(let i=0; i<10; i++) { 
      const r = uangData[i] || ["",""]; 
      results.push({ kategori:'Uang', row: 48+i, nama: r[1], harga: r[0]||'0', tipe:'info', urut: i }); 
    }

    // 6. Saldo Elektrik (Ditambahkan row: 65)
    if(saldoData) { 
      results.push({ 
        kategori:'Elektrik', 
        row: 65, // <--- FIX: Berikan row ID tetap untuk Saldo
        nama:'Saldo Listrik', 
        awal: saldoData[0]||'0', 
        topup: saldoData[3]||'0', 
        stok: saldoData[5]||'0', 
        tipe:'saldo' 
      }); 
    }

    return response(true, "Data Loaded", results);
  } catch (e) { 
    return response(false, "Gagal Load: " + e.toString()); 
  }
}

function batchUpdateStokMobile(payload) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheetName = resolveSheetName(payload.toko);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, msg: "Sheet tidak ditemukan" };

    const colBValues = sheet.getRange("B1:B350").getValues();
    let updated = 0;
    let logData = [];
    const timeFormatted = "'" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

    payload.items.forEach(item => {
      const rowNum = parseInt(item.row);
      const tipe = String(item.tipe || "barang").toLowerCase();
      
      // --- PENENTUAN KOLOM TARGET ---
      let targetCol = 6; // Default Kolom F (Barang/Voucher)
      
      if (tipe === 'info') targetCol = 11;      // Kolom K (Uang Cash)
      else if (tipe === 'saldo') targetCol = 19; // Kolom S (Elektrik)
      else if (tipe === 'uang') targetCol = 14;  // Kolom N (Pengeluaran)

      // EKSEKUSI UPDATE: Hanya sel spesifik yang ditembak
      sheet.getRange(rowNum, targetCol).setValue(item.stokBaru);

      // --- LOG LOGIC ---
      let displayNamaLog = item.nama;
      if (targetCol === 6) { // Jika barang fisik, cari brand di kolom B
        for (let r = rowNum - 1; r >= 0; r--) {
          if (colBValues[r][0] && colBValues[r][0] !== "" && colBValues[r][0] !== "-") {
            displayNamaLog = colBValues[r][0] + ":" + item.nama;
            break;
          }
        }
      }

      logData.push([timeFormatted, payload.user, sheetName, item.kategori || "-", displayNamaLog, `Update:${item.stokBaru}`, "Sukses", false]);
      updated++;
    });

    // SIMPAN KE LOG
    if (logData.length > 0) {
      const ssLog = SpreadsheetApp.openById(CONFIG.DB_ID);
      let shLog = ssLog.getSheetByName("log") || ssLog.insertSheet("log");
      shLog.getRange(shLog.getLastRow() + 1, 1, logData.length, 8).setValues(logData);
    }

    return { success: true, msg: updated + " Data Berhasil Diupdate!" };
  } catch (e) {
    return { success: false, msg: "Gagal: " + e.toString() };
  }
}

function simpanLaporanSalah(data) {
    try {
        const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
        let sheet = ss.getSheetByName("log");
        if(!sheet) { sheet = ss.insertSheet("log"); sheet.appendRow(["timestamp", "email", "konter", "kategori", "produk", "komentarbaru", "status", "koreksi"]); }
        const timestamp = "'" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
        
        // Gabungkan provider (brand) dan nama produk
        const displayNama = (data.brand && data.brand !== '-' && data.brand.toLowerCase() !== 'umum' && data.brand.toLowerCase() !== 'aksesoris') 
          ? (String(data.brand).toLowerCase().trim() + "-" + data.nama) 
          : data.nama;

        sheet.appendRow([timestamp, data.user, data.toko, data.kategori, displayNama, `Lapor ${data.tipeMasalah}: ${data.nilaiBaru} (Sys:${data.nilaiLama})`, "Salah", false]);
        try { sheet.getRange(sheet.getLastRow(), 8).insertCheckboxes(); } catch(e){}
        
        // --- 1. KIRIM NOTIFIKASI EMAIL (GRATIS) ---
        if (CONFIG.NOTIF_EMAIL) {
          try {
            const subject = `[Laporan Selisih] ${data.toko} - ${displayNama}`;
            const body = `Halo Admin,\n\n` +
                         `Ada laporan selisih stok baru:\n\n` +
                         `• Konter: ${data.toko}\n` +
                         `• Karyawan: ${data.user}\n` +
                         `• Kategori: ${data.kategori}\n` +
                         `• Produk: ${displayNama}\n` +
                         `• Tipe Laporan: Selisih ${data.tipeMasalah}\n` +
                         `• Nilai Sistem: ${data.nilaiLama}\n` +
                         `• Nilai Riil Fisik: ${data.nilaiBaru}\n` +
                         `• Waktu Kirim: ${timestamp}\n\n` +
                         `Silakan cek spreadsheet log Anda untuk verifikasi.`;
            MailApp.sendEmail(CONFIG.NOTIF_EMAIL, subject, body);
          } catch(err) {
            Logger.log("Gagal mengirim email: " + err.toString());
          }
        }

        // --- 2. KIRIM NOTIFIKASI TELEGRAM (ALTERNATIF GRATIS INSTAN) ---
        const teleMessage = `⚠️ <b>LAPORAN SELISIH STOK</b> ⚠️\n\n` +
                            `• <b>Konter</b>: ${data.toko}\n` +
                            `• <b>Karyawan</b>: ${data.user}\n` +
                            `• <b>Kategori</b>: ${data.kategori}\n` +
                            `• <b>Produk</b>: ${displayNama}\n` +
                            `• <b>Tipe</b>: Selisih ${data.tipeMasalah}\n` +
                            `• <b>Sistem</b>: ${data.nilaiLama}\n` +
                            `• <b>Fisik Real</b>: ${data.nilaiBaru}\n` +
                            `• <b>Waktu</b>: ${timestamp}`;
        sendTelegramNotif(teleMessage);

        return response(true, "Laporan Terkirim");
    } catch(e) { return response(false, e.toString()); }
}

// Helper untuk mengirim notifikasi Telegram Bot
function sendTelegramNotif(message) {
  if (!CONFIG.TELEGRAM_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
  try {
    const url = "https://api.telegram.org/bot" + CONFIG.TELEGRAM_TOKEN + "/sendMessage";
    const payload = {
      chat_id: CONFIG.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    };
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(url, options);
  } catch(e) {
    Logger.log("Gagal kirim notif Telegram: " + e.toString());
  }
}

// --- PENGELUARAN (TAMBAH, EDIT, HAPUS) ---
function tambahPengeluaranMobile(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheet = ss.getSheetByName(resolveSheetName(data.toko));
    const vals = sheet.getRange("N15:N28").getValues();
    let row = -1;
    for(let i=0; i<vals.length; i++) { if(vals[i][0] === "" || vals[i][0] === 0) { row = 15+i; break; } }
    if(row === -1) return response(false, "Slot Pengeluaran Penuh");
    sheet.getRange(row, 14).setValue(data.nominal); sheet.getRange(row, 18).setValue(data.ket);
    return response(true, "Pengeluaran Ditambahkan");
  } catch (e) { return response(false, e.toString()); }
}

function hapusPengeluaranMobile(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheet = ss.getSheetByName(resolveSheetName(data.toko));
    // Hapus Isi Kolom N (14) dan R (18) pada baris tersebut
    sheet.getRange(data.row, 14).clearContent();
    sheet.getRange(data.row, 18).clearContent();
    return response(true, "Pengeluaran Dihapus");
  } catch(e) { return response(false, e.toString()); }
}

function editPengeluaranMobile(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheet = ss.getSheetByName(resolveSheetName(data.toko));
    sheet.getRange(data.row, 14).setValue(data.nominal);
    sheet.getRange(data.row, 18).setValue(data.ket);
    return response(true, "Pengeluaran Diupdate");
  } catch(e) { return response(false, e.toString()); }
}

function getDashboardSummary(toko) {
  try {
    const ssStok = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheetStok = ssStok.getSheetByName(resolveSheetName(toko));
    let pen="0", peng="0", sel="0";
    if(sheetStok) {
       pen = sheetStok.getRange("N38").getDisplayValue() || "0";
       peng = sheetStok.getRange("N42").getDisplayValue() || "0";
       sel = sheetStok.getRange("N44").getDisplayValue() || "0";
    }
    const ssDb = SpreadsheetApp.openById(CONFIG.DB_ID);
    const sheetInfo = ssDb.getSheetByName("info_pusat");
    let runningText = "Selamat Bekerja, Semangat!";
    if(sheetInfo) {
       const dataInfo = sheetInfo.getDataRange().getValues();
       let messages = [];
       for(let i=1; i<dataInfo.length; i++) {
          if(dataInfo[i][2] === true) { messages.push(dataInfo[i][1]); }
       }
       if(messages.length > 0) { runningText = messages.join("   ◉   "); }
    }
    return response(true, "OK", { penjualan: pen, pengeluaran: peng, selisih: sel, info: runningText });
  } catch(e) { return response(false, e.toString()); }
}

function resolveSheetName(name) {
  const n = String(name).toLowerCase().trim();
  if(n === 'm3') return 'toko'; if(n === 'm3 sore') return 'toko sore'; if(n.includes('jaya')) return 'jayacell'; return name;
}
function response(success, msg, data = null) { return { success: success, msg: msg, data: data }; }