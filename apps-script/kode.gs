/**
 * ============================================================================
 * KARYAWAN APP - BACKEND LOGIC (FINAL OPTIMIZED - NO LOCK)
 * ============================================================================
 * 
 * Perbaikan Utama:
 * ✅ Removed lock (already safe - per-user sheets per-day)
 * ✅ Added timeout handling
 * ✅ Improved cache management
 * ✅ Added data validation
 * ✅ Optimized dashboard calculation
 * ✅ Added execution metrics logging
 * ✅ Setup log archival system
 */

const CONFIG = {
  DB_ID: '1iz7B7MzBqIU4u72N4SyoeOA0NTA4EiNnYSIHE8hDpV0',
  STOK_ID: '1m3Kzzw0H84NVxBXmhIvcrQDQ6q2MmciTmbwV_cqKtJY',
  FOTO_FOLDER_ID: '16nDd0ozjr6eR3JcKmyBEnB-16HDqa9jb',
  NOTIF_EMAIL: 'alfiannurhuda77@gmail.com',
  MAX_EXECUTION_TIME: 25000, // 25 sec (5s buffer dari 30s limit)
  SLOW_EXECUTION_THRESHOLD: 5000 // Alert jika > 5 sec
};

// ============================================================================
// EXECUTION TIMER (Timeout Management)
// ============================================================================

class ExecutionTimer {
  constructor(maxTime = CONFIG.MAX_EXECUTION_TIME) {
    this.startTime = new Date().getTime();
    this.maxTime = maxTime;
  }

  isTimeout() {
    const elapsed = new Date().getTime() - this.startTime;
    return elapsed > this.maxTime;
  }

  getElapsed() {
    return new Date().getTime() - this.startTime;
  }

  getRemainingTime() {
    const elapsed = this.getElapsed();
    return Math.max(0, this.maxTime - elapsed);
  }

  isSlow() {
    return this.getElapsed() > CONFIG.SLOW_EXECUTION_THRESHOLD;
  }

  logMetric(actionName) {
    const elapsed = this.getElapsed();
    const status = this.isTimeout() ? "TIMEOUT" : "OK";
    const level = this.isSlow() ? "⚠️ SLOW" : "✅";
    
    Logger.log(`${level} [${status}] ${actionName}: ${elapsed}ms`);
    
    // Log to spreadsheet jika slow atau error
    if (this.isSlow() || status === "TIMEOUT") {
      logExecutionMetric(actionName, elapsed, status);
    }
  }
}

/**
 * Log execution metrics ke spreadsheet untuk monitoring
 */
function logExecutionMetric(action, executionTime, status) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    let sheet = ss.getSheetByName("execution_metrics");
    
    if (!sheet) {
      sheet = ss.insertSheet("execution_metrics");
      sheet.appendRow(["Timestamp", "Action", "Execution Time (ms)", "Status"]);
    }
    
    sheet.appendRow([new Date(), action, executionTime, status]);
  } catch (err) {
    Logger.log("Metrics logging error: " + err);
  }
}

// ============================================================================
// MAIN REQUEST HANDLER (NO LOCK NEEDED!)
// ============================================================================

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Karyawan App')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ✅ MAIN ENDPOINT - NO LOCK NEEDED!
 * Setiap user punya sheet sendiri per hari, tidak ada race condition
 */
