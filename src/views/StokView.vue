<template>
  <div class="page-section animate-fade">
    <div class="sticky-top bg-light pb-2 sticky-header">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h5 class="fw-bold mb-0 text-dark">Data Stok</h5>
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
            class="btn btn-filter shadow-sm rounded-circle border d-flex align-items-center justify-content-center" 
            :class="isHideZero ? 'btn-primary text-white' : 'btn-light text-muted'"
            @click="isHideZero = !isHideZero"
            style="width: 42px; height: 42px; transition: all 0.2s ease-in-out;"
          >
            <i class="fa-solid" :class="isHideZero ? 'fa-eye-slash' : 'fa-layer-group'"></i>
          </button>
        </div>
      </div>

      <!-- Categories Tabs -->
      <div class="d-flex gap-2 overflow-auto pb-1 no-scrollbar mb-2">
        <button 
          v-for="cat in categories" 
          :key="cat.id"
          class="btn btn-xs rounded-pill px-3 filter-kat"
          :class="currentKat === cat.id ? 'btn-dark' : 'btn-white border'"
          @click="currentKat = cat.id"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- Stock Content -->
    <div class="row g-2 pb-5 mt-2">
      <!-- Add Expense Button (Only when category is Pengeluaran) -->
      <div v-if="currentKat === 'Pengeluaran'" class="col-12 mb-3">
        <button 
          class="btn btn-outline-danger w-100 border-2 border-dashed rounded-4 py-2 fw-bold" 
          @click="handleTambahPengeluaran"
        >
          <i class="fa-solid fa-plus me-2"></i> Tambah Pengeluaran
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="col-12 text-center py-5">
        <div class="spinner-border text-primary"></div>
        <div class="text-muted mt-2 small">Memuat data...</div>
      </div>

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
              <div class="text-end text-nowrap">
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
                <div class="box-info box-awal cursor-pointer" @click="openModalLapor(item, 'Awal', item.awal)">
                  <span class="label-tiny">AWAL</span>
                  <span class="val-tiny">{{ item.awal }}</span>
                </div>
              </div>
              <div class="col-3">
                <div class="box-info box-topup cursor-pointer" @click="openModalLapor(item, 'Topup', item.topup)">
                  <span class="label-tiny">TOPUP</span>
                  <span class="val-tiny">+{{ item.topup }}</span>
                </div>
              </div>
              <div class="col-6 ps-2">
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
              <div class="text-end text-nowrap">
                <div class="small text-muted fw-bold" style="font-size: 0.65rem;">Nominal Terjual</div>
                <div class="fw-bold text-success" style="font-size: 0.75rem;">
                  {{ formatRp(getTerjualSaldo(item)) }}
                </div>
              </div>
            </div>
            <div class="row g-1 align-items-end">
              <div class="col-3">
                <div class="box-info box-awal cursor-pointer" @click="openModalLapor(item, 'Awal', item.awal)">
                  <span class="label-tiny">AWAL</span>
                  <span class="val-tiny">{{ formatRp(getNumericValue(item.awal)) }}</span>
                </div>
              </div>
              <div class="col-3">
                <div class="box-info box-topup cursor-pointer" @click="openModalLapor(item, 'Topup', item.topup)">
                  <span class="label-tiny">TOPUP</span>
                  <span class="val-tiny">+{{ formatRp(getNumericValue(item.topup)) }}</span>
                </div>
              </div>
              <div class="col-6 ps-2">
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
            v-else-if="item.tipe === 'info'" 
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

    <!-- Floating Action Button (FAB) -->
    <div 
      v-if="changedCount > 0" 
      class="fab-container" 
      @click="saveBatch"
    >
      <button class="btn-fab"><i class="fa-solid fa-floppy-disk"></i></button>
      <div class="fab-badge">{{ changedCount }}</div>
    </div>

    <!-- Modal Lapor (Bootstrap style implemented reactively) -->
    <div 
      class="modal fade" 
      :class="{ show: showLaporModal, 'd-block': showLaporModal }" 
      tabindex="-1" 
      style="background: rgba(0,0,0,0.5);"
      v-if="showLaporModal"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow rounded-4">
          <div class="modal-header bg-warning bg-gradient text-dark py-2">
             <h6 class="modal-title fw-bold small">Lapor Selisih / Topup</h6>
             <button type="button" class="btn-close" @click="showLaporModal = false"></button>
          </div>
          <div class="modal-body bg-light text-dark">
             <div>
                <div class="alert alert-white border shadow-sm py-2 px-3 mb-3 bg-white">
                   <div class="fw-bold text-dark">{{ laporData.item.nama }}</div>
                   <div class="d-flex mt-1 small">
                      <span>Data Sistem ({{ laporData.field }}): <b>{{ laporData.sysVal }}</b></span>
                   </div>
                </div>
                
                <div class="mb-2">
                   <label class="form-label small fw-bold">Jumlah Real / Fisik</label>
                   <input type="number" class="form-control" v-model="laporData.realVal" placeholder="0">
                </div>
             </div>
          </div>
          <div class="modal-footer py-1 bg-white">
             <button type="button" class="btn btn-sm btn-warning w-100 fw-bold shadow-sm" @click="submitLaporan">Kirim Laporan</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { store, changedKeys } from '../store'
