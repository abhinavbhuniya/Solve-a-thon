// ── Firestore Service (localStorage-based for demo) ──
// This simulates Firestore operations using localStorage
// Replace with actual Firestore calls for production

const ORDERS_KEY = 'chotadhobi_orders';
const SCHEDULE_KEY = 'chotadhobi_schedule';
const NOTIFICATIONS_KEY = 'chotadhobi_notifications';

// ── Event System for real-time updates ──
const listeners = new Map();

export function onOrdersChange(callback) {
  const id = Date.now() + Math.random();
  listeners.set(id, callback);
  // Fire immediately with current data
  callback(getOrders());
  return () => listeners.delete(id);
}

function notifyListeners() {
  const orders = getOrders();
  listeners.forEach(cb => cb(orders));
}

// ── Schedule ──
const DEFAULT_SCHEDULE = {
  Monday: { blocks: ['A-Block'], timeSlot: '8:00 AM - 12:00 PM', description: 'A-Block Laundry Day / A-பிளாக் சலவை நாள்' },
  Tuesday: { blocks: ['B-Block'], timeSlot: '8:00 AM - 12:00 PM', description: 'B-Block Laundry Day / B-பிளாக் சலவை நாள்' },
  Wednesday: { blocks: ['C-Block'], timeSlot: '8:00 AM - 12:00 PM', description: 'C-Block Laundry Day / C-பிளாக் சலவை நாள்' },
  Thursday: { blocks: ['D-Block'], timeSlot: '8:00 AM - 12:00 PM', description: 'D-Block Laundry Day / D-பிளாக் சலவை நாள்' },
  Friday: { blocks: ['E-Block'], timeSlot: '8:00 AM - 12:00 PM', description: 'E-Block Laundry Day / E-பிளாக் சலவை நாள்' },
  Saturday: { blocks: [], timeSlot: 'Closed', description: 'No laundry service / சலவை சேவை இல்லை' },
  Sunday: { blocks: [], timeSlot: 'Closed', description: 'No laundry service / சலவை சேவை இல்லை' }
};

export function getSchedule() {
  const stored = localStorage.getItem(SCHEDULE_KEY);
  if (!stored) {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(DEFAULT_SCHEDULE));
    return DEFAULT_SCHEDULE;
  }
  return JSON.parse(stored);
}

export function getScheduleForDay(day) {
  const schedule = getSchedule();
  return schedule[day] || null;
}

// ── Orders ──
function getOrdersRaw() {
  const stored = localStorage.getItem(ORDERS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  notifyListeners();
}

export function getOrders() {
  return getOrdersRaw();
}

export function getOrdersByStudent(studentId) {
  return getOrdersRaw().filter(o => o.studentId === studentId);
}

export function getOrdersByStatus(status) {
  return getOrdersRaw().filter(o => o.status === status);
}

export function getOrdersByDate(dateStr) {
  return getOrdersRaw().filter(o => o.date === dateStr);
}

export function getActiveOrders() {
  return getOrdersRaw().filter(o => o.status !== 'collected');
}

export function getTodaysOrders() {
  const today = new Date().toISOString().split('T')[0];
  return getOrdersRaw().filter(o => o.date === today);
}

export function getOrderByToken(tokenNo, dateStr) {
  const date = dateStr || new Date().toISOString().split('T')[0];
  return getOrdersRaw().find(o => o.tokenNo === tokenNo && o.date === date);
}

export function createOrder({ tokenNo, studentId, studentName, roomNo, itemCount }) {
  const orders = getOrdersRaw();
  const today = new Date().toISOString().split('T')[0];
  
  // Check for duplicate token today
  const existing = orders.find(o => o.tokenNo === tokenNo && o.date === today);
  if (existing) {
    return { error: 'Token already used today' };
  }
  
  const order = {
    id: 'order_' + Date.now(),
    tokenNo: parseInt(tokenNo),
    studentId,
    studentName: studentName || 'Student',
    roomNo: roomNo || '',
    status: 'submitted',
    rackNo: null,
    itemCount: itemCount || null,
    submittedAt: new Date().toISOString(),
    receivedAt: null,
    washingAt: null,
    readyAt: null,
    collectedAt: null,
    date: today
  };
  
  orders.push(order);
  saveOrders(orders);
  
  // Add notification
  addNotification({
    userId: studentId,
    title: 'Laundry Submitted',
    body: `Token #${tokenNo} — Your laundry has been submitted successfully.`,
    type: 'status_update',
    orderId: order.id
  });
  
  return { order };
}

export function updateOrderStatus(orderId, newStatus, extra = {}) {
  const orders = getOrdersRaw();
  const index = orders.findIndex(o => o.id === orderId);
  
  if (index === -1) return { error: 'Order not found' };
  
  const order = orders[index];
  order.status = newStatus;
  
  const now = new Date().toISOString();
  switch (newStatus) {
    case 'received': order.receivedAt = now; break;
    case 'washing': order.washingAt = now; break;
    case 'ready': 
      order.readyAt = now; 
      if (extra.rackNo) order.rackNo = extra.rackNo;
      break;
    case 'collected': order.collectedAt = now; break;
  }
  
  orders[index] = order;
  saveOrders(orders);
  
  // Notification messages
  const statusMessages = {
    received: {
      title: '📥 Laundry Received',
      body: `Token #${order.tokenNo} — Staff has received your laundry.`,
      titleTamil: 'சலவை பெறப்பட்டது'
    },
    washing: {
      title: '🧺 Washing In Progress',
      body: `Token #${order.tokenNo} — Your clothes are being washed.`,
      titleTamil: 'துவைப்பு நடக்கிறது'
    },
    ready: {
      title: '✅ Ready for Pickup!',
      body: `Token #${order.tokenNo} — Your laundry is ready! Rack #${order.rackNo || '—'}`,
      titleTamil: 'எடுக்க தயார்!'
    },
    collected: {
      title: '📦 Collected',
      body: `Token #${order.tokenNo} — Laundry collected. Thank you!`,
      titleTamil: 'சேகரிக்கப்பட்டது'
    }
  };
  
  const msg = statusMessages[newStatus];
  if (msg) {
    addNotification({
      userId: order.studentId,
      title: msg.title,
      body: msg.body,
      type: newStatus === 'ready' ? 'ready_pickup' : 'status_update',
      orderId: order.id
    });
  }
  
  return { order };
}

// ── Notifications ──
function getNotificationsRaw() {
  const stored = localStorage.getItem(NOTIFICATIONS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveNotifications(notifs) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifs));
}

