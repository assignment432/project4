// ════════════════════════════════════════════════════════════
//  professor.js — Professor: create classrooms, grade submissions
// ════════════════════════════════════════════════════════════

window._currentClassroomId = null;
let _allStudents = [];

function switchProfTab(tab, el) {
  document.querySelectorAll('#page-professor .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('ptab-classrooms').style.display = tab === 'classrooms' ? 'block' : 'none';
  document.getElementById('ptab-create').style.display     = tab === 'create'     ? 'block' : 'none';
  if (tab === 'create') loadStudentPicker();
}

// ─── Load professor page ───────────────────────────────────
async function loadProfessorPage() {
  loadMyClassrooms();
}

// ─── My classrooms list ────────────────────────────────────
async function loadMyClassrooms() {
  const container = document.getElementById('my-classrooms-list');
  container.innerHTML = '<div class="spinner">Loading classrooms…</div>';
  try {
    const data = await api.myClassroomsProf();
    const cls  = data.classrooms || [];
    if (cls.length === 0) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">🏫</div><p>No classrooms yet. Create one!</p></div>';
      return;
    }
    container.innerHTML = cls.map(c => `
      <div class="classroom-card" onclick="loadClassroomDetail('${c.id}')">
        <div class="classroom-card-title">${c.name}</div>
        ${c.description ? `<div style="color:var(--muted);font-size:13px;margin-bottom:8px">${c.description}</div>` : ''}
        <div class="classroom-meta">
          <span>👥 ${c.studentIds?.length || 0} students</span>
          <span>📅 Created ${formatDateTime(c.createdAt)}</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

// ─── Classroom detail + submissions ───────────────────────
async function loadClassroomDetail(cid) {
  window._currentClassroomId = cid;
  document.getElementById('classroom-detail').style.display = 'block';
  document.getElementById('my-classrooms-list').style.display = 'none';

  document.getElementById('classroom-detail-content').innerHTML = '<div class="spinner">Loading…</div>';
  document.getElementById('submissions-list').innerHTML = '<div class="spinner">Loading submissions…</div>';

  try {
    const [clsData, subsData] = await Promise.all([
      api.getClassroom(cid),
      api.getClassroomSubs(cid)
    ]);
    const cls  = clsData.classroom;
    const subs = subsData.submissions || [];

    document.getElementById('classroom-detail-content').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-family:'DM Serif Display',serif;font-size:24px;margin-bottom:4px">${cls.name}</div>
          ${cls.description ? `<div style="color:var(--muted);font-size:13px">${cls.description}</div>` : ''}
          <div class="classroom-meta" style="margin-top:8px">
            <span>👥 ${cls.studentIds?.length || 0} students enrolled</span>
            <span>📅 Created ${formatDateTime(cls.createdAt)}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="background:var(--blue-light);color:var(--blue);padding:4px 12px;border-radius:100px;font-size:12px;font-weight:600">
            ${subs.length} Submissions
          </span>
          <span style="background:var(--green-light);color:var(--green);padding:4px 12px;border-radius:100px;font-size:12px;font-weight:600">
            ${subs.filter(s => s.status === 'graded').length} Graded
          </span>
        </div>
      </div>
    `;

    if (subs.length === 0) {
      document.getElementById('submissions-list').innerHTML =
        '<div class="empty"><div class="empty-icon">📭</div><p>No submissions yet.</p></div>';
      return;
    }

    document.getElementById('submissions-list').innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Student</th><th>Project Title</th><th>Drive Link</th><th>Submitted</th><th>Status</th><th>Grade</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${subs.map(s => `
              <tr>
                <td>
                  <div style="font-weight:500">${s.studentName}</div>
                  <div style="color:var(--muted);font-size:12px">${s.studentId} · ${s.studentDept || ''}</div>
                </td>
                <td>
                  <div style="font-weight:500">${s.title}</div>
                  ${s.description ? `<div style="color:var(--muted);font-size:12px">${truncate(s.description, 40)}</div>` : ''}
                </td>
                <td>
                  <a href="${s.driveLink}" target="_blank" rel="noopener" class="drive-link">
                    📁 Open Drive
                  </a>
                </td>
                <td style="font-size:12px;color:var(--muted)">${formatDateTime(s.submittedAt)}</td>
                <td><span class="status ${s.status}">${s.status === 'graded' ? 'Graded' : 'Submitted'}</span></td>
                <td>
                  ${s.grade
                    ? `<div class="grade-badge">${s.grade}</div>
                       ${s.feedback ? `<div style="color:var(--muted);font-size:11px;margin-top:4px">${truncate(s.feedback, 30)}</div>` : ''}`
                    : '<span style="color:var(--muted);font-size:13px">—</span>'
                  }
                </td>
                <td>
                  <button class="btn btn-blue btn-sm" onclick="openGradeModal('${s.id}')">
                    ${s.status === 'graded' ? '✏️ Re-grade' : '✓ Grade'}
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
  document.getElementById('classroom-detail').style.display    = 'none';
  document.getElementById('my-classrooms-list').style.display  = 'block';
  loadMyClassrooms();
}

// ─── Student picker for classroom creation ─────────────────
async function loadStudentPicker() {
  const picker = document.getElementById('student-picker');
  picker.innerHTML = '<div class="spinner">Loading students…</div>';
  try {
    const data   = await api.getStudents();
    _allStudents = data.students || [];
    if (_allStudents.length === 0) {
      picker.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">No students yet. Ask admin to create some.</div>';
      return;
    }
    renderStudentPicker(_allStudents);
  } catch (e) {
    picker.innerHTML = `<div style="padding:16px;color:var(--red)">${e.message}</div>`;
  }
}

function renderStudentPicker(students) {
  const picker = document.getElementById('student-picker');
  picker.innerHTML = students.map(s => `
    <label class="student-pick-item" id="pick-${s.id}">
      <input type="checkbox" value="${s.id}" onchange="updateStudentPickStyle('${s.id}', this.checked)">
      <div class="user-item-avatar" style="background:var(--green);width:32px;height:32px;font-size:13px;flex-shrink:0">
        ${s.name.charAt(0)}
      </div>
      <div>
        <div style="font-weight:500;font-size:14px">${s.name}</div>
        <div style="color:var(--muted);font-size:12px">${s.id} · ${s.dept || ''}</div>
      </div>
    </label>
  `).join('');
}

function updateStudentPickStyle(id, checked) {
  const el = document.getElementById(`pick-${id}`);
  if (checked) el.classList.add('student-pick-selected');
  else         el.classList.remove('student-pick-selected');
  updateSelectedCount();
}

function updateSelectedCount() {
  const checked = document.querySelectorAll('#student-picker input:checked').length;
  const el = document.getElementById('selected-count');
  if (el) el.textContent = checked > 0 ? `${checked} selected` : '';
}

function filterStudents() {
  const q       = document.getElementById('student-search').value.toLowerCase();
  const filtered = _allStudents.filter(s =>
    s.name.toLowerCase().includes(q) || (s.dept || '').toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
  );
  renderStudentPicker(filtered);
  // Restore checked states
  document.querySelectorAll('#student-picker input[type=checkbox]').forEach(cb => {
    const existingCheck = document.querySelector(`#pick-${cb.value} input`);
    // Re-apply previously selected
  });
}

async function createClassroom() {
  const name       = document.getElementById('cls-name').value.trim();
  const desc       = document.getElementById('cls-desc').value.trim();
  const studentIds = [...document.querySelectorAll('#student-picker input:checked')].map(c => c.value);
  const btn        = document.getElementById('create-cls-btn');

  if (!name)                { toast('Classroom name is required.', 'error'); return; }
  if (studentIds.length < 1){ toast('Select at least one student.', 'error'); return; }

  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    const data = await api.createClassroom(name, desc, studentIds);
    toast(`Classroom "${name}" created with ${studentIds.length} students!`, 'success');
    document.getElementById('cls-name').value = '';
    document.getElementById('cls-desc').value = '';
    document.querySelectorAll('#student-picker input:checked').forEach(c => { c.checked = false; });
    document.querySelectorAll('.student-pick-selected').forEach(el => el.classList.remove('student-pick-selected'));
    updateSelectedCount();
    // Switch to classrooms tab
    switchProfTab('classrooms', document.querySelector('#page-professor .tab'));
    loadMyClassrooms();
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  } finally { btn.disabled = false; btn.textContent = 'Create Classroom'; }
}
