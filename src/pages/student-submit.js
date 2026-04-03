import { getCurrentUser } from '../services/database.js';
import { createOrder } from '../services/database.js';
import { showToast } from '../components/toast.js';
import { renderNav, updateNavActive } from '../components/nav.js';

export default function studentSubmit(container) {
  const user = getCurrentUser();
  if (!user) { window.location.hash = '#/login'; return; }

  renderNav('student');
  updateNavActive();

  let tokenValue = '';
  let itemCount = 1;

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 style="font-size: var(--font-size-2xl);">Submit Laundry</h1>
          <p class="text-secondary text-sm">Enter your physical token number</p>
        </div>
      </div>

      <!-- Token Display -->
      <div class="card card-highlight card-glow text-center mb-6" style="padding: var(--space-8);">
        <p class="text-xs text-secondary mb-2">TOKEN NUMBER / டோக்கன் எண்</p>
        <div id="token-display" style="font-size: 3.5rem; font-weight: 800; color: var(--primary-light); min-height: 4rem; line-height: 1;">
          <span style="opacity: 0.2; font-size: 2rem;">Enter token</span>
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

      <!-- Item Count -->
      <div class="card mb-6">
        <p class="text-sm font-medium mb-3">Number of Items (optional)</p>
        <div class="flex items-center justify-center gap-6">
          <button class="btn btn-icon btn-secondary" id="item-dec">−</button>
          <span style="font-size: var(--font-size-2xl); font-weight: 700; min-width: 40px; text-align: center;" id="item-count">${itemCount}</span>
          <button class="btn btn-icon btn-secondary" id="item-inc">+</button>
        </div>
      </div>

      <!-- Submit Button -->
      <button class="btn btn-primary btn-xl btn-block" id="submit-btn" disabled>
        ✅ Submit Laundry
      </button>

      <!-- Info -->
      <p class="text-center text-xs text-secondary mt-4">
        Make sure you have the physical token from the staff before submitting.
      </p>
    </div>
  `;

  // Number pad handlers
  const tokenDisplay = container.querySelector('#token-display');
  const submitBtn = container.querySelector('#submit-btn');

  function updateTokenUI() {
    tokenDisplay.innerHTML = tokenValue || '<span style="opacity: 0.2; font-size: 2rem;">Enter token</span>';
    submitBtn.disabled = !tokenValue;
  }

  container.querySelectorAll('.number-pad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.num !== undefined) {
        const newVal = tokenValue + btn.dataset.num;
        const tokenNum = parseInt(newVal, 10);
        if (tokenNum >= 1 && tokenNum <= 100) {
          tokenValue = newVal;
          updateTokenUI();
        } else {
           showToast('Token must be between 1 and 100', 'error');
        }
      } else if (btn.dataset.action === 'clear') {
        tokenValue = '';
        updateTokenUI();
      } else if (btn.dataset.action === 'backspace') {
        tokenValue = tokenValue.slice(0, -1);
        updateTokenUI();
      }
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(10);
    });
  });

  // Item count handlers
  const decBtn = container.querySelector('#item-dec');
  const incBtn = container.querySelector('#item-inc');
  const countDisplay = container.querySelector('#item-count');

  if (decBtn) {
    decBtn.addEventListener('click', () => {
      if (itemCount > 1) { 
        itemCount--; 
        countDisplay.textContent = itemCount;
      }
    });
  }
  if (incBtn) {
    incBtn.addEventListener('click', () => {
      if (itemCount < 9999) { 
        itemCount++; 
        countDisplay.textContent = itemCount;
      }
    });
  }

  // Submit handler
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (!tokenValue) {
        showToast('Please enter a token number', 'error');
        return;
      }

      const token = parseInt(tokenValue);
      if (token < 1 || token > 100) {
        showToast('Token must be between 1 and 100', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Submitting...';

      try {
        const result = await createOrder({
          tokenNo: token,
          studentId: user.id,
          studentName: user.name,
          roomNo: user.roomNo,
          itemCount: itemCount
        });

        if (result.error) {
          showToast(result.error, 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '✅ Submit Laundry';
          return;
        }

        showToast('Laundry submitted successfully! 🎉', 'success');
        showConfirmation(result.order);
      } catch (e) {
        showToast('Network Error', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '✅ Submit Laundry';
      }
    });
  }

  function showConfirmation(order) {
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
            <span class="text-secondary text-sm">Items</span>
            <span class="font-semibold">${order.itemCount || '—'}</span>
          </div>
          <div class="flex justify-between items-center mb-4">
            <span class="text-secondary text-sm">Status</span>
            <span class="badge badge-submitted">📝 Submitted</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-secondary text-sm">Date</span>
            <span class="text-sm">${new Date().toLocaleDateString('en-IN')}</span>
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

  render();
}
