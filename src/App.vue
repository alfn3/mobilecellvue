<template>
  <div class="app-container">
    <!-- Login Screen -->
    <LoginView v-if="isNotLoggedIn" />

    <!-- Main Application -->
    <template v-else>
      <!-- Top Fixed Navbar -->
      <nav class="navbar fixed-top bg-primary shadow-sm text-white navbar-custom">
        <div class="container-fluid d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            <i class="fa-solid fa-layer-group fs-4"></i>
            <span class="fw-bold fs-5">MobileCell</span>
          </div>
          <div class="small fw-bold opacity-75 clock-text d-flex gap-2 align-items-center">
            <span>{{ currentDateStr }}</span>
            <span class="opacity-50">&bull;</span>
            <span>{{ digitalClock }}</span>
          </div>
        </div>
      </nav>

      <!-- Main Content Area -->
      <main class="container-fluid main-content">
        <HomeView 
          v-if="homeMounted"
          v-show="currentTab === 'home'" 
          @refresh-stock="triggerStockRefresh" 
        />
        <StokView 
          v-if="stokMounted"
          v-show="currentTab === 'stok' || currentTab === 'pengeluaran' || currentTab === 'uangcash'" 
          :active-tab="currentTab"
          ref="stokViewRef" 
        />
        <AkunView 
          v-if="akunMounted"
          v-show="currentTab === 'akun'" 
        />
      </main>

      <!-- Bottom Fixed Navbar -->
      <nav class="navbar fixed-bottom bg-white border-top shadow-lg bottom-navbar-custom">
        <div class="container-fluid d-flex justify-content-around h-100 align-items-center">
          <button 
            class="nav-item-mobile btn-reset" 
            :class="{ active: currentTab === 'home' }" 
            @click="navTo('home')"
          >
            <i class="fa-solid fa-house fs-4"></i>
            <span>Home</span>
          </button>
          
          <button 
            class="nav-item-mobile btn-reset" 
            :class="{ active: currentTab === 'stok' }" 
            :disabled="!store.status.isAbsen"
            :style="{ 
              opacity: store.status.isAbsen ? '1' : '0.5', 
              pointerEvents: store.status.isAbsen ? 'auto' : 'none' 
            }"
            @click="navTo('stok')"
          >
            <i class="fa-solid fs-4" :class="store.status.isAbsen ? 'fa-box-open' : 'fa-lock'"></i>
            <span>Stok</span>
          </button>

          <button 
            class="nav-item-mobile btn-reset" 
            :class="{ active: currentTab === 'pengeluaran' }" 
            :disabled="!store.status.isAbsen"
            :style="{ 
              opacity: store.status.isAbsen ? '1' : '0.5', 
              pointerEvents: store.status.isAbsen ? 'auto' : 'none' 
            }"
            @click="navTo('pengeluaran')"
          >
            <i class="fa-solid fs-4" :class="store.status.isAbsen ? 'fa-wallet' : 'fa-lock'"></i>
            <span>Pengeluaran</span>
          </button>

          <button 
            class="nav-item-mobile btn-reset" 
            :class="{ active: currentTab === 'uangcash' }" 
            :disabled="!store.status.isAbsen"
            :style="{ 
              opacity: store.status.isAbsen ? '1' : '0.5', 
              pointerEvents: store.status.isAbsen ? 'auto' : 'none' 
            }"
            @click="navTo('uangcash')"
          >
            <i class="fa-solid fs-4" :class="store.status.isAbsen ? 'fa-money-bill-wave' : 'fa-lock'"></i>
            <span>Uang Cash</span>
          </button>
          
          <button 
            class="nav-item-mobile btn-reset" 
            :class="{ active: currentTab === 'akun' }" 
            @click="navTo('akun')"
          >
            <i class="fa-solid fa-user fs-4"></i>
            <span>Akun</span>
          </button>
        </div>
      </nav>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { store } from './store'
import Swal from 'sweetalert2'

const LoginView = defineAsyncComponent(() => import('./views/LoginView.vue'))
const HomeView  = defineAsyncComponent(() => import('./views/HomeView.vue'))
const StokView  = defineAsyncComponent(() => import('./views/StokView.vue'))
const AkunView  = defineAsyncComponent(() => import('./views/AkunView.vue'))

const currentTab = ref('home')
const digitalClock = ref('00:00')
const stokViewRef = ref(null)

// Lazy mount flags: komponen hanya di-mount saat pertama dikunjungi
const homeMounted = ref(true)   // home adalah tab default, langsung mount
const stokMounted = ref(false)  // mount saat pertama buka stok/pengeluaran/uangcash
const akunMounted = ref(false)  // mount saat pertama buka akun

let clockInterval = null

const currentDateStr = computed(() => {
  return new Date().toLocaleDateString('id-ID', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short' 
  })
})

const isNotLoggedIn = computed(() => {
  // Check if store user email is a placeholder/empty
  return !store.user.email || store.user.name === 'Guest'
})

const checkDayChange = () => {
  if (isNotLoggedIn.value) return
  
  const lastLoginDate = localStorage.getItem('LOGIN_DATE')
  if (!lastLoginDate) return
  
  const today = new Date().toDateString()
  if (lastLoginDate !== today) {
    store.logout()
    Swal.fire({
      icon: 'info',
      title: 'Sesi Berakhir',
      text: 'Hari telah berganti. Sesi Anda telah berakhir dan sistem otomatis log out.',
      confirmButtonText: 'OK',
      allowOutsideClick: false
    }).then(() => {
      location.reload()
    })
  }
}

const updateClock = () => {
  const d = new Date()
  digitalClock.value = d.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
  checkDayChange()
}

const navTo = (tab) => {
  if ((tab === 'stok' || tab === 'pengeluaran' || tab === 'uangcash') && !store.status.isAbsen) {
    return // Block access if not checked-in
  }
  // Set lazy mount flag saat pertama dikunjungi
  if (tab === 'stok' || tab === 'pengeluaran' || tab === 'uangcash') {
    stokMounted.value = true
  } else if (tab === 'akun') {
    akunMounted.value = true
  }
  currentTab.value = tab
}

const triggerStockRefresh = () => {
  if (stokViewRef.value) {
    stokViewRef.value.loadStock()
  }
}

onMounted(() => {
  updateClock()
  clockInterval = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})
</script>

<style scoped>
.navbar-custom {
  padding-top: calc(env(safe-area-inset-top) + 0.5rem);
}

.main-content {
  padding-top: 70px; 
  padding-bottom: 90px;
}

.bottom-navbar-custom {
  height: 70px; 
  padding-bottom: env(safe-area-inset-bottom); 
  z-index: 1040;
}

.clock-text {
  font-family: monospace;
  font-size: 0.95rem;
}
</style>
