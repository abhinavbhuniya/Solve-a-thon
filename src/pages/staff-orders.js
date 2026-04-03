// ── Staff Orders Page ──
import { getCurrentUser } from '../services/database.js';
import { getTodaysOrders } from '../services/database.js';
import { renderNav, updateNavActive } from '../components/nav.js';

const STATUS_ORDER = ['submitted', 'received', 'washing', 'ready', 'collected'];

function getStatusEmoji(status) {
  const map = { submitted: '📝', received: '📥', washing: '🧺', ready: '✅', collected: '📦' };
  return map[status] || '❓';
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default async function staffOrders(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'staff') { window.location.hash = '#/login'; return; }

  renderNav('staff');
  updateNavActive();

  let activeFilter = 'all';
  container.innerHTML = `<div class="page" style="display:flex; justify-content:center; align-items:center; height:100vh;"><p>Loading orders...</p></div>`;
  const todaysOrders = await getTodaysOrders();

  function render() {
    const filtered = activeFilter === 'all' 
      ? todaysOrders 
      : todaysOrders.filter(o => o.status === activeFilter);

    // Sort: active first, then by time
    filtered.sort((a, b) => {
      const aIdx = STATUS_ORDER.indexOf(a.status);
      const bIdx = STATUS_ORDER.indexOf(b.status);
      if (aIdx !== bIdx) return aIdx - bIdx;
      return new Date(b.submittedAt) - new Date(a.submittedAt);
    });

    container.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1 style="font-size: var(--font-size-2xl);">All Orders</h1>
            <p class="text-secondary text-sm">அனைத்து ஆர்டர்கள் — ${todaysOrders.length} total</p>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div class="tabs mb-6" style="overflow-x: auto; flex-wrap: nowrap;">
          <button class="tab ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">All (${todaysOrders.length})</button>
          ${STATUS_ORDER.filter(s => s !== 'collected').map(s => {
            const count = todaysOrders.filter(o => o.status === s).length;
            return `<button class="tab ${activeFilter === s ? 'active' : ''}" data-filter="${s}" style="white-space:nowrap;">
              ${getStatusEmoji(s)} ${count}
            </button>`;
          }).join('')}
        </div>

        ${filtered.length > 0 ? `
          <div class="flex flex-col gap-3">
            ${filtered.map(order => `
              <div class="order-card" onclick="window.location.hash='#/staff/update?token=${order.tokenNo}'">
                <div class="order-token">#${order.tokenNo}</div>
                <div class="order-info">
                  <div class="order-name">${order.studentName}</div>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="badge badge-${order.status}">${getStatusEmoji(order.status)} ${order.status}</span>
                    ${order.rackNo ? `<span class="text-xs" style="color: var(--success);">Rack #${order.rackNo}</span>` : ''}
                  </div>
                  <div class="order-date mt-1">Room ${order.roomNo} • ${formatTime(order.submittedAt)}</div>
                </div>
                <span class="order-arrow">›</span>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p class="empty-text">No orders with this status</p>
          </div>
        `}
      </div>
    `;

    // Filter handlers
    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeFilter = tab.dataset.filter;
        render();
      });
    });
  }

  render();
}
