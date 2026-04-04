// ── Token Lifecycle Service ──
// Tracks token states: available → in_use → washing → ready → collected → available
import { supabase } from '../supabase.js';

const VALID_TRANSITIONS = {
  available: ['in_use'],
  in_use: ['washing', 'available'],    // available for cancel
  washing: ['ready'],
  ready: ['collected'],
  collected: ['available']
};

// ── Query ──

export async function getTokenStatus(tokenNo) {
  // Find active token (not collected/available)
  const { data } = await supabase
    .from('tokens')
    .select('*')
    .eq('token_no', tokenNo)
    .in('status', ['in_use', 'washing', 'ready'])
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? data.status : 'available';
}

export async function getActiveTokenRecord(tokenNo) {
  const { data } = await supabase
    .from('tokens')
    .select('*')
    .eq('token_no', tokenNo)
    .in('status', ['in_use', 'washing', 'ready'])
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

export async function getAllTokenStatuses() {
  // Fetch all active (non-available) tokens
  const { data: activeTokens } = await supabase
    .from('tokens')
    .select('*')
    .in('status', ['in_use', 'washing', 'ready'])
    .order('token_no', { ascending: true });

  // Build a map of 1-100
  const statuses = {};
  for (let i = 1; i <= 100; i++) {
    statuses[i] = { tokenNo: i, status: 'available', orderId: null, assignedAt: null };
  }

  (activeTokens || []).forEach(t => {
    statuses[t.token_no] = {
      tokenNo: t.token_no,
      status: t.status,
      orderId: t.order_id,
      assignedAt: t.assigned_at
    };
  });

  return statuses;
}

export async function getAvailableTokens() {
  const all = await getAllTokenStatuses();
  return Object.values(all).filter(t => t.status === 'available').map(t => t.tokenNo);
}

// ── Lifecycle Operations ──

export async function assignToken(tokenNo, orderId) {
  // Verify token is available
  const currentStatus = await getTokenStatus(tokenNo);
  if (currentStatus !== 'available') {
    return { error: `Token #${tokenNo} is currently ${currentStatus}. Cannot assign.` };
  }

  const { data, error } = await supabase
    .from('tokens')
    .insert([{
      token_no: tokenNo,
      status: 'in_use',
      order_id: orderId,
      assigned_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    // Check for unique constraint violation (race condition)
    if (error.code === '23505') {
      return { error: `Token #${tokenNo} was just claimed by another student.` };
    }
    return { error: error.message };
  }

  return { token: data };
}

export async function updateTokenStatus(tokenNo, newStatus) {
  const record = await getActiveTokenRecord(tokenNo);

  if (!record) {
    // If transitioning to available (release), nothing to do
    if (newStatus === 'available') return { success: true };
    return { error: `No active record for token #${tokenNo}` };
  }

  const allowed = VALID_TRANSITIONS[record.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return { error: `Cannot transition token #${tokenNo} from ${record.status} to ${newStatus}` };
  }

  if (newStatus === 'available') {
    // Release the token
    return releaseToken(tokenNo);
  }

  const { data, error } = await supabase
    .from('tokens')
    .update({ status: newStatus })
    .eq('id', record.id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { token: data };
}

export async function releaseToken(tokenNo) {
  const record = await getActiveTokenRecord(tokenNo);
  if (!record) return { success: true };

  const { error } = await supabase
    .from('tokens')
    .update({
      status: 'collected',
      released_at: new Date().toISOString()
    })
    .eq('id', record.id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function forceReleaseToken(tokenNo) {
  // Admin override — force any active token to available
  const record = await getActiveTokenRecord(tokenNo);
  if (!record) return { success: true };

  const { error } = await supabase
    .from('tokens')
    .update({
      status: 'collected',
      released_at: new Date().toISOString()
    })
    .eq('id', record.id);

  if (error) return { error: error.message };
  return { success: true };
}

// ── Validation ──

export async function validateTokenAvailable(tokenNo) {
  if (tokenNo < 1 || tokenNo > 100) {
    return { valid: false, error: 'Token must be between 1 and 100' };
  }

  const status = await getTokenStatus(tokenNo);
  if (status !== 'available') {
    return { valid: false, error: `Token #${tokenNo} is currently ${status}` };
  }

  return { valid: true };
}

// ── Map order status → token status ──
export function orderStatusToTokenStatus(orderStatus) {
  const map = {
    submitted: 'in_use',
    received: 'in_use',
    washing: 'washing',
    ready: 'ready',
    collected: 'collected'
  };
  return map[orderStatus] || 'in_use';
}

// ── Realtime ──
let tokensChannel = null;
export function subscribeToTokens(callback) {
  if (!tokensChannel) {
    tokensChannel = supabase.channel('tokens-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, (payload) => {
        callback(payload);
      })
      .subscribe();
  }
  return () => {
    supabase.removeChannel(tokensChannel);
    tokensChannel = null;
  };
}
