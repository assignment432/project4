// ════════════════════════════════════════════════════════════
//  professor.js — Professor: create classrooms, grade submissions
// ════════════════════════════════════════════════════════════

window._currentClassroomId = null;
let _allStudents = [];

function switchProfTab(tab, el) {
  document.querySelectorAll('#nav-professor .nav-link').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('ptab-classrooms').style.display = tab === 'classrooms' ? 'block' : 'none';
  document.getElementById('ptab-create').style.display     = tab === 'create'     ? 'block' : 'none';
  if (tab === 'create') loadStudentPicker();
}

async function loadProfessorPage() {
  loadMyClassrooms();
}

// ─── Deadline helpers ─────────────────────────────────────
function deadlineState(isoDeadline) {
  if (!isoDeadline) return null;
  const now  = Date.now();
  const dl   = new Date(isoDeadline).getTime();
  const diff = dl - now;
  if (diff < 0)              return 'passed';
  if (diff < 3600 * 1000)   return 'urgent';
  if (diff < 86400 * 1000)  return 'soon';
  return 'ok';
}

function deadlineBadge(isoDeadline) {
  if (!isoDeadline) return '';
  const state = deadlineState(isoDeadline);
  const labels = { passed: '⛔ Deadline passed', urgent: '🔴 Due in < 1 hr', soon: '⚠ Due in < 24 hrs', ok: '🟢 On time' };
  return `<span class="deadline-badge ${state}">${labels[state]}</span>
          <span style="font-size:11px;color:var(--muted2);margin-left:6px">${formatDateTime(isoDeadline)}</span>`;
}

