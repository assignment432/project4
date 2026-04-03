// ════════════════════════════════════════════════════════════
//  app.js — Firebase init + app shell + role routing
// ════════════════════════════════════════════════════════════

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
devLog('Firebase initialized → project:', FIREBASE_CONFIG.projectId);

function mountApp() {
  const user = window._currentUser;
  document.getElementById('app').style.display          = 'block';
  document.getElementById('nav-avatar').textContent     = user.name.charAt(0).toUpperCase();
  document.getElementById('nav-name').textContent       = user.name;
  document.getElementById('nav-id-display').textContent = user.id;

  const badge = document.getElementById('nav-role-badge');
  badge.textContent = capitalize(user.role);
  badge.className   = 'role-badge ' + user.role;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  if (user.role === 'admin') {
    document.getElementById('page-admin').classList.add('active');
    loadAdminPage();

  } else if (user.role === 'professor') {
    document.getElementById('page-professor').classList.add('active');
    loadProfessorPage();

  } else if (user.role === 'student') {
    document.getElementById('page-student').classList.add('active');
    loadStudentPage();

  } else {
    toast('Unknown role. Contact administrator.', 'error');
    doLogout();
  }
}

// Grade modal state
let _gradingSubId = null;

function openGradeModal(subId) {
  _gradingSubId = subId;
  document.getElementById('grade-input').value    = '';
  document.getElementById('feedback-input').value = '';
  document.getElementById('grade-error').style.display = 'none';
  document.getElementById('grade-modal').classList.add('active');
}

function closeGradeModal() {
  document.getElementById('grade-modal').classList.remove('active');
  _gradingSubId = null;
}

async function submitGrade() {
  const grade    = document.getElementById('grade-input').value.trim();
  const feedback = document.getElementById('feedback-input').value.trim();
  const err      = document.getElementById('grade-error');
  const btn      = document.getElementById('grade-submit-btn');
  if (!grade) { showError(err, 'Grade is required'); return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await api.gradeSubmission(_gradingSubId, grade, feedback);
    toast('Graded successfully!', 'success');
    closeGradeModal();
    // Refresh current classroom view if open
    if (window._currentClassroomId) loadClassroomDetail(window._currentClassroomId);
  } catch (e) {
    showError(err, e.message);
  } finally { btn.disabled = false; btn.textContent = 'Save Grade'; }
}

boot();
