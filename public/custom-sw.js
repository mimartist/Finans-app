// Push notification handler for Finans Asistan PWA
self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      tag: data.tag || 'finans-notification',
      vibrate: [200, 100, 200],
      data: data.data || { url: '/' },
      actions: [
        { action: 'open', title: 'Aç' },
        { action: 'dismiss', title: 'Kapat' },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Finans Asistan', options)
    );
  } catch (e) {
    // Fallback for non-JSON push
    event.waitUntil(
      self.registration.showNotification('Finans Asistan', {
        body: event.data.text(),
        icon: '/icon-192.png',
      })
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
