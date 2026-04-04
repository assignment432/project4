// ════════════════════════════════════════════════════════════
//  auth.js — Login, logout, session, push notifications
// ════════════════════════════════════════════════════════════

window._currentUser   = null;
window._currentUserId = null;

// ─── Boot ─────────────────────────────────────────────────
async function boot() {
  // Register SW immediately — before login — so a subscription
  // can be created and stored as early as possible.
  // This means when the professor creates a classroom and sends
  // the "Added to Classroom" push, the student already has a
  // saved subscription in Firestore.
  await registerServiceWorkerEarly();

  try {
    await db.collection('users').limit(1).get();
    document.getElementById('fb-status-text').textContent = 'Firebase Connected';
    devLog('Firebase OK');
  } catch (e) {
    document.getElementById('fb-status-badge').style.background = 'var(--red-subtle)';
    document.getElementById('fb-status-text').textContent = 'Firebase Error';
    devLog('Firebase FAILED:', e.message);
  }
  await checkFirstRunSetup();
  _hideOverlay();
}

function _hideOverlay() {
  const ov = document.getElementById('loading-overlay');
  ov.classList.add('hidden');
  setTimeout(() => { ov.style.display = 'none'; }, 400);
  document.getElementById('login-screen').style.display = 'flex';
}

async function checkFirstRunSetup() {
  try {
    const h = await api.health();
    if (h.needsSetup) {
      document.getElementById('setup-panel').style.display = 'block';
      document.getElementById('login-panel').style.display = 'none';
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

    // After login the user ID is known — request push permission
    // and immediately save the subscription to the backend.
    // This ensures the server can push to this specific user.
    requestAndSavePushSubscription();
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

// ══════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ══════════════════════════════════════════════════════════

// Step 1 — Register SW immediately on page load (no user ID needed).
//   This creates the subscription object in the browser.
//   We store it in window._swReg so Step 2 can reuse it.
async function registerServiceWorkerEarly() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    // Wait until the SW is fully active
    await navigator.serviceWorker.ready;
    window._swReg = reg;
    devLog('SW registered early, scope:', reg.scope);
  } catch (e) {
    devLog('SW early registration failed:', e.message);
  }
}

// Step 2 — After login, request permission and save subscription to backend.
//   Called with the user ID already set in window._currentUserId.
async function requestAndSavePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!window._currentUserId) return;

  try {
    // Use cached registration from Step 1, or re-register if needed
    const reg = window._swReg || await navigator.serviceWorker.ready;

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      devLog('Push permission denied');
      return;
    }

    // Reuse existing subscription or create a new one
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // Always re-save on every login so the server has a fresh record
    await api.savePushSubscription(sub.toJSON());
    devLog('Push subscription saved for', window._currentUserId);
  } catch (e) {
    devLog('Push subscription failed:', e.message);
  }
}

// ─── VAPID key conversion util ────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  const output  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

// Enter key on password field triggers login
document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
