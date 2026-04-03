// ════════════════════════════════════════════════════════════
//  api.js — All HTTP calls to Flask backend
// ════════════════════════════════════════════════════════════

async function apiFetch(path, options = {}) {
  const userId  = window._currentUserId || '';
  const headers = {
    'Content-Type': 'application/json',
    ...(userId ? { 'X-User-Id': userId } : {}),
    ...(options.headers || {})
  };
  const url = `${API_BASE}${path}`;
  devLog(`API ${options.method || 'GET'} → ${url}`);
  let res;
  try { res = await fetch(url, { ...options, headers }); }
  catch { throw new Error('Cannot reach backend.'); }
  let data;
  try { data = await res.json(); }
  catch { throw new Error(`Non-JSON response (${res.status})`); }
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  devLog('API response:', data);
  return data;
}

const api = {
  // Auth
  login:      (userId, password)         => apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ userId, password }) }),
  adminSetup: (adminId, password)        => apiFetch('/api/admin/setup', { method: 'POST', body: JSON.stringify({ adminId, password }) }),
  health:     ()                         => apiFetch('/api/health'),

  // Admin
  createUser:     (name, role, dept)             => apiFetch('/api/admin/create-user', { method: 'POST', body: JSON.stringify({ name, role, dept }) }),
  getAllUsers:     ()                             => apiFetch('/api/admin/users'),
  changePassword: (currentPassword, newPassword) => apiFetch('/api/admin/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  // Students list (for professor)
  getStudents: () => apiFetch('/api/students'),

  // Classrooms
  createClassroom:    (name, desc, studentIds) => apiFetch('/api/classroom/create', { method: 'POST', body: JSON.stringify({ name, description: desc, studentIds }) }),
  myClassroomsProf:   ()                       => apiFetch('/api/classroom/mine'),
  myClassroomsStudent:()                       => apiFetch('/api/classroom/student'),
  getClassroom:       (id)                     => apiFetch(`/api/classroom/${id}`),
  getClassroomSubs:   (id)                     => apiFetch(`/api/classroom/${id}/submissions`),

  // Submissions
  submitProject:  (classroomId, title, desc, driveLink) =>
    apiFetch('/api/submission/submit', { method: 'POST', body: JSON.stringify({ classroomId, title, description: desc, driveLink }) }),
  gradeSubmission: (subId, grade, feedback) =>
    apiFetch(`/api/submission/${subId}/grade`, { method: 'POST', body: JSON.stringify({ grade, feedback }) }),
  mySubmissions: () => apiFetch('/api/submission/mine'),

  // Push
  savePushSubscription: (subscription) =>
    apiFetch('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) }),
};
