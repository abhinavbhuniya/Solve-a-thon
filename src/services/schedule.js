// ── Schedule Service ──
// Manages date-based schedules, capacity tracking, and room-to-date assignments
import { supabase } from '../supabase.js';

// ── Default block-to-weekday mapping (fallback when no DB schedules exist) ──
const BLOCK_DAY_MAP = {
  'A-Block': 1,   // Monday
  'B-Block': 2,   // Tuesday
  'C-Block': 3,   // Wednesday
  'D-Block': 4,   // Thursday
  'D1-Block': 4,
  'D2-Block': 4,
  'E-Block': 5,   // Friday
};

const DEFAULT_CAPACITY = 100;

// ── Helpers ──
function toDateStr(d) {
  if (typeof d === 'string') return d.split('T')[0];
  return d.toISOString().split('T')[0];
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ── Fetch Schedules ──

export async function getSchedules(startDate, endDate) {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .gte('date', toDateStr(startDate))
    .lte('date', toDateStr(endDate))
    .order('date', { ascending: true });

  if (error) {
    console.error('getSchedules error:', error);
    return [];
  }
  return data || [];
}

export async function getScheduleForDate(date) {
  const dateStr = toDateStr(date);
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('date', dateStr)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('getScheduleForDate error:', error);
  }
  return data || null;
}

// ── CRUD ──

export async function createSchedule({ date, roomRangeStart, roomRangeEnd, hostelBlocks, capacity, timeSlot, description }) {
  const { data, error } = await supabase
    .from('schedules')
    .insert([{
      date: toDateStr(date),
      room_range_start: roomRangeStart || null,
      room_range_end: roomRangeEnd || null,
      hostel_blocks: hostelBlocks || [],
      capacity: capacity || DEFAULT_CAPACITY,
      booked_count: 0,
      time_slot: timeSlot || '8:00 AM - 12:00 PM',
      description: description || '',
      is_active: true
    }])
    .select()
    .single();

  if (error) return { error: error.message };
  return { schedule: data };
}

export async function updateSchedule(id, updates) {
  const payload = { updated_at: new Date().toISOString() };
  if (updates.roomRangeStart !== undefined) payload.room_range_start = updates.roomRangeStart;
  if (updates.roomRangeEnd !== undefined) payload.room_range_end = updates.roomRangeEnd;
  if (updates.hostelBlocks !== undefined) payload.hostel_blocks = updates.hostelBlocks;
  if (updates.capacity !== undefined) payload.capacity = updates.capacity;
  if (updates.timeSlot !== undefined) payload.time_slot = updates.timeSlot;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;

  const { data, error } = await supabase
    .from('schedules')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { schedule: data };
}

