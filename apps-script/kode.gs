/**
 * ============================================================================
 * BACKEND - HYBRID CACHING IMPLEMENTATION
 * ============================================================================
 * 
 * Perbaikan:
 * ✅ Add metadata untuk client (cache status, TTL, timestamp)
 * ✅ Smart cache invalidation
 * ✅ Return signal untuk client action
 * ✅ Cache validation
 */

const CONFIG = {
  DB_ID: '1iz7B7MzBqIU4u72N4SyoeOA0NTA4EiNnYSIHE8hDpV0',
  STOK_ID: '1m3Kzzw0H84NVxBXmhIvcrQDQ6q2MmciTmbwV_cqKtJY',
  FOTO_FOLDER_ID: '16nDd0ozjr6eR3JcKmyBEnB-16HDqa9jb',
  NOTIF_EMAIL: 'alfiannurhuda77@gmail.com',
  FONNTE_TOKEN: 'vNkPPChGgZQZXzJxE927', // Masukkan Token API Fonnte Anda di sini
  FONNTE_TARGET: '0895355347768', // Masukkan Nomor WhatsApp Tujuan di sini (Misal: '08123456789')
  MAX_EXECUTION_TIME: 25000,
  SLOW_EXECUTION_THRESHOLD: 5000,
  
  // ✅ Cache configuration
  CACHE_TTL_STOK: 1800,        // 30 menit untuk stok
  CACHE_TTL_DASHBOARD: 300,    // 5 menit untuk dashboard
  CACHE_TTL_REPORTED: 7200     // 2 jam untuk laporan
};

// ============================================================================
// EXECUTION TIMER
// ============================================================================

class ExecutionTimer {
  constructor(maxTime = CONFIG.MAX_EXECUTION_TIME) {
    this.startTime = new Date().getTime();
    this.maxTime = maxTime;
  }

  isTimeout() {
    return (new Date().getTime() - this.startTime) > this.maxTime;
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
    
    if (this.isSlow() || status === "TIMEOUT") {
      logExecutionMetric(actionName, elapsed, status);
    }
  }
}

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
// MAIN REQUEST HANDLER
// ============================================================================

