<template>
  <div class="page-section animate-fade">
    <!-- Announcement Marquee -->
    <div class="w-100 bg-warning bg-opacity-10 border-bottom border-warning text-dark py-2 overflow-hidden mb-3">
      <div class="d-flex align-items-center px-3">
        <i class="fa-solid fa-bullhorn text-warning me-2"></i>
        <marquee scrollamount="6" class="fw-bold small text-secondary style-marquee">
          {{ dashboardData.info || 'Memuat Info Pusat...' }}
        </marquee>
      </div>
    </div>
    <!-- Profile Hero Card -->
    <div class="card border-0 shadow rounded-4 mb-3 text-white card-hero">
      <div class="position-absolute top-0 start-0 translate-middle bg-warning opacity-10 rounded-circle circle-bg"></div>

      <div class="card-body p-4 position-relative z-1">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div class="badge bg-white bg-opacity-25 text-white fw-normal border border-white border-opacity-25 px-3 py-1 rounded-pill">
            {{ currentDate }}
          </div>
          <button 
            class="btn btn-sm btn-light bg-white bg-opacity-25 border-0 text-white rounded-circle shadow-sm btn-refresh"
            @click="refreshAll"
            :disabled="refreshing"
          >
            <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': refreshing }"></i>
          </button>
        </div>

        <div class="d-flex align-items-center gap-3">
          <div class="avatar-circle bg-white text-primary fw-bold fs-3 shadow-sm">
            {{ userInitial }}
          </div>
          <div class="w-100 overflow-hidden">
            <div class="small text-white text-opacity-75 text-uppercase ls-1" style="font-size: 0.7rem;">Selamat Bekerja,</div>
            <h4 class="fw-bold mb-1 text-truncate">{{ store.user.name }}</h4>
            <div class="d-flex gap-1">
              <span class="badge bg-black bg-opacity-25 border border-white border-opacity-25 fw-normal">{{ store.user.store || '-' }}</span>
              <span class="badge bg-black bg-opacity-25 border border-white border-opacity-25 fw-normal">{{ store.user.shift || '-' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Absen Masuk Panel (If not checked-in) -->
    <div v-if="!store.status.isAbsen" class="card border-0 shadow-sm rounded-4 mb-4 bg-white">
      <div class="card-body p-4 text-center">
        <div class="mb-4">
          <h5 class="fw-bold mb-1 text-dark">Selamat Bekerja!</h5>
          <p class="text-muted small mb-0">Silakan klik tombol di bawah untuk mencatat kehadiran Anda hari ini.</p>
        </div>
        <button 
          class="btn btn-success w-100 rounded-pill py-3 shadow-sm btn-absen-submit"
          @click="submitAbsen('Masuk')"
          :disabled="loadingAbsenMasuk"
        >
          <span v-if="loadingAbsenMasuk" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          <i v-else class="fa-solid fa-right-to-bracket me-2"></i> 
          {{ loadingAbsenMasuk ? 'Memverifikasi..' : 'ABSEN MASUK' }}
        </button>
      </div>
    </div>

    <!-- Dashboard Panel (If checked-in) -->
    <div v-else class="animate-fade">
      

      <div class="row g-2 mb-4">
        <div class="col-12">
          <div class="card border-0 shadow-sm overflow-hidden" style="border-radius: 1.25rem; transform: translateZ(0);">
            <!-- Gradient Header (Total Penjualan) -->
            <div class="position-relative p-4 overflow-hidden" style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); border-top-left-radius: 1.25rem; border-top-right-radius: 1.25rem;">
              <!-- Abstract Circles -->
              <div class="position-absolute top-0 end-0 bg-black rounded-circle" style="width: 120px; height: 120px; transform: translate(30%, -30%); opacity: 0.2;"></div>
              <div class="position-absolute bottom-0 start-0 bg-black rounded-circle" style="width: 80px; height: 80px; transform: translate(-30%, 30%); opacity: 0.2;"></div>
              
              <div class="position-relative z-1 d-flex justify-content-between align-items-center">
                <div>
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <span class="text-white text-opacity-75 small text-uppercase fw-bold" style="font-size:0.7rem; letter-spacing: 0.5px;">Total Penjualan</span>
                    <span class="badge bg-white bg-opacity-25 text-white border border-white border-opacity-25 rounded-pill px-2 py-1" style="font-size: 0.55rem;">HARI INI</span>
                  </div>
                  <h2 class="fw-bold text-white mb-0 mt-1" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.15);">{{ displayPenjualan }}</h2>
                </div>
                <div class="rounded-circle bg-white shadow-sm d-flex align-items-center justify-content-center" style="width: 56px; height: 56px; color: #3b82f6; font-size: 1.5rem;">
                  <i class="fa-solid fa-sack-dollar"></i>
                </div>
              </div>
            </div>
            
            <!-- Clean Body (Kas & Selisih) -->
            <div class="bg-white p-3">
              <div class="row g-2">
                <!-- Kas di Laci -->
                <div class="col-6 border-end border-light d-flex align-items-center">
                  <div class="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center me-2 flex-shrink-0" style="width: 38px; height: 38px;">
                    <i class="fa-solid fa-cash-register text-success" style="font-size: 1rem;"></i>
                  </div>
                  <div>
                    <span class="text-muted fw-bold d-block" style="font-size:0.6rem; letter-spacing: 0.5px;">KAS DI LACI</span>
                    <h6 class="fw-bold text-dark mb-0 mt-1" style="font-size: 0.95rem;">{{ displayKasDiLaci }}</h6>
                  </div>
                </div>
                <!-- Bersih / Selisih -->
                <div class="col-6 ps-2 d-flex align-items-center">
                  <div class="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center me-2 flex-shrink-0" style="width: 38px; height: 38px;">
                    <i class="fa-solid fa-scale-unbalanced text-primary" style="font-size: 1rem;"></i>
                  </div>
                  <div>
                    <span class="text-muted fw-bold d-block" style="font-size:0.6rem; letter-spacing: 0.5px;">SELISIH</span>
                    <h6 :class="selisihClass" class="fw-bold mb-0 mt-1" style="font-size: 0.95rem;">{{ displaySelisih }}</h6>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Analisis Card -->
      <div v-if="loadingAnalisis" class="card border-0 shadow-sm rounded-4 mb-4 bg-white border border-warning" style="border-width: 2px !important;">
        <div class="card-body p-3 d-flex align-items-center gap-3">
          <div class="rounded-circle bg-warning bg-opacity-25 placeholder-glow" style="width: 48px; height: 48px;">
            <span class="placeholder w-100 h-100 rounded-circle"></span>
          </div>
          <div class="w-100 placeholder-glow">
            <span class="placeholder col-4 rounded mb-1"></span><br>
            <span class="placeholder col-7 rounded"></span>
          </div>
        </div>
      </div>
      <div v-else-if="filteredAnalisis.length > 0" class="card border-0 shadow-sm rounded-4 mb-4 bg-white border border-warning" style="border-width: 2px !important;">
        <div class="card-body p-3 d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-circle bg-warning bg-opacity-25 d-flex align-items-center justify-content-center text-warning" style="width: 48px; height: 48px;">
              <i class="fa-solid fa-chart-line fs-5"></i>
            </div>
            <div>
              <h6 class="fw-bold text-dark mb-0">Analisis Stok</h6>
              <span class="small text-danger fw-bold">{{ filteredAnalisis.length }} Indikasi Salah Lapor!</span>
            </div>
          </div>
          <button class="btn btn-warning btn-sm fw-bold rounded-pill shadow-sm px-3" @click="bukaAnalisis">Cek</button>
        </div>
      </div>
      <div v-else class="card border-0 shadow-sm rounded-4 mb-4 bg-white border border-success" style="border-width: 2px !important;">
        <div class="card-body p-3 d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-circle bg-success bg-opacity-25 d-flex align-items-center justify-content-center text-success" style="width: 48px; height: 48px;">
              <i class="fa-solid fa-check-circle fs-5"></i>
            </div>
            <div>
              <h6 class="fw-bold text-dark mb-0">Analisis Stok</h6>
              <span class="small text-success fw-bold">Penjualan Wajar & Aman</span>
            </div>
          </div>
          <button class="btn btn-success btn-sm fw-bold rounded-pill shadow-sm px-3" @click="bukaAnalisis">Cek</button>
        </div>
      </div>
    </div>

  <!-- Modal Analisis Mingguan -->
  <div class="modal fade" id="modalAnalisisHome" tabindex="-1" aria-hidden="true" ref="modalAnalisisRef">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content border-0 shadow-lg" style="border-radius: 16px;">
        <div class="modal-header bg-warning text-dark border-0">
          <h5 class="modal-title fw-bold d-flex align-items-center gap-2">
            <i class="fa-solid fa-chart-line"></i> Analisis Selisih Mingguan
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        
        <div class="modal-body bg-light p-3">
          <div v-if="loadingAnalisis" class="text-center py-5">
            <div class="spinner-border text-warning" role="status"></div>
            <p class="mt-2 text-muted fw-bold small">Menganalisis Data...</p>
          </div>
          
          <div v-else-if="analisisData.length === 0" class="text-center py-5">
            <i class="fa-solid fa-folder-open fs-1 text-muted opacity-50 mb-3"></i>
            <h6 class="fw-bold text-secondary">Data Belum Cukup</h6>
            <p class="small text-muted mb-0">Sistem butuh waktu beberapa hari merekam data stok akhir untuk menampilkan rata-rata.</p>
          </div>
          
          <div v-else>
            <div class="alert alert-info border-0 shadow-sm mb-3 rounded-4 d-flex gap-3 align-items-center">
              <i class="fa-solid fa-circle-info fs-3 text-info"></i>
              <div class="small">
                Menampilkan anomali penjualan hari ini (sangat tinggi/rendah) dibandingkan rata-rata 7 hari terakhir. Berguna untuk mendeteksi salah lapor awal/topup.
              </div>
            </div>
            
            <div v-for="item in filteredAnalisis" :key="item.nama" class="card border-0 shadow-sm rounded-4 mb-3">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <span class="badge bg-light text-dark border me-1">{{ item.kategori }}</span>
                    <span class="badge bg-secondary">{{ item.brand }}</span>
                  </div>
                </div>
                <h6 class="fw-bold text-dark mb-3">{{ item.nama }}</h6>
                
                <div class="row g-2 text-center">
                  <div class="col-6">
                    <div class="p-2 bg-light rounded-3">
                      <div class="small text-muted mb-1">Rata-rata 7 Hari</div>
                      <div class="fw-bold fs-5 text-primary">{{ item.rataRata }}</div>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="p-2 rounded-3" :class="getAnomaliColor(item)">
                      <div class="small mb-1" :class="item.isAnomali ? 'text-white' : 'text-muted'">Terjual Hari Ini</div>
                      <div class="fw-bold fs-5">{{ item.terjualHariIni }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer border-0">
          <button type="button" class="btn btn-light rounded-pill px-4 fw-bold w-100" data-bs-dismiss="modal">
            Tutup
          </button>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { store } from '../store'
import { callApi } from '../services/api'
import Swal from 'sweetalert2'

const emits = defineEmits(['refresh-stock'])

const refreshing = ref(false)
const loadingAbsenMasuk = ref(false)
const loadingAbsenPulang = ref(false)

const modalAnalisisRef = ref(null)
let modalAnalisisInstance = null
const analisisData = ref([])
const loadingAnalisis = ref(false)

// Instant initialization from persistent cache if available
const dashboardData = ref(store.dashboardCache || {
  penjualan: 'Rp 0',
  kasDiLaci: 'Rp 0',
  pengeluaran: 'Rp 0',
  selisih: 'Rp 0',
  info: 'Memuat Info Pusat...'
})

const currentDate = computed(() => {
  return new Date().toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
})

const userInitial = computed(() => {
  return store.user.name ? store.user.name.charAt(0).toUpperCase() : 'U'
})

const totalPenjualan = computed(() => {
  if (!store.stockCache || store.stockCache.length === 0) return null
  let total = 0
  const parseNum = (val) => parseInt(String(val).replace(/[^0-9-]/g, '')) || 0
  
  store.stockCache.forEach(item => {
    if (item.tipe === 'barang') {
      const key = item.row ? `row_${item.row}_${item.tipe}` : `${item.kategori}_${item.nama}`.replace(/[^a-zA-Z0-9]/g, "")
      let stok = parseNum(item.stok)
      if (store.unsavedChanges.hasOwnProperty(key)) {
        stok = parseNum(store.unsavedChanges[key])
      }
      let awal = parseNum(item.awal)
      let topup = parseNum(item.topup)
      let terjual = (awal + topup) - stok
      let harga = parseNum(item.harga)
      
      if (terjual > 0) total += (terjual * harga)
    } else if (item.tipe === 'saldo') {
      const key = item.row ? `row_${item.row}_${item.tipe}` : `${item.kategori}_${item.nama}`.replace(/[^a-zA-Z0-9]/g, "")
      let stok = parseNum(item.stok)
      if (store.unsavedChanges.hasOwnProperty(key)) {
        stok = parseNum(store.unsavedChanges[key])
      }
      let awal = parseNum(item.awal)
      let topup = parseNum(item.topup)
      let terjual = (awal + topup) - stok
      
      if (terjual > 0) total += terjual
    }
  })
  return total
})

const totalPengeluaran = computed(() => {
  if (!store.stockCache || store.stockCache.length === 0) return null
  let total = 0
  store.stockCache.forEach(item => {
    // Pengeluaran di-format menjadi tipe='uang' oleh HomeView
    if (item.tipe === 'uang' && (item.kategori || '').toLowerCase() === 'pengeluaran') {
      const key = item.row ? `row_${item.row}_${item.tipe}` : `${item.kategori}_${item.nama}`.replace(/[^a-zA-Z0-9]/g, "")
      let nominal = parseInt(String(item.harga).replace(/[^0-9-]/g, '')) || 0
      if (store.unsavedChanges.hasOwnProperty(key)) {
        nominal = parseInt(String(store.unsavedChanges[key]).replace(/[^0-9-]/g, '')) || 0
      }
      total += nominal
    }
  })
  // Tambahkan juga pengeluaran yang masih di antrian (belum disave)
  try {
    const pending = JSON.parse(localStorage.getItem('PENDING_EXPENSES') || '[]')
    pending.forEach(exp => {
      total += parseInt(String(exp.nominal).replace(/[^0-9-]/g, '')) || 0
    })
  } catch(e) {}
  return total
})

const totalUangCash = computed(() => {
  if (!store.stockCache || store.stockCache.length === 0) return null
  const cashItems = store.stockCache.filter(item => item.tipe === 'info')
  if (cashItems.length === 0) return null
  
  let total = 0
  cashItems.forEach(item => {
    const key = item.row ? `row_${item.row}_${item.tipe}` : `${item.kategori}_${item.nama}`.replace(/[^a-zA-Z0-9]/g, "")
    let nominal = 0
    if (store.unsavedChanges.hasOwnProperty(key)) {
      nominal = parseInt(String(store.unsavedChanges[key]).replace(/[^0-9-]/g, '')) || 0
    } else {
      nominal = parseInt(String(item.harga || 0).replace(/[^0-9-]/g, '')) || 0
    }
    total += nominal
  })
  return total
})

const computedSelisih = computed(() => {
  if (totalPenjualan.value === null || totalUangCash.value === null) return null
  const peng = totalPengeluaran.value || 0
  return (totalUangCash.value + peng) - totalPenjualan.value
})

const formatRp = (num) => {
  let isNeg = num < 0
  let abs = Math.abs(num)
  let str = "Rp " + abs.toLocaleString('id-ID')
  return isNeg ? "-" + str : str
}

const displayPenjualan = computed(() => {
  if (totalPenjualan.value !== null) return formatRp(totalPenjualan.value)
  return dashboardData.value.penjualan
})

const displayKasDiLaci = computed(() => {
  if (totalUangCash.value !== null) return formatRp(totalUangCash.value)
  return dashboardData.value.kasDiLaci
})

const displaySelisih = computed(() => {
  if (computedSelisih.value !== null) return formatRp(computedSelisih.value)
  return dashboardData.value.selisih
})

const selisihClass = computed(() => {
  const raw = computedSelisih.value || 0
  if (raw < 0) return 'text-danger'    // Merah
  if (raw > 0) return 'text-primary'   // Biru
  return 'text-success'                // Hijau
})

// === Logika Analisis Mingguan ===
const fetchAnalisis = async () => {
  if (!store.user.store) return;
  loadingAnalisis.value = true;
  try {
    const result = await callApi('getAnalisisMingguan', { toko: store.user.store })
    if (result.success && result.data) {
      analisisData.value = result.data;
    }
  } catch (e) {
    console.error("Gagal load analisis:", e)
  } finally {
    loadingAnalisis.value = false;
  }
}

const filteredAnalisis = computed(() => {
  if (!analisisData.value.length || !store.stockCache) return []
  
  const parseNum = (val) => parseInt(String(val).replace(/[^0-9-]/g, '')) || 0
  
  const combinedData = analisisData.value.map(item => {
    // Cari barang ini di stock cache
    const matchingStok = store.stockCache.find(s => s.nama === item.nama)
    let terjualHariIni = 0
    if (matchingStok) {
      const key = matchingStok.row ? `row_${matchingStok.row}_${matchingStok.tipe}` : `${matchingStok.kategori}_${matchingStok.nama}`.replace(/[^a-zA-Z0-9]/g, "")
      
      let rawStok = null
      if (store.unsavedChanges.hasOwnProperty(key)) {
        rawStok = store.unsavedChanges[key]
      } else {
        rawStok = matchingStok.stok
      }
      
      let stok = parseNum(rawStok)
      let awal = parseNum(matchingStok.awal)
      let topup = parseNum(matchingStok.topup)
      
      let isUnfilled = (rawStok === null || rawStok === undefined || String(rawStok).trim() === '')
      if (isUnfilled && stok === 0) {
        terjualHariIni = 0; // Belum diisi, anggap 0 supaya tidak langsung merah
      } else {
        terjualHariIni = (awal + topup) - stok;
      }
    }
    
    return {
      ...item,
      terjualHariIni,
      isAnomali: Math.abs(terjualHariIni - item.rataRata) >= Math.max(2, item.rataRata * 0.5)
    }
  })
  
  const anomaliSaja = combinedData.filter(d => d.isAnomali)
  return anomaliSaja.sort((a, b) => b.terjualHariIni - a.terjualHariIni)
})

const getAnomaliColor = (item) => {
  if (!item.isAnomali) return 'bg-light';
  if (item.terjualHariIni > item.rataRata) return 'bg-danger text-white shadow-sm';
  return 'bg-warning text-dark shadow-sm';
}

const bukaAnalisis = () => {
  if (modalAnalisisInstance) modalAnalisisInstance.show()
  // if empty, try fetching again
  if (analisisData.value.length === 0) fetchAnalisis()
}

const fetchInfoPusat = async (isManualRefresh = false) => {
  if (!store.user.store) return
  const res = await callApi('getInfoPusat', { toko: store.user.store }, { forceRefresh: isManualRefresh })
  if (res && res.success) {
    dashboardData.value.info = res.data.info || 'Belum ada info pusat'
    store.setDashboardCache(dashboardData.value)
  }
}

const fetchDashboard = async (isManualRefresh = false) => {
  if (!store.user.store) return
  
  const fetchStokNeeded = isManualRefresh || !store.stockCache || store.stockCache.length === 0

  // Jika perlu memuat data stok (atau user memaksa refresh), muat sekarang.
  if (fetchStokNeeded) {
    const resStok = await callApi('getStok', { toko: store.user.store }, { forceRefresh: isManualRefresh })
    
    if (resStok && resStok.success) {
      const formatted = resStok.data.map((item, index) => {
        const n = (item.nama || "").toLowerCase()
        const k = (item.kategori || "").toLowerCase()
        let typeFixed = item.tipe || 'barang'
        
        if (n.includes('bendelan') || k === 'uang' || typeFixed === 'info') {
          typeFixed = 'info'
        } else if (n.includes('saldo') || n.includes('listrik') || k === 'elektrik') {
          typeFixed = 'saldo'
        } else if (k === 'pengeluaran') {
          typeFixed = 'uang'
        }
        
        return {
          ...item,
          row: item.row || (index + 2),
          tipe: typeFixed
        }
      })
      store.setStockCache(formatted)
    }
    
    // Fetch info running text
    await fetchInfoPusat(isManualRefresh)
  }
}

const refreshAll = async () => {
  refreshing.value = true
  await fetchDashboard(true)
  // Menghapus emits('refresh-stock') agar tombol refresh di Home murni HANYA trigger frontend
  setTimeout(() => {
    refreshing.value = false
  }, 500)
}

const submitAbsen = async (jenis = 'Masuk') => {
  if (jenis === 'Masuk') loadingAbsenMasuk.value = true
  else loadingAbsenPulang.value = true

  const payload = {
    nama: store.user.name,
    toko: store.user.store,
    jenis: jenis,
    lat: 0,
    long: 0,
    fotoBase64: '',
    ket: 'Absen Tanpa GPS (Vue PWA)'
  }

  const res = await callApi('simpanAbsensi', payload)
  
  if (jenis === 'Masuk') loadingAbsenMasuk.value = false
  else loadingAbsenPulang.value = false

  if (res.success) {
    Swal.fire({
      icon: 'success',
      title: 'Berhasil',
      text: res.msg,
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      if (jenis === 'Masuk') {
        const now = new Date()
        const jam = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        store.setStatus({
          sudahMasuk: true,
          jamMasuk: jam
        })
        fetchDashboard(true)
        emits('refresh-stock')
      } else {
        store.logout()
      }
    })
  } else {
    Swal.fire('Gagal', res.msg || 'Gagal menyimpan absensi.', 'error')
  }
}

onMounted(() => {
  if (typeof bootstrap !== 'undefined' && modalAnalisisRef.value) {
    modalAnalisisInstance = new bootstrap.Modal(modalAnalisisRef.value)
  }
  fetchDashboard(false)
  fetchAnalisis()
})

defineExpose({
  refreshAll,
  fetchAnalisis,
  fetchInfoPusat
})
</script>

<style scoped>
.card-hero {
  background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%); 
  overflow: hidden;
  position: relative;
}

.circle-bg {
  width: 200px; 
  height: 200px;
}

.style-marquee {
  width: 100%;
}

.btn-refresh {
  width: 38px; 
  height: 38px; 
  backdrop-filter: blur(5px);
}

.avatar-circle {
  width: 55px; 
  height: 55px;
}

.btn-absen-submit {
  background: linear-gradient(to right, #198754, #20c997); 
  border: none;
}

.btn-absen-submit:active {
  transform: scale(0.98);
}
</style>