export async function deleteSchedule(id) {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

// ── Capacity Management ──

export async function checkCapacity(date) {
  const schedule = await getScheduleForDate(date);
  if (!schedule) return { available: true, remaining: DEFAULT_CAPACITY, capacity: DEFAULT_CAPACITY, booked: 0 };

  const remaining = schedule.capacity - schedule.booked_count;
  return {
    available: remaining > 0,
    remaining: Math.max(0, remaining),
    capacity: schedule.capacity,
    booked: schedule.booked_count
  };
}

export async function bookSlot(date) {
  const dateStr = toDateStr(date);

  // Try to atomically increment booked_count
  const { data: schedule } = await supabase
    .from('schedules')
    .select('*')
    .eq('date', dateStr)
    .single();

  if (!schedule) {
    // Auto-create schedule for this date with defaults
    const { data: newSched, error: createErr } = await supabase
      .from('schedules')
      .insert([{
        date: dateStr,
        capacity: DEFAULT_CAPACITY,
        booked_count: 1,
        hostel_blocks: [],
        time_slot: '8:00 AM - 12:00 PM',
        is_active: true
      }])
      .select()
      .single();

    if (createErr) return { error: createErr.message };
    return { success: true, schedule: newSched };
  }

  if (schedule.booked_count >= schedule.capacity) {
    return { error: 'This date is fully booked', full: true };
  }

  const { data: updated, error } = await supabase
    .from('schedules')
    .update({
      booked_count: schedule.booked_count + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', schedule.id)
    .eq('booked_count', schedule.booked_count) // Optimistic concurrency
    .select()
    .single();

  if (error || !updated) {
    return { error: 'Slot booking conflict. Please try again.' };
  }

  return { success: true, schedule: updated };
}

export async function releaseSlot(date) {
  const dateStr = toDateStr(date);
  const { data: schedule } = await supabase
    .from('schedules')
    .select('*')
    .eq('date', dateStr)
    .single();

  if (!schedule || schedule.booked_count <= 0) return;

  await supabase
    .from('schedules')
    .update({
      booked_count: Math.max(0, schedule.booked_count - 1),
      updated_at: new Date().toISOString()
    })
    .eq('id', schedule.id);
}

// ── Student Date Assignment ──

export function getDefaultDateForStudent(hostelBlock) {
  const targetDay = BLOCK_DAY_MAP[hostelBlock];
  if (targetDay === undefined) return null;

  const today = new Date();
  const todayDay = today.getDay(); // 0=Sun, 1=Mon...
  let diff = targetDay - todayDay;
  if (diff < 0) diff += 7;
  if (diff === 0) {
    // It's today — return today if before cutoff, else next week
    const hour = today.getHours();
    if (hour >= 12) diff = 7; // Past today's window
  }

  return toDateStr(addDays(today, diff));
}

export async function getAvailableDates(hostelBlock, daysAhead = 14) {
  const today = new Date();
  const end = addDays(today, daysAhead);
  const schedules = await getSchedules(today, end);

  const available = [];
  const defaultDate = getDefaultDateForStudent(hostelBlock);

  for (let d = new Date(today); d <= end; d = addDays(d, 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    const dateStr = toDateStr(d);
    const schedule = schedules.find(s => s.date === dateStr);

    const capacity = schedule ? schedule.capacity : DEFAULT_CAPACITY;
    const booked = schedule ? schedule.booked_count : 0;
    const remaining = capacity - booked;
    const isDefault = dateStr === defaultDate;

    if (remaining > 0 || isDefault) {
      available.push({
        date: dateStr,
        capacity,
        booked,
        remaining: Math.max(0, remaining),
        isDefault,
        isFull: remaining <= 0,
        hostelBlocks: schedule?.hostel_blocks || [],
        timeSlot: schedule?.time_slot || '8:00 AM - 12:00 PM'
      });
    }
  }

  return available;
}

// ── Bulk Schedule Generation ──

export async function generateSchedulesForMonth(year, month, config = {}) {
  const {
    capacity = DEFAULT_CAPACITY,
    timeSlot = '8:00 AM - 12:00 PM',
    blockAssignments = BLOCK_DAY_MAP
  } = config;

  const schedules = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dow = d.getDay();

    if (dow === 0 || dow === 6) continue; // Skip weekends

    const blocks = Object.entries(blockAssignments)
      .filter(([_, dayNum]) => dayNum === dow)
      .map(([block]) => block);

    schedules.push({
      date: toDateStr(d),
      hostel_blocks: blocks,
      capacity,
      booked_count: 0,
      time_slot: timeSlot,
      description: blocks.length > 0 ? `${blocks.join(', ')} Laundry Day` : 'Open Day',
      is_active: true
    });
  }

  // Upsert to avoid conflicts with existing schedules
  const { data, error } = await supabase
    .from('schedules')
    .upsert(schedules, { onConflict: 'date' })
    .select();

  if (error) return { error: error.message };
  return { schedules: data, count: (data || []).length };
}

// ── Realtime ──
let schedulesChannel = null;
export function subscribeToSchedules(callback) {
  if (!schedulesChannel) {
    schedulesChannel = supabase.channel('schedules-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, (payload) => {
        callback(payload);
      })
      .subscribe();
  }
  return () => {
    supabase.removeChannel(schedulesChannel);
    schedulesChannel = null;
  };
}
