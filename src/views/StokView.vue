<template>
  <div class="page-section animate-fade">
    <div class="sticky-top bg-light pb-2 sticky-header">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h5 class="fw-bold mb-0 text-dark">
          {{ activeTab === 'pengeluaran' ? 'Data Pengeluaran' : (activeTab === 'uangcash' ? 'Uang Cash' : 'Data Stok') }}
        </h5>
        <div class="d-flex gap-2 align-items-center">
          <span class="badge bg-primary rounded-pill px-3 py-2">
            <i class="fa-solid fa-shop me-1"></i> {{ store.user.store }}
          </span>
          <button 
            class="btn btn-light rounded-circle border shadow-sm btn-refresh-stok"
            @click="loadStock"
            :disabled="loading"
          >
            <i class="fa-solid fa-arrows-rotate text-primary" :class="{ 'fa-spin': loading }"></i>
          </button>
        </div>
      </div>
      
      <!-- Search & Filters -->
      <div class="d-flex align-items-center gap-2 px-1 mb-3">
        <div class="position-relative shadow-sm rounded-pill bg-white flex-grow-1">
          <input 
            type="text" 
            class="form-control rounded-pill border-0 py-2 ps-4 pe-5" 
            v-model="searchQuery" 
            placeholder="Cari barang..."
          >
          <i class="fa-solid fa-magnifying-glass position-absolute top-50 end-0 translate-middle-y me-3 text-muted"></i>
        </div>
        <div>
          <button 
            class="btn btn-filter shadow-sm rounded-pill border d-flex align-items-center gap-1.5 px-3 fw-bold btn-sm" 
            :class="isHideZero ? 'btn-primary text-white' : 'btn-light text-muted'"
            @click="isHideZero = !isHideZero"
            style="height: 38px; font-size: 0.75rem; white-space: nowrap; transition: all 0.2s ease-in-out;"
          >
            <i class="fa-solid" :class="isHideZero ? 'fa-eye-slash' : 'fa-eye'"></i>
            <span>{{ isHideZero ? 'Sembunyikan Kosong' : 'Tampilkan Semua' }}</span>
          </button>
        </div>
      </div>

      <!-- Categories Tabs -->
      <div v-if="activeTab === 'stok'" class="d-flex gap-2 w-100 pb-1 mb-2">
        <button 
          v-for="cat in categories" 
          :key="cat.id"
          class="btn btn-xs rounded-pill px-2 filter-kat flex-fill"
          :class="currentKat === cat.id ? 'btn-dark' : 'btn-white border'"
          @click="currentKat = cat.id"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- Stock Content -->
    <div class="row g-2 pb-5 mt-2">
      <!-- Loading State (Skeleton Loaders) -->
      <template v-if="loading">
        <div v-for="i in 5" :key="i" class="col-12 mb-2">
          <!-- Skeleton Barang / Saldo -->
          <div v-if="currentKat !== 'Pengeluaran' && currentKat !== 'Uang'" class="card-stok-mini placeholder-glow border-start border-3" style="border-left-color: #dee2e6 !important;">
            <div class="d-flex justify-content-between mb-2">
              <div style="width: 70%;">
                <span class="placeholder col-8 rounded mb-1" style="height: 1.1rem; display: block;"></span>
                <div class="mt-2 d-flex gap-1">
                  <span class="placeholder col-4 rounded" style="height: 0.8rem;"></span>
                  <span class="placeholder col-3 rounded" style="height: 0.8rem;"></span>
                </div>
              </div>
              <div style="width: 25%; text-align: right;">
                <span class="placeholder col-6 rounded mb-1" style="height: 0.8rem; display: inline-block;"></span>
                <span class="placeholder col-10 rounded mt-1" style="height: 1rem; display: inline-block;"></span>
              </div>
            </div>
            <div class="row g-1 mt-3">
              <div class="col-3">
                <div class="placeholder rounded" style="height: 35px; width: 100%;"></div>
              </div>
              <div class="col-3">
                <div class="placeholder rounded" style="height: 35px; width: 100%;"></div>
              </div>
              <div class="col-6 ps-2">
                <div class="placeholder rounded" style="height: 35px; width: 100%;"></div>
              </div>
            </div>
          </div>

          <!-- Skeleton Pengeluaran -->
          <div v-else-if="currentKat === 'Pengeluaran'" class="card border-0 shadow-sm rounded-4 placeholder-glow" style="background: #e9ecef; min-height: 90px;">
            <div class="card-body p-3 d-flex justify-content-between align-items-center">
              <div style="width: 60%;">
                <span class="placeholder col-8 rounded mb-2" style="height: 1rem; display: block;"></span>
                <div class="d-flex gap-3 mt-2">
                  <span class="placeholder col-2 rounded" style="height: 0.8rem;"></span>
                  <span class="placeholder col-2 rounded" style="height: 0.8rem;"></span>
                </div>
              </div>
              <div style="width: 40%; text-align: right;">
                <span class="placeholder col-8 rounded" style="height: 1.5rem; display: inline-block;"></span>
              </div>
            </div>
          </div>

          <!-- Skeleton Uang Cash -->
          <div v-else-if="currentKat === 'Uang'" class="card border-0 shadow-sm rounded-4 placeholder-glow" style="background: #e9ecef; min-height: 55px;">
            <div class="card-body p-3 d-flex justify-content-between align-items-center">
              <div style="width: 50%;">
                <span class="placeholder col-10 rounded" style="height: 0.9rem; display: block;"></span>
              </div>
              <div style="width: 40%; text-align: right;">
                <span class="placeholder col-8 rounded" style="height: 1.2rem; display: inline-block;"></span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Empty State -->
      <div v-else-if="filteredStock.length === 0" class="col-12 text-center py-5 text-muted small">
        Data tidak ditemukan.
      </div>

      <!-- Render Stock Cards -->
      <template v-else>
        <div 
          v-for="item in filteredStock" 
          :key="getItemKey(item)" 
          class="col-12"
        >
          <!-- 1. Card Barang (Perdana, Voucher, Aksesoris) -->
          <div 
            v-if="item.tipe === 'barang'" 
            class="card-stok-mini" 
            :style="{ borderLeftColor: getProviderColor(item.brand) }"
          >
            <div class="d-flex justify-content-between mb-2">
              <div class="overflow-hidden pe-2">
                <div class="stok-title">{{ item.nama }}</div>
                <div class="mt-1 d-flex align-items-center flex-wrap gap-1">
                  <span 
                    class="badge text-white rounded-pill" 
                    :style="{ backgroundColor: getProviderColor(item.brand) }"
                    style="font-size: 0.6rem;"
                  >
                    {{ item.brand || 'Umum' }}
                  </span>
                  <span v-if="getNumericValue(item.harga) > 0" class="badge bg-success bg-opacity-75" style="font-size: 0.6rem;">
                    {{ formatRp(getNumericValue(item.harga)) }}
                  </span>
                </div>
              </div>
              <div class="text-end text-nowrap" v-show="getTerjualBarang(item) > 0">
                <div class="small text-muted fw-bold" style="font-size: 0.85rem;">
                  Terjual: <span class="text-dark">{{ getTerjualBarang(item) }}</span>
                </div>
                <div class="fw-bold text-success" style="font-size: 0.95rem;">
                  {{ formatRp(getTerjualBarang(item) * getNumericValue(item.harga)) }}
                </div>
              </div>
            </div>
            <div class="row g-1 align-items-end">
              <div class="col-3">
                <div 
                  class="box-info box-awal cursor-pointer" 
                  :class="{ 'reported-error': item.awalReported }"
                  @click="openModalLapor(item, 'Awal', item.awal)"
                >
                  <span class="label-tiny">
                    AWAL 
                    <span v-if="item.awalReported" class="text-danger fw-bold ms-1" style="font-size:0.65rem;">
                      ⚠️{{ item.awalReportedVal }}
                    </span>
                  </span>
                  <span class="val-tiny">{{ item.awal }}</span>
                </div>
              </div>
              <div class="col-3">
                <div 
                  class="box-info box-topup cursor-pointer" 
                  :class="{ 'reported-error': item.topupReported }"
                  @click="openModalLapor(item, 'Topup', item.topup)"
                >
                  <span class="label-tiny">
                    TOPUP 
                    <span v-if="item.topupReported" class="text-danger fw-bold ms-1" style="font-size:0.65rem;">
                      ⚠️{{ item.topupReportedVal }}
                    </span>
                  </span>
                  <span class="val-tiny">+{{ item.topup }}</span>
                </div>
              </div>
              <div class="col-6 ps-2">
                <span class="label-tiny text-secondary fw-semibold mb-1 d-block text-end pe-1">SISA</span>
                <input 
                  type="number" 
                  class="input-sisa-mini" 
                  :value="getLocalValue(item)"
                  @input="handleInputBarang(item, $event)"
                  placeholder="0"
                >
              </div>
            </div>
          </div>

          <!-- 2. Card Saldo (Elektrik) -->
          <div 
            v-else-if="item.tipe === 'saldo'" 
            class="card-stok-mini" 
            :style="{ borderLeftColor: getProviderColor(item.brand || 'Elektrik') }"
          >
            <div class="d-flex justify-content-between mb-2">
              <div class="overflow-hidden pe-2">
                <div class="stok-title">{{ item.nama }}</div>
                <div class="mt-1">
                  <span class="badge bg-secondary text-white rounded-pill" style="font-size: 0.6rem;">Elektrik</span>
                </div>
              </div>
              <div class="text-end text-nowrap" v-show="getTerjualSaldo(item) > 0">
                <div class="small text-muted fw-bold" style="font-size: 0.65rem;">Nominal Terjual</div>
                <div class="fw-bold text-success" style="font-size: 0.75rem;">
                  {{ formatRp(getTerjualSaldo(item)) }}
                </div>
              </div>
            </div>
            <div class="row g-1 align-items-end">
              <div class="col-3">
                <div 
                  class="box-info box-awal cursor-pointer" 
                  :class="{ 'reported-error': item.awalReported }"
                  @click="openModalLapor(item, 'Awal', item.awal)"
                >
                  <span class="label-tiny">
                    AWAL 
                    <span v-if="item.awalReported" class="text-danger fw-bold ms-1" style="font-size:0.6rem;">
                      ⚠️{{ formatRp(item.awalReportedVal) }}
                    </span>
                  </span>
                  <span class="val-tiny">{{ formatRp(getNumericValue(item.awal)) }}</span>
                </div>
              </div>
              <div class="col-3">
                <div 
                  class="box-info box-topup cursor-pointer" 
                  :class="{ 'reported-error': item.topupReported }"
                  @click="openModalLapor(item, 'Topup', item.topup)"
                >
                  <span class="label-tiny">
                    TOPUP 
                    <span v-if="item.topupReported" class="text-danger fw-bold ms-1" style="font-size:0.6rem;">
                      ⚠️{{ formatRp(item.topupReportedVal) }}
                    </span>
                  </span>
                  <span class="val-tiny">+{{ formatRp(getNumericValue(item.topup)) }}</span>
                </div>
              </div>
              <div class="col-6 ps-2">
                <span class="label-tiny text-secondary fw-semibold mb-1 d-block text-end pe-1">SISA</span>
                <input 
                  type="text" 
                  inputmode="numeric" 
                  class="input-sisa-mini" 
                  :value="formatRp(getLocalValue(item))"
                  @input="handleInputMoney(item, $event)"
                >
              </div>
            </div>
          </div>

          <!-- 3. Card Uang Cash (Info) -->
          <div 
            v-else-if="item.tipe === 'info' && isCashVisible(item)" 
            class="card border-0 shadow-sm rounded-4 position-relative overflow-hidden mb-2 card-money"
            :class="getMoneyCfg(item).text || 'text-white'"
            :style="{ background: getMoneyCfg(item).grad }"
          >
            <i class="fa-solid position-absolute money-bg-icon" :class="[getMoneyCfg(item).icon]" style="right:-10px; bottom:-10px; font-size:3.5rem; opacity:0.2;"></i>
            <div class="card-body p-3 d-flex justify-content-between align-items-center z-1">
              <div style="width: 55%">
                <h6 class="text-uppercase fw-bold mb-0" style="font-size: 0.85rem;">{{ getMoneyCfg(item).label }}</h6>
              </div>
              <div style="width: 45%">
                <input 
                  type="text" 
                  inputmode="numeric" 
                  class="form-control bg-transparent border-0 p-0 fw-bold text-end input-money-flat"
                  :class="getMoneyCfg(item).text || 'text-white'"
                  :value="formatRp(getLocalValue(item))"
                  @input="handleInputMoney(item, $event)"
                >
              </div>
            </div>
          </div>

          <!-- 4. Card Pengeluaran (Uang) -->
          <div 
            v-else-if="item.tipe === 'uang'" 
            class="card border-0 shadow-sm rounded-4 text-white mb-2" 
            style="background: linear-gradient(135deg, #cb2d3e, #ef473a); min-height: 90px;"
          >
            <div class="card-body p-3 d-flex justify-content-between align-items-center">
              <div style="width: 60%">
                <h6 class="fw-bold mb-1" style="font-size: 0.9rem;">{{ item.nama }}</h6>
                <div class="d-flex gap-3 mt-2">
                  <i class="fa-solid fa-pen-to-square text-white opacity-75 cursor-pointer" @click="handleEditPengeluaran(item)"></i>
                  <i class="fa-solid fa-trash text-white opacity-75 cursor-pointer" @click="handleHapusPengeluaran(item)"></i>
                </div>
              </div>
              <div style="width: 40%">
                <input 
                  type="text" 
                  class="form-control bg-transparent border-0 p-0 fw-bold text-end text-white" 
                  :value="formatRp(getLocalValue(item))"
                  readonly 
                  style="font-size: 1.3rem;"
                >
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Add Cash Denomination Button (Only when activeTab is 'uangcash') -->
    <div v-if="activeTab === 'uangcash' && hiddenCashItems.length > 0" class="col-12 text-center mt-2 mb-4 animate-fade">
      <button 
        class="btn btn-outline-primary rounded-pill px-4 py-2 small shadow-sm fw-bold border-2"
        @click="showAddCashModal"
      >
        <i class="fa-solid fa-plus me-1"></i> Tambah Kolom Uang
      </button>
    </div>

    <!-- Floating Action Button (FAB) -->
    <div 
      v-if="changedCount > 0" 
      class="fab-container" 
      @click="saveBatch"
    >
      <button class="btn-fab"><i class="fa-solid fa-floppy-disk"></i></button>
      <div class="fab-badge">{{ changedCount }}</div>
    </div>

    <!-- Floating Action Button (FAB) for Tambah Pengeluaran -->
    <div 
      v-if="activeTab === 'pengeluaran'" 
      class="fab-add-expense" 
      :class="{ 'shifted': changedCount > 0 }"
      @click="handleTambahPengeluaran"
    >
      <button class="btn-fab bg-warning text-dark">
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { store, changedKeys } from '../store'
import { callApi } from '../services/api'
import Swal from 'sweetalert2'

