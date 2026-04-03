// ── Authentication Service ──
// Using localStorage-based demo auth for hackathon (no Firebase dependency required)
// Replace with Firebase Auth for production

import { showToast } from '../components/toast.js';
import { validateRegistration, isValidGenderBlockCombo } from '../utils/validation.js';

const USERS_KEY = 'chotadhobi_users';
const CURRENT_USER_KEY = 'chotadhobi_current_user';
const STAFF_PIN = '1234';

// Default demo users
const DEFAULT_USERS = [
  {
    id: 'student_1',
    name: 'Abhinav Kumar',
    regNo: '24BCE1731',
    phone: '9876543210',
    roomNo: '305',
    hostelBlock: 'A-Block',
    laundryDay: 'Monday',
    role: 'student'
  },
  {
    id: 'student_2',
    name: 'Rahul Sharma',
    regNo: '24BCE1732',
    phone: '9876543211',
    roomNo: '412',
    hostelBlock: 'B-Block',
    laundryDay: 'Tuesday',
    role: 'student'
  },
  {
    id: 'student_3',
    name: 'Priya Patel',
    regNo: '24BCE1733',
    phone: '9876543212',
    roomNo: '210',
    hostelBlock: 'A-Block',
    laundryDay: 'Monday',
    role: 'student'
  }
];

function getUsers() {
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }
  return JSON.parse(stored);
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentUser() {
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function loginAsStudent(regNo, name, gender, roomNo, hostelBlock, phone) {
  const regValidation = validateRegistration(regNo);
  if (!regValidation.valid) {
    return { error: regValidation.error };
  }

  if (!isValidGenderBlockCombo(gender, hostelBlock)) {
    return { error: `Block ${hostelBlock} is not valid for gender ${gender}.` };
  }

  const users = getUsers();
  
  // Check if user exists
  let user = users.find(u => u.regNo === regNo);
  
  if (!user) {
    // Create new user
    user = {
      id: 'student_' + Date.now(),
      name: name || 'Student',
      regNo: regNo.toUpperCase(),
      gender: gender,
      phone: phone || '',
      roomNo: roomNo || '',
      hostelBlock: hostelBlock || 'A-Block',
      laundryDay: getAssignedDay(hostelBlock || 'A-Block'),
      role: 'student'
    };
    users.push(user);
    saveUsers(users);
  } else {
    // If user exists, optionally update gender if it was missing?
    user.gender = gender;
  }
  
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  return user;
}

export function loginAsStaff(pin) {
  if (pin !== STAFF_PIN) {
    return null;
  }
  
  const staffUser = {
    id: 'staff_1',
    name: 'Laundry Staff',
    role: 'staff'
  };
  
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(staffUser));
  return staffUser;
}

export function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
  window.location.hash = '#/login';
}

export function isLoggedIn() {
  return !!getCurrentUser();
}

export function isStaff() {
  const user = getCurrentUser();
  return user && user.role === 'staff';
}

export function isStudent() {
  const user = getCurrentUser();
  return user && user.role === 'student';
}

// Assign laundry day based on hostel block
function getAssignedDay(block) {
  const schedule = {
    'A-Block': 'Monday',
    'B-Block': 'Tuesday',
    'C-Block': 'Wednesday',
    'D-Block': 'Thursday',
    'E-Block': 'Friday'
  };
  return schedule[block] || 'Monday';
}

// Get all students (for staff view)
export function getAllStudents() {
  return getUsers().filter(u => u.role === 'student');
}

export function getStudentById(id) {
  return getUsers().find(u => u.id === id);
}
