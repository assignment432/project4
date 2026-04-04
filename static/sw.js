// ════════════════════════════════════════════════════════════
//  sw.js — Service Worker  |  Project Submission Portal
//  Must live at the ROOT of static/ so scope is /
// ════════════════════════════════════════════════════════════

const CACHE_NAME = 'portal-v1';

// ── Install: skip waiting immediately so new SW takes over fast
self.addEventListener('install', e => {
  self.skipWaiting();
});

// ── Activate: claim all clients so push reaches the new SW
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// ══════════════════════════════════════════════════════════
//  PUSH  — receive and display notification
// ══════════════════════════════════════════════════════════
self.addEventListener('push', function (event) {
  let title = 'Project Portal';
  let body  = 'You have a new notification.';
  let data  = {};

  // Safely parse whatever the server sent
  if (event.data) {
    try {
      const parsed = event.data.json();
      title = parsed.title || title;
      body  = parsed.body  || body;
      data  = parsed.data  || {};
    } catch (_) {
      // Fallback: treat as plain text
      body = event.data.text() || body;
    }
  }

  // Choose icon based on notification type
  let icon  = '/icons/icon-192.png';
  let badge = '/icons/icon-72.png';

  // Urgency tag so OS batches identical alerts (deadline won't spam)
  const tag = data.classroomId
    ? `classroom-${data.classroomId}`
    : data.submissionId
      ? `submission-${data.submissionId}`
      : `portal-${Date.now()}`;

  const options = {
    body,
    icon,
    badge,
    tag,
    renotify:  true,    // always show even if same tag
    data,
    vibrate:   [120, 60, 120],
    requireInteraction: false,
    actions: [
      { action: 'open',    title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss'  }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ══════════════════════════════════════════════════════════
//  NOTIFICATION CLICK
// ══════════════════════════════════════════════════════════
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Bring existing window to focus or open new one
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        // Try to focus an already-open portal tab
        for (const client of list) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // No open tab — open one
        return clients.openWindow('/');
      })
  );
});
