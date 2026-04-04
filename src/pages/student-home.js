// ── Student Home Page ──
import { getCurrentUser, logout, getSchedule, getOrdersByStudent, getUnreadCount } from '../services/database.js';
import { checkMonthlyLimit, checkMissedSlots, suggestNextSlot, MONTHLY_LIMIT } from '../services/constraints.js';
import { getDefaultDateForStudent } from '../services/schedule.js';
import { getStudentWaitlistEntries } from '../services/waitlist.js';
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
  
  const [orders, unreadCount, monthly, missedSlots, waitlistEntries] = await Promise.all([
    getOrdersByStudent(user.id),
    getUnreadCount(user.id),
    checkMonthlyLimit(user.id),
    checkMissedSlots(user.id, user.hostelBlock),
    getStudentWaitlistEntries(user.id)
  ]);
  
  const activeOrders = orders.filter(o => o.status !== 'collected');
  
  // Suggest next slot if they have missed dates
  let suggestedSlot = null;
  if (missedSlots.count > 0) {
    suggestedSlot = await suggestNextSlot(user.hostelBlock);
  }

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

      <!-- Monthly Usage -->
      <div class="card mb-4" style="padding: var(--space-3) var(--space-4);">
        <div class="flex justify-between items-center">
          <div>
            <span class="text-sm font-medium">Monthly Credits</span>
            <p class="text-xs text-secondary">${monthly.remaining} remaining this month</p>
          </div>
          <div class="flex items-center gap-2">
            <div class="usage-dots">
              ${Array.from({ length: MONTHLY_LIMIT }, (_, i) => `
                <span class="usage-dot ${i < monthly.used ? 'used' : ''}"></span>
              `).join('')}
            </div>
            <span class="text-sm font-bold">${monthly.used}/${MONTHLY_LIMIT}</span>
          </div>
        </div>
      </div>

      ${missedSlots.count > 0 ? `
        <!-- Missed Slot Alert -->
        <div class="card mb-4" style="border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.05); padding: var(--space-3) var(--space-4);">
          <div class="flex items-start gap-3">
            <span style="font-size: 1.3rem;">⚠️</span>
            <div>
              <div class="font-medium text-sm" style="color: var(--warning);">Missed ${missedSlots.count} scheduled slot${missedSlots.count > 1 ? 's' : ''}</div>
              <p class="text-xs text-secondary mt-1">
                ${suggestedSlot ? `Next available: <strong>${new Date(suggestedSlot.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>` : 'No slots available currently.'}
              </p>
            </div>
          </div>
        </div>
      ` : ''}

      ${waitlistEntries.length > 0 ? `
        <!-- Waitlist Status -->
        <div class="card mb-4" style="border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.05); padding: var(--space-3) var(--space-4);">
          <div class="flex items-center gap-3">
            <span style="font-size: 1.3rem;">⏳</span>
            <div>
              <div class="font-medium text-sm" style="color: var(--primary-light);">On Waitlist</div>
              <p class="text-xs text-secondary">${waitlistEntries.map(w => 
                new Date(w.requested_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
              ).join(', ')}</p>
            </div>
          </div>
        </div>
      ` : ''}

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
        <button class="btn btn-primary btn-lg" style="flex:1" onclick="window.location.hash='#/student/submit'" id="quick-submit"
                ${!monthly.allowed ? 'disabled title="Monthly limit reached"' : ''}>
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
                  ${order.isPriority ? '<span class="badge badge-priority">⚡</span>' : ''}
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
