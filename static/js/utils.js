// ════════════════════════════════════════════════════════════
//  utils.js — Shared helper functions
// ════════════════════════════════════════════════════════════

function today()  { return new Date().toISOString().split('T')[0]; }
function nowISO() { return new Date().toISOString(); }

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function toast(msg, type = 'info') {
  const c  = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className   = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showError(el, msg) {
  el.textContent   = msg;
  el.style.display = 'block';
}

function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text';     btn.textContent = '🙈'; }
  else                           { input.type = 'password'; btn.textContent = '👁'; }
}

function truncate(str, len = 45) {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}
