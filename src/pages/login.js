import { loginAsStudent, loginAsStaff, quickLoginStudent } from '../services/database.js';
import { showToast } from '../components/toast.js';
import { hideNav } from '../components/nav.js';
import { validateRegistration, getBlocksForGender, parseRoom } from '../utils/validation.js';

export default function loginPage(container) {
  hideNav();

  container.innerHTML = `
    <div class="login-page">
      <div class="login-logo">👕</div>
      <h1 class="login-title"><span class="text-gradient">Chota Dhobi</span></h1>
      <p class="login-subtitle">Hostel Laundry Tracking System</p>

      <!-- Role Tabs -->
      <div class="tabs mb-6" style="width: 100%;">
        <button class="tab active" id="tab-student-login" data-tab="student-login">🎓 Login</button>
        <button class="tab" id="tab-student-reg" data-tab="student-reg">✏️ Register</button>
        <button class="tab" id="tab-staff" data-tab="staff">👷 Staff</button>
      </div>

      <!-- Quick Login Form -->
      <form id="student-login-form" class="login-form">
        <div class="input-group">
          <label for="login-reg-no">Registration Number</label>
          <input type="text" id="login-reg-no" class="input" placeholder="e.g., RA2211003010456" required autocomplete="username" />
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block mt-4" id="login-student-btn">
          🎓 Quick Login
        </button>
      </form>

      <!-- Student Register Form -->
      <form id="student-reg-form" class="login-form hidden">
        <div class="input-group">
          <label for="reg-no">Registration Number</label>
          <input type="text" id="reg-no" class="input" placeholder="e.g., RA2211003010456" required autocomplete="username" />
        </div>
        <div class="input-group">
          <label for="student-name">Full Name</label>
          <input type="text" id="student-name" class="input" placeholder="Enter your name" required />
        </div>
        <div class="flex gap-3">
          <div class="input-group" style="flex:1">
            <label for="student-gender">Gender</label>
            <select id="student-gender" class="input" required>
              <option value="" disabled selected>Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div class="input-group" style="flex:1">
            <label for="hostel-block">Block</label>
            <select id="hostel-block" class="input" required>
              <option value="" disabled selected>Select Block</option>
            </select>
          </div>
        </div>
        <div class="flex gap-3">
          <div class="input-group" style="flex:1">
            <label for="room-floor">Floor (1-16)</label>
            <input type="number" id="room-floor" class="input" min="1" max="16" placeholder="Floor" required />
          </div>
          <div class="input-group" style="flex:1">
            <label for="room-index">Room (1-35)</label>
            <input type="number" id="room-index" class="input" min="1" max="35" placeholder="Index" required />
          </div>
        </div>
        <div class="input-group">
          <label for="phone">Phone Number (optional)</label>
          <input type="tel" id="phone" class="input" placeholder="e.g., 9876543210" />
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block mt-4" id="register-student-btn">
          ✏️ Register
        </button>
      </form>

      <!-- Staff Login Form -->
      <form id="staff-form" class="login-form hidden">
        <div style="text-align:center; margin-bottom: var(--space-4);">
          <div style="font-size:3rem; margin-bottom: var(--space-2);">👷</div>
          <p class="text-secondary text-sm">Enter staff PIN to access<br/>ஊழியர் PIN -ஐ உள்ளிடவும்</p>
        </div>
        <div class="input-group">
          <label for="staff-pin">Staff PIN / ஊழியர் PIN</label>
          <input type="password" id="staff-pin" class="input" placeholder="Enter 4-digit PIN" 
                 maxlength="4" inputmode="numeric" pattern="[0-9]*" style="text-align:center; font-size: var(--font-size-2xl); letter-spacing: 0.5em;" />
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block mt-4" id="login-staff-btn">
          👷 Login as Staff / ஊழியர் உள்நுழைவு
        </button>
        <p class="text-center text-xs text-secondary mt-4" style="opacity: 0.5;">Demo PIN: 1234</p>
      </form>
    </div>
  `;

  // Tab switching
  const tabs = container.querySelectorAll('.tab');
  const studentLoginForm = container.querySelector('#student-login-form');
  const studentRegForm = container.querySelector('#student-reg-form');
  const staffForm = container.querySelector('#staff-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      studentLoginForm.classList.add('hidden');
      studentRegForm.classList.add('hidden');
      staffForm.classList.add('hidden');

      if (tab.dataset.tab === 'student-login') {
        studentLoginForm.classList.remove('hidden');
      } else if (tab.dataset.tab === 'student-reg') {
        studentRegForm.classList.remove('hidden');
      } else {
        staffForm.classList.remove('hidden');
      }
    });
  });

  // Dynamic Block Dropdown
  const genderSelect = container.querySelector('#student-gender');
  const blockSelect = container.querySelector('#hostel-block');
  
  genderSelect.addEventListener('change', (e) => {
    const blocks = getBlocksForGender(e.target.value);
    blockSelect.innerHTML = '<option value="" disabled selected>Select Block</option>';
    blocks.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      blockSelect.appendChild(opt);
    });
  });

  // Quick Login (Existing Student)
  studentLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#login-student-btn');
    btn.innerHTML = 'Signing in...';
    btn.disabled = true;

    try {
      const regNo = container.querySelector('#login-reg-no').value.trim();
      const regValid = validateRegistration(regNo);
      if (!regValid.valid) {
        showToast(regValid.error, 'error');
        return;
      }

      const userObjOrError = await quickLoginStudent(regNo);
      if (userObjOrError && userObjOrError.error) {
        showToast(userObjOrError.error, 'error');
        return;
      }
      if (userObjOrError) {
        showToast(`Welcome back, ${userObjOrError.name}! 🎉`, 'success');
        window.location.hash = '#/student';
      }
    } catch(err) {
      showToast('Login failed: ' + err.message, 'error');
    } finally {
      btn.innerHTML = '🎓 Quick Login';
      btn.disabled = false;
    }
  });

  // Register New Student
  studentRegForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#register-student-btn');
    btn.innerHTML = 'Registering...';
    btn.disabled = true;

    try {
      const regNo = container.querySelector('#reg-no').value.trim();
      const name = container.querySelector('#student-name').value.trim();
      const gender = container.querySelector('#student-gender').value;
      const block = container.querySelector('#hostel-block').value;
      const floor = container.querySelector('#room-floor').value;
      const roomIdx = container.querySelector('#room-index').value;
      const phone = container.querySelector('#phone').value.trim();

      if (!regNo || !name || !gender || !block || !floor || !roomIdx) {
        showToast('Please fill in required fields', 'error');
        return;
      }

      const regValid = validateRegistration(regNo);
      if (!regValid.valid) {
        showToast(regValid.error, 'error');
        return;
      }

      const roomParsed = parseRoom(floor, roomIdx);
      if (!roomParsed.valid) {
        showToast(roomParsed.error, 'error');
        return;
      }

      const userObjOrError = await loginAsStudent(regNo, name, gender, roomParsed.room, block, phone);
      if (userObjOrError && userObjOrError.error) {
        showToast(userObjOrError.error, 'error');
        return;
      }

      if (userObjOrError) {
        showToast(`Welcome, ${userObjOrError.name}! 🎉`, 'success');
        window.location.hash = '#/student';
      }
    } catch(err) {
      showToast('Registration failed: ' + err.message, 'error');
    } finally {
      btn.innerHTML = '✏️ Register';
      btn.disabled = false;
    }
  });

  // Staff login
  staffForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = container.querySelector('#staff-pin').value.trim();

    if (!pin) {
      showToast('Please enter the PIN', 'error');
      return;
    }

    const user = loginAsStaff(pin);
    if (user) {
      showToast('Welcome, Staff! 👷', 'success');
      window.location.hash = '#/staff';
    } else {
      showToast('Invalid PIN — தவறான PIN', 'error');
      container.querySelector('#staff-pin').value = '';
    }
  });
}
