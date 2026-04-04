import { isStaff, isStudent, isAdmin } from '../services/database.js';
import { getUnreadCount } from '../services/database.js';
import { getCurrentUser } from '../services/database.js';

// ── Bottom Navigation Component ──

const STUDENT_NAV = [
  { id: 'student-home', icon: '🏠', label: 'Home', route: '#/student' },
  { id: 'student-submit', icon: '🏷️', label: 'Submit', route: '#/student/submit' },
  { id: 'student-track', icon: '📍', label: 'Track', route: '#/student/track' },
  { id: 'student-notifications', icon: '🔔', label: 'Alerts', route: '#/student/notifications' },
];

const STAFF_NAV = [
  { id: 'staff-home', icon: '📊', label: 'Dashboard', route: '#/staff' },
  { id: 'staff-update', icon: '🔄', label: 'Update', route: '#/staff/update' },
  { id: 'staff-orders', icon: '📋', label: 'Orders', route: '#/staff/orders' },
];

const ADMIN_NAV = [
  { id: 'admin-home', icon: '⚙️', label: 'Dashboard', route: '#/admin' },
  { id: 'admin-schedules', icon: '📅', label: 'Schedules', route: '#/admin/schedules' },
  { id: 'admin-analytics', icon: '📊', label: 'Analytics', route: '#/admin/analytics' },
  { id: 'admin-tokens', icon: '🏷️', label: 'Tokens', route: '#/admin/tokens' },
];

export function renderNav(role) {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  let items;
  if (role === 'admin') items = ADMIN_NAV;
  else if (role === 'staff') items = STAFF_NAV;
  else items = STUDENT_NAV;

  const currentHash = window.location.hash || '#/student';

  nav.innerHTML = items.map(item => `
    <button class="nav-item ${currentHash === item.route || currentHash.startsWith(item.route + '/') ? 'active' : ''}" 
            data-route="${item.route}" 
            id="nav-${item.id}">
      <span class="nav-icon">${item.icon}</span>
      <span>${item.label}</span>
    </button>
  `).join('');

  nav.classList.remove('hidden');

  // Add click handlers
  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = btn.dataset.route;
    });
  });
}

export function updateNavActive() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  
  const currentHash = window.location.hash;
  nav.querySelectorAll('.nav-item').forEach(btn => {
    const route = btn.dataset.route;
    const isActive = currentHash === route || currentHash.startsWith(route + '/');
    btn.classList.toggle('active', isActive);
  });
}

export function hideNav() {
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.classList.add('hidden');
}
