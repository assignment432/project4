// ════════════════════════════════════════════════════════════
//  admin.js — Admin dashboard
// ════════════════════════════════════════════════════════════

async function loadAdminPage() {
  document.getElementById('user-list').innerHTML = '<div class="spinner">Loading users…</div>';
  try {
    const data  = await api.getAllUsers();
    const users = data.users || [];
    const profs = users.filter(u => u.role === 'professor');
    const stus  = users.filter(u => u.role === 'student');

    document.getElementById('stat-total').textContent    = users.length;
    document.getElementById('stat-profs').textContent    = profs.length;
    document.getElementById('stat-students').textContent = stus.length;

    const list = document.getElementById('user-list');
    if (users.length === 0) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">👤</div><p>No users yet. Create one!</p></div>';
      return;
    }

    const roleColor = { professor: 'var(--blue)', student: 'var(--teal)' };

    list.innerHTML = users
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map(u => `
        <div class="user-item">
          <div class="user-item-left">
            <div class="user-item-avatar" style="background:${roleColor[u.role] || 'var(--muted2)'}">
              ${(u.name || '?').charAt(0)}
            </div>
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--text)">${u.name}</div>
              <div style="color:var(--muted2);font-size:11px;font-family:'Syne',sans-serif;letter-spacing:0.04em">${u.id} · ${u.dept || ''}</div>
            </div>
          </div>
          <span class="status ${u.role === 'professor' ? 'submitted' : 'graded'}" style="font-size:10px;letter-spacing:0.08em">
            ${capitalize(u.role)}
          </span>
        </div>
      `).join('');
  } catch (e) {
    document.getElementById('user-list').innerHTML =
      `<div class="empty"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

async function createAccount() {
  const name = document.getElementById('new-name').value.trim();
  const role = document.getElementById('new-role').value;
  const dept = document.getElementById('new-dept').value.trim();
  const btn  = document.getElementById('create-btn');
  if (!name || !dept) { toast('Please fill in all fields.', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    const data = await api.createUser(name, role, dept);
    const { id: newId, password: pass } = data.credentials;
    document.getElementById('cred-id').textContent   = newId;
    document.getElementById('cred-pass').textContent = pass;
    document.getElementById('cred-role').textContent = capitalize(role);
    document.getElementById('cred-name').textContent = name;
    document.getElementById('cred-display').style.display = 'block';
    document.getElementById('new-name').value = '';
    document.getElementById('new-dept').value = '';
    toast(`Account created for ${name}!`, 'success');
    loadAdminPage();
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  } finally { btn.disabled = false; btn.textContent = 'Generate Credentials'; }
}

async function changePassword() {
  const curPass     = document.getElementById('cur-pass').value;
  const newPass     = document.getElementById('new-pass').value;
  const confirmPass = document.getElementById('confirm-pass').value;
  const btn         = document.getElementById('change-pass-btn');
  const err         = document.getElementById('pass-error');
  err.style.display = 'none';
  if (!curPass || !newPass || !confirmPass) { showError(err, 'Fill in all fields.'); return; }
  if (newPass.length < 10)                  { showError(err, 'Min 10 characters.'); return; }
  if (newPass !== confirmPass)              { showError(err, 'Passwords do not match.'); return; }
  if (curPass === newPass)                  { showError(err, 'New password must differ.'); return; }
  btn.disabled = true; btn.textContent = 'Updating…';
  try {
    await api.changePassword(curPass, newPass);
    document.getElementById('cur-pass').value     = '';
    document.getElementById('new-pass').value     = '';
    document.getElementById('confirm-pass').value = '';
    toast('Password updated! Logging out…', 'success');
    setTimeout(() => doLogout(), 2000);
  } catch (e) { showError(err, e.message); }
  finally { btn.disabled = false; btn.textContent = 'Update Password'; }
}