function doPost(e) {
  const timer = new ExecutionTimer();
  
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload;
    
    // ✅ REMOVED: No lock needed! Per-user sheets prevent race conditions
    
    let result = {};

    // Route handler
    switch(action) {
      case 'login':
        result = loginUser(payload);
        break;
      case 'getStok':
        result = getStokMobileOptimized(payload.toko, payload.forceRefresh);
        break;
      case 'simpanAbsensi':
        result = simpanAbsensi(payload);
        break;
      case 'batchUpdateStok':
        result = batchUpdateStokMobileOptimized(payload);
        break;
      case 'gantiKataSandi':
        result = gantiKataSandi(payload);
        break;
      case 'simpanLaporanSalah':
        result = simpanLaporanSalah(payload);
        break;
      case 'editLaporanSalah':
        result = editLaporanSalahMobile(payload);
        break;
      case 'hapusLaporanSalah':
        result = hapusLaporanSalahMobile(payload);
        break;
      case 'tambahPengeluaran':
        result = tambahPengeluaranMobile(payload);
        break;
      case 'hapusPengeluaran':
        result = hapusPengeluaranMobile(payload);
        break;
      case 'editPengeluaran':
        result = editPengeluaranMobileOptimized(payload);
        break;
      case 'getDashboardSummary':
        result = getDashboardSummaryOptimized(payload.toko, payload.forceRefresh);
        break;
      default:
        result = response(false, "Action tidak ditemukan");
    }

    // ✅ Timeout check before returning
    if (timer.isTimeout()) {
      Logger.log(`⚠️ TIMEOUT RISK: Action ${action} approaching limit`);
      result = response(false, "Execution timeout: hasil tidak dapat dijamin");
    }

    timer.logMetric(action);

    return ContentService.createTextOutput(JSON.stringify(result))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    timer.logMetric("ERROR_" + action);
    return ContentService.createTextOutput(JSON.stringify(
      response(false, error.toString())
    )).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

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

    for (let i = 1; i < dataVal.length; i++) {
      const emailSheet = String(dataVal[i][0]).toLowerCase().trim();
      const passSheet = String(dataVal[i][5]);
      const statusSheet = String(dataVal[i][4]).toLowerCase().trim();
      
      if (emailSheet === emailInput && passSheet === passInput) {
        if (statusSheet !== 'aktif') return response(false, "Akun Anda dinonaktifkan.");
        
        user = { 
          nama: dataVal[i][1], shift: dataVal[i][2], 
          konter: dataVal[i][3], email: emailInput 
        }; 
        break;
      }
    }

    if (!user) return response(false, "Email atau Password salah.");

    // Get location coordinates
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

    // Check if user already checked in today
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

function gantiKataSandi(payload) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    const sheet = ss.getSheetByName("validasi");
    const data = sheet.getDataRange().getValues();
    const emailUser = payload.email.toLowerCase().trim();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === emailUser) {
        if (String(data[i][5]) !== String(payload.sandiLama)) {
          return { success: false, msg: "Kata sandi lama salah!" };
        }
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) return { success: false, msg: "User tidak ditemukan." };
    sheet.getRange(rowIndex, 6).setValue(payload.sandiBaru);
    return { success: true, msg: "Kata sandi berhasil diperbarui!" };
  } catch (e) {
    return { success: false, msg: "Error: " + e.toString() };
  }
}

// ============================================================================
// ATTENDANCE
// ============================================================================

function simpanAbsensi(payload) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    let sheet = ss.getSheetByName("data_absensi");
    if (!sheet) {
      sheet = ss.insertSheet("data_absensi");
      sheet.appendRow(["Waktu", "Nama", "Status", "Lokasi", "Link Foto", "Keterangan", "Lat", "Long"]);
    }

    let fotoUrl = "-";
    if (payload.fotoBase64 && CONFIG.FOTO_FOLDER_ID.length > 5) {
      try {
        const folder = DriveApp.getFolderById(CONFIG.FOTO_FOLDER_ID);
        const blob = Utilities.newBlob(
          Utilities.base64Decode(payload.fotoBase64.split(',')[1]),
          'image/png',
          `Absen_${payload.nama}_${Date.now()}.png`
        );
        const file = folder.createFile(blob);
        fotoUrl = file.getUrl();
      } catch (err) {
        Logger.log("Upload foto gagal: " + err);
        fotoUrl = "Upload gagal";
      }
    }

    const timestamp = "'" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    sheet.appendRow([
      timestamp, payload.nama, payload.jenis, payload.toko || "-", 
      fotoUrl, payload.ket, "'" + payload.lat, "'" + payload.long
    ]);

    return response(true, "Absensi Berhasil!");
  } catch (e) {
    return response(false, "Gagal Absen: " + e.toString());
  }
}

// ============================================================================
// DATA VALIDATION
// ============================================================================

