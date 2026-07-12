import { reactive, computed } from 'vue'

export const store = reactive({
  user: {
    name: localStorage.getItem('USER_NAME') || 'Guest',
    store: localStorage.getItem('STORE_NAME') || '',
    shift: localStorage.getItem('USER_SHIFT') || '',
    email: localStorage.getItem('USER_EMAIL') || ''
  },
  status: {
    isAbsen: localStorage.getItem('IS_ABSEN') === 'true',
    jamMasuk: localStorage.getItem('JAM_MASUK') || '-'
  },
  stockCache: [],
  unsavedChanges: {},
  
  // Actions
  setUser(user) {
    this.user.name = user.nama || user.name || 'Guest';
    this.user.store = user.konter || user.store || '';
    this.user.shift = user.shift || '';
    this.user.email = user.email || '';
    
    localStorage.setItem('USER_NAME', this.user.name);
    localStorage.setItem('STORE_NAME', this.user.store);
    localStorage.setItem('USER_SHIFT', this.user.shift);
    localStorage.setItem('USER_EMAIL', this.user.email);
  },
  
  setStatus(status) {
    this.status.isAbsen = status.sudahMasuk !== undefined ? status.sudahMasuk : status.isAbsen;
    this.status.jamMasuk = status.jamMasuk || '-';
    
    localStorage.setItem('IS_ABSEN', this.status.isAbsen ? 'true' : 'false');
    localStorage.setItem('JAM_MASUK', this.status.jamMasuk);
  },
  
  setStockCache(stocks) {
    this.stockCache = stocks;
  },
  
  updateStockValue(key, value) {
    this.unsavedChanges[key] = value;
  },
  
  removeUnsavedChange(key) {
    delete this.unsavedChanges[key];
  },
  
  clearUnsavedChanges() {
    this.unsavedChanges = {};
  },
  
  logout() {
    this.user = { name: 'Guest', store: '', shift: '', email: '' };
    this.status = { isAbsen: false, jamMasuk: '-' };
    this.stockCache = [];
    this.unsavedChanges = {};
    
    localStorage.removeItem('USER_NAME');
    localStorage.removeItem('STORE_NAME');
    localStorage.removeItem('USER_SHIFT');
    localStorage.removeItem('USER_EMAIL');
    localStorage.removeItem('IS_ABSEN');
    localStorage.removeItem('JAM_MASUK');
  }
})

// Computed properties for easy changes tracking
export const changedKeys = computed(() => {
  return Object.keys(store.unsavedChanges);
})