const props = defineProps({
  activeTab: {
    type: String,
    default: 'stok'
  }
})

const loading = ref(false)
const searchQuery = ref('')
const isHideZero = ref(false)
const currentKat = ref('Perdana')

watch(() => props.activeTab, (newTab) => {
  if (newTab === 'pengeluaran') {
    currentKat.value = 'Pengeluaran'
  } else if (newTab === 'uangcash') {
    currentKat.value = 'Uang'
  } else {
    if (currentKat.value === 'Pengeluaran' || currentKat.value === 'Uang') {
      currentKat.value = 'Perdana'
    }
  }
}, { immediate: true })

const categories = [
  { id: 'Perdana', label: 'Perdana' },
  { id: 'Voucher', label: 'Voucher' },
  { id: 'Aksesoris', label: 'Acc' },
  { id: 'Elektrik', label: 'Elektrik' }
]

const moneyColors = [
  { label: "BENDEL JUTAAN",  grad: "linear-gradient(135deg, #ff0844 0%, #ffb199 100%)", icon: "fa-money-bill-1-wave" },
  { label: "BENDEL PULUHAN", grad: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", icon: "fa-money-bill" },
  { label: "BENDEL RIBUAN",  grad: "linear-gradient(135deg, #868f96 0%, #596164 100%)", icon: "fa-money-bills" },
  { label: "KOIN",           grad: "linear-gradient(135deg, #f09819 0%, #edde5d 100%)", icon: "fa-coins", text: "text-dark" },
  { label: "SISA RATUSAN",   grad: "linear-gradient(135deg, #009efd 0%, #2af598 100%)", icon: "fa-sack-dollar" },
  { label: "SISA PULUHAN",   grad: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)", icon: "fa-wallet", text: "text-dark" },
  { label: "SISA RIBUAN",    grad: "linear-gradient(135deg, #868f96 0%, #596164 100%)", icon: "fa-piggy-bank", text: "text-dark" },
  { label: "SISA LAIN 1",    grad: "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)", icon: "fa-hand-holding-dollar", text: "text-dark" },
  { label: "SISA LAIN 2",    grad: "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)", icon: "fa-comment-dollar", text: "text-dark" },
  { label: "SISA LAIN 3",    grad: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)", icon: "fa-circle-dollar-to-slot", text: "text-dark" }
]

const changedCount = computed(() => changedKeys.value.length)

const filteredStock = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  
  return store.stockCache.filter(item => {
    // 1. Filter Category
    if (currentKat.value === 'Pengeluaran') {
      if (item.tipe !== 'uang') return false
    } else if (currentKat.value === 'Uang') {
      if (item.tipe !== 'info') return false
    } else {
      const matchCat = (item.kategori === currentKat.value) || 
                       (item.grup === currentKat.value)
      if (!matchCat) return false
    }
    
    // 2. Filter Search Query
    const matchSearch = item.nama.toLowerCase().includes(q)
    if (!matchSearch) return false
    
    // 3. Filter Zero Stock Toggles
    if (isHideZero.value && item.tipe === 'barang') {
      const awalVal = getNumericValue(item.awal)
      const topupVal = getNumericValue(item.topup)
      const sisaVal = getNumericValue(item.stok)
      if (awalVal <= 0 && topupVal <= 0 && sisaVal <= 0) return false
    }
    
    return true
  })
})

