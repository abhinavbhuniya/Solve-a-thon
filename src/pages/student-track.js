// ── Student Track Page ──
import { getCurrentUser } from '../services/database.js';
import { getOrdersByStudent, subscribeToOrders } from '../services/database.js';
import { renderNav, updateNavActive } from '../components/nav.js';

const STATUSES = ['submitted', 'received', 'washing', 'ready', 'collected'];
const STATUS_INFO = {
  submitted: { emoji: '📝', label: 'Submitted', tamil: 'சமர்ப்பிக்கப்பட்டது' },
  received: { emoji: '📥', label: 'Received', tamil: 'பெறப்பட்டது' },
  washing: { emoji: '🧺', label: 'Washing', tamil: 'துவைப்பு' },
  ready: { emoji: '✅', label: 'Ready', tamil: 'தயார்' },
  collected: { emoji: '📦', label: 'Collected', tamil: 'சேகரிக்கப்பட்டது' }
};

function getStepState(currentStatus, stepStatus) {
  const currentIdx = STATUSES.indexOf(currentStatus);
  const stepIdx = STATUSES.indexOf(stepStatus);
  
  if (stepIdx < currentIdx) return 'completed';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

function getProgressWidth(status) {
  const idx = STATUSES.indexOf(status);
  if (idx <= 0) return '0%';
  return `${(idx / (STATUSES.length - 1)) * 100}%`;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString('en-IN', { 
    day: 'numeric', month: 'short', 
    hour: '2-digit', minute: '2-digit' 
  });
}

export default async function studentTrack(container, params = {}) {
  const user = getCurrentUser();
  if (!user) { window.location.hash = '#/login'; return; }

  renderNav('student');
  updateNavActive();

  let unsubscribe = null;

  async function render() {
    const orders = await getOrdersByStudent(user.id);
    const activeOrders = orders.filter(o => o.status !== 'collected');
    
    // If a specific order ID was passed, find it
    const targetOrder = params.id 
      ? orders.find(o => o.id === params.id) 
      : activeOrders[0];

    container.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1 style="font-size: var(--font-size-2xl);">Track Laundry</h1>
            <p class="text-secondary text-sm">Real-time status updates</p>
          </div>
        </div>

        ${targetOrder ? renderOrderDetail(targetOrder) : renderNoOrders(activeOrders.length)}

        ${activeOrders.length > 1 ? `
          <div class="section-header mt-8">
            <h3 class="section-title">Other Active Orders</h3>
          </div>
          <div class="flex flex-col gap-3">
            ${activeOrders.filter(o => o.id !== targetOrder?.id).map(order => `
              <div class="order-card" onclick="window.location.hash='#/student/track/${order.id}'">
                <div class="order-token">#${order.tokenNo}</div>
                <div class="order-info">
                  <span class="badge badge-${order.status}">${STATUS_INFO[order.status]?.emoji} ${order.status}</span>
                  <div class="order-date">${formatDateTime(order.submittedAt)}</div>
                </div>
                <span class="order-arrow">›</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderOrderDetail(order) {
    const status = order.status;
    
    return `
      <!-- Token Card -->
      <div class="card card-highlight text-center mb-6">
        <p class="text-xs text-secondary">Token Number</p>
        <div style="font-size: var(--font-size-4xl); font-weight: 800; color: var(--primary-light);">#${order.tokenNo}</div>
        <p class="text-xs text-secondary mt-1">${new Date(order.submittedAt).toLocaleDateString('en-IN')}</p>
      </div>

      <!-- Status Stepper -->
      <div class="card mb-6">
        <div class="stepper">
          <div class="stepper-progress" style="width: ${getProgressWidth(status)}"></div>
          ${STATUSES.map(s => {
            const state = getStepState(status, s);
            const info = STATUS_INFO[s];
            return `
              <div class="stepper-step ${state}">
                <div class="stepper-icon">${info.emoji}</div>
                <span class="stepper-label">${info.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Current Status -->
      <div class="card card-glass mb-4">
        <div class="flex items-center gap-3 mb-3">
          <span style="font-size: 1.5rem;">${STATUS_INFO[status]?.emoji}</span>
          <div>
            <div class="font-bold">${STATUS_INFO[status]?.label}</div>
            <div class="text-xs text-secondary">${STATUS_INFO[status]?.tamil}</div>
          </div>
          <div style="margin-left: auto;">
            <span class="badge badge-${status}">${status}</span>
          </div>
        </div>
        ${getStatusMessage(order)}
      </div>

      ${status === 'ready' && order.rackNo ? `
        <!-- Rack Location -->
        <div class="rack-card mb-6">
          <p class="text-sm font-medium" style="color: var(--success);">📍 Pickup Location</p>
          <div class="rack-number">Rack #${order.rackNo}</div>
          <p class="rack-label">Your laundry is ready for pickup!</p>
          <p class="text-xs text-secondary mt-2">Present your token to the staff</p>
        </div>
      ` : ''}

      <!-- Timeline -->
      <div class="card">
        <h4 class="mb-4">Timeline</h4>
        <div class="flex flex-col gap-4">
          ${renderTimeline(order)}
        </div>
      </div>
    `;
  }

  function getStatusMessage(order) {
    switch (order.status) {
      case 'submitted':
        return '<p class="text-sm text-secondary">Your laundry has been submitted. Waiting for staff to receive it.</p>';
      case 'received':
        return '<p class="text-sm text-secondary">Staff has received your laundry. It will be washed soon.</p>';
      case 'washing':
        return '<p class="text-sm text-secondary">Your clothes are currently being washed. Sit tight! 🧺</p>';
      case 'ready':
        return `<p class="text-sm" style="color: var(--success);">Your laundry is ready! Head to Rack #${order.rackNo || '—'} to pick it up.</p>`;
      case 'collected':
        return '<p class="text-sm text-secondary">Laundry has been collected. See you next time! 👋</p>';
      default:
        return '';
    }
  }

  function renderTimeline(order) {
    const events = [
      { status: 'submitted', time: order.submittedAt, label: 'Submitted' },
      { status: 'received', time: order.updatedAt && ['received', 'washing', 'ready', 'collected'].includes(order.status) ? order.updatedAt : null, label: 'Received by Staff' },
      { status: 'washing', time: order.updatedAt && ['washing', 'ready', 'collected'].includes(order.status) ? order.updatedAt : null, label: 'Washing Started' },
      { status: 'ready', time: order.updatedAt && ['ready', 'collected'].includes(order.status) ? order.updatedAt : null, label: `Ready — Rack #${order.rackNo || '?'}` },
      { status: 'collected', time: order.updatedAt && order.status === 'collected' ? order.updatedAt : null, label: 'Collected' },
    ];

    return events.map(e => `
      <div class="flex gap-3 items-start" style="opacity: ${e.time ? 1 : 0.3};">
        <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0;
             background: ${e.time ? `var(--status-${e.status})` : 'var(--bg-tertiary)'};">
        </div>
        <div>
          <div class="text-sm font-medium">${e.label}</div>
          <div class="text-xs text-secondary">${e.time ? formatDateTime(e.time) : 'Pending'}</div>
        </div>
      </div>
    `).join('');
  }

  function renderNoOrders(count) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📍</div>
        <h3>No Active Orders</h3>
        <p class="empty-text">Submit your laundry to start tracking.</p>
        <button class="btn btn-primary mt-4" onclick="window.location.hash='#/student/submit'">
          🏷️ Submit Laundry
        </button>
      </div>
    `;
  }

  await render();

  // Subscribe to order changes for real-time updates
  unsubscribe = subscribeToOrders(() => {
    render();
  });

  // Cleanup
  return () => {
    if (unsubscribe) unsubscribe();
  };
}
