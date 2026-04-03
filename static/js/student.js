// ════════════════════════════════════════════════════════════
//  student.js — Student: view classrooms, submit Drive links
// ════════════════════════════════════════════════════════════

let _selectedClassroomId   = null;
let _selectedClassroomName = '';

function switchStudentTab(tab, el) {
  document.querySelectorAll('#page-student .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('stab-classrooms').style.display = tab === 'classrooms' ? 'block' : 'none';
  document.getElementById('stab-submit').style.display     = tab === 'submit'     ? 'block' : 'none';
  document.getElementById('stab-track').style.display      = tab === 'track'      ? 'block' : 'none';
  if (tab === 'track')  loadMySubmissions();
  if (tab === 'submit') loadClassroomDropdown();
}

// ─── Load student page ─────────────────────────────────────
async function loadStudentPage() {
  loadStudentClassrooms();
}

// ─── Classrooms list ───────────────────────────────────────
async function loadStudentClassrooms() {
  const container = document.getElementById('student-classrooms-list');
  container.innerHTML = '<div class="spinner">Loading classrooms…</div>';
  try {
    const data = await api.myClassroomsStudent();
    const cls  = data.classrooms || [];
    if (cls.length === 0) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">🏫</div><p>You are not enrolled in any classrooms yet.</p></div>';
      return;
    }
    container.innerHTML = cls.map(c => `
      <div class="classroom-card" onclick="quickSubmit('${c.id}', '${c.name.replace(/'/g,"\\'")}')">
        <div class="classroom-card-title">${c.name}</div>
        ${c.description ? `<div style="color:var(--muted);font-size:13px;margin-bottom:8px">${c.description}</div>` : ''}
        <div class="classroom-meta">
          <span>👨‍🏫 ${c.professorName}</span>
          <span>👥 ${c.studentIds?.length || 0} students</span>
        </div>
        <div style="margin-top:12px">
          <span style="font-size:12px;color:var(--accent);font-weight:600">Click to submit project →</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

// ─── Quick submit from classroom card ─────────────────────
function quickSubmit(cid, cname) {
  _selectedClassroomId   = cid;
  _selectedClassroomName = cname;
  // Switch to submit tab
  const tab = document.querySelector('#page-student .tab:nth-child(2)');
  switchStudentTab('submit', tab);
  // Pre-select in dropdown
  loadClassroomDropdown().then(() => {
    const sel = document.getElementById('sub-classroom');
    if (sel) sel.value = cid;
  });
}

// ─── Classroom dropdown for submit form ───────────────────
async function loadClassroomDropdown() {
  const sel = document.getElementById('sub-classroom');
  sel.innerHTML = '<option value="">Loading…</option>';
  try {
    const data = await api.myClassroomsStudent();
    const cls  = data.classrooms || [];
    if (cls.length === 0) {
      sel.innerHTML = '<option value="">No classrooms available</option>';
      return;
    }
    sel.innerHTML = '<option value="">— Select a classroom —</option>' +
      cls.map(c => `<option value="${c.id}">${c.name} (${c.professorName})</option>`).join('');
    if (_selectedClassroomId) sel.value = _selectedClassroomId;
  } catch (e) {
    sel.innerHTML = '<option value="">Failed to load</option>';
  }
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
    _selectedClassroomId = null;
    toast('Project submitted! Your professor will be notified.', 'success');
    // Switch to track tab
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
          <div style="font-weight:500">${s.title}</div>
          ${s.description ? `<div style="color:var(--muted);font-size:12px">${truncate(s.description, 35)}</div>` : ''}
        </td>
        <td style="font-size:13px">${s.classroomName || '—'}</td>
        <td style="font-size:13px">${s.professorName || '—'}</td>
        <td>
          <a href="${s.driveLink}" target="_blank" rel="noopener" class="drive-link">📁 Open</a>
        </td>
        <td style="font-size:12px;color:var(--muted)">${formatDateTime(s.submittedAt)}</td>
        <td><span class="status ${s.status}">${s.status === 'graded' ? 'Graded' : 'Submitted'}</span></td>
        <td>
          ${s.grade
            ? `<div class="grade-badge">${s.grade}</div>
               ${s.feedback ? `<div style="color:var(--muted);font-size:11px;margin-top:4px">${truncate(s.feedback, 30)}</div>` : ''}`
            : '<span style="color:var(--muted);font-size:13px">Pending</span>'
          }
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="empty-icon">⚠️</div><p>${e.message}</p></div></td></tr>`;
  }
}