const getItemKey = (item) => {
  return item.row ? `row_${item.row}_${item.tipe}` : `${item.kategori}_${item.nama}`.replace(/[^a-zA-Z0-9]/g, "")
}

const getLocalValue = (item) => {
  const key = getItemKey(item)
  if (store.unsavedChanges.hasOwnProperty(key)) {
    return store.unsavedChanges[key]
  }
  const rawStr = String(item.tipe === 'barang' || item.tipe === 'saldo' ? item.stok : item.harga)
  return getNumericValue(rawStr)
}

const getNumericValue = (val) => {
  if (val === undefined || val === null) return 0
  const clean = String(val).replace(/[^0-9-]/g, '')
  return parseInt(clean) || 0
}

const getTerjualBarang = (item) => {
  const awal = getNumericValue(item.awal)
  const topup = getNumericValue(item.topup)
  const sisa = getLocalValue(item)
  return (awal + topup) - sisa
}

const getTerjualSaldo = (item) => {
  const awal = getNumericValue(item.awal)
  const topup = getNumericValue(item.topup)
  const sisa = getLocalValue(item)
  return (awal + topup) - sisa
}

const revealedCash = ref([])

const isCashVisible = (item) => {
  const localVal = getLocalValue(item)
  if (getNumericValue(localVal) > 0) return true
  
  const cfg = getMoneyCfg(item)
  if (revealedCash.value.includes(cfg.label)) return true
  
  return false
}

