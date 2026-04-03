// ════════════════════════════════════════════════════════════
//  auth.js — Login, logout, session, push notifications
// ════════════════════════════════════════════════════════════

window._currentUser   = null;
window._currentUserId = null;

// ─── Boot ─────────────────────────────────────────────────
async function boot() {
  try {
    await db.collection('users').limit(1).get();
    document.getElementById('fb-status-text').textContent = 'Firebase Connected';
    devLog('Firebase OK');
  } catch (e) {
    document.getElementById('fb-status-badge').style.background = '#fde8e3';
    document.getElementById('fb-status-text').textContent = 'Firebase Error';
    devLog('Firebase FAILED:', e.message);
  }
  await checkFirstRunSetup();
  _hideOverlay();
}

function _hideOverlay() {
  const ov = document.getElementById('loading-overlay');
  ov.classList.add('hidden');
  setTimeout(() => { ov.style.display = 'none'; }, 500);
  document.getElementById('login-screen').style.display = 'flex';
}

async function checkFirstRunSetup() {
  try {
    const h = await api.health();
    if (h.needsSetup) {
      document.getElementById('setup-panel').style.display  = 'block';
      document.getElementById('login-panel').style.display  = 'none';
    }
  } catch (_) {}
}

// ─── First-run Setup ──────────────────────────────────────
async function doSetup() {
  const adminId = document.getElementById('setup-admin-id').value.trim();
  const pass    = document.getElementById('setup-pass').value;
  const confirm = document.getElementById('setup-confirm').value;
  const err     = document.getElementById('setup-error');
  const btn     = document.getElementById('setup-btn');
  err.style.display = 'none';
  if (!adminId || !pass || !confirm) { showError(err, 'Fill in all fields.'); return; }
  if (pass.length < 10)              { showError(err, 'Min 10 characters.'); return; }
  if (pass !== confirm)              { showError(err, 'Passwords do not match.'); return; }
  btn.disabled = true; btn.textContent = 'Setting up…';
  try {
    await api.adminSetup(adminId, pass);
    toast('Admin account created! Please log in.', 'success');
    document.getElementById('setup-panel').style.display = 'none';
    document.getElementById('login-panel').style.display = 'block';
    document.getElementById('login-id').value = adminId;
  } catch (e) { showError(err, e.message); }
  finally { btn.disabled = false; btn.textContent = 'Create Admin Account'; }
}

// ─── Login ────────────────────────────────────────────────
async function doLogin() {
  const id   = document.getElementById('login-id').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err  = document.getElementById('login-error');
  const btn  = document.getElementById('login-btn');
  err.style.display = 'none';
  if (!id || !pass) { showError(err, 'Fill in all fields.'); return; }
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const data = await api.login(id, pass);
    window._currentUser   = data.user;
    window._currentUserId = data.user.id;
    document.getElementById('login-screen').style.display = 'none';
    mountApp();
    // Register push notifications after login
    requestPushPermission();
  } catch (e) {
    showError(err, 'Invalid credentials. Please try again.');
    devLog('Login error:', e.message);
  } finally { btn.disabled = false; btn.textContent = 'Sign In →'; }
}

// ─── Logout ───────────────────────────────────────────────
function doLogout() {
  window._currentUser   = null;
  window._currentUserId = null;
  document.getElementById('app').style.display          = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-id').value             = '';
  document.getElementById('login-pass').value           = '';
}

// ─── Push Notifications ───────────────────────────────────
async function requestPushPermission() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    await api.savePushSubscription(sub.toJSON());
    devLog('Push subscription saved');
  } catch (e) {
    devLog('Push registration failed:', e.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  const output  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
