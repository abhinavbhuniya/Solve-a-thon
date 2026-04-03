import { supabase } from '../supabase.js';

// ── Transformers ──
// Map snake_case DB rows to camelCase App models
function mapStudent(dbRow) {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    name: dbRow.name,
    regNo: dbRow.reg_no,
    gender: dbRow.gender,
    phone: dbRow.phone,
    roomNo: dbRow.room_no,
    hostelBlock: dbRow.hostel_block,
    laundryDay: dbRow.laundry_day,
    role: 'student'
  };
}

function mapOrder(o) {
  if (!o) return null;
  return {
    id: o.id,
    tokenNo: o.token_no,
    studentId: o.student_id,
    studentName: o.student_name,
    roomNo: o.room_no,
    status: o.status,
    rackNo: o.rack_no,
    itemCount: o.item_count,
    submittedAt: o.submitted_at,
    updatedAt: o.updated_at,
    date: o.submitted_at ? o.submitted_at.split('T')[0] : null
  };
}

function mapNotification(n) {
  if (!n) return null;
  return {
    id: n.id,
    userId: n.student_id,
    title: n.title,
    body: n.message || n.body,
    type: n.type,
    status: n.status,
    read: n.read,
    createdAt: n.created_at,
    orderId: n.order_id
  };
}

// ── Authentication ──

export async function loginAsStudent(regNo, name, gender, roomNo, hostelBlock, phone) {
  let { data: user, error } = await supabase
    .from('students')
    .select('*')
    .eq('reg_no', regNo.toUpperCase())
    .single();

  if (!user && (error?.code === 'PGRST116' || error?.details?.includes('0 rows'))) {
    const schedule = getSchedule();
    const day = schedule[hostelBlock || 'A-Block'] ? Object.keys(schedule).find(k => schedule[k].blocks.includes(hostelBlock)) || 'Monday' : 'Monday';
    
    const { data: newUser, error: insertError } = await supabase
      .from('students')
      .insert([{
        name,
        reg_no: regNo.toUpperCase(),
        gender,
        phone: phone || '',
        room_no: roomNo || '',
        hostel_block: hostelBlock || 'A-Block',
        laundry_day: day
      }])
      .select()
      .single();

    if (insertError) return { error: insertError.message };
    user = newUser;
  } else if (error) {
    return { error: error.message };
  }

  if (user && user.gender !== gender) {
     await supabase.from('students').update({ gender }).eq('id', user.id);
     user.gender = gender;
  }

  const mappedUser = mapStudent(user);
  localStorage.setItem('chotadhobi_current_user', JSON.stringify(mappedUser));
  return mappedUser;
}

export async function quickLoginStudent(regNo) {
  let { data: user, error } = await supabase
    .from('students')
    .select('*')
    .eq('reg_no', regNo.toUpperCase())
    .single();

  if (error || !user) {
    return { error: 'Student not found. Please register as a new user.' };
  }

  const mappedUser = mapStudent(user);
  localStorage.setItem('chotadhobi_current_user', JSON.stringify(mappedUser));
  return mappedUser;
}

export function loginAsStaff(pin) {
  if (pin !== '1234') return null;
  const staffUser = { id: 'staff_1', name: 'Laundry Staff', role: 'staff' };
  localStorage.setItem('chotadhobi_current_user', JSON.stringify(staffUser));
  return staffUser;
}

export function getCurrentUser() {
  const stored = localStorage.getItem('chotadhobi_current_user');
  if (!stored) return null;
  try {
    const user = JSON.parse(stored);
    // If the student doesn't have a valid Supabase UUID (length 36), it's a legacy mock session. Force logout.
    if (user && user.role === 'student' && (!user.id || user.id.length !== 36)) {
      localStorage.removeItem('chotadhobi_current_user');
      return null;
    }
    return user;
  } catch(e) {
    return null;
  }
}

export function logout() {
  localStorage.removeItem('chotadhobi_current_user');
  window.location.hash = '#/login';
}

export function isStaff() {
  const u = getCurrentUser();
  return u && u.role === 'staff';
}

export function isStudent() {
  const u = getCurrentUser();
  return u && u.role === 'student';
}

// ── Schedule (Local config for now) ──
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
  return DEFAULT_SCHEDULE;
}

export function getScheduleForDay(day) {
  return DEFAULT_SCHEDULE[day] || null;
}

// ── Orders ──