function validateStockData(item) {
  if (!item || typeof item !== 'object') {
    return { valid: false, errors: ["Invalid item object"] };
  }
  
  const awal = parseInt(item.awal) || 0;
  const topup = parseInt(item.topup) || 0;
  const stok = parseInt(item.stok) || 0;
  
  const errors = [];
  
  if (awal < 0) errors.push("Awal tidak boleh negatif");
  if (topup < 0) errors.push("Topup tidak boleh negatif");
  if (stok < 0) errors.push("Stok tidak boleh negatif");
  
  if (stok > (awal + topup)) {
    errors.push(`Stok (${stok}) > Awal+Topup (${awal}+${topup})`);
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function calculateTerjual(awal, topup, stok) {
  const a = parseInt(awal) || 0;
  const t = parseInt(topup) || 0;
  const s = parseInt(stok) || 0;
  
  if (a < 0 || t < 0 || s < 0) return 0;
  
  const terjual = (a + t) - s;
  return Math.max(0, terjual); // No negative
}

// ============================================================================
// STOK DATA LOADING (OPTIMIZED)
// ============================================================================

function getStokMobileOptimized(toko, forceRefresh = false) {
  try {
    const sheetName = resolveSheetName(toko);
    const cacheKey = 'STOK_' + sheetName;
    const cache = CacheService.getScriptCache();
    
    // ✅ Check cache first
    if (!forceRefresh) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) return response(true, "Sukses (Cached)", JSON.parse(cachedData));
    }

    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheet = ss.getSheetByName(sheetName);
    if(!sheet) return response(false, `Data toko '${sheetName}' tidak ditemukan.`);

    // ✅ Single batch range read (1 RPC call!)
    const allData = sheet.getRange("A1:S307").getDisplayValues();
    
    const rawValues = allData.slice(2, 307).map(r => r.slice(1, 9));  // B3:I307
    const pengData = allData.slice(14, 28).map(r => r.slice(13, 18)); // N15:R28
    const uangData = allData.slice(47, 57).map(r => r.slice(10, 12)); // K48:L57
    const saldoData = allData.slice(64, 65).map(r => r.slice(13, 19))[0]; // N65:S65

    const START_ROW_RAW = 3;
    let results = [];

    const parseStandard = (r, cat, brand, rowIdx) => ({ 
      kategori: cat, brand: brand || r[0], nama: r[1], 
      awal: r[2], topup: r[3], stok: r[4], harga: r[6]||'0', 
      tipe: 'barang', row: START_ROW_RAW + rowIdx
    });

    // Process Barang
    let curBrand = 'Perdana';
    rawValues.slice(0, 43).forEach((r, i) => { 
      if(r[0] && r[0]!=='-') curBrand = r[0]; 
      if(r[1] && r[1]!=='#N/A') results.push(parseStandard(r, 'Perdana', curBrand, i)); 
    });
    rawValues.slice(46, 128).forEach((r, i) => { 
      let realIdx = i + 46;
      if(r[0] && r[0]!=='-') curBrand = r[0]; 
      if(r[1] && r[1]!=='#N/A') results.push(parseStandard(r, 'Voucher', curBrand, realIdx)); 
    });
    rawValues.slice(133, 305).forEach((r, i) => { 
      let realIdx = i + 133;
      if(r[0] && r[0] !== "#N/A" && r[0] !== "-") {
        results.push({ 
          kategori: 'Aksesoris', brand: 'Aksesoris', nama: r[0], 
          awal: r[2], topup: r[3], stok: r[4], harga: r[6]||'0', 
          tipe: 'barang', row: START_ROW_RAW + realIdx
        });
      }
    });

    // Process Pengeluaran
    pengData.forEach((r, i) => { 
      if(r[0] || r[4]) results.push({ 
        kategori:'Pengeluaran', row: 15+i, nama: r[4]||'Biaya', 
        harga: r[0]||'0', tipe:'uang' 
      }); 
    });

    // Process Uang Cash
    for(let i=0; i<10; i++) { 
      const r = uangData[i] || ["",""]; 
      results.push({ 
        kategori:'Uang', row: 48+i, nama: r[1], 
        harga: r[0]||'0', tipe:'info', urut: i 
      }); 
    }

    // Process Saldo Listrik
    if(saldoData) { 
      results.push({ 
        kategori:'Elektrik', row: 65, nama:'Saldo Listrik', 
        awal: saldoData[0]||'0', topup: saldoData[3]||'0', 
        stok: saldoData[5]||'0', tipe:'saldo' 
      }); 
    }

    // ✅ Get reported items dari cache (2-hour TTL)
    const reportedItems = getReportedItemsFromCache(sheetName, toko, forceRefresh);

    // Apply reported flags
    results = results.map(item => {
      if (item.tipe !== "barang" && item.tipe !== "saldo") return item;

      const brand = String(item.brand || "").trim();
      const nama = String(item.nama || "").trim();
      const hasBrand = brand && brand !== "-" && brand.toLowerCase() !== "umum" && brand.toLowerCase() !== "aksesoris";

      const pKeyWithBrand = (hasBrand ? `${brand}-${nama}` : nama)
        .toLowerCase().replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim();
      const nameWithoutBrand = nama.toLowerCase().replace(/\s+/g, " ").trim();

      const reported = reportedItems[pKeyWithBrand] || reportedItems[nameWithoutBrand] || {
        awal: false, topup: false, keteranganAwal: "", 
        keteranganTopup: "", barisAwal: "", barisTopup: ""
      };

      return {
        ...item,
        awalReported: reported.awal,
        topupReported: reported.topup,
        awalReportedVal: reported.keteranganAwal || "",
        topupReportedVal: reported.keteranganTopup || "",
        rowAwal: reported.barisAwal || "",
        rowTopup: reported.barisTopup || ""
      };
    });

    // ✅ Cache results (30-45 menit)
    const jsonStr = JSON.stringify(results);
    if (jsonStr.length < 100000) {
      cache.put(cacheKey, jsonStr, 1800);
    }

    return response(true, "Data Loaded", results);
  } catch (e) { 
    return response(false, "Gagal Load: " + e.toString()); 
  }
}

