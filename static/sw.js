// ════════════════════════════════════════════════════════════
//  sw.js — Service Worker for Web Push Notifications
//  Place this file at the ROOT of static/ so it scopes to /
// ════════════════════════════════════════════════════════════

self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'New Notification', body: event.data?.text() || '' }; }

  const options = {
    body:  data.body  || '',
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data:  data.data  || {},
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open',    title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss'  }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Project System', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('install',  e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
