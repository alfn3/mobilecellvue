<template>
  <div class="page-section animate-fade pb-5">
    <div class="card border-0 shadow-sm text-white mb-3 card-header-profile">
      <div class="card-body text-center p-4">
        <div class="bg-white text-primary rounded-circle mx-auto d-flex align-items-center justify-content-center shadow mb-3 avatar-circle">
          {{ userInitial }}
        </div>
        <h5 class="fw-bold mb-0">{{ store.user.name }}</h5>
        <p class="small opacity-75 mb-0">{{ store.user.email || 'Karyawan' }}</p>
      </div>
    </div>

    <div class="container px-3 mt-n30">
      <div class="card border-0 shadow-sm rounded-4 mb-3 bg-white text-dark">
        <div class="card-body p-3">
          <h6 class="fw-bold text-muted small mb-3">DETAIL PEKERJAAN</h6>
          
          <div class="d-flex align-items-center mb-3">
            <div class="bg-light rounded-circle p-2 me-3 text-primary"><i class="fa-solid fa-shop"></i></div>
            <div>
              <div class="small text-muted">Lokasi Konter</div>
              <div class="fw-bold text-dark">{{ store.user.store || '-' }}</div>
            </div>
          </div>

          <div class="d-flex align-items-center mb-3">
            <div class="bg-light rounded-circle p-2 me-3 text-warning"><i class="fa-solid fa-clock"></i></div>
            <div>
              <div class="small text-muted">Shift Kerja</div>
              <div class="fw-bold text-dark">{{ store.user.shift || '-' }}</div>
            </div>
          </div>

          <div class="d-flex align-items-center mb-3">
            <div class="bg-light rounded-circle p-2 me-3 text-success"><i class="fa-solid fa-fingerprint"></i></div>
            <div>
              <div class="small text-muted">Status Absen</div>
              <div class="fw-bold" :class="store.status.isAbsen ? 'text-success' : 'text-danger'">
                {{ store.status.isAbsen ? 'Sudah Masuk' : 'Belum Absen' }}
              </div>
            </div>
          </div>

          <div v-if="store.status.isAbsen && store.status.jamMasuk !== '-'" class="d-flex align-items-center mb-4">
            <div class="bg-light rounded-circle p-2 me-3 text-info"><i class="fa-regular fa-clock"></i></div>
            <div>
              <div class="small text-muted">Waktu Masuk</div>
              <div class="fw-bold text-primary fs-5">{{ store.status.jamMasuk }} WIB</div>
            </div>
          </div>

          <button class="btn btn-light w-100 rounded-pill py-2 border mb-2 btn-action" @click="handleGantiSandi">
            <i class="fa-solid fa-key me-2 text-warning"></i> Atur Kata Sandi
          </button>

          <button class="btn btn-outline-danger w-100 rounded-pill py-2 fw-bold shadow-sm mb-4 btn-action" @click="handleLogout">
            <i class="fa-solid fa-right-from-bracket me-2"></i> KELUAR APLIKASI
          </button>
        </div>
      </div>

      <div class="text-center text-muted small mb-5 mt-4">
        <p class="mb-0">Versi Aplikasi 1.4.0 (Vue PWA)</p>
        <p>&copy; 2026 Karyawan App</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { store } from '../store'
import { callApi } from '../services/api'
import Swal from 'sweetalert2'

const userInitial = computed(() => {
  return store.user.name ? store.user.name.charAt(0).toUpperCase() : 'U'
})

const handleGantiSandi = () => {
  Swal.fire({
    title: 'Ganti Kata Sandi',
    html: `
      <input type="password" id="oldPass" class="form-control mb-2 rounded-pill px-3" placeholder="Kata Sandi Lama">
      <input type="password" id="newPass" class="form-control mb-2 rounded-pill px-3" placeholder="Kata Sandi Baru">
      <input type="password" id="confirmPass" class="form-control rounded-pill px-3" placeholder="Konfirmasi Sandi Baru">
    `,
    showCancelButton: true,
    confirmButtonText: 'Update Sandi',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#0d6efd',
    preConfirm: () => {
      const oldP = document.getElementById('oldPass').value
      const newP = document.getElementById('newPass').value
      const confP = document.getElementById('confirmPass').value
      
      if (!oldP || !newP || !confP) {
        Swal.showValidationMessage('Semua kolom wajib diisi!')
        return false
      }
      if (newP !== confP) {
        Swal.showValidationMessage('Konfirmasi sandi tidak cocok!')
        return false
      }
      if (newP.length < 4) {
        Swal.showValidationMessage('Sandi baru minimal 4 karakter!')
        return false
      }
      return { oldP, newP }
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() })
      
      const res = await callApi('gantiKataSandi', {
        email: store.user.email,
        sandiLama: result.value.oldP,
        sandiBaru: result.value.newP
      })
      Swal.close()

      if (res.success) {
        Swal.fire('Sukses', res.msg, 'success')
      } else {
        Swal.fire('Gagal', res.msg, 'error')
      }
    }
  })
}

const handleLogout = () => {
  Swal.fire({
    title: 'Keluar Aplikasi?',
    text: "Anda harus login kembali untuk masuk.",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#dc3545',
    confirmButtonText: 'Ya, Keluar',
    cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
      store.logout()
    }
  })
}
</script>

<style scoped>
.card-header-profile {
  background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%); 
  border-radius: 0 0 25px 25px;
}

.avatar-circle {
  width: 70px; 
  height: 70px; 
  font-size: 2rem; 
  font-weight: bold;
}

.mt-n30 {
  margin-top: -30px;
}

.btn-action {
  transition: transform 0.15s ease-in-out;
}

.btn-action:active {
  transform: scale(0.98);
}
</style>
