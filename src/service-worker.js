// Simple MCM Alerts Service Worker
// Handles push notifications and basic caching

// Required for Workbox/vite-plugin-pwa - DO NOT REMOVE THIS LINE
// Workbox will replace this with the actual precache manifest
const precacheManifest = self.__WB_MANIFEST;

const CACHE_NAME = 'mcm-alerts-v1';
const NOTIFICATION_TAG = 'mcm-notification';

console.log('Service Worker loaded');

// Install event
self.addEventListener('install', event => {
  console.log('Service Worker installing');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  console.log('Service Worker activating');
  event.waitUntil(self.clients.claim());
});

// Push notification handler
self.addEventListener('push', event => {
  console.log('Push received');

  let notification = {
    title: 'MCM Alert',
    body: 'New notification',
    icon: '/mcm-logo-192.png',
    badge: '/mcm-logo-192.png',
    tag: NOTIFICATION_TAG,
    data: { url: '/' }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notification = { ...notification, ...data };
    } catch (e) {
      console.error('Could not parse push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      tag: notification.tag,
      data: notification.data
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked');
  
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Message handler from main thread
self.addEventListener('message', event => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SHOW_NOTIFICATION':
      showNotification(data);
      break;
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    default:
      console.log('Unknown message type:', type);
  }
});

// Show notification function
function showNotification(data) {
  const options = {
    body: data.body || 'New notification',
    icon: '/mcm-logo-192.png',
    badge: '/mcm-logo-192.png',
    tag: NOTIFICATION_TAG,
    data: { url: data.url || '/' }
  };

  self.registration.showNotification(data.title || 'MCM Alert', options)
    .then(() => console.log('Notification shown'))
    .catch(error => console.error('Failed to show notification:', error));
}

console.log('Service Worker setup complete');