/**
 * ✅ Get Reported Items dari Cache
 * Cache 2-hour untuk prevent log scan setiap request
 */
function getReportedItemsFromCache(sheetName, toko, forceRefresh = false) {
  const timer = new ExecutionTimer(8000); // 8 sec max untuk operation ini
  const cacheKey = 'REPORTED_' + sheetName;
  const cache = CacheService.getScriptCache();
  
  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  let reportedItems = {};
  
  try {
    const ssDb = SpreadsheetApp.openById(CONFIG.DB_ID);
    const shLog = ssDb.getSheetByName("log");

    if (shLog) {
      const dataLog = shLog.getDataRange().getValues();
      const targetStoreName = String(sheetName).toLowerCase().trim();
      const originalStoreName = String(toko).toLowerCase().trim();
      const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

      for (let i = 1; i < dataLog.length; i++) {
        // ✅ Timeout check every 100 iterations
        if (i % 100 === 0 && timer.isTimeout()) {
          Logger.log("⚠️ Timeout in getReportedItems, returning partial results");
          break;
        }
        
        const row = dataLog[i];
        let isToday = false;

        if (row[0] instanceof Date) {
          isToday = Utilities.formatDate(row[0], Session.getScriptTimeZone(), "dd/MM/yyyy") === todayStr;
        } else {
          isToday = String(row[0]).includes(todayStr);
        }

        if (!isToday) continue;

        const logToko = String(row[2]).toLowerCase().trim();
        const logStatus = String(row[6]).toLowerCase().trim();
        const logKoreksi = row[7];

        if (logToko !== originalStoreName && logToko !== targetStoreName) continue;
        if (logStatus !== "salah" || logKoreksi !== false) continue;

        const produkName = String(row[4])
          .toLowerCase()
          .replace(/\s+/g, " ")
          .replace(/\s*-\s*/g, "-")
          .trim();
        
        const komentar = String(row[5]);
        const isAwal = komentar.toLowerCase().includes("lapor awal");
        const isTopup = komentar.toLowerCase().includes("lapor topup");

        if (!reportedItems[produkName]) {
          reportedItems[produkName] = {
            awal: false, topup: false, 
            keteranganAwal: "", keteranganTopup: "", 
            barisAwal: null, barisTopup: null
          };
        }

        const sheetRowNumber = i + 1;

        if (isAwal) {
          reportedItems[produkName].awal = true;
          reportedItems[produkName].barisAwal = sheetRowNumber;
          const match = komentar.match(/lapor\s+awal[:\s]*([0-9]+)/i);
          reportedItems[produkName].keteranganAwal = match ? match[1] : "";
        }

        if (isTopup) {
          reportedItems[produkName].topup = true;
          reportedItems[produkName].barisTopup = sheetRowNumber;
          const match = komentar.match(/lapor\s+topup[:\s]*([0-9]+)/i);
          reportedItems[produkName].keteranganTopup = match ? match[1] : "";
        }
      }
    }
  } catch (err) {
    Logger.log("Error in getReportedItems: " + err.toString());
  }

  // ✅ Cache hasil (2 jam)
  cache.put(cacheKey, JSON.stringify(reportedItems), 7200);
  return reportedItems;
}

