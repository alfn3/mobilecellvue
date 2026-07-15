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
        >
          <i class="fa-solid fa-right-to-bracket me-2"></i> ABSEN MASUK
        </button>
      </div>
    </div>

    <!-- Dashboard Panel (If checked-in) -->
    <div v-else class="animate-fade">
      <div class="row g-2 mb-4">
        <div class="col-12">
          <div class="card border-0 shadow-sm rounded-4 bg-white">
            <div class="card-body p-3 d-flex justify-content-between align-items-center">
              <div>
                <div class="text-muted small text-uppercase fw-bold mb-1" style="font-size:0.65rem;">Total Penjualan</div>
                <div v-if="refreshing" class="placeholder-glow" style="width: 120px; height: 38px; display: flex; align-items: center;">
                  <span class="placeholder col-8 rounded bg-primary opacity-25" style="height: 1.8rem;"></span>
                </div>
                <h3 v-else class="fw-bold text-primary mb-0">{{ dashboardData.penjualan }}</h3>
              </div>
              <div class="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style="width: 48px; height: 48px; font-size: 1.2rem;">
                <i class="fa-solid fa-sack-dollar"></i>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-6">
          <div class="card border-0 shadow-sm rounded-4 bg-white h-100">
            <div class="card-body p-3">
              <span class="text-muted small fw-bold" style="font-size:0.65rem;">PENGELUARAN</span>
              <div v-if="refreshing" class="placeholder-glow mt-1" style="width: 85px; height: 24px; display: flex; align-items: center;">
                <span class="placeholder col-10 rounded bg-danger opacity-25" style="height: 1.1rem;"></span>
              </div>
              <h6 v-else class="fw-bold text-danger mb-0 mt-1">{{ dashboardData.pengeluaran }}</h6>
            </div>
          </div>
        </div>
        
        <div class="col-6">
          <div class="card border-0 shadow-sm rounded-4 bg-white h-100">
            <div class="card-body p-3">
              <span class="text-muted small fw-bold" style="font-size:0.65rem;">BERSIH / SELISIH</span>
              <div v-if="refreshing" class="placeholder-glow mt-1" style="width: 85px; height: 24px; display: flex; align-items: center;">
                <span class="placeholder col-10 rounded bg-success opacity-25" style="height: 1.1rem;"></span>
              </div>
              <h6 v-else :class="selisihClass" class="fw-bold mb-0 mt-1">{{ dashboardData.selisih }}</h6>
            </div>
          </div>
        </div>
      </div>
      
      <button 
        class="btn btn-danger w-100 rounded-4 py-3 shadow-sm border-0 mt-3 btn-pulang-submit"
        @click="submitAbsen('Pulang')"
      >
        <i class="fa-solid fa-person-walking-arrow-right me-2"></i> ABSEN PULANG
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
const dashboardData = ref({
  penjualan: 'Rp 0',
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

const selisihClass = computed(() => {
  const raw = parseInt(String(dashboardData.value.selisih).replace(/[^0-9-]/g, '')) || 0
  if (raw < 0) return 'text-danger'
  if (raw > 0) return 'text-primary'
  return 'text-success'
})

const fetchDashboard = async () => {
  if (!store.user.store) return
  
  const res = await callApi('getDashboardSummary', { toko: store.user.store })
  if (res.success) {
    dashboardData.value = {
      penjualan: res.data.penjualan || 'Rp 0',
      pengeluaran: res.data.pengeluaran || 'Rp 0',
      selisih: res.data.selisih || 'Rp 0',
      info: res.data.info || 'Selamat Bekerja, Semangat!'
    }
  }
}

const refreshAll = async () => {
  refreshing.value = true
  await fetchDashboard()
  if (store.status.isAbsen) {
    emits('refresh-stock')
  }
  setTimeout(() => {
    refreshing.value = false
  }, 1000)
}

const submitAbsen = async (jenis = 'Masuk') => {
  Swal.fire({
    title: 'Mencatat Kehadiran...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  })

  // Mock location for simplification matching original logic
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
  Swal.close()

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
        fetchDashboard()
        emits('refresh-stock')
      } else {
        // Pulang -> logout
        store.logout()
      }
    })
  } else {
    Swal.fire('Gagal', res.msg || 'Gagal menyimpan absensi.', 'error')
  }
}

onMounted(() => {
  fetchDashboard()
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
