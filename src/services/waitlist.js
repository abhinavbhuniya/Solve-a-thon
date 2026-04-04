// ── Waitlist Service ──
// Manages waitlist entries when dates are fully booked
import { supabase } from '../supabase.js';
import { addNotification } from './database.js';

// ── Join Waitlist ──

export async function joinWaitlist(studentId, date, isPriority = false) {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  // Check if student is already on waitlist for this date
  const { data: existing } = await supabase
    .from('waitlist')
    .select('*')
    .eq('student_id', studentId)
    .eq('requested_date', dateStr)
    .in('status', ['waiting', 'assigned'])
    .maybeSingle();

  if (existing) {
    return { error: 'You are already on the waitlist for this date.', entry: existing };
  }

  // Get current max position for this date
  const { data: lastEntry } = await supabase
    .from('waitlist')
    .select('position')
    .eq('requested_date', dateStr)
    .eq('status', 'waiting')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (lastEntry?.position || 0) + 1;

  const { data, error } = await supabase
    .from('waitlist')
    .insert([{
      student_id: studentId,
      requested_date: dateStr,
      priority: isPriority,
      status: 'waiting',
      position: isPriority ? 0 : position // Priority gets position 0 (top)
    }])
    .select()
    .single();

  if (error) return { error: error.message };

  // Re-order if priority was inserted
  if (isPriority) {
    await reorderWaitlist(dateStr);
  }

  return { entry: data, position: data.position };
}

// ── Get Waitlist Info ──

export async function getWaitlistPosition(studentId, date) {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  const { data } = await supabase
    .from('waitlist')
    .select('*')
    .eq('student_id', studentId)
    .eq('requested_date', dateStr)
    .in('status', ['waiting'])
    .maybeSingle();

  if (!data) return { onWaitlist: false, position: null };
  return { onWaitlist: true, position: data.position, entry: data };
}

export async function getWaitlistForDate(date) {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  const { data } = await supabase
    .from('waitlist')
    .select('*, students(name, reg_no, room_no, hostel_block)')
    .eq('requested_date', dateStr)
    .eq('status', 'waiting')
    .order('position', { ascending: true });

  return data || [];
}

export async function getStudentWaitlistEntries(studentId) {
  const { data } = await supabase
    .from('waitlist')
    .select('*')
    .eq('student_id', studentId)
    .in('status', ['waiting'])
    .order('requested_date', { ascending: true });

  return data || [];
}

// ── Process Waitlist (called when slot opens) ──

export async function processWaitlist(date) {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  // Get next person in line (priority first, then by position)
  const { data: nextEntry } = await supabase
    .from('waitlist')
    .select('*')
    .eq('requested_date', dateStr)
    .eq('status', 'waiting')
    .order('priority', { ascending: false })
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextEntry) return { assigned: false };

  // Mark as assigned
  const { error } = await supabase
    .from('waitlist')
    .update({
      status: 'assigned',
      assigned_at: new Date().toISOString(),
      notified_at: new Date().toISOString()
    })
    .eq('id', nextEntry.id);

  if (error) return { error: error.message };

  // Notify the student
  await addNotification({
    userId: nextEntry.student_id,
    title: '🎉 Waitlist Slot Available!',
    body: `A slot has opened up for ${dateStr}. You have been automatically assigned. Please submit your laundry.`,
    type: 'waitlist_assigned'
  });

  return { assigned: true, studentId: nextEntry.student_id, date: dateStr };
}

// ── Cancel ──

export async function cancelWaitlistEntry(entryId) {
  const { data, error } = await supabase
    .from('waitlist')
    .update({ status: 'cancelled' })
    .eq('id', entryId)
    .select()
    .single();

  if (error) return { error: error.message };

  // Re-order remaining entries
  await reorderWaitlist(data.requested_date);
  return { success: true };
}

// ── Reorder ──

async function reorderWaitlist(dateStr) {
  const { data: entries } = await supabase
    .from('waitlist')
    .select('*')
    .eq('requested_date', dateStr)
    .eq('status', 'waiting')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (!entries || entries.length === 0) return;

  for (let i = 0; i < entries.length; i++) {
    await supabase
      .from('waitlist')
      .update({ position: i + 1 })
      .eq('id', entries[i].id);
  }
}

// ── Stats (for admin analytics) ──

export async function getWaitlistStats(startDate, endDate) {
  const { data } = await supabase
    .from('waitlist')
    .select('*')
    .gte('requested_date', startDate)
    .lte('requested_date', endDate);

  if (!data) return { total: 0, waiting: 0, assigned: 0, cancelled: 0, expired: 0 };

  return {
    total: data.length,
    waiting: data.filter(w => w.status === 'waiting').length,
    assigned: data.filter(w => w.status === 'assigned').length,
    cancelled: data.filter(w => w.status === 'cancelled').length,
    expired: data.filter(w => w.status === 'expired').length
  };
}
