// ── Admin Home/Dashboard Page ──
import { getCurrentUser, logout, getStats, getTodaysOrders } from '../services/database.js';
import { getScheduleForDate, getSchedules } from '../services/schedule.js';
import { getAllTokenStatuses } from '../services/token.js';
import { getWaitlistForDate } from '../services/waitlist.js';
import { renderNav, updateNavActive } from '../components/nav.js';

export default async function adminHome(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') { window.location.hash = '#/login'; return; }

  renderNav('admin');
  updateNavActive();

  container.innerHTML = `<div class="page" style="display:flex; justify-content:center; align-items:center; height:100vh;"><p>Loading admin dashboard...</p></div>`;

  const today = new Date().toISOString().split('T')[0];
  const stats = await getStats();
  const todaysOrders = await getTodaysOrders();
  const todaySchedule = await getScheduleForDate(today);
  const tokenStatuses = await getAllTokenStatuses();
  const waitlist = await getWaitlistForDate(today);

  const tokensInUse = Object.values(tokenStatuses).filter(t => t.status !== 'available').length;
  const tokensAvailable = 100 - tokensInUse;
  const capacity = todaySchedule ? todaySchedule.capacity : 100;
  const booked = todaySchedule ? todaySchedule.booked_count : todaysOrders.length;
  const capacityPct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

  container.innerHTML = `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <p class="text-secondary text-sm">Admin Panel / நிர்வாக பேனல்</p>
          <h1 style="font-size: var(--font-size-2xl);">Chota Dhobi ⚙️</h1>
        </div>
        <button class="btn btn-ghost btn-icon" id="admin-logout-btn" title="Logout">🚪</button>
      </div>

      <!-- Today's Overview -->
      <div class="card card-highlight mb-6 text-center">
        <p class="text-sm text-secondary">Today</p>
        <p class="font-bold" style="font-size: var(--font-size-xl);">
          ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <div class="capacity-bar-wrapper mt-4">
          <div class="flex justify-between text-xs text-secondary mb-1">
            <span>Capacity Usage</span>
            <span>${booked} / ${capacity} (${capacityPct}%)</span>
          </div>
          <div class="capacity-bar">
            <div class="capacity-bar-fill ${capacityPct > 90 ? 'critical' : capacityPct > 70 ? 'warning' : ''}" 
                 style="width: ${capacityPct}%"></div>
          </div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="admin-stats-grid mb-6">
        <div class="admin-stat-card">
          <div class="admin-stat-icon">📋</div>
          <div class="admin-stat-value">${stats.total}</div>
          <div class="admin-stat-label">Today's Orders</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-icon">🏷️</div>
          <div class="admin-stat-value">${tokensAvailable}</div>
          <div class="admin-stat-label">Tokens Free</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-icon">⏳</div>
          <div class="admin-stat-value">${waitlist.length}</div>
          <div class="admin-stat-label">Waitlisted</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-icon">🧺</div>
          <div class="admin-stat-value">${stats.washing}</div>
          <div class="admin-stat-label">Washing</div>
        </div>
      </div>

      <!-- Status Breakdown -->
      <div class="stats-grid mb-6">
        <div class="stat-card received">
          <div class="stat-icon">📥</div>
          <div class="stat-value">${stats.submitted + stats.received}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card washing">
          <div class="stat-icon">🧺</div>
          <div class="stat-value">${stats.washing}</div>
          <div class="stat-label">Washing</div>
        </div>
        <div class="stat-card ready">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${stats.ready}</div>
          <div class="stat-label">Ready</div>
        </div>
        <div class="stat-card collected">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${stats.collected}</div>
          <div class="stat-label">Collected</div>
        </div>
      </div>

      <!-- Admin Actions -->
      <div class="section-header">
        <h3 class="section-title">Management / மேலாண்மை</h3>
      </div>
      <div class="admin-actions-grid mb-6">
        <button class="admin-action-card" onclick="window.location.hash='#/admin/schedules'" id="nav-schedules">
          <span class="admin-action-icon">📅</span>
          <span class="admin-action-label">Schedules</span>
          <span class="admin-action-desc">Create & manage daily schedules</span>
        </button>
        <button class="admin-action-card" onclick="window.location.hash='#/admin/analytics'" id="nav-analytics">
          <span class="admin-action-icon">📊</span>
          <span class="admin-action-label">Analytics</span>
          <span class="admin-action-desc">Charts, insights & reports</span>
        </button>
        <button class="admin-action-card" onclick="window.location.hash='#/admin/tokens'" id="nav-tokens">
          <span class="admin-action-icon">🏷️</span>
          <span class="admin-action-label">Tokens</span>
          <span class="admin-action-desc">Token lifecycle & management</span>
        </button>
      </div>

      <!-- Recent Orders -->
      ${todaysOrders.length > 0 ? `
        <div class="section-header">
          <h3 class="section-title">Recent Orders</h3>
          <span class="badge badge-submitted">${todaysOrders.length} today</span>
        </div>
        <div class="flex flex-col gap-3">
          ${todaysOrders.slice(0, 8).map(order => `
            <div class="order-card">
              <div class="order-token">#${order.tokenNo}</div>
              <div class="order-info">
                <div class="order-name">${order.studentName}</div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-${order.status}">${getStatusEmoji(order.status)} ${order.status}</span>
                  ${order.isPriority ? '<span class="badge badge-priority">⚡ Priority</span>' : ''}
                </div>
                <div class="order-date">Room ${order.roomNo}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p class="empty-text">No orders today yet</p>
        </div>
      `}
    </div>
  `;

  container.querySelector('#admin-logout-btn')?.addEventListener('click', () => {
    if (confirm('Confirm logout?')) logout();
  });
}

function getStatusEmoji(status) {
  const map = { submitted: '📝', received: '📥', washing: '🧺', ready: '✅', collected: '📦' };
  return map[status] || '❓';
}
