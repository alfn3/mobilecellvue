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
          <div class="small fw-bold opacity-75 clock-text">{{ digitalClock }}</div>
        </div>
      </nav>

      <!-- Main Content Area -->
      <main class="container-fluid main-content">
        <HomeView 
          v-show="currentTab === 'home'" 
          @refresh-stock="triggerStockRefresh" 
        />
        <StokView 
          v-show="currentTab === 'stok'" 
          ref="stokViewRef" 
        />
        <AkunView 
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
            <i class="fa-solid fa-fingerprint fs-4"></i>
            <span>Absen</span>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { store } from './store'
import LoginView from './views/LoginView.vue'
import HomeView from './views/HomeView.vue'
import StokView from './views/StokView.vue'
import AkunView from './views/AkunView.vue'

const currentTab = ref('home')
const digitalClock = ref('00:00')
const stokViewRef = ref(null)

let clockInterval = null

const isNotLoggedIn = computed(() => {
  // Check if store user email is a placeholder/empty
  return !store.user.email || store.user.name === 'Guest'
})

const updateClock = () => {
  const d = new Date()
  digitalClock.value = d.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const navTo = (tab) => {
  if (tab === 'stok' && !store.status.isAbsen) {
    return // Block access to stock if not checked-in
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
