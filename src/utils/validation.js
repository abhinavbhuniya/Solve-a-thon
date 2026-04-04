export function validateRegistration(regNo) {
  if (!regNo) return { valid: false, error: 'Registration number is required' };

  // Format: YYBXXNNNN
  const regex = /^(22|23|24|25)B([A-Z]{2})(\d{4})$/;
  const match = regNo.trim().toUpperCase().match(regex);

  if (!match) {
    return { 
      valid: false, 
      error: 'Invalid format. Expected format: YYBXXNNNN (e.g. 22BCE1001), where YY is 22-25.' 
    };
  }

  const branch = match[2];
  const roll = parseInt(match[3], 10);

  if (branch === 'CE') {
    if (!((roll >= 1000 && roll <= 1999) || (roll >= 5000 && roll <= 5999))) {
      return {
        valid: false,
        error: 'Invalid roll number for CE branch. Must be 1000-1999 or 5000-5999.'
      };
    }
  } else {
    if (roll < 1000 || roll > 1999) {
      return {
        valid: false,
        error: `Invalid roll number for ${branch} branch. Must be between 1000-1999.`
      };
    }
  }

  return { valid: true };
}

export function getBlocksForGender(gender) {
  if (gender === 'Male') {
    return ['A-Block', 'D1-Block', 'D2-Block', 'E-Block'];
  } else if (gender === 'Female') {
    return ['B-Block', 'C-Block'];
  }
  return [];
}

export function isValidGenderBlockCombo(gender, block) {
  const allowed = getBlocksForGender(gender);
  return allowed.includes(block);
}

export function parseRoom(roomStr) {
  if (!roomStr || roomStr.trim() === '') {
    return { valid: false, error: 'Room number is required.' };
  }
  return { valid: true, room: roomStr.trim() };
}

export function validateTokenLimit(tokenVal) {
  const token = parseInt(tokenVal, 10);
  if (isNaN(token) || token < 1 || token > 100) {
    return false;
  }
  return true;
}

export function validateDateSelection(date) {
  if (!date) return { valid: false, error: 'Please select a date.' };

  const selected = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(selected.getTime())) {
    return { valid: false, error: 'Invalid date format.' };
  }

  if (selected < today) {
    return { valid: false, error: 'Cannot select a past date.' };
  }

  const dow = selected.getDay();
  if (dow === 0 || dow === 6) {
    return { valid: false, error: 'Laundry service is not available on weekends.' };
  }

  return { valid: true };
}

export function validateCapacity(booked, capacity) {
  return booked < capacity;
}

export function validateMonthlyLimit(used, limit) {
  return used < limit;
}