const hiddenCashItems = computed(() => {
  if (props.activeTab !== 'uangcash') return []
  return store.stockCache.filter(item => {
    if (item.tipe !== 'info') return false
    return !isCashVisible(item)
  })
})

const showAddCashModal = () => {
  const inputOptions = {}
  hiddenCashItems.value.forEach(item => {
    const cfg = getMoneyCfg(item)
    inputOptions[cfg.label] = cfg.label
  })

  Swal.fire({
    title: 'Tambah Kolom Uang Cash',
    input: 'select',
    inputOptions: inputOptions,
    inputPlaceholder: 'Pilih denominasi...',
    showCancelButton: true,
    confirmButtonText: 'Tampilkan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#0d6efd',
    customClass: {
      popup: 'rounded-4 border-0 shadow-lg',
      confirmButton: 'btn btn-primary fw-bold px-3 py-2 rounded-3 me-2',
      cancelButton: 'btn btn-secondary fw-bold px-3 py-2 rounded-3'
    },
    inputValidator: (value) => {
      if (!value) {
        return 'Anda harus memilih salah satu'
      }
    }
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      revealedCash.value.push(result.value)
    }
  })
}

const getMoneyCfg = (item) => {
  return moneyColors[item.urut] || { grad: "linear-gradient(135deg,#555,#777)", icon: "fa-wallet", label: item.nama }
}