function doPost(e) {
  const timer = new ExecutionTimer();
  
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload;
    
    let result = {};

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

      case 'getAnalisisMingguan':
        result = getAnalisisMingguan(payload.toko);
        break;
      case 'getInfoPusat':
        result = getInfoPusat();
        break;
      default:
        result = response(false, "Action tidak ditemukan");
    }

    if (timer.isTimeout()) {
      Logger.log(`⚠️ TIMEOUT RISK: Action ${action} approaching limit`);
      result = response(false, "Execution timeout");
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
// ✅ OPTIMIZED: getStokMobileOptimized dengan HYBRID CACHING
// ============================================================================

function getStokMobileOptimized(toko, forceRefresh = false) {
  try {
    const sheetName = resolveSheetName(toko);
    const cacheKey = 'STOK_' + sheetName;
    const cache = CacheService.getScriptCache();
    
    // ✅ Check cache first (ALWAYS)
    if (!forceRefresh) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          
          // ✅ Return with cache metadata
          return response(true, "Sukses (Cached)", parsed, {
            cached: true,
            timestamp: new Date().getTime(),
            ttl: CONFIG.CACHE_TTL_STOK * 1000,  // Convert to ms
            clientAction: null  // No action needed
          });
        } catch (parseErr) {
          Logger.log("Cache parse error, falling through to full load");
          cache.remove(cacheKey);
        }
      }
    }

    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheet = ss.getSheetByName(sheetName);
    if(!sheet) return response(false, `Data toko '${sheetName}' tidak ditemukan.`);

    // ✅ Single batch range read (1 RPC call!)
    const allData = sheet.getRange("A1:S307").getDisplayValues();
    
    const rawValues = allData.slice(2, 307).map(r => r.slice(1, 9));
    const pengData = allData.slice(14, 28).map(r => r.slice(13, 18));
    const uangData = allData.slice(47, 57).map(r => r.slice(10, 12));
    const saldoData = allData.slice(64, 65).map(r => r.slice(13, 19))[0];

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

    // ✅ Get reported items dari cache (separate cache layer)
    const reportedItems = getReportedItemsFromCache(sheetName, toko, forceRefresh);

    // Apply reported flags dengan helper function
    results = results.map(item => {
      if (item.tipe !== "barang" && item.tipe !== "saldo") return item;

      const { key: pKeyWithBrand } = normalizeProductKey(item.brand, item.nama);
      
      const nameWithoutBrand = String(item.nama || "")
        .trim().replace(/\s+/g, "-").toLowerCase().replace(/-+/g, "-").trim();

      let reported = reportedItems[pKeyWithBrand];
      if (!reported) reported = reportedItems[nameWithoutBrand];
      if (!reported) {
        reported = {
          awal: false, topup: false, 
          keteranganAwal: "", keteranganTopup: "", 
          barisAwal: "", barisTopup: ""
        };
      }

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

    // ✅ Cache results dengan TTL lebih panjang untuk client-side caching
    const jsonStr = JSON.stringify(results);
    if (jsonStr.length < 100000) {
      cache.put(cacheKey, jsonStr, CONFIG.CACHE_TTL_STOK);
    }

    // ✅ Return with metadata untuk hybrid caching
    return response(true, "Data Loaded", results, {
      cached: false,
      timestamp: new Date().getTime(),
      ttl: CONFIG.CACHE_TTL_STOK * 1000,  // Convert to ms
      clientAction: "SAVE_CACHE"  // Signal to save di localStorage
    });

  } catch (e) { 
    return response(false, "Gagal Load: " + e.toString()); 
  }
}

// ============================================================================
// ✅ HELPER: normalizeProductKey untuk consistent matching
// ============================================================================

function normalizeProductKey(brand, nama) {
  const brandNorm = String(brand || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .trim();
  
  const namaNorm = String(nama || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .trim();
  
  const hasBrand = brandNorm && 
                   brandNorm !== "-" && 
                   brandNorm !== "umum" && 
                   brandNorm !== "aksesoris";

  const key = (hasBrand ? `${brandNorm}-${namaNorm}` : namaNorm)
    .toLowerCase()
    .replace(/-+/g, "-")
    .trim();

  return { key, hasBrand };
}

// ============================================================================
// ✅ OPTIMIZED: getReportedItemsFromCache dengan timeout
// ============================================================================

function getReportedItemsFromCache(sheetName, toko, forceRefresh = false) {
  const timer = new ExecutionTimer(8000);
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
        if (i % 100 === 0 && timer.isTimeout()) {
          Logger.log("⚠️ Timeout in getReportedItems");
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

        // ✅ Normalize produk name dengan consistent method
        const rawProduk = String(row[4]);
        const produkNorm = rawProduk
          .trim()
          .replace(/\s+/g, "-")
          .toLowerCase()
          .replace(/-+/g, "-")
          .trim();
        
        const komentar = String(row[5]);
        const isAwal = komentar.toLowerCase().includes("lapor awal");
        const isTopup = komentar.toLowerCase().includes("lapor topup");

        if (!reportedItems[produkNorm]) {
          reportedItems[produkNorm] = {
            awal: false, topup: false, 
            keteranganAwal: "", keteranganTopup: "", 
            barisAwal: null, barisTopup: null
          };
        }

        const sheetRowNumber = i + 1;

        if (isAwal) {
          reportedItems[produkNorm].awal = true;
          reportedItems[produkNorm].barisAwal = sheetRowNumber;
          const match = komentar.match(/lapor\s+awal[:\s]*([0-9]+)/i);
          reportedItems[produkNorm].keteranganAwal = match ? match[1] : "";
        }

        if (isTopup) {
          reportedItems[produkNorm].topup = true;
          reportedItems[produkNorm].barisTopup = sheetRowNumber;
          const match = komentar.match(/lapor\s+topup[:\s]*([0-9]+)/i);
          reportedItems[produkNorm].keteranganTopup = match ? match[1] : "";
        }
      }
    }
  } catch (err) {
    Logger.log("Error in getReportedItems: " + err.toString());
  }

  cache.put(cacheKey, JSON.stringify(reportedItems), CONFIG.CACHE_TTL_REPORTED);
  return reportedItems;
}

