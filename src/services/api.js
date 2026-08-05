const apiCache = new Map();
const CACHE_TTL = 15000; // 15 detik cache dalam memori untuk mencegah request berulang

export async function callApi(action, payload, options = {}) {
  const { forceRefresh = false } = options;
  const url = import.meta.env.VITE_API_URL;
  
  if (!url || url.includes('YOUR_SCRIPT_ID')) {
    console.warn("API URL is not set or using placeholder.");
  }
  
  const cacheKey = JSON.stringify({ action, payload });
  const now = Date.now();

  // Kembalikan cache jika masih valid dan tidak force refresh (hanya untuk request read)
  const isReadAction = action === 'getStok' || action === 'getDashboardSummary' || action === 'getInfoPusat';
  if (isReadAction && !forceRefresh && apiCache.has(cacheKey)) {
    const cached = apiCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action, payload })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    if (result && result.success && isReadAction) {
      apiCache.set(cacheKey, { data: result, timestamp: now });
    }
    
    // Jika aksi mutasi (simpan/absen), bersihkan cache agar data terbaru langsung diambil
    if (!isReadAction) {
      clearApiCache();
    }

    return result;
  } catch (error) {
    console.error("API Call Failed:", error);
    let errorMsg = error.message;
    if (errorMsg === "Failed to fetch" || (errorMsg && errorMsg.includes("NetworkError"))) {
      errorMsg = "Tidak ada koneksi internet";
    }
    return { success: false, msg: errorMsg || "Koneksi ke server gagal" };
  }
}

export function clearApiCache() {
  apiCache.clear();
}
