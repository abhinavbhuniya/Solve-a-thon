// ── Staff Home/Dashboard Page ──
import { getCurrentUser, logout } from '../services/database.js';
import { getStats, getTodaysOrders } from '../services/database.js';
import { getScheduleForDate } from '../services/schedule.js';
import { renderNav, updateNavActive } from '../components/nav.js';

export default async function staffHome(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'staff') { window.location.hash = '#/login'; return; }

  renderNav('staff');
  updateNavActive();

  container.innerHTML = `<div class="page" style="display:flex; justify-content:center; align-items:center; height:100vh;"><p>Loading stats...</p></div>`;

  const today = new Date().toISOString().split('T')[0];
  const stats = await getStats();
  const todaysOrders = await getTodaysOrders();
  const todaySchedule = await getScheduleForDate(today);

  const capacity = todaySchedule ? todaySchedule.capacity : 100;
  const booked = todaySchedule ? todaySchedule.booked_count : todaysOrders.length;
  const capacityPct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

  container.innerHTML = `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <p class="text-secondary text-sm">Staff Dashboard / ஊழியர் டாஷ்போர்ட்</p>
          <h1 style="font-size: var(--font-size-2xl);">Chota Dhobi 👷</h1>
        </div>
        <button class="btn btn-ghost btn-icon" id="logout-btn" title="Logout">🚪</button>
      </div>

      <!-- Today's Date -->
      <div class="card card-highlight mb-6 text-center">
        <p class="text-sm text-secondary">Today</p>
        <p class="font-bold" style="font-size: var(--font-size-xl);">
          ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p class="text-xs text-secondary mt-1">Total Orders: ${stats.total}</p>
        
        <!-- Capacity Bar -->
        <div class="capacity-bar-wrapper mt-4">
          <div class="flex justify-between text-xs text-secondary mb-1">
            <span>Today's Capacity</span>
            <span>${booked} / ${capacity} (${capacityPct}%)</span>
          </div>
          <div class="capacity-bar">
            <div class="capacity-bar-fill ${capacityPct > 90 ? 'critical' : capacityPct > 70 ? 'warning' : ''}" 
                 style="width: ${capacityPct}%"></div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid mb-6">
        <div class="stat-card received">
          <div class="stat-icon">📥</div>
          <div class="stat-value">${stats.submitted + stats.received}</div>
          <div class="stat-label">Received / பெறப்பட்டது</div>
        </div>
        <div class="stat-card washing">
          <div class="stat-icon">🧺</div>
          <div class="stat-value">${stats.washing}</div>
          <div class="stat-label">Washing / துவைப்பு</div>
        </div>
        <div class="stat-card ready">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${stats.ready}</div>
          <div class="stat-label">Ready / தயார்</div>
        </div>
        <div class="stat-card collected">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${stats.collected}</div>
          <div class="stat-label">Collected / சேகரிக்கப்பட்டது</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="section-header">
        <h3 class="section-title">Quick Actions / விரைவு செயல்கள்</h3>
      </div>
      <div class="staff-actions mb-6">
        <button class="staff-action-btn received" onclick="window.location.hash='#/staff/update'" id="action-update">
          <span class="icon">🔄</span>
          <span class="label">Update Status</span>
          <span class="tamil">நிலை புதுப்பிப்பு</span>
        </button>
        <button class="staff-action-btn ready" onclick="window.location.hash='#/staff/orders'" id="action-orders">
          <span class="icon">📋</span>
          <span class="label">All Orders</span>
          <span class="tamil">அனைத்து ஆர்டர்கள்</span>
        </button>
      </div>

      <!-- Recent Activity -->
      ${todaysOrders.length > 0 ? `
        <div class="section-header">
          <h3 class="section-title">Today's Orders / இன்றைய ஆர்டர்கள்</h3>
        </div>
        <div class="flex flex-col gap-3">
          ${todaysOrders.slice(0, 10).map(order => `
            <div class="order-card" onclick="window.location.hash='#/staff/update?token=${order.tokenNo}'">
              <div class="order-token">#${order.tokenNo}</div>
              <div class="order-info">
                <div class="order-name">${order.studentName}</div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-${order.status}">
                    ${getStatusEmoji(order.status)} ${order.status}
                  </span>
                  ${order.rackNo ? `<span class="text-xs" style="color:var(--success)">Rack #${order.rackNo}</span>` : ''}
                </div>
                <div class="order-date">Room ${order.roomNo}</div>
              </div>
              <span class="order-arrow">›</span>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p class="empty-text">No orders today</p>
        </div>
      `}
    </div>
  `;

  container.querySelector('#logout-btn')?.addEventListener('click', () => {
    if (confirm('Confirm logout? / வெளியேற விரும்புகிறீர்களா?')) {
      logout();
    }
  });
}

function getStatusEmoji(status) {
  const map = { submitted: '📝', received: '📥', washing: '🧺', ready: '✅', collected: '📦' };
  return map[status] || '❓';
}
