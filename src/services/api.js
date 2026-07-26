export async function callApi(action, payload) {
  const url = import.meta.env.VITE_API_URL;
  if (!url || url.includes('YOUR_SCRIPT_ID')) {
    console.warn("API URL is not set or using placeholder.");
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