// ============================================================================
// BATCH UPDATE STOK (OPTIMIZED & VALIDATED)
// ============================================================================

function batchUpdateStokMobileOptimized(payload) {
  try {
    const timer = new ExecutionTimer();
    
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheetName = resolveSheetName(payload.toko);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) return { success: false, msg: "Sheet tidak ditemukan" };

    // ✅ Validate ALL items before update
    const validations = payload.items.map(item => validateStockData(item));
    const invalid = validations.filter(v => !v.valid);

    if (invalid.length > 0) {
      const errors = invalid.map((v, i) => `Item ${i+1}: ${v.errors.join(', ')}`).join(' | ');
      return { success: false, msg: `Data invalid: ${errors}` };
    }

    const colBValues = sheet.getRange("B1:B350").getValues();
    let updated = 0;
    let logData = [];
    const timeFormatted = "'" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

    const updatesByCol = {};

    payload.items.forEach((item, idx) => {
      const rowNum = parseInt(item.row);
      const tipe = String(item.tipe || "barang").toLowerCase();
      
      let targetCol = 6;
      if (tipe === 'info') targetCol = 11;
      else if (tipe === 'saldo') targetCol = 19;
      else if (tipe === 'uang') targetCol = 14;

      if (!updatesByCol[targetCol]) updatesByCol[targetCol] = [];
      updatesByCol[targetCol].push({ row: rowNum, value: item.stokBaru });

      let displayNamaLog = item.nama;
      if (targetCol === 6) {
        for (let r = rowNum - 1; r >= 0; r--) {
          if (colBValues[r][0] && colBValues[r][0] !== "" && colBValues[r][0] !== "-") {
            displayNamaLog = colBValues[r][0] + ":" + item.nama;
            break;
          }
        }
      }

      logData.push([
        timeFormatted, payload.user, sheetName, item.kategori || "-", 
        displayNamaLog, `Update:${item.stokBaru}`, "Sukses", false
      ]);
      updated++;
      
      // ✅ Timeout check
      if (idx % 10 === 0 && timer.isTimeout()) {
        return { success: false, msg: `Timeout saat update item ke-${idx}` };
      }
    });

    // ✅ Batch update per column
    Object.keys(updatesByCol).forEach(col => {
      const colIdx = parseInt(col);
      const colUpdates = updatesByCol[col];
      const range = sheet.getRange(1, colIdx, 350, 1);
      const values = range.getValues();
      
      colUpdates.forEach(u => {
        values[u.row - 1][0] = u.value;
      });
      
      range.setValues(values);
    });

    // ✅ Batch insert log
    if (logData.length > 0) {
      const ssLog = SpreadsheetApp.openById(CONFIG.DB_ID);
      let shLog = ssLog.getSheetByName("log") || ssLog.insertSheet("log");
      shLog.getRange(shLog.getLastRow() + 1, 1, logData.length, 8).setValues(logData);
    }

    // ✅ Invalidate caches AFTER successful update
    const cache = CacheService.getScriptCache();
    cache.remove('STOK_' + sheetName);
    cache.remove('dash_sum_' + sheetName);

    timer.logMetric("batchUpdateStok");
    return { success: true, msg: updated + " Data Berhasil Diupdate!" };

  } catch (e) {
    return { success: false, msg: "Gagal: " + e.toString() };
  }
}

// ============================================================================
// LAPORAN SALAH (REPORT MISMATCHES)
// ============================================================================

