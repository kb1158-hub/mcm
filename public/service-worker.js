// MCM Alerts Service Worker with Enhanced Sound and Mobile Support

const CACHE_NAME = 'mcm-alerts-v2';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/mcm-logo-192.png',
  '/mcm-logo-512.png',
  '/static/js/bundle.js',
  '/static/css/main.css'
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

// Enhanced push event with sound and vibration
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
    sound: '/notification-sound.mp3', // Add sound file
    actions: [
      { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: {
      url: '/',
      timestamp: Date.now(),
      playSound: true
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
      
      // Set priority-based options for mobile
      if (data.priority === 'high') {
        notificationData.requireInteraction = true;
        notificationData.vibrate = [300, 100, 300, 100, 300];
        notificationData.silent = false;
      } else if (data.priority === 'low') {
        notificationData.vibrate = [100];
        notificationData.silent = false; // Keep sound for all notifications
      } else {
        notificationData.vibrate = [200, 100, 200];
        notificationData.silent = false;
      }
    } catch (e) {
      console.error('Could not parse push data:', e);
    }
  }

  event.waitUntil(
    Promise.all([
      // Show notification
      self.registration.showNotification(notificationData.title, notificationData),
      // Play sound manually for better mobile support
      playNotificationSound(notificationData.data?.priority || 'medium')
    ]).then(() => {
      console.log('Notification displayed and sound played successfully');
    }).catch(error => {
      console.error('Failed to show notification or play sound:', error);
    })
  );
});

// Function to play notification sound
async function playNotificationSound(priority) {
  try {
    // Get all clients (open tabs/windows)
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    
    // Send message to all clients to play sound
    clients.forEach(client => {
      client.postMessage({
        type: 'PLAY_NOTIFICATION_SOUND',
        priority: priority
      });
    });
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
}

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
    console.log('Notification dismissed');
  }
});

// Enhanced message handling with sound support
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
      silent: false, // Never silent for better sound support
      requireInteraction: priority === 'high',
      vibrate: priority === 'high' ? [300, 100, 300] : [200, 100, 200],
      actions: [
        { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: {
        url: '/',
        priority: priority || 'medium',
        timestamp: Date.now(),
        playSound: true
      }
    };
    
    Promise.all([
      self.registration.showNotification(title, notificationOptions),
      playNotificationSound(priority || 'medium')
    ]).then(() => {
      console.log('Manual notification displayed and sound played successfully');
      event.ports[0]?.postMessage({ success: true });
    }).catch(error => {
      console.error('Failed to show manual notification or play sound:', error);
      event.ports[0]?.postMessage({ success: false, error: error.message });
    });
  }
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('Notification closed:', event.notification.tag);
});

console.log('Service Worker loaded successfully with enhanced mobile support');