// ============================================================================
// ✅ OPTIMIZED: batchUpdateStok dengan smart invalidation
// ============================================================================

function batchUpdateStokMobileOptimized(payload) {
  try {
    const timer = new ExecutionTimer();
    
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheetName = resolveSheetName(payload.toko);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) return { success: false, msg: "Sheet tidak ditemukan" };

    // Validate data
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
      
      if (idx % 10 === 0 && timer.isTimeout()) {
        return { success: false, msg: `Timeout saat update item ke-${idx}` };
      }
    });

    // Batch update per column
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

    // Batch insert log
    if (logData.length > 0) {
      const ssLog = SpreadsheetApp.openById(CONFIG.DB_ID);
      let shLog = ssLog.getSheetByName("log") || ssLog.insertSheet("log");
      shLog.getRange(shLog.getLastRow() + 1, 1, logData.length, 8).setValues(logData);
    }

    // ✅ SMART INVALIDATION - only after successful update
    const cache = CacheService.getScriptCache();
    cache.remove('STOK_' + sheetName);
    cache.remove('dash_sum_' + sheetName);
    cache.remove('REPORTED_' + sheetName);

    timer.logMetric("batchUpdateStok");
    
    // ✅ Return signal untuk client clear cache
    return { 
      success: true, 
      msg: updated + " Data Berhasil Diupdate!",
      _clientAction: "REFRESH_CACHE"  // Signal to clear localStorage
    };

  } catch (e) {
    return { success: false, msg: "Gagal: " + e.toString() };
  }
}


// ============================================================================
// HELPER FUNCTIONS
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
  const parseNum = (val) => parseInt(String(val).replace(/[^\d-]/g, ''), 10) || 0;
  const a = parseNum(awal);
  const t = parseNum(topup);
  const s = parseNum(stok);
  
  if (a < 0 || t < 0 || s < 0) return 0;
  
  const terjual = (a + t) - s;
  return Math.max(0, terjual);
}

function resolveSheetName(name) {
  const n = String(name).toLowerCase().trim();
  if(n === 'm3') return 'toko'; 
  if(n === 'm3 sore') return 'toko sore'; 
  if(n.includes('jaya')) return 'jayacell'; 
  return name;
}

function response(success, msg, data = null, metadata = null) { 
  const result = { success: success, msg: msg };
  if (data !== null) result.data = data;
  if (metadata !== null) result._metadata = metadata;
  return result;
}

