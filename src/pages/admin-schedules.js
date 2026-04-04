// ── Admin Schedule Management Page ──
import { getCurrentUser } from '../services/database.js';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, generateSchedulesForMonth } from '../services/schedule.js';
import { showToast } from '../components/toast.js';
import { renderNav, updateNavActive } from '../components/nav.js';

export default async function adminSchedules(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') { window.location.hash = '#/login'; return; }

  renderNav('admin');
  updateNavActive();

  const today = new Date();
  let viewMonth = today.getMonth();
  let viewYear = today.getFullYear();
  let editingSchedule = null;

  async function render() {
    const startDate = new Date(viewYear, viewMonth, 1);
    const endDate = new Date(viewYear, viewMonth + 1, 0);
    const schedules = await getSchedules(startDate, endDate);
    const scheduleMap = {};
    schedules.forEach(s => { scheduleMap[s.date] = s; });

    const monthName = startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const daysInMonth = endDate.getDate();
    const firstDayOfWeek = startDate.getDay(); // 0=Sun

    container.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1 style="font-size: var(--font-size-2xl);">📅 Schedules</h1>
            <p class="text-secondary text-sm">Manage daily laundry schedules</p>
          </div>
          <button class="btn btn-ghost" onclick="window.location.hash='#/admin'">← Back</button>
        </div>

        <!-- Month Navigation -->
        <div class="card mb-6">
          <div class="flex justify-between items-center">
            <button class="btn btn-icon btn-secondary" id="prev-month">◀</button>
            <h3 class="font-bold">${monthName}</h3>
            <button class="btn btn-icon btn-secondary" id="next-month">▶</button>
          </div>
        </div>

        <!-- Bulk Generate -->
        <div class="flex gap-3 mb-6">
          <button class="btn btn-primary" style="flex:1" id="generate-month-btn">
            🔄 Generate ${monthName} Schedules
          </button>
        </div>

        <!-- Calendar Grid -->
        <div class="schedule-calendar mb-6">
          <div class="cal-header">Sun</div>
          <div class="cal-header">Mon</div>
          <div class="cal-header">Tue</div>
          <div class="cal-header">Wed</div>
          <div class="cal-header">Thu</div>
          <div class="cal-header">Fri</div>
          <div class="cal-header">Sat</div>
          ${renderCalendarCells(daysInMonth, firstDayOfWeek, viewYear, viewMonth, scheduleMap)}
        </div>

        <!-- Schedule Details / Edit Modal -->
        <div id="schedule-detail-area"></div>

        <!-- Schedule List -->
        <div class="section-header">
          <h3 class="section-title">All Schedules This Month</h3>
          <span class="badge badge-submitted">${schedules.length} days</span>
        </div>
        <div class="flex flex-col gap-3" id="schedule-list">
          ${schedules.length > 0 ? schedules.map(s => `
            <div class="card schedule-list-item" data-schedule-id="${s.id}" data-date="${s.date}" style="cursor:pointer;">
              <div class="flex justify-between items-center">
                <div>
                  <div class="font-bold text-sm">${formatDateReadable(s.date)}</div>
                  <div class="text-xs text-secondary mt-1">${(s.hostel_blocks || []).join(', ') || 'All Blocks'}</div>
                  <div class="text-xs text-secondary">${s.time_slot || '8:00 AM - 12:00 PM'}</div>
                </div>
                <div class="text-right">
                  <div class="capacity-bar-mini">
                    <div class="capacity-bar-fill-mini ${getCapacityClass(s.booked_count, s.capacity)}" 
                         style="width: ${Math.min(100, (s.booked_count / s.capacity) * 100)}%"></div>
                  </div>
                  <div class="text-xs text-secondary mt-1">${s.booked_count}/${s.capacity}</div>
                </div>
              </div>
            </div>
          `).join('') : '<div class="empty-state"><div class="empty-icon">📅</div><p class="empty-text">No schedules. Click "Generate" to auto-create.</p></div>'}
        </div>
      </div>
    `;

    attachHandlers(scheduleMap);
  }

  function renderCalendarCells(daysInMonth, firstDay, year, month, scheduleMap) {
    let cells = '';
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells += '<div class="cal-cell empty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dow = dateObj.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const schedule = scheduleMap[dateStr];
      const isToday = dateStr === today.toISOString().split('T')[0];

      let cls = 'cal-cell';
      if (isWeekend) cls += ' weekend';
      if (isToday) cls += ' today';
      if (schedule) cls += ' scheduled';

      let pct = 0;
      if (schedule) {
        pct = Math.round((schedule.booked_count / schedule.capacity) * 100);
        if (pct >= 90) cls += ' full';
        else if (pct >= 70) cls += ' busy';
      }

      cells += `
        <div class="${cls}" data-cal-date="${dateStr}">
          <span class="cal-day">${d}</span>
          ${schedule ? `<span class="cal-usage">${pct}%</span>` : ''}
        </div>
      `;
    }
    return cells;
  }

  function attachHandlers(scheduleMap) {
    container.querySelector('#prev-month')?.addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      render();
    });

    container.querySelector('#next-month')?.addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      render();
    });

    container.querySelector('#generate-month-btn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#generate-month-btn');
      btn.disabled = true;
      btn.innerHTML = 'Generating...';
      const result = await generateSchedulesForMonth(viewYear, viewMonth + 1);
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        showToast(`Generated ${result.count} schedules! ✅`, 'success');
      }
      await render();
    });

    // Calendar cell clicks
    container.querySelectorAll('[data-cal-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.dataset.calDate;
        const schedule = scheduleMap[dateStr];
        showScheduleDetail(dateStr, schedule);
      });
    });

    // Schedule list item clicks
    container.querySelectorAll('.schedule-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const dateStr = item.dataset.date;
        const schedule = scheduleMap[dateStr];
        showScheduleDetail(dateStr, schedule);
      });
    });
  }

  function showScheduleDetail(dateStr, schedule) {
    const area = container.querySelector('#schedule-detail-area');
    if (!area) return;

    const isNew = !schedule;
    const blocks = schedule?.hostel_blocks || [];

    area.innerHTML = `
      <div class="card card-highlight mb-6">
        <h4 class="mb-4">${isNew ? '➕ Create Schedule' : '✏️ Edit Schedule'} — ${formatDateReadable(dateStr)}</h4>
        <form id="schedule-form">
          <div class="input-group mb-4">
            <label>Hostel Blocks</label>
            <div class="flex gap-2 flex-wrap">
              ${['A-Block', 'B-Block', 'C-Block', 'D-Block', 'D1-Block', 'D2-Block', 'E-Block'].map(b => `
                <label class="chip-label">
                  <input type="checkbox" name="blocks" value="${b}" ${blocks.includes(b) ? 'checked' : ''}>
                  <span class="chip">${b}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="flex gap-3 mb-4">
            <div class="input-group" style="flex:1">
              <label>Room Range Start</label>
              <input type="text" class="input" id="sched-room-start" value="${schedule?.room_range_start || ''}" placeholder="e.g., 100">
            </div>
            <div class="input-group" style="flex:1">
              <label>Room Range End</label>
              <input type="text" class="input" id="sched-room-end" value="${schedule?.room_range_end || ''}" placeholder="e.g., 500">
            </div>
          </div>
          <div class="flex gap-3 mb-4">
            <div class="input-group" style="flex:1">
              <label>Capacity</label>
              <input type="number" class="input" id="sched-capacity" value="${schedule?.capacity || 100}" min="1" max="500">
            </div>
            <div class="input-group" style="flex:1">
              <label>Time Slot</label>
              <input type="text" class="input" id="sched-time" value="${schedule?.time_slot || '8:00 AM - 12:00 PM'}">
            </div>
          </div>
          <div class="input-group mb-4">
            <label>Description</label>
            <input type="text" class="input" id="sched-desc" value="${schedule?.description || ''}" placeholder="e.g., A-Block Laundry Day">
          </div>
          <div class="flex gap-3">
            <button type="submit" class="btn btn-primary" style="flex:1">${isNew ? '➕ Create' : '💾 Update'}</button>
            ${!isNew ? `<button type="button" class="btn btn-danger" id="delete-sched-btn">🗑️ Delete</button>` : ''}
            <button type="button" class="btn btn-secondary" id="cancel-sched-btn">Cancel</button>
          </div>
        </form>
      </div>
    `;

    // Form submit
    area.querySelector('#schedule-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const checkedBlocks = [...area.querySelectorAll('input[name="blocks"]:checked')].map(i => i.value);
      const data = {
        roomRangeStart: area.querySelector('#sched-room-start').value || null,
        roomRangeEnd: area.querySelector('#sched-room-end').value || null,
        hostelBlocks: checkedBlocks,
        capacity: parseInt(area.querySelector('#sched-capacity').value) || 100,
        timeSlot: area.querySelector('#sched-time').value,
        description: area.querySelector('#sched-desc').value
      };

      let result;
      if (isNew) {
        result = await createSchedule({ date: dateStr, ...data });
      } else {
        result = await updateSchedule(schedule.id, data);
      }

      if (result.error) {
        showToast(result.error, 'error');
      } else {
        showToast(`Schedule ${isNew ? 'created' : 'updated'} ✅`, 'success');
        await render();
      }
    });

    // Delete
    area.querySelector('#delete-sched-btn')?.addEventListener('click', async () => {
      if (!confirm('Delete this schedule?')) return;
      const result = await deleteSchedule(schedule.id);
      if (result.error) showToast(result.error, 'error');
      else { showToast('Schedule deleted', 'success'); await render(); }
    });

    // Cancel
    area.querySelector('#cancel-sched-btn')?.addEventListener('click', () => {
      area.innerHTML = '';
    });

    // Scroll to detail
    area.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  await render();
}

function formatDateReadable(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
}

function getCapacityClass(booked, capacity) {
  const pct = (booked / capacity) * 100;
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'warning';
  return '';
}
