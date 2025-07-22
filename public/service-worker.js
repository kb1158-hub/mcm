// MCM Alerts Service Worker

const CACHE_NAME = 'mcm-alerts-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/mcm-logo-192.png',
  '/mcm-logo-512.png'
];

// Install event - cache resources
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

// Activate event - cleanup old caches and take control immediately
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('Deleting old cache:', key);
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// Fetch event - serve cached resources, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(error => {
        console.error('Fetch failed:', error);
        throw error;
      })
  );
});

// Push event - handle push notifications
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
    vibrate: [100, 50, 100],
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
      
      // Set priority-based options
      if (data.priority === 'high') {
        notificationData.requireInteraction = true;
        notificationData.vibrate = [200, 100, 200, 100, 200];
      } else if (data.priority === 'low') {
        notificationData.silent = true;
        notificationData.vibrate = [50];
      }
    } catch (e) {
      console.error('Could not parse push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .then(() => {
        console.log('Notification displayed successfully');
      })
      .catch(error => {
        console.error('Failed to show notification:', error);
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
          // Check if there's already a window/tab open with the target URL
          for (const client of clientList) {
            if (client.url.includes(targetUrl) && 'focus' in client) {
              return client.focus();
            }
          }
          // If no window/tab is open, open a new one
          if (clients.openWindow) {
            return clients.openWindow(targetUrl);
          }
        })
        .catch(error => {
          console.error('Error handling notification click:', error);
        })
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification (already done above)
    console.log('Notification dismissed');
  }
});

// Handle messages from main thread
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, badge, priority } = event.data;
    
    // Configure sound and interaction based on priority
    const notificationOptions = {
      body,
      icon: icon || '/mcm-logo-192.png',
      badge: badge || '/mcm-logo-192.png',
      tag: 'mcm-alert',
      silent: false,
      requireInteraction: priority === 'high',
      vibrate: priority === 'high' ? [200, 100, 200] : [100],
      actions: [
        { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: {
        url: '/',
        priority: priority || 'medium',
        timestamp: Date.now()
      }
    };
    
    self.registration.showNotification(title, notificationOptions)
      .then(() => {
        console.log('Manual notification displayed successfully');
        // Send confirmation back to main thread
        event.ports[0]?.postMessage({ success: true });
      })
      .catch(error => {
        console.error('Failed to show manual notification:', error);
        event.ports[0]?.postMessage({ success: false, error: error.message });
      });
  }
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('Notification closed:', event.notification.tag);
});

console.log('Service Worker loaded successfully');