// ============================================================================
// OTHER FUNCTIONS (Copy dari kode existing Anda)
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
      }
    }

    const timestamp = "'" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    sheet.appendRow([timestamp, payload.nama, payload.jenis, payload.toko || "-", fotoUrl, payload.ket, "'" + payload.lat, "'" + payload.long]);

    return response(true, "Absensi Berhasil!");
  } catch (e) {
    return response(false, "Gagal Absen: " + e.toString());
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

    sheet.appendRow([timestamp, data.user, data.toko, data.kategori, displayNama, `Lapor ${data.tipeMasalah}: ${data.nilaiBaru} (Sys:${data.nilaiLama})`, "Salah", false]);
    
    try { sheet.getRange(sheet.getLastRow(), 8).insertCheckboxes(); } catch(e){}

    const cleanTimestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    const kategoriStr = data.kategori ? data.kategori + ' ' : '';
    const brandStr = (data.brand && data.brand !== '-') ? data.brand + ' | ' : '';
    const cleanProduk = data.brand && data.brand !== '-' ? String(data.nama).replace(new RegExp('^' + data.brand + '[- ]?', 'i'), '').trim() : data.nama;
    const textNotif = `🚨 *Laporan Salah (${data.toko})*\n\n` +
                      `*Waktu:* ${cleanTimestamp}\n` +
                      `*Produk:* ${kategoriStr}${brandStr}${cleanProduk}\n` +
                      `*Masalah:* Lapor ${data.tipeMasalah}\n` +
                      `*Koreksi:* ${data.nilaiBaru} (Sistem: ${data.nilaiLama})\n` +
                      `*Pelapor:* ${data.user}`;

    kirimNotifWA(textNotif);

    // ✅ Invalidate cache
    CacheService.getScriptCache().remove('REPORTED_' + resolveSheetName(data.toko));
    CacheService.getScriptCache().remove('STOK_' + resolveSheetName(data.toko));

    return response(true, "Laporan Terkirim", null, { clientAction: "REFRESH_CACHE" });
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
      if (row === -1) return response(false, "Laporan tidak ditemukan");
    }

    sheet.getRange(row, 6).setValue(`Lapor ${data.tipeMasalah}: ${data.nilaiBaru} (Sys:${data.nilaiLama})`);
    
    const cleanTimestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    const kategoriStr = data.kategori ? data.kategori + ' ' : '';
    const brandStr = (data.brand && data.brand !== '-') ? data.brand + ' | ' : '';
    const cleanProduk = data.brand && data.brand !== '-' ? String(data.produk).replace(new RegExp('^' + data.brand + '[- ]?', 'i'), '').trim() : data.produk;
    const textNotif = `✏️ *Laporan Diedit (${data.toko})*\n\n` +
                      `*Waktu:* ${cleanTimestamp}\n` +
                      `*Produk:* ${kategoriStr}${brandStr}${cleanProduk}\n` +
                      `*Koreksi Baru:* ${data.nilaiBaru} (Sys: ${data.nilaiLama})\n` +
                      `*Editor:* ${data.user}`;
    kirimNotifWA(textNotif);

    CacheService.getScriptCache().remove('REPORTED_' + resolveSheetName(data.toko));
    return response(true, "Laporan diupdate", null, { clientAction: "REFRESH_CACHE" });
  } catch(e) { 
    return response(false, e.toString()); 
  }
}

function hapusLaporanSalahMobile(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    const sheet = ss.getSheetByName("log");
    let row = parseInt(data.row);

    if (isNaN(row) || row < 1) {
      row = cariBarisLogOtomatis(sheet, data.toko, data.produk, data.brand);
      if (row === -1) return response(false, "Laporan tidak ditemukan");
    }

    sheet.deleteRow(row);
    
    const cleanTimestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    const kategoriStr = data.kategori ? data.kategori + ' ' : '';
    const brandStr = (data.brand && data.brand !== '-') ? data.brand + ' | ' : '';
    const cleanProduk = data.brand && data.brand !== '-' ? String(data.produk).replace(new RegExp('^' + data.brand + '[- ]?', 'i'), '').trim() : data.produk;
    const textNotif = `🗑️ *Laporan Dihapus (${data.toko})*\n\n` +
                      `*Waktu:* ${cleanTimestamp}\n` +
                      `*Produk:* ${kategoriStr}${brandStr}${cleanProduk}\n` +
                      `*Penghapus:* ${data.user}`;
    kirimNotifWA(textNotif);

    CacheService.getScriptCache().remove('REPORTED_' + resolveSheetName(data.toko));
    return response(true, "Laporan dihapus", null, { clientAction: "REFRESH_CACHE" });
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
    
    CacheService.getScriptCache().remove('STOK_' + sheetName);
    CacheService.getScriptCache().remove('dash_sum_' + sheetName);
    
    return response(true, "Pengeluaran Ditambahkan", null, { clientAction: "REFRESH_CACHE" });
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
    
    CacheService.getScriptCache().remove('STOK_' + sheetName);
    CacheService.getScriptCache().remove('dash_sum_' + sheetName);
    
    return response(true, "Pengeluaran Dihapus", null, { clientAction: "REFRESH_CACHE" });
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
    
    CacheService.getScriptCache().remove('STOK_' + sheetName);
    CacheService.getScriptCache().remove('dash_sum_' + sheetName);
    
    return response(true, "Pengeluaran Diupdate", null, { clientAction: "REFRESH_CACHE" });
  } catch(e) { 
    return response(false, e.toString()); 
  }
}

