// MCM Alerts Service Worker with Enhanced Mobile Background Notifications

const CACHE_NAME = 'mcm-alerts-v3';
const NOTIFICATION_TAG_PREFIX = 'mcm-alert';
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
        return response || fetch(event.request);
      })
      .catch(error => {
        console.error('Fetch failed:', error);
        throw error;
      })
  );
});

// Enhanced push event for mobile background notifications
self.addEventListener('push', event => {
  console.log('Push event received:', event);

  let notificationData = {
    title: 'MCM Alert',
    body: 'New alert received',
    icon: '/mcm-logo-192.png',
    badge: '/mcm-logo-192.png',
    tag: `${NOTIFICATION_TAG_PREFIX}-${Date.now()}`,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: {
      url: '/',
      timestamp: Date.now(),
      priority: 'medium'
    }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('Push data received:', data);
      
      notificationData = {
        ...notificationData,
        ...data,
        data: { ...notificationData.data, ...data.data }
      };

      // Adjust notification based on priority
      if (data.priority === 'high') {
        notificationData.requireInteraction = true;
        notificationData.vibrate = [300, 100, 300, 100, 300];
        notificationData.actions = [
          { action: 'acknowledge', title: 'Acknowledge', icon: '/mcm-logo-192.png' },
          { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' }
        ];
      } else if (data.priority === 'low') {
        notificationData.vibrate = [100];
        notificationData.requireInteraction = false;
      }
    } catch (e) {
      console.error('Could not parse push data:', e);
    }
  }

  event.waitUntil(
    Promise.all([
      // Show the notification
      self.registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        tag: notificationData.tag,
        requireInteraction: notificationData.requireInteraction,
        silent: notificationData.silent,
        vibrate: notificationData.vibrate,
        actions: notificationData.actions,
        data: notificationData.data,
        timestamp: Date.now()
      }),
      
      // Notify all open clients about the push notification
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        console.log(`Notifying ${clients.length} clients about push notification`);
        
        clients.forEach(client => {
          try {
            client.postMessage({
              type: 'PUSH_NOTIFICATION_RECEIVED',
              notificationData: notificationData,
              timestamp: Date.now()
            });
          } catch (error) {
            console.error('Failed to send message to client:', error);
          }
        });
      })
    ]).then(() => {
      console.log('Background notification displayed and clients notified successfully');
    }).catch(error => {
      console.error('Failed to show background notification:', error);
    })
  );
});

// Enhanced notification click handler
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  // Close the notification
  notification.close();
  
  // Handle different actions
  if (action === 'acknowledge') {
    console.log('Notification acknowledged via service worker');
    
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then(function(clientList) {
        clientList.forEach(client => {
          try {
            client.postMessage({
              type: 'NOTIFICATION_ACKNOWLEDGED',
              notificationData: data,
              notificationTag: notification.tag,
              timestamp: Date.now()
            });
          } catch (error) {
            console.error('Failed to send acknowledgment message:', error);
          }
        });
      })
    );
  } else if (action === 'dismiss') {
    console.log('Notification dismissed');
    
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then(function(clientList) {
        clientList.forEach(client => {
          try {
            client.postMessage({
              type: 'NOTIFICATION_DISMISSED',
              notificationData: data,
              notificationTag: notification.tag,
              timestamp: Date.now()
            });
          } catch (error) {
            console.error('Failed to send dismissal message:', error);
          }
        });
      })
    );
  } else {
    // Default click action - focus or open the app
    let targetUrl = data.url || '/';
    
    event.waitUntil(
      self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(function(clientList) {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          const clientUrl = new URL(client.url);
          const targetUrlObj = new URL(targetUrl, self.location.origin);
          
          if (clientUrl.origin === targetUrlObj.origin) {
            console.log('Focusing existing client window');
            
            try {
              client.postMessage({
                type: 'NOTIFICATION_CLICKED',
                notificationData: data,
                notificationTag: notification.tag,
                targetUrl: targetUrl,
                timestamp: Date.now()
              });
            } catch (error) {
              console.error('Failed to send click message:', error);
            }
            
            return client.focus();
          }
        }
        
        // If no window is open, open a new one
        if (self.clients.openWindow) {
          console.log('Opening new client window:', targetUrl);
          return self.clients.openWindow(targetUrl);
        }
      }).catch(error => {
        console.error('Error handling notification click:', error);
      })
    );
  }
});

