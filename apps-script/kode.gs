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
  FONNTE_TARGET: '628156665292-1474669748@g.us', // Masukkan Nomor WhatsApp Tujuan di sini (Misal: '08123456789')
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

  logError(actionName, errorMsg) {
    const elapsed = this.getElapsed();
    Logger.log(`❌ [ERROR] ${actionName}: ${errorMsg} (${elapsed}ms)`);
    logExecutionMetric(actionName, elapsed, "ERROR", errorMsg);
  }

  logMetric(actionName) {
    const elapsed = this.getElapsed();
    const status = this.isTimeout() ? "TIMEOUT" : "OK";
    const level = this.isSlow() ? "⚠️ SLOW" : "✅";
    
    Logger.log(`${level} [${status}] ${actionName}: ${elapsed}ms`);
    
    if (this.isSlow() || status === "TIMEOUT") {
      logExecutionMetric(actionName, elapsed, status, "");
    }
  }
}

function logExecutionMetric(action, executionTime, status, errorMsg = "") {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    let sheet = ss.getSheetByName("execution_metrics");
    
    if (!sheet) {
      sheet = ss.insertSheet("execution_metrics");
      sheet.appendRow(["Timestamp", "Action", "Execution Time (ms)", "Status", "Error Message"]);
    }
    
    // Auto-update header if Error Message column is missing
    if (sheet.getRange("E1").getValue() !== "Error Message") {
      sheet.getRange("E1").setValue("Error Message");
    }
    
    sheet.appendRow([new Date(), action, executionTime, status, String(errorMsg)]);
  } catch (err) {
    Logger.log("Metrics logging error: " + err);
  }
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

