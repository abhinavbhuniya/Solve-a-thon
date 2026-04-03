// ── Chota Dhobi — Main Entry Point ──
import './styles/index.css';
import { registerRoute, initRouter } from './router.js';
import { getCurrentUser, isStaff } from './services/database.js';
import { updateNavActive } from './components/nav.js';

// ── Import Pages ──
import loginPage from './pages/login.js';
import studentHome from './pages/student-home.js';
import studentSubmit from './pages/student-submit.js';
import studentTrack from './pages/student-track.js';
import studentNotifications from './pages/student-notifications.js';
import staffHome from './pages/staff-home.js';
import staffUpdate from './pages/staff-update.js';
import staffOrders from './pages/staff-orders.js';

// ── Register Routes ──
registerRoute('/login', loginPage);
registerRoute('/student', studentHome);
registerRoute('/student/submit', studentSubmit);
registerRoute('/student/track', studentTrack);
registerRoute('/student/track/:id', studentTrack);
registerRoute('/student/notifications', studentNotifications);
registerRoute('/staff', staffHome);
registerRoute('/staff/update', staffUpdate);
registerRoute('/staff/orders', staffOrders);

// ── Auth Guard ──
function checkAuth() {
  const user = getCurrentUser();
  const hash = window.location.hash;
  
  if (!user && hash !== '#/login' && hash !== '') {
    window.location.hash = '#/login';
    return;
  }
  
  if (user && (hash === '#/login' || hash === '' || hash === '#/')) {
    window.location.hash = isStaff() ? '#/staff' : '#/student';
    return;
  }

  // Prevent cross-domain navigation
  if (user && isStaff() && hash.startsWith('#/student')) {
    window.location.hash = '#/staff';
    return;
  }

  if (user && !isStaff() && hash.startsWith('#/staff')) {
    window.location.hash = '#/student';
    return;
  }
}

// ── Offline Detection ──
function setupOfflineDetection() {
  const bar = document.getElementById('offline-bar');
  
  function updateStatus() {
    if (navigator.onLine) {
      bar?.classList.add('hidden');
    } else {
      bar?.classList.remove('hidden');
    }
  }
  
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

// ── Theme Setup ──
function setupTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const iconDark = toggleBtn?.querySelector('.icon-dark');
  const iconLight = toggleBtn?.querySelector('.icon-light');
  
  // Initialize from storage or default to dark
  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  if (currentTheme === 'light') {
    iconDark?.classList.add('hidden-icon');
    iconLight?.classList.remove('hidden-icon');
  } else {
    iconLight?.classList.add('hidden-icon');
    iconDark?.classList.remove('hidden-icon');
  }

  toggleBtn?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'light') {
      iconDark?.classList.add('hidden-icon');
      iconLight?.classList.remove('hidden-icon');
    } else {
      iconLight?.classList.add('hidden-icon');
      iconDark?.classList.remove('hidden-icon');
    }
  });
}

// ── Initialize App ──
function init() {
  // Setup theme
  setupTheme();
  
  // Check auth before routing
  checkAuth();
  
  // Listen for hash changes to check auth
  window.addEventListener('hashchange', () => {
    checkAuth();
    updateNavActive();
  });
  
  // Init router
  initRouter();
  
  // Setup offline detection
  setupOfflineDetection();
  
  // Hide splash, show app
  const splash = document.getElementById('splash');
  const app = document.getElementById('app');
  
  setTimeout(() => {
    splash?.classList.add('splash-hide');
    app?.classList.remove('hidden');
    setTimeout(() => splash?.remove(), 300);
  }, 800);
}

// ── Start ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