const getProviderColor = (brand) => {
  if (!brand) return '#6c757d'
  const b = brand.toLowerCase()
  if (b.includes('telkomsel') || b.includes('simpati') || b.includes('as')) return '#dc3545'
  if (b.includes('indosat') || b.includes('im3')) return '#fd7e14'
  if (b.includes('xl')) return '#0d6efd'
  if (b.includes('axis')) return '#6f42c1'
  if (b.includes('smartfren')) return '#e83e8c'
  if (b.includes('tri') || b.includes('three')) return '#212529'
  return '#6c757d'
}

const formatRp = (num) => {
  const isNeg = num < 0
  const absNum = Math.abs(num)
  const formatted = 'Rp ' + new Intl.NumberFormat('id-ID').format(absNum)
  return isNeg ? '- ' + formatted : formatted
}

const handleInputBarang = (item, event) => {
  const key = getItemKey(item)
  const val = parseInt(event.target.value) || 0
  store.updateStockValue(key, val)
}

const handleInputMoney = (item, event) => {
  const key = getItemKey(item)
  let num = parseInt(event.target.value.replace(/\D/g, '')) || 0
  if (event.target.value.includes('-')) num = -num
  store.updateStockValue(key, num)
}

// Fetch Stock
const loadStock = async () => {
  if (!store.user.store) return
  loading.value = true
  
  const res = await callApi('getStok', { toko: store.user.store })
  loading.value = false
  
  if (res.success) {
    revealedCash.value = []
    const formatted = res.data.map((item, index) => {
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
  } else {
    Swal.fire('Gagal Load Stok', res.msg || 'Terjadi kesalahan.', 'error')
  }
}

// Save Changes
const saveBatch = () => {
  if (changedCount.value === 0) return
  
  let itemsToUpdate = []
  changedKeys.value.forEach(key => {
    const item = store.stockCache.find(i => getItemKey(i) === key)
    if (item) {
      itemsToUpdate.push({
        nama: item.nama,
        kategori: item.kategori,
        row: item.row,
        stokBaru: store.unsavedChanges[key],
        tipe: item.tipe
      })
    }
  })

  Swal.fire({
    title: 'Simpan Data?',
    text: `Menyimpan ${changedCount.value} perubahan ke server`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ya, Simpan',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() })
      
      const res = await callApi('batchUpdateStok', {
        toko: store.user.store,
        user: store.user.name,
        items: itemsToUpdate
      })
      Swal.close()

      if (res.success) {
        store.clearUnsavedChanges()
        await loadStock()
        Swal.fire('Sukses', res.msg, 'success')
      } else {
        Swal.fire('Gagal', res.msg || 'Gagal menyimpan data.', 'error')
      }
    }
  })
}

// Lapor Modal Actions
const openModalLapor = (item, field, sysVal) => {
  const isAwal = field === 'Awal'
  const isReported = isAwal ? item.awalReported : item.topupReported
  const isSaldo = item.tipe === 'saldo'
  
  if (isReported) {
    const reportedVal = isAwal ? item.awalReportedVal : item.topupReportedVal
    const logRow = isAwal ? item.awalReportedRow : item.topupReportedRow
    const reportedSys = isAwal ? item.awalReportedSys : item.topupReportedSys
    
    Swal.fire({
      title: `<span class="fw-bold" style="font-family: 'Outfit', sans-serif; color: #dc3545; font-size: 1.05rem;">Laporan Selisih Stok</span>`,
      html: `
        <div class="text-start" style="font-family: 'Inter', sans-serif; font-size: 0.78rem;">
          <div class="card border-0 shadow-sm mb-2 rounded-3" style="background: linear-gradient(135deg, #fff5f5 0%, #fff 100%); border-left: 4px solid #dc3545 !important;">
            <div class="card-body p-2.5">
              <h6 class="fw-bold text-dark mb-0.5" style="font-size: 0.85rem; line-height: 1.2;">${item.nama}</h6>
              <div class="text-muted mb-2" style="font-size: 0.7rem;">${item.brand && item.brand !== '-' ? item.brand : 'PWA'} (${item.kategori})</div>
              
              <div class="row g-1 text-center">
                <div class="col-6">
                  <div class="bg-white p-1.5 rounded-2 border">
                    <div class="text-secondary fw-semibold" style="font-size: 0.65rem;">Sistem</div>
                    <div class="fw-bold text-dark mt-0.5" style="font-size: 0.8rem;">
                      ${isSaldo ? formatRp(getNumericValue(sysVal)) : sysVal}
                    </div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="bg-white p-1.5 rounded-2 border border-danger bg-danger bg-opacity-10">
                    <div class="text-danger fw-semibold" style="font-size: 0.65rem;">Fisik Lapor</div>
                    <div class="fw-bold text-danger mt-0.5" style="font-size: 0.8rem;">
                      ⚠️ ${isSaldo ? formatRp(getNumericValue(reportedVal)) : reportedVal}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p class="text-center text-muted mb-0" style="font-size: 0.7rem;">Laporan sudah terkirim. Pilih tindakan:</p>
        </div>
      `,
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: '<i class="fa-solid fa-pen-to-square me-1"></i> Edit',
      denyButtonText: '<i class="fa-solid fa-trash me-1"></i> Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#0d6efd',
      denyButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      width: '320px',
      padding: '0.75rem',
      customClass: {
        popup: 'rounded-4 border-0 shadow-lg',
        confirmButton: 'btn btn-sm btn-primary fw-bold px-2 py-1.5 rounded-3 me-1 shadow-sm',
        denyButton: 'btn btn-sm btn-danger fw-bold px-2 py-1.5 rounded-3 me-1 shadow-sm',
        cancelButton: 'btn btn-sm btn-secondary fw-bold px-2 py-1.5 rounded-3'
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        // EDIT LAPORAN
        Swal.fire({
          title: `<span class="fw-bold" style="font-family: 'Outfit', sans-serif; color: #0d6efd; font-size: 1.05rem;">Revisi Nilai Fisik</span>`,
          input: 'number',
          inputValue: getNumericValue(reportedVal),
          inputLabel: 'Masukkan jumlah real fisik yang benar:',
          showCancelButton: true,
          confirmButtonText: 'Simpan',
          cancelButtonText: 'Batal',
          confirmButtonColor: '#0d6efd',
          cancelButtonColor: '#6c757d',
          width: '300px',
          padding: '0.75rem',
          customClass: {
            popup: 'rounded-4 border-0 shadow-lg',
            inputLabel: 'small text-secondary fw-semibold mb-1',
            input: 'form-control form-control-sm py-1.5 text-center',
            confirmButton: 'btn btn-sm btn-primary fw-bold px-3 py-1.5 rounded-3 shadow-sm me-2',
            cancelButton: 'btn btn-sm btn-secondary fw-bold px-3 py-1.5 rounded-3'
          },
          preConfirm: (value) => {
            if (value === '' || value === null) {
              Swal.showValidationMessage('Nilai wajib diisi')
              return false
            }
            return value
          }
        }).then(async (editResult) => {
          if (editResult.isConfirmed) {
            Swal.fire({ title: 'Mengubah Laporan...', didOpen: () => Swal.showLoading() })
            const displayNama = (item.brand && item.brand !== '-' && item.brand.toLowerCase() !== 'umum' && item.brand.toLowerCase() !== 'aksesoris') 
              ? (String(item.brand).toLowerCase().trim() + "-" + item.nama) 
              : item.nama
              
            const res = await callApi('editLaporanSalah', {
              row: logRow,
              toko: store.user.store,
              produk: displayNama,
              tipeMasalah: field,
              nilaiLama: reportedSys,
              nilaiBaru: isSaldo ? editResult.value : parseInt(editResult.value)
            })
            Swal.close()
            
            if (res.success) {
              Swal.fire('Sukses', 'Laporan berhasil diupdate!', 'success')
              loadStock() // Reload stock to refresh indicators
            } else {
              Swal.fire('Gagal', res.msg || 'Terjadi kesalahan.', 'error')
            }
          }
        })
      } else if (result.isDenied) {
        // HAPUS LAPORAN
        Swal.fire({
          title: 'Hapus Laporan?',
          text: 'Laporan kesalahan stok ini akan dibatalkan/dihapus dari log log.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#dc3545',
          confirmButtonText: 'Ya, Hapus',
          cancelButtonText: 'Batal',
          width: '300px',
          padding: '0.75rem',
          customClass: {
            popup: 'rounded-4 border-0 shadow-lg',
            confirmButton: 'btn btn-sm btn-danger fw-bold px-3 py-1.5 rounded-3 shadow-sm me-2',
            cancelButton: 'btn btn-sm btn-secondary fw-bold px-3 py-1.5 rounded-3'
          }
        }).then(async (confirmDelete) => {
          if (confirmDelete.isConfirmed) {
            Swal.fire({ title: 'Menghapus Laporan...', didOpen: () => Swal.showLoading() })
            const res = await callApi('hapusLaporanSalah', { row: logRow })
            Swal.close()
            
            if (res.success) {
              Swal.fire('Sukses', 'Laporan berhasil dihapus!', 'success')
              loadStock() // Reload stock to refresh indicators
            } else {
              Swal.fire('Gagal', res.msg || 'Terjadi kesalahan.', 'error')
            }
          }
        })
      }
    })
    return
  }

  // Jika belum dilaporkan, tampilkan modal KIRIM LAPORAN baru menggunakan SweetAlert2 agar konsisten!
  Swal.fire({
    title: `<span class="fw-bold" style="font-family: 'Outfit', sans-serif; color: #ffc107; font-size: 1.05rem;">Lapor Selisih / Topup</span>`,
    html: `
      <div class="text-start" style="font-family: 'Inter', sans-serif; font-size: 0.78rem;">
        <div class="card border-0 shadow-sm mb-2 rounded-3" style="background: linear-gradient(135deg, #fff9e6 0%, #fff 100%); border-left: 4px solid #ffc107 !important;">
          <div class="card-body p-2.5">
            <h6 class="fw-bold text-dark mb-0.5" style="font-size: 0.85rem; line-height: 1.2;">${item.nama}</h6>
            <div class="text-muted mb-2" style="font-size: 0.7rem;">${item.brand && item.brand !== '-' ? item.brand : 'PWA'} (${item.kategori})</div>
            
            <div class="d-flex justify-content-between align-items-center bg-white p-1.5 rounded-2 border">
              <span class="fw-semibold text-secondary" style="font-size: 0.7rem;">Tipe: <b>Selisih ${field}</b></span>
              <span class="badge bg-warning text-dark px-2 py-1 rounded-pill fw-bold" style="font-size: 0.65rem;">
                Sistem: ${isSaldo ? formatRp(getNumericValue(sysVal)) : sysVal}
              </span>
            </div>
          </div>
        </div>
        
        <div class="mb-1">
          <label class="form-label fw-bold text-secondary mb-1" style="font-size: 0.7rem;">Jumlah Real / Fisik Sebenarnya</label>
          <div class="input-group input-group-sm">
            <span class="input-group-text bg-light border-end-0 rounded-start-3" style="border-color:#dee2e6;"><i class="fa-solid fa-calculator text-muted"></i></span>
            <input type="number" id="swal_new_real_val" class="form-control border-start-0 rounded-end-3 py-1.5 text-center" style="border-color:#dee2e6; font-size: 0.85rem;" placeholder="0" autofocus>
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-paper-plane me-1"></i> Kirim',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#ffc107',
    cancelButtonColor: '#6c757d',
    width: '320px',
    padding: '0.75rem',
    customClass: {
      popup: 'rounded-4 border-0 shadow-lg',
      confirmButton: 'btn btn-sm btn-warning fw-bold px-3 py-1.5 rounded-3 text-dark shadow-sm me-2',
      cancelButton: 'btn btn-sm btn-secondary fw-bold px-3 py-1.5 rounded-3'
    },
    preConfirm: () => {
      const val = document.getElementById('swal_new_real_val').value
      if (val === '' || val === null) {
        Swal.showValidationMessage('Jumlah real/fisik wajib diisi')
        return false
      }
      return val
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      const payload = {
        user: store.user.name,
        toko: store.user.store,
        kategori: item.kategori,
        nama: item.nama,
        brand: item.brand || '',
        tipeMasalah: field,
        nilaiLama: sysVal,
        nilaiBaru: isSaldo ? result.value : parseInt(result.value),
        ket: 'Dikirim dari Vue PWA'
      }
      
      Swal.fire({ title: 'Mengirim Laporan...', didOpen: () => Swal.showLoading() })
      const res = await callApi('simpanLaporanSalah', payload)
      Swal.close()
      
      if (res.success) {
        Swal.fire('Terkirim', 'Laporan berhasil dikirim.', 'success')
        loadStock()
      } else {
        Swal.fire('Gagal', res.msg || 'Gagal mengirim laporan.', 'error')
      }
    }
  })
}

// Pengeluaran Actions (tambah, edit, hapus)
const handleTambahPengeluaran = () => {
  Swal.fire({
    title: 'Tambah Pengeluaran',
    html: `
      <input type="text" inputmode="numeric" id="peng_nom" class="form-control mb-2" placeholder="Nominal (Rp)">
      <input type="text" id="peng_ket" class="form-control" placeholder="Keterangan">
    `,
    showCancelButton: true,
    confirmButtonText: 'Simpan',
    cancelButtonText: 'Batal',
    focusConfirm: false,
    didOpen: () => {
      const input = document.getElementById('peng_nom')
      if (input) {
        input.addEventListener('input', (e) => {
          let value = e.target.value.replace(/\D/g, '')
          let num = parseInt(value) || 0
          e.target.value = num > 0 ? 'Rp ' + new Intl.NumberFormat('id-ID').format(num) : ''
        })
      }
    },
    preConfirm: () => {
      const valStr = document.getElementById('peng_nom').value
      const nominal = parseInt(valStr.replace(/\D/g, '')) || 0
      const ket = document.getElementById('peng_ket').value
      if (!nominal || !ket) {
        Swal.showValidationMessage('Nominal dan keterangan wajib diisi')
        return false
      }
      return { nominal, ket }
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() })
      const res = await callApi('tambahPengeluaran', {
        toko: store.user.store,
        nominal: result.value.nominal,
        ket: result.value.ket
      })
      Swal.close()

      if (res.success) {
        await loadStock()
        Swal.fire('Sukses', 'Pengeluaran berhasil ditambahkan.', 'success')
      } else {
        Swal.fire('Gagal', res.msg || 'Gagal menyimpan.', 'error')
      }
    }
  })
}

const handleEditPengeluaran = (item) => {
  const price = getNumericValue(item.harga)
  
  Swal.fire({
    title: 'Edit Pengeluaran',
    html: `
      <input type="text" inputmode="numeric" id="edit_peng_nom" class="form-control mb-2" value="${price}">
      <input type="text" id="edit_peng_ket" class="form-control" value="${item.nama}">
    `,
    showCancelButton: true,
    confirmButtonText: 'Update',
    cancelButtonText: 'Batal',
    didOpen: () => {
      const input = document.getElementById('edit_peng_nom')
      if (input) {
        // Format initial value
        let val = input.value.replace(/\D/g, '')
        let n = parseInt(val) || 0
        input.value = n > 0 ? 'Rp ' + new Intl.NumberFormat('id-ID').format(n) : ''

        input.addEventListener('input', (e) => {
          let value = e.target.value.replace(/\D/g, '')
          let num = parseInt(value) || 0
          e.target.value = num > 0 ? 'Rp ' + new Intl.NumberFormat('id-ID').format(num) : ''
        })
      }
    },
    preConfirm: () => {
      const valStr = document.getElementById('edit_peng_nom').value
      const nominal = parseInt(valStr.replace(/\D/g, '')) || 0
      const ket = document.getElementById('edit_peng_ket').value
      if (!nominal || !ket) {
        Swal.showValidationMessage('Nominal dan keterangan wajib diisi')
        return false
      }
      return { nominal, ket }
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: 'Mengupdate...', didOpen: () => Swal.showLoading() })
      const res = await callApi('editPengeluaran', {
        toko: store.user.store,
        row: item.row,
        nominal: result.value.nominal,
        ket: result.value.ket
      })
      Swal.close()

      if (res.success) {
        await loadStock()
        Swal.fire('Sukses', 'Pengeluaran diperbarui.', 'success')
      } else {
        Swal.fire('Gagal', res.msg || 'Gagal mengupdate.', 'error')
      }
    }
  })
}

const handleHapusPengeluaran = (item) => {
  Swal.fire({
    title: `Hapus ${item.nama}?`,
    text: 'Data yang dihapus tidak dapat dikembalikan.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading() })
      const res = await callApi('hapusPengeluaran', {
        toko: store.user.store,
        row: item.row
      })
      Swal.close()

      if (res.success) {
        await loadStock()
        Swal.fire('Terhapus', 'Pengeluaran telah dihapus.', 'success')
      } else {
        Swal.fire('Gagal', res.msg || 'Gagal menghapus.', 'error')
      }
    }
  })
}

onMounted(() => {
  if (store.stockCache.length === 0) {
    loadStock()
  }
})

defineExpose({
  loadStock
})
</script>

<style scoped>
.sticky-header {
  top: 55px; 
  z-index: 5;
}

.filter-kat {
  font-size: 0.75rem;
  flex: 1 1 0%;
}

.card-stok-mini { 
  border: 1px solid #e9ecef; 
  border-left: 4px solid var(--primary-color); 
  background: #ffffff; 
  border-radius: 10px; 
  margin-bottom: 6px; 
  padding: 10px 12px; 
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  color: #333;
}

.stok-title { 
  font-size: 0.85rem; 
  font-weight: 600; 
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  color: #343a40;
}

.box-info { 
  border-radius: 6px; 
  text-align: center; 
  font-size: 0.7rem; 
  padding: 4px;
}

.box-awal {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  color: #495057;
}

.box-topup {
  background-color: #d1e7dd;
  border: 1px solid #badbcc;
  color: #0f5132;
}

.label-tiny { 
  font-size: 0.55rem;
  display: block;
}

.val-tiny { 
  font-weight: bold; 
  font-size: 0.85rem; 
}

.input-sisa-mini { 
  width: 100%; 
  text-align: right; 
  font-weight: bold; 
  border-radius: 6px; 
  font-size: 0.95rem; 
  height: 34px; 
  padding: 0 10px;
  border: 1px solid #ced4da;
  background-color: #f8f9fa;
  color: #212529;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.input-sisa-mini:focus {
  background-color: #fff;
  border-color: #86b7fe;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.fab-container { 
  position: fixed; 
  bottom: 85px; 
  right: 15px; 
  z-index: 1050; 
}

.btn-fab { 
  width: 55px; 
  height: 55px; 
  border-radius: 50%; 
  background: #0d6efd; 
  color: white; 
  border: none; 
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: transform 0.2s;
}

.btn-fab:active {
  transform: scale(0.9);
}

.fab-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background-color: #dc3545;
  color: white;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
  border: 2px solid white;
}

.card-money {
  min-height: 90px;
}

.money-bg-icon {
  z-index: 0;
}

.input-money-flat {
  font-size: 1.3rem;
}

.input-money-flat:focus {
  background: transparent;
  box-shadow: none;
  outline: 0;
}

.modal.show {
  display: block;
}

.box-info.reported-error {
  border: 1px solid #dc3545 !important;
  background-color: #f8d7da !important;
  color: #842029 !important;
}

.fab-add-expense {
  position: fixed;
  bottom: 85px;
  right: 15px;
  z-index: 1045;
  transition: bottom 0.2s ease-in-out;
}

.fab-add-expense.shifted {
  bottom: 155px;
}
</style>