function doPost(e) {
  const timer = new ExecutionTimer();
  let action = "UNKNOWN";
  
  try {
    const request = JSON.parse(e.postData.contents);
    action = request.action;
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
      case 'batchTambahPengeluaran':
        result = batchTambahPengeluaranMobile(payload);
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
        result = getInfoPusat(payload.toko);
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
    timer.logError("doPost_GLOBAL_" + action, error.toString());
    return ContentService.createTextOutput(JSON.stringify(
      response(false, error.toString())
    )).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// GET REQUEST HANDLER (Mencegah error di log jika URL dibuka langsung)
// ============================================================================
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    msg: "Backend API MobileCell berjalan normal. Silakan gunakan POST method.",
    timestamp: new Date().getTime()
  })).setMimeType(ContentService.MimeType.JSON);
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
    let curAccBrand = '-';
    const validAccBrands = ['KABEL DATA TOPLES', 'OTG', 'KEPALA CHARGER', 'EARPHONE', 'MMC', 'FLASH DISK', 'TRAVEL CHARGER', 'POWERBANK'];

    rawValues.slice(133, 305).forEach((r, i) => { 
      let realIdx = i + 133;
      if(r[0] && r[0] !== "#N/A" && r[0] !== "-") {
        const colB = String(r[0]).trim();
        const colBUpper = colB.toUpperCase();

        const matchedBrand = validAccBrands.find(b => colBUpper.includes(b));
        
        if (matchedBrand) {
          curAccBrand = matchedBrand;
          // Cek apakah ini sekadar baris header (tidak ada stok & harga)
          const stokAwal = String(r[2] || "").trim();
          const harga = String(r[6] || "").trim();
          if (stokAwal === "" && harga === "") {
             return; // Skip baris murni header
          }
        }

        results.push({ 
          kategori: 'Aksesoris', brand: curAccBrand, nama: colB, 
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
        const logStatus = String(row[6]).toLowerCase().trim();
        const logKoreksi = row[7];
        if (logStatus !== "salah" || logKoreksi !== false) continue;

        const logToko = String(row[2]).toLowerCase().trim();
        if (logToko !== originalStoreName && logToko !== targetStoreName) continue;

        let isToday = false;
        if (row[0] instanceof Date) {
          isToday = Utilities.formatDate(row[0], Session.getScriptTimeZone(), "dd/MM/yyyy") === todayStr;
        } else {
          isToday = String(row[0]).includes(todayStr);
        }

        if (!isToday) continue;

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
    try {
      const cache = CacheService.getScriptCache();
      cache.remove('STOK_' + sheetName);
      cache.remove('dash_sum_' + sheetName);
      cache.remove('REPORTED_' + sheetName);
    } catch(e){}

    timer.logMetric("batchUpdateStok");
    
    // ✅ Return signal untuk client clear cache
    return { 
      success: true, 
      msg: updated + " Data Berhasil Diupdate!",
      _clientAction: "REFRESH_CACHE"  // Signal to clear localStorage
    };

  } catch (e) {
    const timer = new ExecutionTimer(8000);
    timer.logError("batchUpdateStokMobileOptimized", e.toString());
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
      const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
      for (let k = dataAbsen.length - 1; k >= 1; k--) {
        let rowDate = dataAbsen[k][0];
        let isToday = false;
        if (rowDate instanceof Date) {
          isToday = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "dd/MM/yyyy") === todayStr;
        } else {
          isToday = String(rowDate).includes(todayStr);
        }
        
        if (String(dataAbsen[k][1]) === user.nama && isToday && String(dataAbsen[k][2]) === 'Masuk') {
          sudahMasuk = true;
          if (rowDate instanceof Date) {
            jamMasuk = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "HH:mm");
          } else {
            let match = String(rowDate).match(/(\d{2}:\d{2})/);
            jamMasuk = match ? match[1] : "-";
          }
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
    try {
      CacheService.getScriptCache().remove('REPORTED_' + resolveSheetName(data.toko));
      CacheService.getScriptCache().remove('STOK_' + resolveSheetName(data.toko));
    } catch(e){}

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

    try {
      CacheService.getScriptCache().remove('REPORTED_' + resolveSheetName(data.toko));
      CacheService.getScriptCache().remove('STOK_' + resolveSheetName(data.toko));
    } catch(e){}
    return response(true, "Laporan diupdate", null, { clientAction: "REFRESH_CACHE" });
  } catch(e) { 
    const timer = new ExecutionTimer(8000);
    timer.logError("editLaporanSalahMobile", e.toString());
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

    try {
      CacheService.getScriptCache().remove('REPORTED_' + resolveSheetName(data.toko));
      CacheService.getScriptCache().remove('STOK_' + resolveSheetName(data.toko));
    } catch(e){}
    return response(true, "Laporan dihapus", null, { clientAction: "REFRESH_CACHE" });
  } catch(e) { 
    const timer = new ExecutionTimer(8000);
    timer.logError("hapusLaporanSalahMobile", e.toString());
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
    
    if (String(rowData[6]).toLowerCase().trim() !== 'salah' || rowData[7] !== false) continue;
    
    const logToko = String(rowData[2]).toLowerCase().trim();
    if (logToko !== targetToko) continue;
    
    let isToday = false;
    let logDate = rowData[0];
    if (!(logDate instanceof Date)) logDate = new Date(logDate);
    if (!isNaN(logDate.getTime())) {
      isToday = (Utilities.formatDate(logDate, Session.getScriptTimeZone(), "dd/MM/yyyy") === todayStr);
    } else {
      isToday = String(rowData[0]).includes(todayStr);
    }
    
    if (!isToday) continue;
    
    const logProduk = String(rowData[4]).toLowerCase().replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim();
    
    if (logProduk === targetDenganBrand || logProduk === namaBersih) {
      return i + 1;
    }
  }
  return -1;
}

function tambahPengeluaranMobile(data) {
  const timer = new ExecutionTimer(5000) // 5 sec timeout untuk fungsi ini
  
  try {
    // ========== VALIDATION ==========
    
    if (!data) {
      return response(false, "Data pengeluaran tidak diterima")
    }
    
    const toko = String(data.toko || "").trim().toLowerCase()
    if (!toko) {
      return response(false, "Nama toko harus diisi")
    }
    
    const nominal = parseInt(String(data.nominal || "").replace(/[^0-9-]/g, '')) || 0
    if (nominal === 0) {
      return response(false, "Nominal pengeluaran harus lebih dari 0")
    }
    
    const ket = String(data.ket || "").trim()
    if (!ket || ket.length === 0) {
      return response(false, "Keterangan pengeluaran harus diisi")
    }
    
    if (ket.length > 100) {
      return response(false, "Keterangan terlalu panjang (max 100 karakter)")
    }

    // ========== GET SHEET ==========
    
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID)
    if (!ss) {
      return response(false, "Spreadsheet tidak ditemukan")
    }
    
    const sheetName = resolveSheetName(toko)
    const sheet = ss.getSheetByName(sheetName)
    
    if (!sheet) {
      return response(false, `Sheet '${sheetName}' tidak ditemukan untuk toko '${toko}'`)
    }

    // ========== FIND AVAILABLE SLOT ==========
    
    // Pengeluaran disimpan di column N (14) dengan range N15:N28 (14 baris)
    const range = sheet.getRange("N15:N28")
    const values = range.getValues()
    
    let availableRow = -1
    let usedCount = 0
    
    for (let i = 0; i < values.length; i++) {
      const cellValue = values[i][0]
      
      // Check if cell empty or zero
      const isEmpty = (cellValue === "" || cellValue === null || cellValue === 0)
      
      if (isEmpty && availableRow === -1) {
        availableRow = 15 + i // row number (1-indexed)
      }
      
      if (!isEmpty) {
        usedCount++
      }
    }
    
    if (availableRow === -1) {
      // Semua slot penuh
      return response(false, `Pengeluaran penuh (${usedCount}/14 slot terpakai). Hapus yang lama terlebih dahulu.`)
    }

    // ========== SAVE TO SHEET ==========
    
    Logger.log(`📝 [${sheetName}] Saving expense at row ${availableRow}: "${ket}" = ${nominal}`)
    
    // Column mapping:
    // N = Column 14 (nominal)
    // R = Column 18 (keterangan)
    sheet.getRange(availableRow, 14).setValue(nominal)
    sheet.getRange(availableRow, 18).setValue(ket)
    
    // Optional: Add timestamp (Column O = 15)
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
    sheet.getRange(availableRow, 15).setValue(timestamp)

    // ========== INVALIDATE CACHE ==========
    
    const cache = CacheService.getScriptCache()
    cache.remove('STOK_' + sheetName)
    cache.remove('dash_sum_' + sheetName)
    
    Logger.log(`✅ Cache invalidated for ${sheetName}`)

    // ========== RETURN SUCCESS ==========
    
    timer.logMetric("tambahPengeluaranMobile")
    
    return response(
      true,
      `Pengeluaran berhasil disimpan (${usedCount + 1}/14)`,
      {
        row: availableRow,
        nominal: nominal,
        ket: ket,
        slotUsed: usedCount + 1,
        slotTotal: 14
      },
      {
        cached: false,
        clientAction: "REFRESH_CACHE"
      }
    )

  } catch (e) {
    Logger.log(`❌ Error in tambahPengeluaranMobile: ${e.toString()}`)
    timer.logMetric("tambahPengeluaranMobile_ERROR")
    return response(false, `System Error: ${e.toString()}`)
  }
}

function batchTambahPengeluaranMobile(data) {
  const timer = new ExecutionTimer(8000);
  try {
    if (!data || !data.expenses || data.expenses.length === 0) {
      return response(false, "Tidak ada data pengeluaran");
    }
    const toko = String(data.toko || "").trim().toLowerCase();
    const sheetName = resolveSheetName(toko);
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return response(false, "Sheet tidak ditemukan");

    const range = sheet.getRange("N15:N28");
    const values = range.getValues();
    let availableRows = [];
    
    for (let i = 0; i < values.length; i++) {
      const cellValue = values[i][0];
      if (cellValue === "" || cellValue === null || cellValue === 0) {
        availableRows.push(15 + i);
      }
    }

    if (availableRows.length < data.expenses.length) {
      return response(false, `Slot pengeluaran tidak cukup. Tersisa ${availableRows.length} slot.`);
    }

    // Get range for batch update: N15:R28 (Row 15-28, Col 14-18)
    const updateRange = sheet.getRange("N15:R28");
    const updateValues = updateRange.getValues(); // 14 rows, 5 cols
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    
    let updated = 0;
    data.expenses.forEach(exp => {
      const rowIdx = availableRows.shift() - 15; // 0 to 13
      const nominal = parseInt(String(exp.nominal).replace(/[^0-9-]/g, '')) || 0;
      const ket = String(exp.ket || "").trim();
      
      updateValues[rowIdx][0] = nominal; // N
      updateValues[rowIdx][1] = timestamp; // O
      updateValues[rowIdx][4] = ket; // R
      updated++;
    });

    updateRange.setValues(updateValues);

    const cache = CacheService.getScriptCache();
    cache.remove('STOK_' + sheetName);
    cache.remove('dash_sum_' + sheetName);

    timer.logMetric("batchTambahPengeluaranMobile");
    return response(true, `${updated} Pengeluaran berhasil disimpan`, null, { clientAction: "REFRESH_CACHE" });
  } catch (e) {
    timer.logError("batchTambahPengeluaranMobile", e.toString());
    return response(false, "System Error: " + e.toString());
  }
}

function hapusPengeluaranMobile(data) {
  const timer = new ExecutionTimer(5000)
  
  try {
    if (!data || !data.row || !data.toko) {
      return response(false, "Data tidak lengkap")
    }
    
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID)
    const sheetName = resolveSheetName(data.toko)
    const sheet = ss.getSheetByName(sheetName)
    
    if (!sheet) {
      return response(false, `Sheet '${sheetName}' tidak ditemukan`)
    }
    
    Logger.log(`🗑️ [${sheetName}] Deleting expense at row ${data.row}`)
    
    // Clear cells
    sheet.getRange(data.row, 14).clearContent()  // Column N (nominal)
    sheet.getRange(data.row, 15).clearContent()  // Column O (timestamp)
    sheet.getRange(data.row, 18).clearContent()  // Column R (keterangan)
    
    // Invalidate cache
    const cache = CacheService.getScriptCache()
    cache.remove('STOK_' + sheetName)
    cache.remove('dash_sum_' + sheetName)
    
    timer.logMetric("hapusPengeluaranMobile")
    
    return response(
      true,
      "Pengeluaran berhasil dihapus",
      null,
      { clientAction: "REFRESH_CACHE" }
    )
    
  } catch (e) {
    timer.logError("hapusPengeluaranMobile", e.toString());
    return response(false, `Error: ${e.toString()}`);
  }
}

function editPengeluaranMobileOptimized(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.STOK_ID);
    const sheetName = resolveSheetName(data.toko);
    const sheet = ss.getSheetByName(sheetName);
    
    sheet.getRange(data.row, 14).setValue(data.nominal);
    sheet.getRange(data.row, 18).setValue(data.ket);
    SpreadsheetApp.flush();
    
    try {
      CacheService.getScriptCache().remove('STOK_' + sheetName);
      CacheService.getScriptCache().remove('dash_sum_' + sheetName);
    } catch (e) {
      Logger.log("Gagal invalidate cache: " + e.toString());
    }
    
    return response(true, "Pengeluaran Diupdate", null, { clientAction: "REFRESH_CACHE" });
  } catch(e) { 
    const timer = new ExecutionTimer(8000);
    timer.logError("editPengeluaranMobileOptimized", e.toString());
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

function getInfoPusat() {
  try {
    const ssDb = SpreadsheetApp.openById(CONFIG.DB_ID);
    const sheetInfo = ssDb.getSheetByName("info_pusat");
    let runningText = "Selamat Bekerja, Semangat!";
    
    if(sheetInfo) {
       const dataInfo = sheetInfo.getDataRange().getValues();
       let messages = [];
       for(let i=1; i<dataInfo.length; i++) {
          // Asumsi centang aktif ada di kolom C (index 2), pesan di kolom B (index 1)
          if(dataInfo[i][2] === true) { messages.push(dataInfo[i][1]); }
       }
       if(messages.length > 0) { runningText = messages.join("   ◉   "); }
    }
    return response(true, "OK", { info: runningText });
  } catch(e) { 
    return response(false, e.toString()); 
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
    const target = resolveSheetName(String(tokoTarget || "").toLowerCase().trim());
    
    for (let i = 1; i < data.length; i++) {
      const rowToko = String(data[i][1]).toLowerCase().trim();
      // Bandingkan juga dengan resolveSheetName agar konsisten
      if (target && resolveSheetName(rowToko) !== target) continue;
      
      const kategori = data[i][2];
      const brand = data[i][3];
      const nama = data[i][4];
      const produkKey = `${kategori}_${brand}_${nama}`; // Gunakan kombinasi sebagai key
      const terjual = parseInt(data[i][5]) || 0;
      
      if (!summary[produkKey]) {
        summary[produkKey] = {
          kategori: kategori,
          brand: brand,
          nama: nama,
          totalTerjual: 0,
          hariTerekam: 0,
          minTerjual: Infinity,
          maxTerjual: -Infinity
        };
      }
      
      summary[produkKey].totalTerjual += terjual;
      summary[produkKey].hariTerekam += 1;
      if (terjual < summary[produkKey].minTerjual) summary[produkKey].minTerjual = terjual;
      if (terjual > summary[produkKey].maxTerjual) summary[produkKey].maxTerjual = terjual;
    }
    
    // Format response jadi array dan hitung rata-rata
    const results = Object.keys(summary).map(key => {
      const item = summary[key];
      const rataRata = item.hariTerekam > 0 ? Math.round(item.totalTerjual / item.hariTerekam) : 0;
      return {
        ...item,
        rataRata: rataRata,
        minTerjual: item.minTerjual === Infinity ? 0 : item.minTerjual,
        maxTerjual: item.maxTerjual === -Infinity ? 0 : item.maxTerjual
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

function hapusLogLama() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DB_ID);
    let sheet = ss.getSheetByName("log");
    if (!sheet) return;
    
    const cutoffDate = new Date();
    // 3 hari terakhir (hari ini, kemarin, lusa) = batas H-2
    cutoffDate.setDate(cutoffDate.getDate() - 2);
    cutoffDate.setHours(0, 0, 0, 0);
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return; // Hanya ada header atau kosong
    
    const rowsToKeep = [data[0]]; // Simpan header
    let deletedCount = 0;
    
    for (let i = 1; i < data.length; i++) {
      let dateStr = String(data[i][0]).replace(/^'/, '').trim(); 
      let rowDate;
      
      if (dateStr.includes('/')) {
        let parts = dateStr.split(' ');
        let dateParts = parts[0].split('/');
        let timeParts = parts[1] ? parts[1].split(':') : ['0', '0', '0'];
        
        if (dateParts.length === 3) {
           let day = parseInt(dateParts[0], 10);
           let month = parseInt(dateParts[1], 10) - 1;
           let year = parseInt(dateParts[2], 10);
           
           let hh = parseInt(timeParts[0] || '0', 10);
           let mm = parseInt(timeParts[1] || '0', 10);
           let ss = parseInt(timeParts[2] || '0', 10);
           
           rowDate = new Date(year, month, day, hh, mm, ss);
        } else {
           rowDate = new Date(dateStr);
        }
      } else {
        rowDate = new Date(data[i][0]);
      }
      
      // Jika tanggal valid dan kurang dari cutoffDate (sudah kadaluarsa)
      if (!isNaN(rowDate.getTime()) && rowDate < cutoffDate) {
        deletedCount++;
      } else {
        // Jika masih baru (atau gagal diurai), tetap simpan
        rowsToKeep.push(data[i]);
      }
    }
    
    // Jika ada yang perlu dihapus, timpa ulang isi sheet-nya
    if (deletedCount > 0) {
      sheet.getDataRange().clearContent();
      sheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
      Logger.log(`✅ Log Lama Dihapus: ${deletedCount} baris. (Tersisa: ${rowsToKeep.length - 1} baris log)`);
    } else {
      Logger.log(`✅ Tidak ada log lama yang perlu dihapus.`);
    }
    
  } catch (err) {
    Logger.log("Error hapusLogLama: " + err.toString());
  }
}