// ============================================================================
// ANALISIS STOK MINGGUAN (SNAPSHOT)
// ============================================================================

function kirimNotifWA(pesan) {
  if (CONFIG.FONNTE_TOKEN && CONFIG.FONNTE_TARGET) {
    try {
      const responseFonnte = UrlFetchApp.fetch('https://api.fonnte.com/send', {
        method: 'post',
        headers: { 'Authorization': CONFIG.FONNTE_TOKEN },
        payload: { target: CONFIG.FONNTE_TARGET, message: pesan },
        muteHttpExceptions: true
      });
      Logger.log("Fonnte Response: " + responseFonnte.getContentText());
    } catch(err) {
      Logger.log("Fonnte Error: " + err.toString());
    }
  }
}

/**
 * Rekam snapshot data "Terjual" harian untuk setiap barang per toko.
 * Disimpan di sheet 'analisis_mingguan' dengan format:
 * [Tanggal, Toko, Kategori, Brand, Produk, Terjual, Stok Akhir]
 */
function rekamSnapshotHarian() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    let sheet = ss.getSheetByName("analisis_mingguan");
    
    if (!sheet) {
      sheet = ss.insertSheet("analisis_mingguan");
      sheet.appendRow(["Tanggal", "Toko", "Kategori", "Brand", "Produk", "Terjual", "StokAkhir"]);
    }
    
    // Format timestamp untuk snapshot hari ini
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    const tokoList = ["toko", "toko sore", "jayacell", "m1", "m1 sore", "m2", "m2 sore", "m4"];
    let allSnapshotData = [];
    
    for (const toko of tokoList) {
      // Panggil fungsi pembacaan data yang sama dengan mobile
      const resStok = getStokMobileOptimized(toko, true);
      
      if (resStok && resStok.success && resStok.data) {
        resStok.data.forEach(item => {
          if (item.tipe === 'barang' || item.tipe === 'saldo') {
            const terjual = calculateTerjual(item.awal, item.topup, item.stok);
            const stokAkhir = parseInt(String(item.stok || '0').replace(/[^\d-]/g, ''), 10) || 0;
            
            // Kumpulkan baris snapshot jika ada stok atau ada yang terjual
            if (stokAkhir > 0 || terjual > 0) {
              allSnapshotData.push([
                today, 
                toko, 
                item.kategori || "-", 
                item.brand || "-", 
                item.nama || "-", 
                terjual, 
                stokAkhir
              ]);
            }
          }
        });
      }
    }
    
    if (allSnapshotData.length > 0) {
      // Simpan menggunakan batch operation agar lebih cepat
      sheet.getRange(sheet.getLastRow() + 1, 1, allSnapshotData.length, 7).setValues(allSnapshotData);
      Logger.log(`✅ Snapshot Harian Tersimpan: ${allSnapshotData.length} baris.`);
    }
    
    // Jalankan pembersihan setelah menyimpan snapshot
    hapusSnapshotLama();
    
  } catch (err) {
    Logger.log("Error rekamSnapshotHarian: " + err.toString());
  }
}

/**
 * Hapus data snapshot yang usianya lebih dari 7 hari
 */