// Enhanced message handling from main thread
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);

  const { data } = event;
  
  if (!data || !data.type) {
    console.warn('Received message without type:', data);
    return;
  }

  switch (data.type) {
    case 'SHOW_NOTIFICATION':
      handleShowNotification(event);
      break;
      
    case 'SKIP_WAITING':
      console.log('Skipping waiting...');
      self.skipWaiting();
      break;
      
    case 'GET_SUBSCRIPTION':
      handleGetSubscription(event);
      break;
      
    case 'CLEAR_NOTIFICATIONS':
      handleClearNotifications(event);
      break;
      
    default:
      console.warn('Unknown message type:', data.type);
  }
});

// Handle showing notifications from main thread
function handleShowNotification(event) {
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
    body: body || 'New notification from MCM Alerts',
    icon: icon || '/mcm-logo-192.png',
    badge: badge || '/mcm-logo-192.png',
    tag: tag || `${NOTIFICATION_TAG_PREFIX}-${Date.now()}`,
    silent: silent !== undefined ? silent : false,
    requireInteraction: requireInteraction !== undefined ? requireInteraction : (priority === 'high'),
    vibrate: vibrate || getVibratePattern(priority),
    actions: actions || defaultActions,
    data: {
      url: self.location.origin,
      priority: priority || 'medium',
      timestamp: Date.now(),
      ...(data || {})
    },
    timestamp: Date.now()
  };

  console.log('Showing manual notification with options:', notificationOptions);

  self.registration.showNotification(title || 'MCM Alert', notificationOptions)
    .then(() => {
      console.log('Manual notification displayed successfully');
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, timestamp: Date.now() });
      }
    })
    .catch(error => {
      console.error('Failed to show manual notification:', error);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ 
          success: false, 
          error: error.message,
          timestamp: Date.now() 
        });
      }
    });
}

// Handle getting current subscription
function handleGetSubscription(event) {
  self.registration.pushManager.getSubscription()
    .then(subscription => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ 
          subscription: subscription ? {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
              auth: arrayBufferToBase64(subscription.getKey('auth'))
            }
          } : null
        });
      }
    })
    .catch(error => {
      console.error('Failed to get subscription:', error);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ error: error.message });
      }
    });
}

// Handle clearing all notifications
function handleClearNotifications(event) {
  self.registration.getNotifications()
    .then(notifications => {
      console.log(`Clearing ${notifications.length} notifications`);
      
      notifications.forEach(notification => {
        if (notification.tag && notification.tag.startsWith(NOTIFICATION_TAG_PREFIX)) {
          notification.close();
        }
      });
      
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ 
          success: true, 
          cleared: notifications.length 
        });
      }
    })
    .catch(error => {
      console.error('Failed to clear notifications:', error);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: error.message });
      }
    });
}

// Helper function to get vibrate pattern based on priority
function getVibratePattern(priority) {
  switch (priority) {
    case 'high':
      return [300, 100, 300, 100, 300];
    case 'low':
      return [100];
    case 'medium':
    default:
      return [200, 100, 200];
  }
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Handle notification close
self.addEventListener('notificationclose', function(event) {
  console.log('Notification closed:', event.notification.tag);
  
  const notification = event.notification;
  const data = notification.data || {};
  
  // Notify clients about notification close
  self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      try {
        client.postMessage({
          type: 'NOTIFICATION_CLOSED',
          notificationData: data,
          notificationTag: notification.tag,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Failed to send close message:', error);
      }
    });
  });
});

console.log('MCM Service Worker setup complete');