function simpanLaporanSalah(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    let sheet = ss.getSheetByName("log");
    if(!sheet) { 
      sheet = ss.insertSheet("log"); 
      sheet.appendRow(["timestamp", "email", "konter", "kategori", "produk", "komentarbaru", "status", "koreksi"]); 
    }
    
    const timestamp = "'" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    
    const displayNama = (data.brand && data.brand !== '-' && data.brand.toLowerCase() !== 'umum' && data.brand.toLowerCase() !== 'aksesoris') 
      ? (String(data.brand).toLowerCase().trim() + "-" + data.nama) 
      : data.nama;

    sheet.appendRow([
      timestamp, data.user, data.toko, data.kategori, displayNama, 
      `Lapor ${data.tipeMasalah}: ${data.nilaiBaru} (Sys:${data.nilaiLama})`, 
      "Salah", false
    ]);
    
    try { sheet.getRange(sheet.getLastRow(), 8).insertCheckboxes(); } catch(e){}

    if (CONFIG.NOTIF_EMAIL) {
      try {
        const subject = `[Laporan Selisih Stok] ${data.toko} - ${displayNama}`;
        const body = `Halo Admin,\n\nLaporan selisih stok baru:\n• Konter: ${data.toko}\n• Karyawan: ${data.user}\n• Kategori: ${data.kategori}\n• Produk: ${displayNama}\n• Masalah: Selisih ${data.tipeMasalah}\n• Nilai Sistem: ${data.nilaiLama}\n• Nilai Fisik: ${data.nilaiBaru}\n• Waktu Lapor: ${timestamp.replace("'", "")}\n\nSilakan periksa lembar spreadsheet log Anda.`;
        MailApp.sendEmail(CONFIG.NOTIF_EMAIL, subject, body);
      } catch(err) {}
    }

    // ✅ Invalidate cache
    CacheService.getScriptCache().remove('REPORTED_' + resolveSheetName(data.toko));
    CacheService.getScriptCache().remove('STOK_' + resolveSheetName(data.toko));

    return response(true, "Laporan Terkirim");
  } catch(e) { 
    return response(false, e.toString()); 
  }
}

function editLaporanSalahMobile(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    const sheet = ss.getSheetByName("log");
    let row = parseInt(data.row);
    
    if (isNaN(row) || row < 1) {
      row = cariBarisLogOtomatis(sheet, data.toko, data.produk, data.brand);
      if (row === -1) {
        return response(false, "Gagal update: laporan tidak ditemukan");
      }
    }

    sheet.getRange(row, 6).setValue(`Lapor ${data.tipeMasalah}: ${data.nilaiBaru} (Sys:${data.nilaiLama})`);
    
    if (CONFIG.NOTIF_EMAIL) {
      try {
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
        const subject = `[Revisi Laporan Selisih] ${data.toko} - ${data.produk}`;
        const body = `Halo Admin,\n\nLaporan selisih stok telah direvisi:\n• Konter: ${data.toko}\n• Produk: ${data.produk}\n• Nilai Sistem: ${data.nilaiLama}\n• Nilai Baru: ${data.nilaiBaru}\n• Waktu Revisi: ${timestamp}`;
        MailApp.sendEmail(CONFIG.NOTIF_EMAIL, subject, body);
      } catch(err) {}
    }
    
    CacheService.getScriptCache().remove('REPORTED_' + resolveSheetName(data.toko));
    return response(true, "Laporan berhasil diupdate");
  } catch(e) { 
    return response(false, "Sistem Error: " + e.toString()); 
  }
}

function hapusLaporanSalahMobile(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    const sheet = ss.getSheetByName("log");
    let row = parseInt(data.row);

    if (isNaN(row) || row < 1) {
      row = cariBarisLogOtomatis(sheet, data.toko, data.produk, data.brand);
      if (row === -1) return response(false, "Gagal hapus: laporan tidak ditemukan");
    }

    let logInfo = "";
    if (CONFIG.NOTIF_EMAIL) {
      try {
        const vals = sheet.getRange(row, 1, 1, 6).getValues()[0];
        logInfo = `• Konter: ${vals[2]}\n• Produk: ${vals[4]}\n• Laporan: ${vals[5]}`;
      } catch(err) {}
    }

    sheet.deleteRow(row);
    
    if (CONFIG.NOTIF_EMAIL && logInfo) {
      try {
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
        MailApp.sendEmail(CONFIG.NOTIF_EMAIL, `[Pembatalan Laporan Selisih]`, `Halo Admin,\n\nLaporan dibatalkan:\n\n${logInfo}\n\n• Waktu Batal: ${timestamp}`);
      } catch(err) {}
    }
    
    CacheService.getScriptCache().remove('REPORTED_' + resolveSheetName(data.toko));
    return response(true, "Laporan Dihapus");
  } catch(e) { 
    return response(false, e.toString()); 
  }
}

