// ── Student Home Page ──
import { getCurrentUser, logout } from '../services/database.js';
import { getSchedule, getOrdersByStudent, getUnreadCount, getActiveOrders } from '../services/database.js';
import { renderNav, updateNavActive } from '../components/nav.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDaysUntilLaundry(laundryDay) {
  const today = new Date().getDay();
  const targetIdx = DAYS.indexOf(laundryDay);
  if (targetIdx === -1) return -1;
  
  let diff = targetIdx - today;
  if (diff < 0) diff += 7;
  return diff;
}

function getCountdownText(days) {
  if (days === 0) return "🟢 It's your laundry day today!";
  if (days === 1) return "📅 Tomorrow is your laundry day";
  return `⏳ ${days} days until your laundry day`;
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getStatusEmoji(status) {
  const map = { submitted: '📝', received: '📥', washing: '🧺', ready: '✅', collected: '📦' };
  return map[status] || '❓';
}

export default async function studentHome(container) {
  const user = getCurrentUser();
  if (!user) { window.location.hash = '#/login'; return; }

  renderNav('student');
  updateNavActive();

  container.innerHTML = `<div class="page" style="display:flex; justify-content:center; align-items:center; height:100vh;"><p>Loading dashboard...</p></div>`;

  const schedule = getSchedule();
  const dayInfo = schedule[user.laundryDay] || {};
  const daysUntil = getDaysUntilLaundry(user.laundryDay);
  
  const orders = await getOrdersByStudent(user.id);
  const activeOrders = orders.filter(o => o.status !== 'collected');
  const unreadCount = await getUnreadCount(user.id);

  container.innerHTML = `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <p class="text-secondary text-sm">Welcome back,</p>
          <h1 style="font-size: var(--font-size-2xl);">${user.name.split(' ')[0]} 👋</h1>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-icon btn-ghost ${unreadCount > 0 ? 'pulse' : ''}" 
                  onclick="window.location.hash='#/student/notifications'" id="notif-bell">
            🔔
          </button>
          <button class="btn btn-icon btn-ghost" id="logout-btn" title="Logout">🚪</button>
        </div>
      </div>

      <!-- Schedule Card -->
      <div class="schedule-card mb-6">
        <p class="text-sm text-secondary">Your Laundry Day</p>
        <div class="schedule-day">${user.laundryDay}</div>
        <p class="schedule-countdown">${getCountdownText(daysUntil)}</p>
        <div class="schedule-time">
          <span>🕐</span>
          <span>${dayInfo.timeSlot || '8:00 AM - 12:00 PM'}</span>
        </div>
        <p class="text-xs text-secondary mt-2">${user.hostelBlock} • Room ${user.roomNo}</p>
      </div>

      <!-- Quick Actions -->
      <div class="flex gap-3 mb-6">
        <button class="btn btn-primary btn-lg" style="flex:1" onclick="window.location.hash='#/student/submit'" id="quick-submit">
          🏷️ Submit Laundry
        </button>
        <button class="btn btn-secondary btn-lg" style="flex:1" onclick="window.location.hash='#/student/track'" id="quick-track">
          📍 Track
        </button>
      </div>

      <!-- Active Orders -->
      ${activeOrders.length > 0 ? `
        <div class="section-header">
          <h3 class="section-title">Active Orders</h3>
          <span class="badge badge-${activeOrders[0]?.status || 'submitted'}">${activeOrders.length} active</span>
        </div>
        <div class="flex flex-col gap-3 mb-6">
          ${activeOrders.map(order => `
            <div class="order-card" onclick="window.location.hash='#/student/track/${order.id}'">
              <div class="order-token">#${order.tokenNo}</div>
              <div class="order-info">
                <div class="flex items-center gap-2">
                  <span class="badge badge-${order.status}">${getStatusEmoji(order.status)} ${order.status}</span>
                </div>
                <div class="order-date">${new Date(order.submittedAt).toLocaleDateString('en-IN')} • ${formatTime(order.submittedAt)}</div>
                ${order.rackNo ? `<div class="text-sm" style="color: var(--success);">📍 Rack #${order.rackNo}</div>` : ''}
              </div>
              <span class="order-arrow">›</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Recent History -->
      ${orders.length > 0 ? `
        <div class="section-header">
          <h3 class="section-title">Recent History</h3>
        </div>
        <div class="flex flex-col gap-3">
          ${orders.filter(o => o.status === 'collected').slice(0, 5).map(order => `
            <div class="order-card" style="opacity: 0.7;">
              <div class="order-token">#${order.tokenNo}</div>
              <div class="order-info">
                <div class="badge badge-collected">📦 Collected</div>
                <div class="order-date">${new Date(order.submittedAt).toLocaleDateString('en-IN')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">👕</div>
          <p class="empty-text">No laundry orders yet — submit your first one!</p>
        </div>
      `}
    </div>
  `;

  // Logout handler
  container.querySelector('#logout-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to log out?')) {
      logout();
    }
  });
}