import { callApi } from '../services/api'
import Swal from 'sweetalert2'

const loading = ref(false)
const searchQuery = ref('')
const isHideZero = ref(false)
const currentKat = ref('Semua')

// Modal Lapor State
const showLaporModal = ref(false)
const laporData = ref({
  item: null,
  field: '',
  sysVal: '',
  realVal: ''
})

const categories = [
  { id: 'Semua', label: 'Semua' },
  { id: 'Perdana', label: 'Perdana' },
  { id: 'Voucher', label: 'Voucher' },
  { id: 'Aksesoris', label: 'Acc' },
  { id: 'Elektrik', label: 'Elektrik' },
  { id: 'Pengeluaran', label: 'Pengeluaran' },
  { id: 'Uang', label: 'Uang Cash' }
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
      const matchCat = (currentKat.value === 'Semua') || 
                       (item.kategori === currentKat.value) || 
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
  laporData.value = {
    item,
    field,
    sysVal,
    realVal: ''
  }
  showLaporModal.value = true
}

const submitLaporan = async () => {
  if (!laporData.value.realVal) {
    Swal.fire('Info', 'Isi nilai sebenarnya terlebih dahulu.', 'warning')
    return
  }
  
  showLaporModal.value = false
  
  const payload = {
    user: store.user.name,
    toko: store.user.store,
    kategori: laporData.value.item.kategori,
    nama: laporData.value.item.nama,
    brand: laporData.value.item.brand || '',
    tipeMasalah: laporData.value.field,
    nilaiLama: laporData.value.sysVal,
    nilaiBaru: laporData.value.realVal,
    ket: 'Dikirim dari Vue PWA'
  }
  
  Swal.fire({ title: 'Mengirim Laporan...', didOpen: () => Swal.showLoading() })
  const res = await callApi('simpanLaporanSalah', payload)
  Swal.close()
  
  if (res.success) {
    Swal.fire('Terkirim', 'Laporan berhasil dikirim.', 'success')
  } else {
    Swal.fire('Gagal', res.msg || 'Gagal mengirim laporan.', 'error')
  }
}

// Pengeluaran Actions (tambah, edit, hapus)
const handleTambahPengeluaran = () => {
  Swal.fire({
    title: 'Tambah Pengeluaran',
    html: `
      <input type="number" id="peng_nom" class="form-control mb-2" placeholder="Nominal (Rp)">
      <input type="text" id="peng_ket" class="form-control" placeholder="Keterangan">
    `,
    showCancelButton: true,
    confirmButtonText: 'Simpan',
    cancelButtonText: 'Batal',
    focusConfirm: false,
    preConfirm: () => {
      const nominal = document.getElementById('peng_nom').value
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
      <input type="number" id="edit_peng_nom" class="form-control mb-2" value="${price}">
      <input type="text" id="edit_peng_ket" class="form-control" value="${item.nama}">
    `,
    showCancelButton: true,
    confirmButtonText: 'Update',
    cancelButtonText: 'Batal',
    preConfirm: () => {
      const nominal = document.getElementById('edit_peng_nom').value
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
  flex: 0 0 auto;
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
</style>
