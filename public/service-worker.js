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
        notificationData.actions = [
          { action: 'acknowledge', title: 'Acknowledge', icon: '/mcm-logo-192.png' },
          { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' }
        ];
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

// Enhanced notification click handler - handles both dashboard notifications and test notifications
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  
  // Close the notification
  event.notification.close();
  
  // Handle different actions
  if (event.action === 'acknowledge') {
    console.log('Notification acknowledged via service worker');
    // Send message to main thread to handle acknowledgment
    event.waitUntil(
      clients.matchAll({ includeUncontrolled: true }).then(function(clientList) {
        if (clientList.length > 0) {
          // Send acknowledgment message to the first available client
          clientList.forEach(client => {
            client.postMessage({
              type: 'ACKNOWLEDGE_NOTIFICATION',
              notificationData: event.notification.data,
              notificationTag: event.notification.tag
            });
          });
        }
      })
    );
  } else if (event.action === 'view' || !event.action) {
    // Default click action or explicit view action - focus or open the app
    let targetUrl = '/';
    if (event.notification.data && event.notification.data.url) {
      targetUrl = event.notification.data.url;
    }

    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(function(clientList) {
        // If there's already a window open, focus it
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin)) {
            return client.focus();
          }
        }
        
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }).catch(error => {
        console.error('Error handling notification click:', error);
      })
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification (already done above)
    console.log('Notification dismissed');
  }
});

// Enhanced message handling - supports both existing functionality and new dashboard features
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

    // Set default actions based on priority
    let defaultActions = [
      { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ];

    if (priority === 'high') {
      defaultActions = [
        { action: 'acknowledge', title: 'Acknowledge', icon: '/mcm-logo-192.png' },
        { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' }
      ];
    }

    const notificationOptions = {
      body,
      icon: icon || '/mcm-logo-192.png',
      badge: badge || '/mcm-logo-192.png',
      tag: tag || 'mcm-alert',
      silent: silent !== undefined ? silent : false,
      requireInteraction: requireInteraction !== undefined ? requireInteraction : (priority === 'high'),
      vibrate: vibrate || (priority === 'high' ? [300, 100, 300, 100, 300] : priority === 'low' ? [100] : [200, 100, 200]),
      actions: actions || defaultActions,
      data: {
        url: self.location.origin,
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
  
  // Handle skip waiting message
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
  console.log('Notification closed:', event.notification.data);
  
  // Optional: Send message to main thread about notification close
  self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NOTIFICATION_CLOSED',
        notificationData: event.notification.data,
        notificationTag: event.notification.tag
      });
    });
  });

  // Optional: Track notification close events for analytics
  // You could send analytics or update notification status here
});

// Add optional runtime caching for API calls (if needed)
registerRoute(
  ({ request }) => request.url.includes('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Cache images with CacheFirst strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);
