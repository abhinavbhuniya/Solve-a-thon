export function validateRegistration(regNo) {
  if (!regNo) return { valid: false, error: 'Registration number is required' };

  // Format: YYBXXNNNN
  // YY: 22, 23, 24, 25
  // B: Fixed strictly
  // XX: 2 uppercase letters
  // NNNN: 4 digit roll number
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
    // CE represents CSE: 1000-1999 or 5000-5999
    if (!((roll >= 1000 && roll <= 1999) || (roll >= 5000 && roll <= 5999))) {
      return {
        valid: false,
        error: 'Invalid roll number for CE branch. Must be 1000-1999 or 5000-5999.'
      };
    }
  } else {
    // Other valid branches: 1000-1999
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

export function parseRoom(floorStr, indexStr) {
  const floor = parseInt(floorStr, 10);
  const index = parseInt(indexStr, 10);

  if (isNaN(floor) || floor < 1 || floor > 16) {
    return { valid: false, error: 'Floor must be between 1 and 16.' };
  }

  if (isNaN(index) || index < 1 || index > 35) {
    return { valid: false, error: 'Room index must be between 1 and 35.' };
  }

  // Combine into string e.g., floor 1, index 1 -> '101'
  const formattedIndex = index.toString().padStart(2, '0');
  const roomCombined = `${floor}${formattedIndex}`;

  return { valid: true, room: roomCombined };
}

export function validateTokenLimit(tokenVal) {
  const token = parseInt(tokenVal, 10);
  if (isNaN(token) || token < 1 || token > 100) {
    return false;
  }
  return true;
}

export function validateItemCount(count) {
  const cnt = parseInt(count, 10);
  if (isNaN(cnt) || cnt < 1 || cnt > 9999) {
    return false;
  }
  return true;
}