function hapusSnapshotLama() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    let sheet = ss.getSheetByName("analisis_mingguan");
    if (!sheet) return;
    
    // Batas mundur 7 hari
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    cutoffDate.setHours(0, 0, 0, 0);
    
    const data = sheet.getDataRange().getValues();
    const rowsToDelete = [];
    
    // Dari bawah ke atas
    for (let i = data.length - 1; i >= 1; i--) {
      let rowDate = new Date(data[i][0]);
      if (!isNaN(rowDate.getTime()) && rowDate < cutoffDate) {
        rowsToDelete.push(i + 1);
      }
    }
    
    for (let i = 0; i < rowsToDelete.length; i++) {
      sheet.deleteRow(rowsToDelete[i]);
    }
    
    Logger.log(`✅ Snapshot Lama Dihapus: ${rowsToDelete.length} baris.`);
  } catch (err) {
    Logger.log("Error hapusSnapshotLama: " + err.toString());
  }
}

/**
 * Mengambil rata-rata penjualan 7 hari terakhir dari analisis_mingguan
 * Parameter opsional 'toko'
 */
function getAnalisisMingguan(tokoTarget) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    const sheet = ss.getSheetByName("analisis_mingguan");
    if (!sheet) return response(false, "Data analisis belum tersedia.");
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return response(true, "Data kosong", []);
    
    // [Tanggal, Toko, Kategori, Brand, Produk, Terjual, StokAkhir]
    const summary = {};
    const target = String(tokoTarget || "").toLowerCase().trim();
    
    for (let i = 1; i < data.length; i++) {
      const rowToko = String(data[i][1]).toLowerCase().trim();
      if (target && rowToko !== target) continue;
      
      const produkKey = data[i][4]; // Gunakan nama produk sebagai key
      const terjual = parseInt(data[i][5]) || 0;
      
      if (!summary[produkKey]) {
        summary[produkKey] = {
          kategori: data[i][2],
          brand: data[i][3],
          nama: data[i][4],
          totalTerjual: 0,
          hariTerekam: 0
        };
      }
      
      summary[produkKey].totalTerjual += terjual;
      summary[produkKey].hariTerekam += 1;
    }
    
    // Format response jadi array dan hitung rata-rata
    const results = Object.keys(summary).map(key => {
      const item = summary[key];
      const rataRata = item.hariTerekam > 0 ? (item.totalTerjual / item.hariTerekam).toFixed(1) : 0;
      return {
        ...item,
        rataRata: parseFloat(rataRata)
      };
    });
    
    return response(true, "Data Analisis Loaded", results);
    
  } catch (err) {
    return response(false, err.toString());
  }
}

/**
 * Setup Trigger Harian untuk rekamSnapshotHarian
 * Jalankan 1x secara manual: setupSnapshotTrigger()
 */
function setupSnapshotTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "rekamSnapshotHarian") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Set trigger tiap jam 23.00 - 24.00 (Tengah malam)
  ScriptApp.newTrigger("rekamSnapshotHarian")
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .create();
    
  Logger.log("✅ Trigger snapshot harian berhasil di-setup (pukul 23.00-24.00).");
}
/**
 * Jalankan fungsi ini SEKALI SECARA MANUAL dari editor Apps Script 
 * untuk memberikan izin (Authorization) ke layanan external (Fonnte API).
 */
function tesKoneksiFonnte() {
  if (!CONFIG.FONNTE_TOKEN) {
    Logger.log("Token Fonnte belum diisi di CONFIG.");
    return;
  }
  try {
    const res = UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method: 'post',
      headers: { 'Authorization': CONFIG.FONNTE_TOKEN },
      payload: { target: CONFIG.FONNTE_TARGET, message: "Tes koneksi sistem berhasil." },
      muteHttpExceptions: true
    });
    Logger.log("Hasil tes koneksi: " + res.getContentText());
  } catch (err) {
    Logger.log("Error tes koneksi: " + err.toString());
  }
}