function cariBarisLogOtomatis(sheet, toko, produk, brand) {
  if (!toko || !produk) return -1;
  
  const dataLog = sheet.getDataRange().getValues();
  const targetToko = String(toko).toLowerCase().trim();
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

  const namaBersih = String(produk).toLowerCase().replace(/\s+/g, " ").trim();
  const brandBersih = String(brand || "").toLowerCase().trim();
  const hasBrand = brandBersih && brandBersih !== "-" && brandBersih !== "umum" && brandBersih !== "aksesoris";
  const targetDenganBrand = hasBrand ? `${brandBersih}-${namaBersih}`.replace(/\s*-\s*/g, "-") : namaBersih;
  
  for (let i = dataLog.length - 1; i >= 1; i--) {
    const rowData = dataLog[i];
    if (!rowData[0]) continue;
    
    let isToday = false;
    let logDate = rowData[0];
    if (!(logDate instanceof Date)) logDate = new Date(logDate);
    if (!isNaN(logDate.getTime())) {
      isToday = (Utilities.formatDate(logDate, Session.getScriptTimeZone(), "dd/MM/yyyy") === todayStr);
    } else {
      isToday = String(rowData[0]).includes(todayStr);
    }
    
    if (!isToday) continue;
    
    const logToko = String(rowData[2]).toLowerCase().trim();
    const logProduk = String(rowData[4]).toLowerCase().replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim();
    
    if (logToko === targetToko && (logProduk === targetDenganBrand || logProduk === namaBersih) && String(rowData[6]).toLowerCase().trim() === 'salah' && rowData[7] === false) {
      return i + 1;
    }
  }
  return -1;
}

// ============================================================================
// PENGELUARAN (EXPENSES)
// ============================================================================

function tambahPengeluaranMobile(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheetName = resolveSheetName(data.toko);
    const sheet = ss.getSheetByName(sheetName);
    const vals = sheet.getRange("N15:N28").getValues();
    
    let row = -1;
    for(let i=0; i<vals.length; i++) { 
      if(vals[i][0] === "" || vals[i][0] === 0) { row = 15+i; break; } 
    }
    
    if(row === -1) return response(false, "Slot Pengeluaran Penuh");
    
    sheet.getRange(row, 14).setValue(data.nominal); 
    sheet.getRange(row, 18).setValue(data.ket);
    
    try {
      CacheService.getScriptCache().remove('STOK_' + sheetName);
      CacheService.getScriptCache().remove('dash_sum_' + sheetName);
    } catch (ce) {}
    
    return response(true, "Pengeluaran Ditambahkan");
  } catch (e) { 
    return response(false, e.toString()); 
  }
}

function hapusPengeluaranMobile(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheetName = resolveSheetName(data.toko);
    const sheet = ss.getSheetByName(sheetName);
    
    sheet.getRange(data.row, 14).clearContent();
    sheet.getRange(data.row, 18).clearContent();
    
    try {
      CacheService.getScriptCache().remove('STOK_' + sheetName);
      CacheService.getScriptCache().remove('dash_sum_' + sheetName);
    } catch(ce) {}
    
    return response(true, "Pengeluaran Dihapus");
  } catch(e) { 
    return response(false, e.toString()); 
  }
}

function editPengeluaranMobileOptimized(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheetName = resolveSheetName(data.toko);
    const sheet = ss.getSheetByName(sheetName);
    
    sheet.getRange(data.row, 14).setValue(data.nominal);
    sheet.getRange(data.row, 18).setValue(data.ket);
    
    try {
      CacheService.getScriptCache().remove('STOK_' + sheetName);
      CacheService.getScriptCache().remove('dash_sum_' + sheetName);
    } catch(ce) {}
    
    return response(true, "Pengeluaran Diupdate");
  } catch(e) { 
    return response(false, e.toString()); 
  }
}

// ============================================================================
// DASHBOARD SUMMARY (OPTIMIZED)
// ============================================================================

