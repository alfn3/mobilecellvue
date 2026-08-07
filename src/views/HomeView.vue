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
          <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
            <!-- Gradient Header (Total Penjualan) -->
            <div class="position-relative p-4 overflow-hidden" style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);">
              <!-- Abstract Circles -->
              <div class="position-absolute top-0 end-0 bg-black rounded-circle" style="width: 120px; height: 120px; transform: translate(30%, -30%); opacity: 0.2;"></div>
              <div class="position-absolute bottom-0 start-0 bg-black rounded-circle" style="width: 80px; height: 80px; transform: translate(-30%, 30%); opacity: 0.2;"></div>
              
              <div class="position-relative z-1 d-flex justify-content-between align-items-center">
                <div>
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <span class="text-white text-opacity-75 small text-uppercase fw-bold" style="font-size:0.7rem; letter-spacing: 0.5px;">Total Penjualan</span>
                    <span class="badge bg-white bg-opacity-25 text-white border border-white border-opacity-25 rounded-pill px-2 py-1" style="font-size: 0.55rem;">HARI INI</span>
                  </div>
                  <div v-if="refreshing" class="placeholder-glow mt-2" style="width: 140px; height: 38px; display: flex; align-items: center;">
                    <span class="placeholder col-10 rounded bg-white opacity-25" style="height: 2rem;"></span>
                  </div>
                  <h2 v-else class="fw-bold text-white mb-0 mt-1" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.15);">{{ dashboardData.penjualan }}</h2>
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
                <div class="col-6 border-end border-light">
                  <span class="text-muted small fw-bold" style="font-size:0.65rem;">KAS DI LACI</span>
                  <div v-if="refreshing" class="placeholder-glow mt-1" style="width: 85px; height: 24px; display: flex; align-items: center;">
                    <span class="placeholder col-10 rounded bg-success opacity-25" style="height: 1.1rem;"></span>
                  </div>
                  <h6 v-else class="fw-bold text-dark mb-0 mt-1">{{ displayKasDiLaci }}</h6>
                </div>
                
                <!-- Bersih / Selisih -->
                <div class="col-6 ps-3">
                  <span class="text-muted small fw-bold" style="font-size:0.65rem;">BERSIH / SELISIH</span>
                  <div v-if="refreshing" class="placeholder-glow mt-1" style="width: 85px; height: 24px; display: flex; align-items: center;">
                    <span class="placeholder col-10 rounded bg-success opacity-25" style="height: 1.1rem;"></span>
                  </div>
                  <h6 v-else :class="selisihClass" class="fw-bold mb-0 mt-1">{{ dashboardData.selisih }}</h6>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <button 
        class="btn btn-danger w-100 rounded-4 py-3 shadow-sm border-0 mt-3"
        @click="submitAbsen('Pulang')"
        :disabled="loadingAbsenPulang"
        style="background: linear-gradient(to right, #dc3545, #ff6b6b);"
      >
        <span v-if="loadingAbsenPulang" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        <i v-else class="fa-solid fa-person-walking-arrow-right me-2"></i> 
        {{ loadingAbsenPulang ? 'Memverifikasi..' : 'ABSEN PULANG' }}
      </button>
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

const totalUangCash = computed(() => {
  if (!store.stockCache || store.stockCache.length === 0) return null
  const cashItems = store.stockCache.filter(item => item.tipe === 'info')
  if (cashItems.length === 0) return null
  
  let total = 0
  cashItems.forEach(item => {
    const key = item.row ? `row_${item.row}_${item.tipe}` : `${item.kategori}_${item.nama}`.replace(/[^a-zA-Z0-9]/g, "")
    let val = 0
    if (store.unsavedChanges.hasOwnProperty(key)) {
      val = parseInt(store.unsavedChanges[key]) || 0
    } else {
      const clean = String(item.harga || 0).replace(/[^0-9-]/g, '')
      val = parseInt(clean) || 0
    }
    total += val
  })
  return total
})

const displayKasDiLaci = computed(() => {
  if (totalUangCash.value !== null) {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(totalUangCash.value)
  }
  return dashboardData.value.kasDiLaci
})

const selisihClass = computed(() => {
  const raw = parseInt(String(dashboardData.value.selisih).replace(/[^0-9-]/g, '')) || 0
  if (raw < 0) return 'text-danger'
  if (raw > 0) return 'text-primary'
  return 'text-success'
})

const fetchDashboard = async (isManualRefresh = false) => {
  if (!store.user.store) return
  
  // Eksekusi paralel concurrent requests untuk memotong latency hingga 50%!
  const fetchStokNeeded = !store.stockCache || store.stockCache.length === 0 || isManualRefresh

  const [resSummary, resStok] = await Promise.all([
    callApi('getDashboardSummary', { toko: store.user.store }, { forceRefresh: isManualRefresh }),
    fetchStokNeeded ? callApi('getStok', { toko: store.user.store }, { forceRefresh: isManualRefresh }) : Promise.resolve(null)
  ])

  if (resSummary && resSummary.success) {
    const newData = {
      penjualan: resSummary.data.penjualan || 'Rp 0',
      kasDiLaci: resSummary.data.kasDiLaci || 'Rp 0',
      pengeluaran: resSummary.data.pengeluaran || 'Rp 0',
      selisih: resSummary.data.selisih || 'Rp 0',
      info: resSummary.data.info || 'Selamat Bekerja, Semangat!'
    }
    dashboardData.value = newData
    store.setDashboardCache(newData)
  }

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
}

const refreshAll = async () => {
  refreshing.value = true
  await fetchDashboard(true)
  if (store.status.isAbsen) {
    emits('refresh-stock')
  }
  setTimeout(() => {
    refreshing.value = false
  }, 800)
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
  fetchDashboard(false)
})

defineExpose({
  refreshAll
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
