// ════════════════════════════════════════════════════════════
//  student.js — Student: view classrooms, submit, change password
// ════════════════════════════════════════════════════════════

let _selectedClassroomId   = null;
let _studentClassrooms     = [];

function switchStudentTab(tab, el) {
  document.querySelectorAll('#page-student .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('stab-classrooms').style.display = tab === 'classrooms' ? 'block' : 'none';
  document.getElementById('stab-submit').style.display     = tab === 'submit'     ? 'block' : 'none';
  document.getElementById('stab-track').style.display      = tab === 'track'      ? 'block' : 'none';
  document.getElementById('stab-password').style.display   = tab === 'password'   ? 'block' : 'none';
  if (tab === 'track') loadMySubmissions();
  if (tab === 'submit') loadClassroomDropdown();
}

async function loadStudentPage() {
  loadStudentClassrooms();
}

// ─── Deadline helpers ─────────────────────────────────────
function deadlineBadgeStu(isoDeadline) {
  if (!isoDeadline) return '';
  const now  = Date.now();
  const dl   = new Date(isoDeadline).getTime();
  const diff = dl - now;
  let state, label;
  if (diff < 0)             { state = 'passed'; label = '⛔ Deadline passed'; }
  else if (diff < 3600000)  { state = 'urgent'; label = `🔴 Due in ${Math.ceil(diff/60000)} min`; }
  else if (diff < 86400000) { state = 'soon';   label = `⚠ Due in ${Math.ceil(diff/3600000)} hr`; }
  else                      { state = 'ok';     label = `Due ${formatDateTime(isoDeadline)}`; }
  return `<span class="deadline-badge ${state}">${label}</span>`;
}

// ─── Classrooms list ───────────────────────────────────────
async function loadStudentClassrooms() {
  const container = document.getElementById('student-classrooms-list');
  container.innerHTML = '<div class="spinner">Loading…</div>';
  try {
    const data = await api.myClassroomsStudent();
    _studentClassrooms = data.classrooms || [];
    if (_studentClassrooms.length === 0) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">🏫</div><p>You are not enrolled in any classrooms yet.</p></div>';
      return;
    }
    container.innerHTML = _studentClassrooms.map(c => {
      const asgn = c.assignment || {};
      return `
        <div class="classroom-card" onclick="quickSubmit('${c.id}', '${(c.name || '').replace(/'/g,"\\'")}')">
          <div class="classroom-card-title">${c.name}</div>
          ${c.description ? `<div style="color:var(--muted2);font-size:12px;margin:3px 0 6px">${c.description}</div>` : ''}
          ${asgn.title ? `
            <div style="font-size:12px;color:var(--text2);margin-bottom:6px">
              📋 <strong>${asgn.title}</strong>
              ${asgn.description ? ` — <span style="color:var(--muted2)">${truncate(asgn.description, 50)}</span>` : ''}
            </div>
            ${asgn.deadline ? `<div style="margin-bottom:6px">${deadlineBadgeStu(asgn.deadline)}</div>` : ''}
          ` : ''}
          <div class="classroom-meta">
            <span>👨‍🏫 ${c.professorName}</span>
            <span>👥 ${c.studentIds?.length || 0} students</span>
          </div>
          <div style="margin-top:10px;font-size:11px;color:var(--red);font-weight:600">Click to submit →</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

// ─── Quick submit from classroom card ─────────────────────
function quickSubmit(cid, cname) {
  _selectedClassroomId = cid;
  const tab = document.querySelector('#page-student .tab:nth-child(2)');
  switchStudentTab('submit', tab);
  loadClassroomDropdown().then(() => {
    const sel = document.getElementById('sub-classroom');
    if (sel) { sel.value = cid; onClassroomSelect(); }
  });
}

// ─── Classroom dropdown for submit form ───────────────────
async function loadClassroomDropdown() {
  const sel = document.getElementById('sub-classroom');
  sel.innerHTML = '<option value="">Loading…</option>';
  try {
    const data = await api.myClassroomsStudent();
    _studentClassrooms = data.classrooms || [];
    if (_studentClassrooms.length === 0) {
      sel.innerHTML = '<option value="">No classrooms available</option>';
      return;
    }
    sel.innerHTML = '<option value="">— Select a classroom —</option>' +
      _studentClassrooms.map(c => `<option value="${c.id}">${c.name} (${c.professorName})</option>`).join('');
    if (_selectedClassroomId) { sel.value = _selectedClassroomId; onClassroomSelect(); }
  } catch (e) {
    sel.innerHTML = '<option value="">Failed to load</option>';
  }
}

// ─── Show assignment banner when classroom selected ────────
function onClassroomSelect() {
  const cid    = document.getElementById('sub-classroom').value;
  const banner = document.getElementById('assignment-banner');
  if (!cid) { banner.style.display = 'none'; return; }
  const cls  = _studentClassrooms.find(c => c.id === cid);
  const asgn = cls?.assignment;
  if (!asgn || !asgn.title) { banner.style.display = 'none'; return; }
  document.getElementById('banner-title').textContent = asgn.title;
  document.getElementById('banner-desc').textContent  = asgn.description || '';
  const dlEl = document.getElementById('banner-deadline');
  dlEl.innerHTML = asgn.deadline ? deadlineBadgeStu(asgn.deadline) + `<span style="font-size:11px;color:var(--muted2);margin-left:6px">${formatDateTime(asgn.deadline)}</span>` : '';
  banner.style.display = 'block';
}

// ─── Submit project ────────────────────────────────────────
async function submitProject() {
  const cid       = document.getElementById('sub-classroom').value;
  const title     = document.getElementById('sub-title').value.trim();
  const desc      = document.getElementById('sub-desc').value.trim();
  const driveLink = document.getElementById('sub-drive-link').value.trim();
  const btn       = document.getElementById('submit-project-btn');

  if (!cid)       { toast('Select a classroom.', 'error'); return; }
  if (!title)     { toast('Enter a project title.', 'error'); return; }
  if (!driveLink) { toast('Paste your Google Drive link.', 'error'); return; }

  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    await api.submitProject(cid, title, desc, driveLink);
    document.getElementById('sub-title').value      = '';
    document.getElementById('sub-desc').value       = '';
    document.getElementById('sub-drive-link').value = '';
    document.getElementById('sub-classroom').value  = '';
    document.getElementById('assignment-banner').style.display = 'none';
    _selectedClassroomId = null;
    toast('Project submitted! Your professor will be notified.', 'success');
    const trackTab = document.querySelector('#page-student .tab:nth-child(3)');
    switchStudentTab('track', trackTab);
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  } finally { btn.disabled = false; btn.textContent = 'Submit Project →'; }
}

// ─── My submissions ────────────────────────────────────────
async function loadMySubmissions() {
  const tbody = document.getElementById('my-submissions-table');
  tbody.innerHTML = '<tr><td colspan="7"><div class="spinner">Loading…</div></td></tr>';
  try {
    const data = await api.mySubmissions();
    const subs = data.submissions || [];
    if (subs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="empty-icon">📋</div><p>No submissions yet.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = subs.map(s => `
      <tr>
        <td>
          <div style="font-weight:500;color:var(--text)">${s.title}</div>
          ${s.description ? `<div style="color:var(--muted2);font-size:11px">${truncate(s.description, 32)}</div>` : ''}
        </td>
        <td style="font-size:12px;color:var(--text2)">${s.classroomName || '—'}</td>
        <td style="font-size:12px;color:var(--text2)">${s.professorName || '—'}</td>
        <td><a href="${s.driveLink}" target="_blank" rel="noopener" class="drive-link">📁 Open</a></td>
        <td style="font-size:11px;color:var(--muted2)">${formatDateTime(s.submittedAt)}</td>
        <td><span class="status ${s.status}">${s.status === 'graded' ? 'Graded' : 'Submitted'}</span></td>
        <td>
          ${s.grade
            ? `<div class="grade-badge">${s.grade}</div>${s.feedback ? `<div style="color:var(--muted2);font-size:11px;margin-top:3px">${truncate(s.feedback, 28)}</div>` : ''}`
            : '<span style="color:var(--muted2);font-size:12px">Pending</span>'}
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="empty-icon">⚠️</div><p>${e.message}</p></div></td></tr>`;
  }
}

// ─── Student password change ───────────────────────────────
async function studentChangePassword() {
  const curPass     = document.getElementById('stu-cur-pass').value;
  const newPass     = document.getElementById('stu-new-pass').value;
  const confirmPass = document.getElementById('stu-confirm-pass').value;
  const btn         = document.getElementById('stu-change-pass-btn');
  const err         = document.getElementById('stu-pass-error');
  err.style.display = 'none';

  if (!curPass || !newPass || !confirmPass) { showError(err, 'Fill in all fields.'); return; }
  if (newPass.length < 10)                  { showError(err, 'Min 10 characters.'); return; }
  if (newPass !== confirmPass)              { showError(err, 'Passwords do not match.'); return; }
  if (curPass === newPass)                  { showError(err, 'New password must differ from current.'); return; }

  btn.disabled = true; btn.textContent = 'Updating…';
  try {
    await api.changePasswordUser(curPass, newPass);
    document.getElementById('stu-cur-pass').value     = '';
    document.getElementById('stu-new-pass').value     = '';
    document.getElementById('stu-confirm-pass').value = '';
    toast('Password updated! Please log in again.', 'success');
    setTimeout(() => doLogout(), 2000);
  } catch (e) {
    showError(err, e.message);
  } finally { btn.disabled = false; btn.textContent = 'Update Password'; }
}