export async function createOrder({ tokenNo, studentId, studentName, roomNo, itemCount }) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existing } = await supabase
    .from('orders')
    .select('*')
    .eq('token_no', tokenNo)
    .gte('submitted_at', todayStart.toISOString());

  if (existing && existing.length > 0) {
    return { error: 'Token already used today' };
  }

  const { data: order, error } = await supabase
    .from('orders')
    .insert([{
      token_no: parseInt(tokenNo),
      student_id: studentId,
      student_name: studentName,
      room_no: roomNo,
      item_count: itemCount || null,
      status: 'submitted'
    }])
    .select()
    .single();

  if (error) return { error: error.message };

  await addNotification({
    userId: studentId,
    title: 'Laundry Submitted',
    body: `Token #${tokenNo} — Your laundry has been submitted successfully.`,
    type: 'status_update',
    orderId: order.id
  });

  return { order: mapOrder(order) };
}

export async function getOrdersByStudent(studentId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });
  return (data || []).map(mapOrder);
}

export async function getActiveOrders() {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .neq('status', 'collected')
    .order('submitted_at', { ascending: false });
  return (data || []).map(mapOrder);
}

export async function getTodaysOrders() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('orders')
    .select('*')
    .gte('submitted_at', todayStart.toISOString())
    .order('submitted_at', { ascending: false });
  return (data || []).map(mapOrder);
}

export async function getOrderById(orderId) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  return mapOrder(data);
}

export async function getOrderByToken(tokenNo, dateStr) {
  let queryStart;
  if(dateStr) {
     queryStart = new Date(dateStr);
  } else {
     queryStart = new Date();
     queryStart.setHours(0,0,0,0);
  }
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('token_no', tokenNo)
    .gte('submitted_at', queryStart.toISOString())
    .limit(1)
    .single();
    
  return mapOrder(data);
}

export async function updateOrderStatus(orderId, newStatus, extra = {}) {
  const updates = { 
    status: newStatus,
    updated_at: new Date().toISOString()
  };
  
  if (extra.rackNo) updates.rack_no = extra.rackNo;
  // Let's set timestamps for legacy behavior if needed (which are mapped internally, but we'll stick to updated_at for now)

  const { data: order, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single();

  if (error) return { error: error.message };

  const statusMessages = {
    received: { title: '📥 Laundry Received', body: `Token #${order.token_no} — Staff has received your laundry.` },
    washing: { title: '🧺 Washing In Progress', body: `Token #${order.token_no} — Your clothes are being washed.` },
    ready: { title: '✅ Ready for Pickup!', body: `Token #${order.token_no} — Your laundry is ready! Rack #${order.rack_no || '—'}` },
    collected: { title: '📦 Collected', body: `Token #${order.token_no} — Laundry collected. Thank you!` }
  };

  const msg = statusMessages[newStatus];
  if (msg) {
    await addNotification({
      userId: order.student_id,
      title: msg.title,
      body: msg.body,
      type: newStatus === 'ready' ? 'ready_pickup' : 'status_update',
      orderId: order.id
    });
  }

  return { order: mapOrder(order) };
}

// ── Notifications ──

export async function addNotification({ userId, title, body, type, orderId }) {
  await supabase.from('notifications').insert([{
    student_id: userId,
    title,
    message: body,
    type,
    status: 'sent',
    order_id: orderId || null
  }]);
}

export async function getNotificationsForUser(userId) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('student_id', userId)
    .order('created_at', { ascending: false });
  return (data || []).map(mapNotification);
}

export async function getUnreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', userId)
    .eq('read', false);
  return count || 0;
}

export async function markNotificationRead(notifId) {
  await supabase.from('notifications').update({ read: true }).eq('id', notifId);
}

export async function markAllRead(userId) {
  await supabase.from('notifications').update({ read: true }).eq('student_id', userId);
}

// ── Stats ──

export async function getStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('orders')
    .select('status')
    .gte('submitted_at', todayStart.toISOString());
    
  let stats = { submitted: 0, received: 0, washing: 0, ready: 0, collected: 0, total: 0 };
  if (data) {
    data.forEach(o => {
      if (stats[o.status] !== undefined) stats[o.status]++;
      stats.total++;
    });
  }
  return stats;
}

// ── Realtime ──

// Map the realtime payload recursively if needed or let the consumer fetch fresh mapped data. We'll simply let consumer fetch.
let ordersChannel = null;
export function subscribeToOrders(callback) {
  if (!ordersChannel) {
    ordersChannel = supabase.channel('orders-public-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        // Just trigger callback to let UI re-fetch
        callback(payload);
      })
      .subscribe();
  }
  return () => {
    supabase.removeChannel(ordersChannel);
    ordersChannel = null;
  };
}