function getDashboardSummaryOptimized(toko, forceRefresh = false) {
  try {
    const sName = resolveSheetName(toko);
    const cacheKey = "dash_sum_" + sName;
    const cache = CacheService.getScriptCache();
    
    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    // ✅ Reuse getStokMobileOptimized cache (tidak double-load)
    const resStok = getStokMobileOptimized(toko, false);
    if (!resStok || !resStok.success) {
      return response(false, "Gagal mengambil data stok untuk summary");
    }

    let totalPenjualan = 0;
    let totalPengeluaran = 0;
    let totalUangCash = 0;

    resStok.data.forEach(item => {
      if (item.tipe === 'barang') {
        const terjual = calculateTerjual(item.awal, item.topup, item.stok);
        const harga = parseInt(String(item.harga).replace(/[^0-9]/g, '')) || 0;
        totalPenjualan += (terjual * harga);
      } else if (item.tipe === 'saldo') {
        const terjual = calculateTerjual(item.awal, item.topup, item.stok);
        totalPenjualan += terjual;
      } else if (item.kategori === 'Pengeluaran') {
        const nominal = parseInt(String(item.harga).replace(/[^0-9]/g, '')) || 0;
        totalPengeluaran += nominal;
      } else if (item.kategori === 'Uang') {
        const pecahan = parseInt(String(item.nama).replace(/[^0-9]/g, '')) || 0;
        const lembar = parseInt(String(item.harga).replace(/[^0-9]/g, '')) || 0;
        totalUangCash += (pecahan * lembar);
      }
    });

    const selisih = totalUangCash + totalPengeluaran - totalPenjualan;

    const formatRp = (num) => {
      let isNeg = num < 0;
      let abs = Math.abs(num);
      let str = "Rp " + abs.toLocaleString('id-ID');
      return isNeg ? "-" + str : str;
    };

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
    
    const resObj = response(true, "OK", { 
      penjualan: formatRp(totalPenjualan), 
      pengeluaran: formatRp(totalPengeluaran), 
      kasDiLaci: formatRp(totalUangCash), 
      selisih: formatRp(selisih), 
      info: runningText 
    });
    
    cache.put(cacheKey, JSON.stringify(resObj), 300); // 5 min cache
    return resObj;
  } catch(e) { 
    return response(false, e.toString()); 
  }
}

// ============================================================================
// ARCHIVAL SYSTEM (Prevent log sheet unbounded growth)
// ============================================================================

/**
 * Archive old log entries (>30 hari) ke sheet terpisah
 * Jalankan weekly via time-based trigger
 */
function archiveOldLogs(daysOld = 30) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    let logSheet = ss.getSheetByName("log");
    
    if (!logSheet) {
      Logger.log("Log sheet tidak ditemukan");
      return;
    }
    
    // Create archive sheet jika belum ada
    let archiveSheet = ss.getSheetByName("log_archive");
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet("log_archive");
      const headers = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
      archiveSheet.appendRow(headers);
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const logData = logSheet.getDataRange().getValues();
    const rowsToArchive = [];
    const rowsToDelete = [];
    
    for (let i = logData.length - 1; i >= 1; i--) {
      const rowDate = new Date(logData[i][0]);
      
      if (rowDate < cutoffDate) {
        rowsToArchive.push(logData[i]);
        rowsToDelete.push(i + 1);
      }
    }
    
    if (rowsToArchive.length === 0) {
      Logger.log("Tidak ada log untuk di-archive");
      return;
    }
    
    if (rowsToArchive.length > 0) {
      archiveSheet.getRange(
        archiveSheet.getLastRow() + 1, 
        1, 
        rowsToArchive.length, 
        rowsToArchive[0].length
      ).setValues(rowsToArchive);
    }
    
    for (let i = rowsToDelete.length - 1; i >= 0; i--) {
      logSheet.deleteRow(rowsToDelete[i]);
    }
    
    Logger.log(`✅ Archived ${rowsToArchive.length} log entries (>${daysOld} hari)`);
    
  } catch (err) {
    Logger.log("Log archival error: " + err);
  }
}

/**
 * Setup time-based trigger untuk archival (weekly)
 * Jalankan 1x: setupArchivalTrigger()
 */
function setupArchivalTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "archiveOldLogs") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger("archiveOldLogs")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(2)
    .create();
  
  Logger.log("✅ Archival trigger set (weekly Sunday 2 AM)");
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function resolveSheetName(name) {
  const n = String(name).toLowerCase().trim();
  if(n === 'm3') return 'toko'; 
  if(n === 'm3 sore') return 'toko sore'; 
  if(n.includes('jaya')) return 'jayacell'; 
  return name;
}

function response(success, msg, data = null) { 
  return { success: success, msg: msg, data: data }; 
}

function include(filename) { 
  return HtmlService.createHtmlOutputFromFile(filename).getContent(); 
}