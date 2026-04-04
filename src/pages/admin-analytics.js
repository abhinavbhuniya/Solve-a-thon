// ── Admin Analytics Dashboard ──
import { getCurrentUser, getDailyStats, getOrdersForAnalytics, getStudentAnalytics } from '../services/database.js';
import { getSchedules } from '../services/schedule.js';
import { getWaitlistStats } from '../services/waitlist.js';
import { renderNav, updateNavActive } from '../components/nav.js';

// Chart.js loaded via CDN
const CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';

let chartJsLoaded = false;
async function loadChartJs() {
  if (chartJsLoaded || typeof Chart !== 'undefined') { chartJsLoaded = true; return; }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHART_CDN;
    script.onload = () => { chartJsLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default async function adminAnalytics(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') { window.location.hash = '#/login'; return; }

  renderNav('admin');
  updateNavActive();

  container.innerHTML = `<div class="page" style="display:flex; justify-content:center; align-items:center; height:100vh;"><p>Loading analytics...</p></div>`;

  await loadChartJs();

  let rangeType = 'week'; // day, week, month
  const charts = {};

  function getDateRange() {
    const now = new Date();
    let start, end;
    if (rangeType === 'day') {
      start = new Date(now); start.setHours(0, 0, 0, 0);
      end = new Date(now); end.setHours(23, 59, 59, 999);
    } else if (rangeType === 'week') {
      start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      end = new Date(now); end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    return { start: start.toISOString(), end: end.toISOString(), startDate: start, endDate: end };
  }

  async function render() {
    const range = getDateRange();
    const [dailyStats, orders, schedules, waitlistStats, studentData] = await Promise.all([
      getDailyStats(range.start, range.end),
      getOrdersForAnalytics(range.start, range.end),
      getSchedules(range.startDate, range.endDate),
      getWaitlistStats(range.start.split('T')[0], range.end.split('T')[0]),
      getStudentAnalytics(range.start, range.end)
    ]);

    // Aggregated stats
    const totalOrders = orders.length;
    const statusCounts = { submitted: 0, received: 0, washing: 0, ready: 0, collected: 0 };
    let priorityCount = 0, missedCount = 0;
    orders.forEach(o => {
      if (statusCounts[o.status] !== undefined) statusCounts[o.status]++;
      if (o.isPriority) priorityCount++;
      if (o.missed) missedCount++;
    });

    // Capacity vs usage
    const totalCapacity = schedules.reduce((s, sc) => s + (sc.capacity || 100), 0);
    const totalBooked = schedules.reduce((s, sc) => s + (sc.booked_count || 0), 0);

    container.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1 style="font-size: var(--font-size-2xl);">📊 Analytics</h1>
            <p class="text-secondary text-sm">Data-driven insights</p>
          </div>
          <button class="btn btn-ghost" onclick="window.location.hash='#/admin'">← Back</button>
        </div>

        <!-- Time Range Filter -->
        <div class="tabs mb-6">
          <button class="tab ${rangeType === 'day' ? 'active' : ''}" data-range="day">Today</button>
          <button class="tab ${rangeType === 'week' ? 'active' : ''}" data-range="week">Week</button>
          <button class="tab ${rangeType === 'month' ? 'active' : ''}" data-range="month">Month</button>
        </div>

        <!-- Summary Cards -->
        <div class="admin-stats-grid mb-6">
          <div class="admin-stat-card">
            <div class="admin-stat-icon">📋</div>
            <div class="admin-stat-value">${totalOrders}</div>
            <div class="admin-stat-label">Total Orders</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-icon">⚡</div>
            <div class="admin-stat-value">${priorityCount}</div>
            <div class="admin-stat-label">Priority</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-icon">❌</div>
            <div class="admin-stat-value">${missedCount}</div>
            <div class="admin-stat-label">Missed</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-icon">📈</div>
            <div class="admin-stat-value">${totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0}%</div>
            <div class="admin-stat-label">Utilization</div>
          </div>
        </div>

        <!-- Status Pie Chart -->
        <div class="card mb-6">
          <h4 class="mb-4">📊 Status Distribution</h4>
          <div class="chart-container">
            <canvas id="chart-status-pie"></canvas>
          </div>
        </div>

        <!-- Daily Volume Bar Chart -->
        <div class="card mb-6">
          <h4 class="mb-4">📈 Daily Order Volume</h4>
          <div class="chart-container">
            <canvas id="chart-daily-bar"></canvas>
          </div>
        </div>

        <!-- Capacity Utilization Line Chart -->
        <div class="card mb-6">
          <h4 class="mb-4">📉 Capacity vs Usage</h4>
          <div class="chart-container">
            <canvas id="chart-capacity-line"></canvas>
          </div>
        </div>

        <!-- Waitlist Stats -->
        <div class="card mb-6">
          <h4 class="mb-4">⏳ Waitlist Statistics</h4>
          <div class="admin-stats-grid">
            <div class="admin-stat-card compact">
              <div class="admin-stat-value">${waitlistStats.total}</div>
              <div class="admin-stat-label">Total</div>
            </div>
            <div class="admin-stat-card compact">
              <div class="admin-stat-value">${waitlistStats.assigned}</div>
              <div class="admin-stat-label">Assigned</div>
            </div>
            <div class="admin-stat-card compact">
              <div class="admin-stat-value">${waitlistStats.waiting}</div>
              <div class="admin-stat-label">Waiting</div>
            </div>
            <div class="admin-stat-card compact">
              <div class="admin-stat-value">${waitlistStats.cancelled}</div>
              <div class="admin-stat-label">Cancelled</div>
            </div>
          </div>
        </div>

        <!-- Student Behavior Table -->
        <div class="card mb-6">
          <h4 class="mb-4">👤 Student Activity (Top 10)</h4>
          <div class="table-scroll">
            <table class="analytics-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Room</th>
                  <th>Orders</th>
                  <th>Priority</th>
                  <th>Missed</th>
                </tr>
              </thead>
              <tbody>
                ${studentData.sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 10).map(s => `
                  <tr>
                    <td class="font-medium">${s.studentName || 'Unknown'}</td>
                    <td>${s.roomNo || '—'}</td>
                    <td>${s.totalOrders}</td>
                    <td>${s.priorityOrders}</td>
                    <td>${s.missedSlots}</td>
                  </tr>
                `).join('')}
                ${studentData.length === 0 ? '<tr><td colspan="5" class="text-center text-secondary">No data available</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Peak Load Analysis -->
        <div class="card mb-6">
          <h4 class="mb-4">🔥 Peak Load by Day</h4>
          <div class="chart-container">
            <canvas id="chart-peak-bar"></canvas>
          </div>
        </div>
      </div>
    `;

    // Attach range filter
    container.querySelectorAll('[data-range]').forEach(tab => {
      tab.addEventListener('click', () => {
        rangeType = tab.dataset.range;
        // Destroy existing charts
        Object.values(charts).forEach(c => c.destroy());
        render();
      });
    });

    // Render charts
    renderCharts(statusCounts, dailyStats, schedules);
  }

  function renderCharts(statusCounts, dailyStats, schedules) {
    // Color scheme
    const colors = {
      submitted: '#8B5CF6',
      received: '#3B82F6',
      washing: '#F59E0B',
      ready: '#10B981',
      collected: '#6B7280'
    };

    const chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#F8FAFC', font: { family: 'Inter' } }
        }
      },
      scales: {
        x: { ticks: { color: '#94A3B8', font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(148,163,184,0.1)' } },
        y: { ticks: { color: '#94A3B8', font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(148,163,184,0.1)' } }
      }
    };

    // 1. Status Pie Chart
    const pieCtx = document.getElementById('chart-status-pie');
    if (pieCtx) {
      charts.pie = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
          labels: ['Submitted', 'Received', 'Washing', 'Ready', 'Collected'],
          datasets: [{
            data: [statusCounts.submitted, statusCounts.received, statusCounts.washing, statusCounts.ready, statusCounts.collected],
            backgroundColor: [colors.submitted, colors.received, colors.washing, colors.ready, colors.collected],
            borderWidth: 0,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94A3B8', font: { family: 'Inter' }, padding: 12, usePointStyle: true } }
          }
        }
      });
    }

    // 2. Daily Volume Bar
    const barCtx = document.getElementById('chart-daily-bar');
    if (barCtx && dailyStats.length > 0) {
      charts.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: dailyStats.map(d => formatShortDate(d.date)),
          datasets: [{
            label: 'Orders',
            data: dailyStats.map(d => d.total),
            backgroundColor: 'rgba(99,102,241,0.6)',
            borderColor: '#6366F1',
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
      });
    }

    // 3. Capacity Line
    const lineCtx = document.getElementById('chart-capacity-line');
    if (lineCtx && schedules.length > 0) {
      const sortedSchedules = [...schedules].sort((a, b) => a.date.localeCompare(b.date));
      charts.line = new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: sortedSchedules.map(s => formatShortDate(s.date)),
          datasets: [
            {
              label: 'Capacity',
              data: sortedSchedules.map(s => s.capacity),
              borderColor: '#6366F1',
              backgroundColor: 'rgba(99,102,241,0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointRadius: 3
            },
            {
              label: 'Booked',
              data: sortedSchedules.map(s => s.booked_count),
              borderColor: '#10B981',
              backgroundColor: 'rgba(16,185,129,0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointRadius: 3
            }
          ]
        },
        options: chartDefaults
      });
    }

    // 4. Peak Load by Day of Week
    const peakCtx = document.getElementById('chart-peak-bar');
    if (peakCtx && dailyStats.length > 0) {
      const dayTotals = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };
      const dayCounts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };
      dailyStats.forEach(d => {
        const dayName = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
        if (dayTotals[dayName] !== undefined) {
          dayTotals[dayName] += d.total;
          dayCounts[dayName]++;
        }
      });
      const avgByDay = Object.keys(dayTotals).map(day => ({
        day,
        avg: dayCounts[day] > 0 ? Math.round(dayTotals[day] / dayCounts[day]) : 0
      }));

      charts.peak = new Chart(peakCtx, {
        type: 'bar',
        data: {
          labels: avgByDay.map(d => d.day),
          datasets: [{
            label: 'Avg Orders',
            data: avgByDay.map(d => d.avg),
            backgroundColor: ['rgba(139,92,246,0.6)', 'rgba(59,130,246,0.6)', 'rgba(245,158,11,0.6)', 'rgba(16,185,129,0.6)', 'rgba(239,68,68,0.6)'],
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
      });
    }
  }

  await render();

  return () => {
    Object.values(charts).forEach(c => { try { c.destroy(); } catch(_) {} });
  };
}

function formatShortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
