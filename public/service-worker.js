// MCM Alerts Service Worker with Enhanced Mobile Background Notifications

// Import necessary Workbox modules
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// This is the array of URLs that vite-plugin-pwa will inject automatically.
// DO NOT DEFINE `const urlsToCache = [...]` manually here anymore.
// The `self.__WB_MANIFEST` placeholder is filled by `vite-plugin-pwa` during the build process.
precacheAndRoute(self.__WB_MANIFEST);

// Optional: Clean up old Workbox caches immediately on activation.
// This helps ensure users get the latest version quickly.
cleanupOutdatedCaches();

console.log('Service Worker loaded successfully with mobile background notification support');

// --- REMOVE YOUR OLD CACHING LOGIC ---
// The following sections should be DELETED or COMMENTED OUT.
// Workbox's `precacheAndRoute` handles these automatically for your built assets.

/*
// REMOVE THIS BLOCK (manual urlsToCache)
const CACHE_NAME = 'mcm-alerts-v3';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/mcm-logo-192.png',
  '/mcm-logo-512.png'
];

// REMOVE THIS BLOCK (manual install event)
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

// REMOVE THIS BLOCK (manual activate event, or adapt it if you have *other* cleanup)
// Workbox's cleanupOutdatedCaches() provides a good default.
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) { // CACHE_NAME will be 'mcm-alerts-v3'
          console.log('Deleting old cache:', key);
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// REMOVE THIS BLOCK (manual fetch event for precached assets)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
      .catch(error => {
        console.error('Fetch failed:', error);
        throw error;
      })
  );
});
*/

// --- Your existing push notification and message handling logic (KEEP THIS) ---
// These custom event listeners are not directly managed by Workbox's precaching,
// so they should remain in your service-worker.js file.

// Enhanced push event for mobile background notifications
self.addEventListener('push', event => {
  console.log('Push event received:', event);

  let notificationData = {
    title: 'MCM Alert',
    body: 'New alert received',
    icon: '/mcm-logo-192.png',
    badge: '/mcm-logo-192.png',
    tag: 'mcm-alert',
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        data: { ...notificationData.data, ...data.data }
      };

      if (data.priority === 'high') {
        notificationData.requireInteraction = true;
        notificationData.vibrate = [300, 100, 300, 100, 300];
        notificationData.silent = false;
      } else if (data.priority === 'low') {
        notificationData.vibrate = [100];
        notificationData.silent = false;
      } else {
        notificationData.vibrate = [200, 100, 200];
        notificationData.silent = false;
      }
    } catch (e) {
      console.error('Could not parse push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      silent: notificationData.silent,
      vibrate: notificationData.vibrate,
      actions: notificationData.actions,
      data: notificationData.data
    }).then(() => {
      console.log('Background notification displayed successfully');

      return self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'PLAY_NOTIFICATION_SOUND',
            priority: notificationData.data?.priority || 'medium'
          });
        });
      });
    }).catch(error => {
      console.error('Failed to show background notification:', error);
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event);

  event.notification.close();

  let targetUrl = '/';
  if (event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url;
  }

  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          for (const client of clientList) {
            if (client.url.includes(targetUrl) && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(targetUrl);
          }
        })
        .catch(error => {
          console.error('Error handling notification click:', error);
        })
    );
  }
});

// Enhanced message handling
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const {
        title,
        body,
        icon,
        badge,
        priority,
        tag,
        requireInteraction,
        silent,
        vibrate,
        actions,
        data
    } = event.data;

    const notificationOptions = {
      body,
      icon: icon || '/mcm-logo-192.png',
      badge: badge || '/mcm-logo-192.png',
      tag: tag || 'mcm-alert',
      silent: silent !== undefined ? silent : false,
      requireInteraction: requireInteraction !== undefined ? requireInteraction : (priority === 'high'),
      vibrate: vibrate || (priority === 'high' ? [300, 100, 300] : [200, 100, 200]),
      actions: actions || [
        { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: {
        url: '/',
        priority: priority || 'medium',
        timestamp: Date.now(),
        ...(data || {})
      }
    };

    self.registration.showNotification(title, notificationOptions)
      .then(() => {
        console.log('Manual notification displayed successfully');
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      })
      .catch(error => {
        console.error('Failed to show manual notification:', error);
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: false, error: error.message });
        }
      });
  }
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('Notification closed:', event.notification.tag);
});