// ─── My classrooms list ────────────────────────────────────
async function loadMyClassrooms() {
  const container = document.getElementById('my-classrooms-list');
  container.innerHTML = '<div class="spinner">Loading classrooms…</div>';
  try {
    const data = await api.myClassroomsProf();
    const cls  = data.classrooms || [];
    if (cls.length === 0) {
      container.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🏫</div><p>No classrooms yet. Create one from the sidebar!</p></div>';
      return;
    }
    container.innerHTML = cls.map(c => {
      const asgn = c.assignment || {};
      const dlBadge = asgn.deadline ? deadlineBadge(asgn.deadline) : '';
      return `
        <div class="classroom-card" onclick="loadClassroomDetail('${c.id}')">
          <div class="classroom-card-title">${c.name}</div>
          ${c.description ? `<div style="color:var(--muted2);font-size:12px;margin:4px 0 8px;line-height:1.5">${c.description}</div>` : ''}
          ${asgn.title ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px;font-weight:600">📋 ${asgn.title}</div>` : ''}
          ${dlBadge ? `<div style="margin-bottom:8px">${dlBadge}</div>` : ''}
          <div class="classroom-meta">
            <span>👥 ${c.studentIds?.length || 0} students</span>
            <span>📅 ${formatDateTime(c.createdAt)}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

// ─── Classroom detail ─────────────────────────────────────
async function loadClassroomDetail(cid) {
  window._currentClassroomId = cid;
  document.getElementById('prof-list-view').style.display  = 'none';
  document.getElementById('classroom-detail').style.display = 'block';
  document.getElementById('classroom-detail-content').innerHTML = '<div class="spinner">Loading…</div>';
  document.getElementById('assignments-list').innerHTML = '<div class="spinner">Loading…</div>';
  document.getElementById('submissions-list').innerHTML = '<div class="spinner">Loading…</div>';

  try {
    const [clsData, subsData] = await Promise.all([
      api.getClassroom(cid),
      api.getClassroomSubs(cid)
    ]);
    const cls  = clsData.classroom;
    const subs = subsData.submissions || [];
    const asgn = cls.assignment || {};

    // Header
    document.getElementById('classroom-detail-content').innerHTML = `
      <div class="classroom-detail-header">
        <div>
          <div class="detail-title">${cls.name}</div>
          ${cls.description ? `<div style="color:var(--muted2);font-size:13px;margin-top:4px">${cls.description}</div>` : ''}
          <div class="classroom-meta" style="margin-top:10px">
            <span>👥 ${cls.studentIds?.length || 0} enrolled</span>
            <span>📅 Created ${formatDateTime(cls.createdAt)}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="count-chip" style="background:var(--blue-lt);color:var(--blue);border:1px solid var(--blue-bdr)">
            ${subs.length} SUBMISSIONS
          </span>
          <span class="count-chip" style="background:var(--teal-lt);color:var(--teal);border:1px solid var(--teal-bdr)">
            ${subs.filter(s => s.status === 'graded').length} GRADED
          </span>
        </div>
      </div>
    `;

    // Assignment block
    const asgnEl = document.getElementById('assignments-list');
    if (!asgn.title) {
      asgnEl.innerHTML = '<div class="empty" style="padding:24px"><p>No assignment set for this classroom.</p></div>';
    } else {
      asgnEl.innerHTML = `
        <div class="assignment-row">
          <div style="flex:1">
            <div class="assignment-title">${asgn.title}</div>
            ${asgn.description ? `<div class="assignment-desc">${asgn.description}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${deadlineBadge(asgn.deadline) || '<span style="color:var(--muted2);font-size:12px">No deadline</span>'}
          </div>
        </div>
      `;
    }

    // Submissions table
    if (subs.length === 0) {
      document.getElementById('submissions-list').innerHTML =
        '<div class="empty"><div class="empty-icon">📭</div><p>No submissions yet.</p></div>';
      return;
    }
    document.getElementById('submissions-list').innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Student</th><th>Project</th><th>Drive</th><th>Submitted</th><th>Status</th><th>Grade</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${subs.map(s => `
              <tr>
                <td>
                  <div style="font-weight:600;color:var(--text)">${s.studentName}</div>
                  <div style="color:var(--muted2);font-size:11px;font-family:'Syne',sans-serif">${s.studentId} · ${s.studentDept || ''}</div>
                </td>
                <td>
                  <div style="font-weight:600;color:var(--text)">${s.title}</div>
                  ${s.description ? `<div style="color:var(--muted2);font-size:11px">${truncate(s.description, 38)}</div>` : ''}
                </td>
                <td><a href="${s.driveLink}" target="_blank" rel="noopener" class="drive-link">📁 Open</a></td>
                <td style="font-size:11px;color:var(--muted2)">${formatDateTime(s.submittedAt)}</td>
                <td><span class="status ${s.status}">${s.status === 'graded' ? 'Graded' : 'Submitted'}</span></td>
                <td>
                  ${s.grade
                    ? `<div class="grade-badge">${s.grade}</div>${s.feedback ? `<div style="color:var(--muted2);font-size:11px;margin-top:4px">${truncate(s.feedback, 28)}</div>` : ''}`
                    : '<span style="color:var(--muted2);font-size:12px">—</span>'}
                </td>
                <td>
                  <button class="primary-btn" style="font-size:11px;padding:7px 12px;margin-top:0" onclick="openGradeModal('${s.id}')">
                    ${s.status === 'graded' ? '✏ Re-grade' : '✓ Grade'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    document.getElementById('classroom-detail-content').innerHTML =
      `<div class="empty"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

function backToClassrooms() {
  window._currentClassroomId = null;
  document.getElementById('classroom-detail').style.display  = 'none';
  document.getElementById('prof-list-view').style.display    = 'block';
  loadMyClassrooms();
}

// ─── Student picker ────────────────────────────────────────
async function loadStudentPicker() {
  const picker = document.getElementById('student-picker');
  picker.innerHTML = '<div class="spinner">Loading…</div>';
  try {
    const data   = await api.getStudents();
    _allStudents = data.students || [];
    if (_allStudents.length === 0) {
      picker.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted2);font-size:13px">No students yet.</div>';
      return;
    }
    renderStudentPicker(_allStudents);
  } catch (e) {
    picker.innerHTML = `<div style="padding:14px;color:var(--red);font-size:13px">${e.message}</div>`;
  }
}

function renderStudentPicker(students) {
  document.getElementById('student-picker').innerHTML = students.map(s => `
    <label class="student-pick-item" id="pick-${s.id}">
      <input type="checkbox" value="${s.id}" onchange="updateStudentPickStyle('${s.id}', this.checked)">
      <div class="user-item-avatar" style="background:var(--teal);width:30px;height:30px;font-size:12px;flex-shrink:0;border-radius:6px">
        ${s.name.charAt(0)}
      </div>
      <div>
        <div style="font-weight:600;font-size:13px;color:var(--text)">${s.name}</div>
        <div style="color:var(--muted2);font-size:11px;font-family:'Syne',sans-serif">${s.id} · ${s.dept || ''}</div>
      </div>
    </label>
  `).join('');
}

function updateStudentPickStyle(id, checked) {
  const el = document.getElementById(`pick-${id}`);
  if (el) { checked ? el.classList.add('student-pick-selected') : el.classList.remove('student-pick-selected'); }
  updateSelectedCount();
}

function updateSelectedCount() {
  const n  = document.querySelectorAll('#student-picker input:checked').length;
  const el = document.getElementById('selected-count');
  if (el) el.textContent = n > 0 ? `${n} selected` : '';
}

function filterStudents() {
  const q = document.getElementById('student-search').value.toLowerCase();
  renderStudentPicker(_allStudents.filter(s =>
    s.name.toLowerCase().includes(q) || (s.dept || '').toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
  ));
}

// ─── Create classroom ─────────────────────────────────────
async function createClassroom() {
  const name       = document.getElementById('cls-name').value.trim();
  const desc       = document.getElementById('cls-desc').value.trim();
  const aTitle     = document.getElementById('cls-assignment-title').value.trim();
  const aDesc      = document.getElementById('cls-assignment-desc').value.trim();
  const dlDate     = document.getElementById('cls-deadline-date').value;
  const dlTime     = document.getElementById('cls-deadline-time').value;
  const studentIds = [...document.querySelectorAll('#student-picker input:checked')].map(c => c.value);
  const btn        = document.getElementById('create-cls-btn');

  if (!name)                 { toast('Classroom name is required.', 'error'); return; }
  if (studentIds.length < 1) { toast('Select at least one student.', 'error'); return; }
  if (aTitle && !dlDate)     { toast('Please set a deadline date for the assignment.', 'error'); return; }

  let deadline = null;
  if (aTitle && dlDate) {
    deadline = new Date(`${dlDate}T${dlTime || '23:59'}:00`).toISOString();
  }

  const assignment = aTitle ? { title: aTitle, description: aDesc, deadline } : null;

  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    await api.createClassroom(name, desc, studentIds, assignment);
    toast(`Classroom "${name}" created with ${studentIds.length} students!`, 'success');
    document.getElementById('cls-name').value             = '';
    document.getElementById('cls-desc').value             = '';
    document.getElementById('cls-assignment-title').value = '';
    document.getElementById('cls-assignment-desc').value  = '';
    document.getElementById('cls-deadline-date').value    = '';
    document.getElementById('cls-deadline-time').value    = '23:59';
    document.querySelectorAll('#student-picker input:checked').forEach(c => { c.checked = false; });
    document.querySelectorAll('.student-pick-selected').forEach(el => el.classList.remove('student-pick-selected'));
    updateSelectedCount();
    const firstNavLink = document.querySelector('#nav-professor .nav-link');
    switchProfTab('classrooms', firstNavLink);
    loadMyClassrooms();
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  } finally { btn.disabled = false; btn.textContent = 'Create Classroom'; }
}
