// ── Student Submit Page — Validation-First Flow ──
import { getCurrentUser, createOrder } from '../services/database.js';
import { checkMonthlyLimit, checkActiveOrder, validateSubmission, MONTHLY_LIMIT } from '../services/constraints.js';
import { getAvailableDates, getDefaultDateForStudent } from '../services/schedule.js';
import { getAvailableTokens, validateTokenAvailable } from '../services/token.js';
import { joinWaitlist, getWaitlistPosition } from '../services/waitlist.js';
import { showToast } from '../components/toast.js';
import { renderNav, updateNavActive } from '../components/nav.js';

export default async function studentSubmit(container) {
  const user = getCurrentUser();
  if (!user) { window.location.hash = '#/login'; return; }

  renderNav('student');
  updateNavActive();

  container.innerHTML = `<div class="page" style="display:flex; justify-content:center; align-items:center; height:100vh;"><p>Loading...</p></div>`;

  // Pre-check constraints
  const [monthly, activeCheck] = await Promise.all([
    checkMonthlyLimit(user.id),
    checkActiveOrder(user.id)
  ]);

  // If blocked, show blocker UI
  if (activeCheck.hasActive) {
    showBlockerUI(container, 'active_order', activeCheck);
    return;
  }

  if (!monthly.allowed) {
    showBlockerUI(container, 'monthly_limit', monthly);
    return;
  }

  // Normal flow
  let step = 'select-date'; // select-date → enter-token → confirm
  let selectedDate = null;
  let tokenValue = '';
  let isPriority = false;
  let availableDates = [];

  async function loadDates() {
    availableDates = await getAvailableDates(user.hostelBlock);
    const defaultDate = getDefaultDateForStudent(user.hostelBlock);
    // Pre-select default
    if (defaultDate) {
      const def = availableDates.find(d => d.date === defaultDate);
      if (def && !def.isFull) selectedDate = defaultDate;
    }
  }

  await loadDates();

  function render() {
    container.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1 style="font-size: var(--font-size-2xl);">Submit Laundry</h1>
            <p class="text-secondary text-sm">${getStepLabel()}</p>
          </div>
          ${step !== 'select-date' ? `<button class="btn btn-ghost" id="back-btn">← Back</button>` : ''}
        </div>

        <!-- Monthly Usage Badge -->
        <div class="card mb-4" style="padding: var(--space-3) var(--space-4);">
          <div class="flex justify-between items-center">
            <span class="text-sm text-secondary">Monthly Usage</span>
            <div class="flex items-center gap-2">
              <div class="usage-dots">
                ${Array.from({ length: MONTHLY_LIMIT }, (_, i) => `
                  <span class="usage-dot ${i < monthly.used ? 'used' : ''}"></span>
                `).join('')}
              </div>
              <span class="text-xs font-medium">${monthly.used}/${MONTHLY_LIMIT}</span>
            </div>
          </div>
        </div>

        ${step === 'select-date' ? renderDateSelection() : ''}
        ${step === 'enter-token' ? renderTokenEntry() : ''}
        ${step === 'confirm' ? renderConfirmation() : ''}
      </div>
    `;

    attachHandlers();
  }

  function getStepLabel() {
    if (step === 'select-date') return 'Step 1: Choose your laundry date';
    if (step === 'enter-token') return 'Step 2: Enter token number';
    if (step === 'confirm') return 'Step 3: Review & confirm';
    return '';
  }

  function renderDateSelection() {
    return `
      <!-- Priority Toggle -->
      <div class="card mb-4">
        <label class="flex items-center gap-3" style="cursor: pointer;">
          <input type="checkbox" id="priority-toggle" ${isPriority ? 'checked' : ''} 
                 style="width: 20px; height: 20px; accent-color: var(--primary);">
          <div>
            <span class="font-medium text-sm">⚡ Priority Booking</span>
            <p class="text-xs text-secondary">Uses 2 credits instead of 1. Gets earlier availability.</p>
          </div>
        </label>
      </div>

      <!-- Available Dates -->
      <div class="section-header">
        <h3 class="section-title">Available Dates</h3>
      </div>
      <div class="flex flex-col gap-3 mb-6">
        ${availableDates.length > 0 ? availableDates.map(d => `
          <div class="date-card ${selectedDate === d.date ? 'selected' : ''} ${d.isFull ? 'full' : ''}" 
               data-date="${d.date}">
            <div class="date-card-left">
              <div class="date-card-day font-bold">${formatDate(d.date)}</div>
              <div class="text-xs text-secondary">${d.timeSlot}</div>
              ${d.isDefault ? '<span class="badge badge-submitted text-xs mt-1">📌 Your Day</span>' : ''}
            </div>
            <div class="date-card-right">
              <div class="capacity-bar-mini">
                <div class="capacity-bar-fill-mini ${getCapClass(d)}" 
                     style="width: ${Math.min(100, (d.booked / d.capacity) * 100)}%"></div>
              </div>
              <div class="text-xs text-secondary">${d.remaining} slots left</div>
              ${d.isFull ? '<span class="text-xs" style="color: var(--warning);">Waitlist →</span>' : ''}
            </div>
          </div>
        `).join('') : '<div class="empty-state"><div class="empty-icon">📅</div><p class="empty-text">No available dates. Please check back later.</p></div>'}
      </div>

      <button class="btn btn-primary btn-xl btn-block" id="next-to-token" ${!selectedDate ? 'disabled' : ''}>
        Next: Enter Token →
      </button>
    `;
  }

  function renderTokenEntry() {
    return `
      <!-- Selected Date Display -->
      <div class="card card-highlight text-center mb-4" style="padding: var(--space-3);">
        <span class="text-xs text-secondary">Selected Date</span>
        <div class="font-bold">${formatDate(selectedDate)} ${isPriority ? '⚡' : ''}</div>
      </div>

      <!-- Token Display -->
      <div class="card card-glow text-center mb-6" style="padding: var(--space-8);">
        <p class="text-xs text-secondary mb-2">TOKEN NUMBER / டோக்கன் எண்</p>
        <div id="token-display" style="font-size: 3.5rem; font-weight: 800; color: var(--primary-light); min-height: 4rem; line-height: 1;">
          ${tokenValue || '<span style="opacity: 0.2; font-size: 2rem;">Enter token</span>'}
        </div>
      </div>

      <!-- Number Pad -->
      <div class="number-pad mb-6">
        <button class="number-pad-btn" data-num="1">1</button>
        <button class="number-pad-btn" data-num="2">2</button>
        <button class="number-pad-btn" data-num="3">3</button>
        <button class="number-pad-btn" data-num="4">4</button>
        <button class="number-pad-btn" data-num="5">5</button>
        <button class="number-pad-btn" data-num="6">6</button>
        <button class="number-pad-btn" data-num="7">7</button>
        <button class="number-pad-btn" data-num="8">8</button>
        <button class="number-pad-btn" data-num="9">9</button>
        <button class="number-pad-btn clear" data-action="clear">C</button>
        <button class="number-pad-btn" data-num="0">0</button>
        <button class="number-pad-btn backspace" data-action="backspace">⌫</button>
      </div>

      <!-- Submit Button -->
      <button class="btn btn-primary btn-xl btn-block" id="next-to-confirm" ${!tokenValue ? 'disabled' : ''}>
        Review & Confirm →
      </button>

      <p class="text-center text-xs text-secondary mt-4">
        Make sure you have the physical token from the staff before submitting.
      </p>
    `;
  }

  function renderConfirmation() {
    const tokenNum = parseInt(tokenValue);
    const dateInfo = availableDates.find(d => d.date === selectedDate);

    return `
      <!-- Confirmation Modal -->
      <div class="card card-highlight mb-6">
        <h3 class="text-center mb-4">📋 Confirm Submission</h3>
        
        <div class="confirm-detail-grid">
          <div class="confirm-detail">
            <span class="text-secondary text-sm">Student</span>
            <span class="font-bold">${user.name}</span>
          </div>
          <div class="confirm-detail">
            <span class="text-secondary text-sm">Room</span>
            <span class="font-bold">${user.roomNo} (${user.hostelBlock})</span>
          </div>
          <div class="confirm-detail">
            <span class="text-secondary text-sm">Date</span>
            <span class="font-bold">${formatDate(selectedDate)}</span>
          </div>
          <div class="confirm-detail">
            <span class="text-secondary text-sm">Token</span>
            <span class="font-bold" style="color: var(--primary-light); font-size: var(--font-size-xl);">#${tokenNum}</span>
          </div>
          <div class="confirm-detail">
            <span class="text-secondary text-sm">Time Slot</span>
            <span class="font-medium">${dateInfo?.timeSlot || '8:00 AM - 12:00 PM'}</span>
          </div>
          <div class="confirm-detail">
            <span class="text-secondary text-sm">Credits</span>
            <span class="font-medium">${isPriority ? '⚡ 2 (Priority)' : '1 (Standard)'}</span>
          </div>
        </div>
      </div>

      <!-- Validation Status -->
      <div id="validation-status" class="mb-6">
        <div class="card" style="text-align: center; padding: var(--space-4);">
          <div class="spinner-small"></div>
          <p class="text-sm text-secondary mt-2">Validating constraints...</p>
        </div>
      </div>

      <div class="flex gap-3">
        <button class="btn btn-secondary btn-lg" style="flex:1" id="back-to-token">← Edit</button>
        <button class="btn btn-primary btn-lg" style="flex:1" id="confirm-submit-btn" disabled>
          ✅ Confirm Submit
        </button>
      </div>
    `;
  }

  function attachHandlers() {
    // Back button
    container.querySelector('#back-btn')?.addEventListener('click', () => {
      if (step === 'enter-token') { step = 'select-date'; }
      else if (step === 'confirm') { step = 'enter-token'; }
      render();
    });

    // Priority toggle
    container.querySelector('#priority-toggle')?.addEventListener('change', (e) => {
      isPriority = e.target.checked;
      if (isPriority && monthly.remaining < 2) {
        showToast('Not enough credits for priority booking', 'error');
        isPriority = false;
        e.target.checked = false;
      }
    });

    // Date selection
    container.querySelectorAll('.date-card').forEach(card => {
      card.addEventListener('click', async () => {
        const date = card.dataset.date;
        const dateInfo = availableDates.find(d => d.date === date);

        if (dateInfo?.isFull) {
          // Offer waitlist
          if (confirm(`This date is fully booked. Would you like to join the waitlist for ${formatDate(date)}?`)) {
            const result = await joinWaitlist(user.id, date, isPriority);
            if (result.error) {
              showToast(result.error, 'error');
            } else {
              showToast(`Added to waitlist! Position: #${result.position}`, 'success');
            }
          }
          return;
        }

        selectedDate = date;
        render();
      });
    });

    // Next to token
    container.querySelector('#next-to-token')?.addEventListener('click', () => {
      if (!selectedDate) return;
      step = 'enter-token';
      render();
    });

    // Number pad
    container.querySelectorAll('.number-pad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.num !== undefined) {
          const newVal = tokenValue + btn.dataset.num;
          const tokenNum = parseInt(newVal, 10);
          if (tokenNum >= 1 && tokenNum <= 100) {
            tokenValue = newVal;
          } else if (tokenNum === 0 && tokenValue === '') {
            // Don't allow leading zero
          } else {
            showToast('Token must be between 1 and 100', 'error');
          }
        } else if (btn.dataset.action === 'clear') {
          tokenValue = '';
        } else if (btn.dataset.action === 'backspace') {
          tokenValue = tokenValue.slice(0, -1);
        }
        updateTokenUI();
        if (navigator.vibrate) navigator.vibrate(10);
      });
    });

    // Next to confirm
    container.querySelector('#next-to-confirm')?.addEventListener('click', () => {
      if (!tokenValue) return;
      step = 'confirm';
      render();
      // Run validation after rendering
      runValidation();
    });

    // Back to token from confirm
    container.querySelector('#back-to-token')?.addEventListener('click', () => {
      step = 'enter-token';
      render();
    });

    // Confirm submit
    container.querySelector('#confirm-submit-btn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#confirm-submit-btn');
      btn.disabled = true;
      btn.innerHTML = 'Submitting...';

      try {
        const result = await createOrder({
          tokenNo: parseInt(tokenValue),
          studentId: user.id,
          studentName: user.name,
          roomNo: user.roomNo,
          scheduledDate: selectedDate,
          isPriority
        });

        if (result.error) {
          showToast(result.error, 'error');
          btn.disabled = false;
          btn.innerHTML = '✅ Confirm Submit';
          return;
        }

        showToast('Laundry submitted successfully! 🎉', 'success');
        showSuccessUI(result.order);
      } catch (e) {
        showToast('Network Error: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '✅ Confirm Submit';
      }
    });
  }

  function updateTokenUI() {
    const display = container.querySelector('#token-display');
    const nextBtn = container.querySelector('#next-to-confirm');
    if (display) {
      display.innerHTML = tokenValue || '<span style="opacity: 0.2; font-size: 2rem;">Enter token</span>';
    }
    if (nextBtn) nextBtn.disabled = !tokenValue;
  }

  async function runValidation() {
    const statusDiv = container.querySelector('#validation-status');
    const confirmBtn = container.querySelector('#confirm-submit-btn');
    if (!statusDiv) return;

    const validation = await validateSubmission(user.id, selectedDate, parseInt(tokenValue), isPriority);

    if (validation.valid) {
      statusDiv.innerHTML = `
        <div class="card" style="border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.05);">
          <div class="flex items-center gap-3">
            <span style="font-size: 1.5rem;">✅</span>
            <div>
              <div class="font-bold text-sm" style="color: var(--success);">All checks passed</div>
              <div class="text-xs text-secondary">Ready to submit</div>
            </div>
          </div>
        </div>
      `;
      if (confirmBtn) confirmBtn.disabled = false;
    } else {
      statusDiv.innerHTML = `
        <div class="card" style="border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.05);">
          <div class="font-bold text-sm mb-2" style="color: var(--error);">❌ Validation Failed</div>
          ${validation.errors.map(e => `
            <div class="flex items-start gap-2 mb-2">
              <span class="text-xs" style="color: var(--error);">•</span>
              <span class="text-xs">${e.message}</span>
            </div>
          `).join('')}
        </div>
      `;
      if (confirmBtn) confirmBtn.disabled = true;
    }
  }

  function showSuccessUI(order) {
    container.innerHTML = `
      <div class="page" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div class="confirm-check">✓</div>
        <h2 class="mt-6 text-center">Laundry Submitted!</h2>
        <p class="text-secondary text-center mt-2">Your laundry has been logged successfully.</p>
        
        <div class="card w-full mt-6" style="text-align: center;">
          <div class="flex justify-between items-center mb-4">
            <span class="text-secondary text-sm">Token</span>
            <span class="font-bold" style="font-size: var(--font-size-xl); color: var(--primary-light);">#${order.tokenNo}</span>
          </div>
          <div class="flex justify-between items-center mb-4">
            <span class="text-secondary text-sm">Date</span>
            <span class="font-semibold">${formatDate(order.scheduledDate || order.date)}</span>
          </div>
          <div class="flex justify-between items-center mb-4">
            <span class="text-secondary text-sm">Status</span>
            <span class="badge badge-submitted">📝 Submitted</span>
          </div>
          ${order.isPriority ? `
            <div class="flex justify-between items-center mb-4">
              <span class="text-secondary text-sm">Type</span>
              <span class="badge badge-priority">⚡ Priority</span>
            </div>
          ` : ''}
          <div class="flex justify-between items-center">
            <span class="text-secondary text-sm">Credits Used</span>
            <span class="text-sm">${order.creditsUsed || 1} / ${MONTHLY_LIMIT}</span>
          </div>
        </div>

        <div class="flex gap-3 w-full mt-6">
          <button class="btn btn-secondary btn-lg" style="flex:1" onclick="window.location.hash='#/student/track/${order.id}'">
            📍 Track Order
          </button>
          <button class="btn btn-primary btn-lg" style="flex:1" onclick="window.location.hash='#/student'">
            🏠 Home
          </button>
        </div>
      </div>
    `;
  }

  function showBlockerUI(cont, type, data) {
    renderNav('student');
    updateNavActive();

    if (type === 'active_order') {
      cont.innerHTML = `
        <div class="page">
          <div class="page-header">
            <h1 style="font-size: var(--font-size-2xl);">Submit Laundry</h1>
          </div>
          <div class="card card-highlight text-center" style="padding: var(--space-8);">
            <div style="font-size: 3rem; margin-bottom: var(--space-4);">⚠️</div>
            <h3>Active Order In Progress</h3>
            <p class="text-secondary text-sm mt-2">
              You already have an active order (Token #${data.activeOrder.tokenNo}, status: <strong>${data.activeOrder.status}</strong>).
              Please collect it before submitting new laundry.
            </p>
            <button class="btn btn-primary btn-lg btn-block mt-6" 
                    onclick="window.location.hash='#/student/track/${data.activeOrder.id}'">
              📍 Track Active Order
            </button>
          </div>
        </div>
      `;
    } else {
      cont.innerHTML = `
        <div class="page">
          <div class="page-header">
            <h1 style="font-size: var(--font-size-2xl);">Submit Laundry</h1>
          </div>
          <div class="card card-highlight text-center" style="padding: var(--space-8);">
            <div style="font-size: 3rem; margin-bottom: var(--space-4);">🚫</div>
            <h3>Monthly Limit Reached</h3>
            <p class="text-secondary text-sm mt-2">
              You have used ${data.used} of ${data.limit} monthly credits.
              Your limit will reset at the start of next month.
            </p>
            <button class="btn btn-secondary btn-lg btn-block mt-6" onclick="window.location.hash='#/student'">
              🏠 Back to Home
            </button>
          </div>
        </div>
      `;
    }
  }

  render();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
}

function getCapClass(d) {
  const pct = (d.booked / d.capacity) * 100;
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'warning';
  return '';
}
