// ── Student Notifications Page ──
import { getCurrentUser } from '../services/database.js';
import { getNotificationsForUser, markAllRead, markNotificationRead } from '../services/database.js';
import { renderNav, updateNavActive } from '../components/nav.js';

function timeAgo(isoStr) {
  const now = new Date();
  const then = new Date(isoStr);
  const diff = Math.floor((now - then) / 1000);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default async function studentNotifications(container) {
  const user = getCurrentUser();
  if (!user) { window.location.hash = '#/login'; return; }

  renderNav('student');
  updateNavActive();

  container.innerHTML = `<div class="page" style="display:flex; justify-content:center; align-items:center; height:100vh;"><p>Loading notifications...</p></div>`;

  const notifications = await getNotificationsForUser(user.id);
  const unreadCount = notifications.filter(n => !n.read).length;

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 style="font-size: var(--font-size-2xl);">Notifications</h1>
          <p class="text-secondary text-sm">${unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>
        </div>
        ${unreadCount > 0 ? `
          <button class="btn btn-ghost text-sm" id="mark-all-read">Mark all read</button>
        ` : ''}
      </div>

      ${notifications.length > 0 ? `
        <div class="flex flex-col gap-1">
          ${notifications.map(notif => `
            <div class="notif-item ${notif.read ? '' : 'unread'}" data-id="${notif.id}" 
                 ${notif.orderId ? `onclick="window.location.hash='#/student/track/${notif.orderId}'"` : ''}
                 style="cursor: ${notif.orderId ? 'pointer' : 'default'};">
              <div class="notif-dot"></div>
              <div class="notif-content">
                <div class="notif-title">${notif.title}</div>
                <div class="notif-body">${notif.body}</div>
                <div class="notif-time">${timeAgo(notif.createdAt)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">🔔</div>
          <h3>No Notifications</h3>
          <p class="empty-text">You'll see laundry updates here.</p>
        </div>
      `}
    </div>
  `;

  // Mark all read handler
  const markAllBtn = container.querySelector('#mark-all-read');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markAllRead(user.id);
      studentNotifications(container); // Re-render
    });
  }

  // Mark individual as read on click
  container.querySelectorAll('.notif-item.unread').forEach(item => {
    item.addEventListener('click', async () => {
      await markNotificationRead(item.dataset.id);
    });
  });
}
