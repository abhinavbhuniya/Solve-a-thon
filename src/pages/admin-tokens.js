// ── Admin Token Management Page ──
import { getCurrentUser } from '../services/database.js';
import { getAllTokenStatuses, forceReleaseToken, subscribeToTokens } from '../services/token.js';
import { showToast } from '../components/toast.js';
import { renderNav, updateNavActive } from '../components/nav.js';

const STATUS_COLORS = {
  available: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', color: '#34D399', label: 'Available' },
  in_use: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', color: '#60A5FA', label: 'In Use' },
  washing: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', color: '#FBBF24', label: 'Washing' },
  ready: { bg: 'rgba(16,185,129,0.25)', border: 'rgba(16,185,129,0.5)', color: '#10B981', label: 'Ready' },
  collected: { bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.4)', color: '#9CA3AF', label: 'Collected' }
};

export default async function adminTokens(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') { window.location.hash = '#/login'; return; }

  renderNav('admin');
  updateNavActive();

  let unsubscribe = null;

  async function render() {
    const tokenStatuses = await getAllTokenStatuses();
    const counts = { available: 0, in_use: 0, washing: 0, ready: 0, collected: 0 };
    Object.values(tokenStatuses).forEach(t => {
      if (counts[t.status] !== undefined) counts[t.status]++;
    });

    container.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1 style="font-size: var(--font-size-2xl);">🏷️ Token Management</h1>
            <p class="text-secondary text-sm">100 tokens lifecycle tracking</p>
          </div>
          <button class="btn btn-ghost" onclick="window.location.hash='#/admin'">← Back</button>
        </div>

        <!-- Token Summary -->
        <div class="admin-stats-grid mb-6">
          <div class="admin-stat-card">
            <div class="admin-stat-value" style="color: #34D399;">${counts.available}</div>
            <div class="admin-stat-label">Available</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value" style="color: #60A5FA;">${counts.in_use}</div>
            <div class="admin-stat-label">In Use</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value" style="color: #FBBF24;">${counts.washing}</div>
            <div class="admin-stat-label">Washing</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value" style="color: #10B981;">${counts.ready}</div>
            <div class="admin-stat-label">Ready</div>
          </div>
        </div>

        <!-- Legend -->
        <div class="token-legend mb-4">
          ${Object.entries(STATUS_COLORS).filter(([k]) => k !== 'collected').map(([key, val]) => `
            <div class="legend-item">
              <span class="legend-dot" style="background: ${val.color}"></span>
              <span class="text-xs">${val.label}</span>
            </div>
          `).join('')}
        </div>

        <!-- Token Grid -->
        <div class="token-management-grid mb-6">
          ${Array.from({ length: 100 }, (_, i) => {
            const num = i + 1;
            const token = tokenStatuses[num];
            const status = token?.status || 'available';
            const sc = STATUS_COLORS[status] || STATUS_COLORS.available;
            const isActive = status !== 'available';
            return `
              <button class="token-cell ${isActive ? 'active' : ''}" 
                      data-token="${num}" data-status="${status}"
                      style="background: ${sc.bg}; border-color: ${sc.border}; color: ${sc.color};"
                      title="Token #${num} — ${sc.label}${token?.orderId ? ' (Order: ' + token.orderId.slice(0, 8) + '...)' : ''}">
                ${num}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Token Detail Panel -->
        <div id="token-detail"></div>

        <!-- Bulk Actions -->
        <div class="card mb-6">
          <h4 class="mb-3">⚠️ Bulk Actions</h4>
          <p class="text-xs text-secondary mb-4">Use with caution. These actions override normal token lifecycle.</p>
          <button class="btn btn-warning btn-block" id="release-all-stuck">
            🔓 Release All Stuck Tokens (status: in_use for 24h+)
          </button>
        </div>
      </div>
    `;

    // Token cell click handlers
    container.querySelectorAll('.token-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const num = parseInt(cell.dataset.token);
        const token = tokenStatuses[num];
        showTokenDetail(num, token);
      });
    });

    // Bulk release handler
    container.querySelector('#release-all-stuck')?.addEventListener('click', async () => {
      if (!confirm('This will release all tokens that have been "in_use" for more than 24 hours. Continue?')) return;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let released = 0;

      for (const token of Object.values(tokenStatuses)) {
        if (token.status === 'in_use' && token.assignedAt && token.assignedAt < twentyFourHoursAgo) {
          await forceReleaseToken(token.tokenNo);
          released++;
        }
      }

      showToast(`Released ${released} stuck tokens`, 'success');
      await render();
    });
  }

  function showTokenDetail(num, token) {
    const detail = container.querySelector('#token-detail');
    if (!detail) return;

    const status = token?.status || 'available';
    const sc = STATUS_COLORS[status] || STATUS_COLORS.available;

    detail.innerHTML = `
      <div class="card card-highlight mb-6">
        <div class="flex items-center gap-4 mb-4">
          <div style="width: 64px; height: 64px; border-radius: var(--radius-xl); display: flex; align-items: center; justify-content: center; font-size: var(--font-size-2xl); font-weight: 800; background: ${sc.bg}; border: 2px solid ${sc.border}; color: ${sc.color};">
            ${num}
          </div>
          <div>
            <h3 class="font-bold">Token #${num}</h3>
            <span class="badge" style="background: ${sc.bg}; color: ${sc.color}; border: 1px solid ${sc.border};">${sc.label}</span>
          </div>
        </div>

        ${token?.orderId ? `
          <div class="flex justify-between text-sm mb-2">
            <span class="text-secondary">Order ID</span>
            <span class="font-medium">${token.orderId.slice(0, 12)}...</span>
          </div>
        ` : ''}
        ${token?.assignedAt ? `
          <div class="flex justify-between text-sm mb-2">
            <span class="text-secondary">Assigned</span>
            <span class="font-medium">${new Date(token.assignedAt).toLocaleString('en-IN')}</span>
          </div>
        ` : ''}

        ${status !== 'available' ? `
          <button class="btn btn-danger btn-block mt-4" id="force-release-btn" data-token="${num}">
            🔓 Force Release Token
          </button>
        ` : `
          <p class="text-center text-sm text-secondary mt-2">✅ This token is available for assignment.</p>
        `}
      </div>
    `;

    detail.querySelector('#force-release-btn')?.addEventListener('click', async () => {
      if (!confirm(`Force release Token #${num}? This will mark the associated order token as collected.`)) return;
      const result = await forceReleaseToken(num);
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        showToast(`Token #${num} released ✅`, 'success');
        await render();
      }
    });

    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  await render();

  // Subscribe to real-time token changes
  unsubscribe = subscribeToTokens(() => render());

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
