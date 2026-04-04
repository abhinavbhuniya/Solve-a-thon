// ── Chota Dhobi — Main Entry Point ──
import './styles/index.css';
import { registerRoute, initRouter } from './router.js';
import { getCurrentUser, isStaff, isAdmin } from './services/database.js';
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
import adminHome from './pages/admin-home.js';
import adminSchedules from './pages/admin-schedules.js';
import adminAnalytics from './pages/admin-analytics.js';
import adminTokens from './pages/admin-tokens.js';

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
registerRoute('/admin', adminHome);
registerRoute('/admin/schedules', adminSchedules);
registerRoute('/admin/analytics', adminAnalytics);
registerRoute('/admin/tokens', adminTokens);

// ── Auth Guard ──
function checkAuth() {
  const user = getCurrentUser();
  const hash = window.location.hash;
  
  if (!user && hash !== '#/login' && hash !== '') {
    window.location.hash = '#/login';
    return;
  }
  
  if (user && (hash === '#/login' || hash === '' || hash === '#/')) {
    if (user.role === 'admin') {
      window.location.hash = '#/admin';
    } else if (user.role === 'staff') {
      window.location.hash = '#/staff';
    } else {
      window.location.hash = '#/student';
    }
    return;
  }

  // Prevent cross-domain navigation
  if (user) {
    const role = user.role;
    if (role === 'staff' && (hash.startsWith('#/student') || hash.startsWith('#/admin'))) {
      window.location.hash = '#/staff';
      return;
    }
    if (role === 'student' && (hash.startsWith('#/staff') || hash.startsWith('#/admin'))) {
      window.location.hash = '#/student';
      return;
    }
    if (role === 'admin' && (hash.startsWith('#/student') || hash.startsWith('#/staff'))) {
      window.location.hash = '#/admin';
      return;
    }
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
  setupTheme();
  checkAuth();
  
  window.addEventListener('hashchange', () => {
    checkAuth();
    updateNavActive();
  });
  
  initRouter();
  setupOfflineDetection();
  
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
