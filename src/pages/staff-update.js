// ── Staff Update Page ──
// Zero-typing interface — all tap-based with large buttons
import { getCurrentUser } from '../services/database.js';
import { getTodaysOrders, updateOrderStatus, getOrderByToken } from '../services/database.js';
import { showToast } from '../components/toast.js';
import { renderNav, updateNavActive } from '../components/nav.js';

const STATUS_FLOW = [
  { status: 'received', emoji: '📥', label: 'Received', tamil: 'பெற்றது', color: 'var(--info)' },
  { status: 'washing', emoji: '🧺', label: 'Washing', tamil: 'துவைப்பு', color: 'var(--warning)' },
  { status: 'ready', emoji: '✅', label: 'Ready', tamil: 'தயார்', color: 'var(--success)' },
  { status: 'collected', emoji: '📦', label: 'Collected', tamil: 'சேகரிக்கப்பட்டது', color: 'var(--text-tertiary)' },
];

export default async function staffUpdate(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'staff') { window.location.hash = '#/login'; return; }

  renderNav('staff');
  updateNavActive();

  container.innerHTML = `<div class="page" style="display:flex; justify-content:center; align-items:center; height:100vh;"><p>Loading panel...</p></div>`;

  let selectedToken = null;
  let selectedOrder = null;
  let selectedStatus = null;
  let selectedRack = null;
  let step = 'select-token'; // select-token → select-status → (select-rack) → confirm

  // Check if token was passed via URL
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const preselectedToken = urlParams.get('token');
  if (preselectedToken) {
    const order = await getOrderByToken(parseInt(preselectedToken));
    if (order) {
      selectedToken = parseInt(preselectedToken);
      selectedOrder = order;
      step = 'select-status';
    }
  }

  const todaysOrders = await getTodaysOrders();
  const usedTokens = new Map(todaysOrders.map(o => [o.tokenNo, o]));

  function render() {
    container.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1 style="font-size: var(--font-size-2xl);">Update Status</h1>
            <p class="text-secondary text-sm">நிலை புதுப்பிப்பு</p>
          </div>
          ${step !== 'select-token' ? `
            <button class="btn btn-ghost" id="back-btn">← Back</button>
          ` : ''}
        </div>

        ${step === 'select-token' ? renderTokenSelection() : ''}
        ${step === 'select-status' ? renderStatusSelection() : ''}
        ${step === 'select-rack' ? renderRackSelection() : ''}
        ${step === 'confirm' ? renderConfirmation() : ''}
      </div>
    `;

    attachHandlers();
  }

  function renderTokenSelection() {
    return `
      <p class="text-sm text-secondary mb-4">Select token number / டோக்கன் எண் தேர்வு</p>
      
      <!-- Active tokens (quick select) -->
      ${todaysOrders.length > 0 ? `
        <div class="section-header">
          <h4 class="section-title">Active Tokens / செயலில் உள்ள டோக்கன்</h4>
        </div>
        <div class="flex flex-col gap-3 mb-6">
          ${todaysOrders.filter(o => o.status !== 'collected').map(order => `
            <div class="order-card" data-token-card="${order.tokenNo}" style="cursor: pointer;">
              <div class="order-token">#${order.tokenNo}</div>
              <div class="order-info">
                <div class="order-name">${order.studentName}</div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-${order.status}">${getStatusEmoji(order.status)} ${order.status}</span>
                  <span class="text-xs text-secondary">Room ${order.roomNo}</span>
                </div>
              </div>
              <span class="order-arrow">›</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Full Token Grid -->
      <div class="section-header">
        <h4 class="section-title">All Tokens / அனைத்து டோக்கன்கள்</h4>
      </div>
      <div class="token-grid">
        ${Array.from({ length: 50 }, (_, i) => {
          const num = i + 1;
          const order = usedTokens.get(num);
          let cls = 'grid-btn';
          if (order) {
            cls += order.status === 'collected' ? ' done' : ' occupied';
          }
          return `<button class="${cls}" data-token="${num}" title="${order ? order.studentName + ' - ' + order.status : 'Available'}">${num}</button>`;
        }).join('')}
      </div>
    `;
  }

  function renderStatusSelection() {
    if (!selectedOrder) return '<p>No order found for this token.</p>';

    // Calculate index relative to STATUS_FLOW to align with the rendered buttons
    const currentIdx = STATUS_FLOW.findIndex(s => s.status === selectedOrder.status);

    return `
      <!-- Current Order Info -->
      <div class="card card-highlight mb-6">
        <div class="flex items-center gap-4">
          <div class="order-token" style="width: 64px; height: 64px; font-size: var(--font-size-2xl);">#${selectedOrder.tokenNo}</div>
          <div>
            <div class="font-bold">${selectedOrder.studentName}</div>
            <div class="text-sm text-secondary">Room ${selectedOrder.roomNo}</div>
            <span class="badge badge-${selectedOrder.status} mt-2">${getStatusEmoji(selectedOrder.status)} ${selectedOrder.status}</span>
          </div>
        </div>
      </div>

      <p class="text-sm text-secondary mb-4">Select new status / புதிய நிலையை தேர்வு</p>

      <!-- Status Buttons -->
      <div class="staff-actions">
        ${STATUS_FLOW.map((s, idx) => {
          const isPast = idx <= currentIdx;
          const isNext = idx === currentIdx + 1;
          return `
            <button class="staff-action-btn ${s.status} ${isPast ? 'done' : ''}" 
                    data-status="${s.status}" 
                    ${isPast ? 'disabled style="opacity: 0.3; pointer-events: none;"' : ''}
                    ${isNext ? 'style="border-width: 3px; box-shadow: 0 0 20px rgba(99,102,241,0.2);"' : ''}>
              <span class="icon">${s.emoji}</span>
              <span class="label">${s.label}</span>
              <span class="tamil">${s.tamil}</span>
              ${isNext ? '<span class="text-xs" style="color: var(--primary-light);">← Next</span>' : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderRackSelection() {
    return `
      <div class="card card-highlight mb-6 text-center">
        <p class="text-sm text-secondary">Token #${selectedToken} → <span style="color: var(--success);">✅ Ready</span></p>
        <p class="font-bold mt-2">${selectedOrder.studentName}</p>
      </div>

      <p class="text-sm text-secondary mb-4">Select rack number / ரேக் எண் தேர்வு</p>

      <div class="rack-grid mb-6">
        ${Array.from({ length: 20 }, (_, i) => {
          const num = i + 1;
          return `<button class="grid-btn ${selectedRack === num ? 'selected' : ''}" data-rack="${num}" 
                    style="height: 64px; font-size: var(--font-size-xl);">${num}</button>`;
        }).join('')}
      </div>

      <button class="btn btn-success btn-xl btn-block" id="confirm-rack-btn" ${!selectedRack ? 'disabled' : ''}>
        ✅ Confirm Rack #${selectedRack || '—'} / ரேக் உறுதி
      </button>
    `;
  }

  function renderConfirmation() {
    return `
      <div style="text-align: center; padding: var(--space-8) 0;">
        <div class="confirm-check">✓</div>
        <h2 class="mt-6">Status Updated!</h2>
        <p class="text-secondary mt-2">நிலை புதுப்பிக்கப்பட்டது!</p>
        
        <div class="card mt-6" style="text-align: left;">
          <div class="flex justify-between mb-3">
            <span class="text-secondary text-sm">Token</span>
            <span class="font-bold" style="color: var(--primary-light);">#${selectedToken}</span>
          </div>
          <div class="flex justify-between mb-3">
            <span class="text-secondary text-sm">Student</span>
            <span class="font-semibold">${selectedOrder.studentName}</span>
          </div>
          <div class="flex justify-between mb-3">
            <span class="text-secondary text-sm">Status</span>
            <span class="badge badge-${selectedStatus}">${getStatusEmoji(selectedStatus)} ${selectedStatus}</span>
          </div>
          ${selectedRack ? `
            <div class="flex justify-between">
              <span class="text-secondary text-sm">Rack</span>
              <span class="font-bold" style="color: var(--success);">#${selectedRack}</span>
            </div>
          ` : ''}
        </div>

        <div class="flex gap-3 mt-6">
          <button class="btn btn-secondary btn-lg" style="flex:1" id="update-another-btn">
            🔄 Update Another
          </button>
          <button class="btn btn-primary btn-lg" style="flex:1" onclick="window.location.hash='#/staff'">
            🏠 Dashboard
          </button>
        </div>
      </div>
    `;
  }

  function attachHandlers() {
    // Back button
    container.querySelector('#back-btn')?.addEventListener('click', () => {
      if (step === 'confirm') { step = 'select-token'; selectedToken = null; selectedOrder = null; selectedStatus = null; selectedRack = null; }
      else if (step === 'select-rack') { step = 'select-status'; selectedRack = null; }
      else if (step === 'select-status') { step = 'select-token'; selectedToken = null; selectedOrder = null; }
      render();
    });

    // Token card click
    container.querySelectorAll('[data-token-card]').forEach(card => {
      card.addEventListener('click', () => {
        const tokenNo = parseInt(card.dataset.tokenCard);
        selectToken(tokenNo);
      });
    });

    // Token grid click
    container.querySelectorAll('[data-token]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tokenNo = parseInt(btn.dataset.token);
        selectToken(tokenNo);
      });
    });

    // Status buttons
    container.querySelectorAll('[data-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedStatus = btn.dataset.status;
        if (navigator.vibrate) navigator.vibrate(20);

        if (selectedStatus === 'ready') {
          step = 'select-rack';
          render();
        } else {
          // Direct update
          performUpdate();
        }
      });
    });

    // Rack selection
    container.querySelectorAll('[data-rack]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRack = parseInt(btn.dataset.rack);
        if (navigator.vibrate) navigator.vibrate(15);
        render();
      });
    });

    // Confirm rack
    container.querySelector('#confirm-rack-btn')?.addEventListener('click', () => {
      performUpdate();
    });

    // Update another
    container.querySelector('#update-another-btn')?.addEventListener('click', () => {
      selectedToken = null;
      selectedOrder = null;
      selectedStatus = null;
      selectedRack = null;
      step = 'select-token';
      render();
    });
  }

  function selectToken(tokenNo) {
    const order = usedTokens.get(tokenNo);
    if (!order) {
      showToast('No order for this token today / இன்று இந்த டோக்கனுக்கு ஆர்டர் இல்லை', 'error');
      return;
    }
    if (order.status === 'collected') {
      showToast('This order is already collected / ஏற்கனவே சேகரிக்கப்பட்டது', 'info');
      return;
    }

    selectedToken = tokenNo;
    selectedOrder = order;
    step = 'select-status';
    if (navigator.vibrate) navigator.vibrate(15);
    render();
  }

  async function performUpdate() {
    const result = await updateOrderStatus(selectedOrder.id, selectedStatus, { rackNo: selectedRack });
    
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }

    selectedOrder = result.order;
    step = 'confirm';
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    showToast(`Token #${selectedToken} → ${selectedStatus} ✓`, 'success');
    render();
  }

  render();
}

function getStatusEmoji(status) {
  const map = { submitted: '📝', received: '📥', washing: '🧺', ready: '✅', collected: '📦' };
  return map[status] || '❓';
}