export function addNotification({ userId, title, body, type, orderId }) {
  const notifs = getNotificationsRaw();
  notifs.unshift({
    id: 'notif_' + Date.now(),
    userId,
    title,
    body,
    type,
    read: false,
    createdAt: new Date().toISOString(),
    orderId: orderId || null
  });
  saveNotifications(notifs);
}

export function getNotificationsForUser(userId) {
  return getNotificationsRaw().filter(n => n.userId === userId);
}

export function getUnreadCount(userId) {
  return getNotificationsRaw().filter(n => n.userId === userId && !n.read).length;
}

export function markNotificationRead(notifId) {
  const notifs = getNotificationsRaw();
  const index = notifs.findIndex(n => n.id === notifId);
  if (index !== -1) {
    notifs[index].read = true;
    saveNotifications(notifs);
  }
}

export function markAllRead(userId) {
  const notifs = getNotificationsRaw();
  notifs.forEach(n => {
    if (n.userId === userId) n.read = true;
  });
  saveNotifications(notifs);
}

// ── Stats ──
export function getStats() {
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = getOrdersRaw().filter(o => o.date === today);
  
  return {
    submitted: todayOrders.filter(o => o.status === 'submitted').length,
    received: todayOrders.filter(o => o.status === 'received').length,
    washing: todayOrders.filter(o => o.status === 'washing').length,
    ready: todayOrders.filter(o => o.status === 'ready').length,
    collected: todayOrders.filter(o => o.status === 'collected').length,
    total: todayOrders.length
  };
}

// ── Demo Data Seeder ──
export function seedDemoData() {
  const today = new Date().toISOString().split('T')[0];
  const existingOrders = getOrdersRaw();
  
  // Only seed if no orders for today
  if (existingOrders.some(o => o.date === today)) return;
  
  const demoOrders = [
    {
      id: 'order_demo_1',
      tokenNo: 7,
      studentId: 'student_2',
      studentName: 'Rahul Sharma',
      roomNo: '412',
      status: 'ready',
      rackNo: 3,
      itemCount: 8,
      submittedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      receivedAt: new Date(Date.now() - 3.5 * 3600000).toISOString(),
      washingAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      readyAt: new Date(Date.now() - 0.5 * 3600000).toISOString(),
      collectedAt: null,
      date: today
    },
    {
      id: 'order_demo_2',
      tokenNo: 12,
      studentId: 'student_3',
      studentName: 'Priya Patel',
      roomNo: '210',
      status: 'washing',
      rackNo: null,
      itemCount: 5,
      submittedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      receivedAt: new Date(Date.now() - 2.5 * 3600000).toISOString(),
      washingAt: new Date(Date.now() - 1 * 3600000).toISOString(),
      readyAt: null,
      collectedAt: null,
      date: today
    }
  ];
  
  const allOrders = [...existingOrders, ...demoOrders];
  saveOrders(allOrders);
}
