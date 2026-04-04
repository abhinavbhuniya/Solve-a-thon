// ── Student Constraints Service ──
// Enforces: monthly limits, active order checks, capacity, token availability
import { supabase } from '../supabase.js';
import { checkCapacity } from './schedule.js';
import { validateTokenAvailable } from './token.js';

const MONTHLY_LIMIT = 4;
const PRIORITY_COST = 2;

// ── Monthly Limit ──

export async function checkMonthlyLimit(studentId) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Count orders for this student in current month
  const monthStart = new Date(currentYear, currentMonth - 1, 1).toISOString();
  const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();

  const { count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .gte('submitted_at', monthStart)
    .lte('submitted_at', monthEnd);

  const used = count || 0;

  // Also count credits used (priority orders cost 2)
  const { data: priorityOrders } = await supabase
    .from('orders')
    .select('credits_used')
    .eq('student_id', studentId)
    .gte('submitted_at', monthStart)
    .lte('submitted_at', monthEnd);

  const creditsUsed = (priorityOrders || []).reduce((sum, o) => sum + (o.credits_used || 1), 0);

  return {
    allowed: creditsUsed < MONTHLY_LIMIT,
    used: creditsUsed,
    limit: MONTHLY_LIMIT,
    remaining: Math.max(0, MONTHLY_LIMIT - creditsUsed),
    orderCount: used
  };
}

// ── Active Order Check ──

export async function checkActiveOrder(studentId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('student_id', studentId)
    .not('status', 'eq', 'collected')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    hasActive: !!data,
    activeOrder: data ? {
      id: data.id,
      tokenNo: data.token_no,
      status: data.status,
      submittedAt: data.submitted_at
    } : null
  };
}

// ── Capacity Check ──

export async function checkCapacityForDate(date) {
  return checkCapacity(date);
}

// ── Comprehensive Pre-Submission Validation ──

export async function validateSubmission(studentId, date, tokenNo, isPriority = false) {
  const errors = [];

  // 1. Monthly limit
  const monthly = await checkMonthlyLimit(studentId);
  const creditCost = isPriority ? PRIORITY_COST : 1;

  if (monthly.remaining < creditCost) {
    errors.push({
      type: 'monthly_limit',
      message: `Monthly limit reached (${monthly.used}/${monthly.limit} credits used). ${isPriority ? 'Priority booking requires 2 credits.' : ''}`
    });
  }

  // 2. Active order check
  const activeCheck = await checkActiveOrder(studentId);
  if (activeCheck.hasActive) {
    errors.push({
      type: 'active_order',
      message: `You have an active order (Token #${activeCheck.activeOrder.tokenNo}, status: ${activeCheck.activeOrder.status}). Please collect it first.`
    });
  }

  // 3. Capacity check
  const capacity = await checkCapacityForDate(date);
  if (!capacity.available && !isPriority) {
    errors.push({
      type: 'capacity_full',
      message: `Selected date is fully booked (${capacity.booked}/${capacity.capacity}). You can join the waitlist instead.`
    });
  }

  // 4. Token availability
  if (tokenNo) {
    const tokenCheck = await validateTokenAvailable(tokenNo);
    if (!tokenCheck.valid) {
      errors.push({
        type: 'token_unavailable',
        message: tokenCheck.error
      });
    }
  }

  // 5. Date validity
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate < today) {
    errors.push({
      type: 'invalid_date',
      message: 'Cannot book a past date.'
    });
  }

  const dayOfWeek = selectedDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    errors.push({
      type: 'weekend',
      message: 'Laundry service is not available on weekends.'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      monthlyUsage: monthly,
      activeOrder: activeCheck,
      capacity,
      creditCost
    }
  };
}

// ── Missed Slot Detection ──

export async function checkMissedSlots(studentId, hostelBlock) {
  // Find past dates where this student's block was scheduled but they didn't submit
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .lt('date', now.toISOString().split('T')[0])
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .contains('hostel_blocks', [hostelBlock])
    .order('date', { ascending: false });

  if (!schedules || schedules.length === 0) return { missed: [], count: 0 };

  // Check which dates the student actually submitted on
  const { data: orders } = await supabase
    .from('orders')
    .select('scheduled_date, submitted_at')
    .eq('student_id', studentId)
    .gte('submitted_at', thirtyDaysAgo.toISOString());

  const submittedDates = new Set(
    (orders || []).map(o => o.scheduled_date || o.submitted_at?.split('T')[0])
  );

  const missed = schedules
    .filter(s => !submittedDates.has(s.date))
    .map(s => ({
      date: s.date,
      hostelBlocks: s.hostel_blocks,
      capacity: s.capacity
    }));

  return { missed, count: missed.length };
}

// ── Suggest Next Available Slot ──

export async function suggestNextSlot(hostelBlock) {
  const today = new Date();
  const twoWeeksAhead = new Date(today);
  twoWeeksAhead.setDate(twoWeeksAhead.getDate() + 14);

  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .gte('date', today.toISOString().split('T')[0])
    .lte('date', twoWeeksAhead.toISOString().split('T')[0])
    .eq('is_active', true)
    .order('date', { ascending: true });

  if (!schedules) return null;

  // Prefer dates assigned to the student's block first
  const blockDates = schedules.filter(s =>
    (s.hostel_blocks || []).includes(hostelBlock) && s.booked_count < s.capacity
  );

  if (blockDates.length > 0) return blockDates[0];

  // Otherwise return any date with capacity
  const openDates = schedules.filter(s => s.booked_count < s.capacity);
  return openDates.length > 0 ? openDates[0] : null;
}

export { MONTHLY_LIMIT, PRIORITY_COST };
