<template>
  <div class="position-fixed top-0 start-0 w-100 h-100 bg-white d-flex align-items-center justify-content-center" style="z-index: 1040;">
    <div class="container-fluid px-2 px-sm-4" style="max-width:420px;">
      <div class="text-center mb-4">
        <div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 80px; height: 80px;">
          <i class="fa-solid fa-layer-group fs-1"></i>
        </div>
        <h2 class="fw-bold">MobileCell</h2>
        <p class="text-muted">Silakan login untuk memulai shift</p>
      </div>
      
      <div class="card border-0 shadow-sm rounded-4 p-2 bg-white">
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label small fw-bold">Email</label>
            <input 
              type="email" 
              v-model="email" 
              class="form-control rounded-pill px-3" 
              placeholder="nama@email.com"
              @keyup.enter="handleLogin"
            >
          </div>
          <div class="mb-4">
            <label class="form-label small fw-bold">Password</label>
            <input 
              type="password" 
              v-model="password" 
              class="form-control rounded-pill px-3" 
              placeholder="••••••••"
              @keyup.enter="handleLogin"
            >
          </div>
          <button 
            class="btn btn-primary w-100 rounded-pill py-2 fw-bold" 
            :disabled="loading"
            @click="handleLogin"
          >
            <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            MASUK
          </button>
        </div>
      </div>
      <div class="text-center mt-4 small text-muted">
        Versi 1.4.0 (Vue PWA) &bull; 2026
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { callApi } from '../services/api'
import { store } from '../store'
import Swal from 'sweetalert2'

const email = ref('')
const password = ref('')
const loading = ref(false)

const handleLogin = async () => {
  if (!email.value || !password.value) {
    Swal.fire('Input Kosong', 'Email dan Password wajib diisi!', 'warning')
    return
  }
  
  loading.value = true
  Swal.fire({
    title: 'Memverifikasi...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  })
  
  const res = await callApi('login', { 
    email: email.value.trim(), 
    password: password.value.trim() 
  })
  
  loading.value = false
  Swal.close()
  
  if (res.success) {
    store.setUser({
      nama: res.data.user.nama,
      konter: res.data.user.konter,
      shift: res.data.user.shift,
      email: email.value.trim()
    })
    
    // Save target location (lat/long radius) if needed
    if (res.data.target) {
      localStorage.setItem('TARGET_LOCATION', JSON.stringify(res.data.target))
    }
    
    store.setStatus({
      sudahMasuk: res.data.status.sudahMasuk,
      jamMasuk: res.data.status.jamMasuk
    })
    
    Swal.fire({
      icon: 'success',
      title: 'Login Sukses',
      text: res.msg,
      timer: 1500,
      showConfirmButton: false
    })
  } else {
    Swal.fire('Gagal Login', res.msg || 'Terjadi kesalahan sistem.', 'error')
  }
}
</script>

<style scoped>
.card {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05) !important;
}
</style>
