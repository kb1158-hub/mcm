// Enhanced MCM Alerts Service Worker with Real-time API Notification Support
// This service worker handles push notifications, caching, and background sync

const CACHE_NAME = 'mcm-alerts-v2';
const NOTIFICATION_TAG_PREFIX = 'mcm-alert';
const API_CACHE_NAME = 'mcm-api-cache';

console.log('Enhanced Service Worker loaded with real-time API notification support');

// Handle installation
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => {
        console.log('Main cache opened');
        return cache.addAll([
          '/',
          '/manifest.json',
          '/mcm-logo-192.png',
          '/mcm-logo-512.png'
        ]);
      }),
      caches.open(API_CACHE_NAME).then(cache => {
        console.log('API cache opened');
        return Promise.resolve();
      })
    ]).catch(error => {
      console.error('Cache installation failed:', error);
    })
  );
  
  // Force activation of new service worker
  self.skipWaiting();
});

// Handle activation
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Enhanced push event for real-time API notifications
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
      priority: 'medium',
      source: 'api'
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
        notificationData.silent = false;
        notificationData.actions = [
          { action: 'acknowledge', title: 'Acknowledge', icon: '/mcm-logo-192.png' },
          { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' }
        ];
      } else if (data.priority === 'low') {
        notificationData.vibrate = [100];
        notificationData.silent = false;
        notificationData.requireInteraction = false;
      }
    } catch (e) {
      console.error('Could not parse push data:', e);
    }
  }

  event.waitUntil(
    Promise.all([
      // Show the notification with enhanced mobile support
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
        timestamp: Date.now(),
        // Additional options for better mobile support
        renotify: true,
        sticky: notificationData.data.priority === 'high'
      }),
      
      // Immediately notify all open clients about the push notification
      notifyAllClients({
        type: 'PUSH_NOTIFICATION_RECEIVED',
        notificationData: notificationData,
        timestamp: Date.now()
      }),

      // Store notification for offline access
      storeNotificationOffline(notificationData)
    ]).then(() => {
      console.log('API push notification displayed and clients notified successfully');
    }).catch(error => {
      console.error('Failed to show API push notification:', error);
    })
  );
});

// Enhanced notification click handler with better mobile support
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
      notifyAllClients({
        type: 'NOTIFICATION_ACKNOWLEDGED',
        notificationData: data,
        notificationTag: notification.tag,
        timestamp: Date.now()
      })
    );
  } else if (action === 'dismiss') {
    console.log('Notification dismissed');
    
    event.waitUntil(
      notifyAllClients({
        type: 'NOTIFICATION_DISMISSED',
        notificationData: data,
        notificationTag: notification.tag,
        timestamp: Date.now()
      })
    );
  } else {
    // Default click action or explicit view action - focus or open the app
    let targetUrl = data.url || '/';
    
    event.waitUntil(
      focusOrOpenClient(targetUrl, {
        type: 'NOTIFICATION_CLICKED',
        notificationData: data,
        notificationTag: notification.tag,
        targetUrl: targetUrl,
        timestamp: Date.now()
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

    case 'API_NOTIFICATION':
      handleApiNotification(event);
      break;
      
    default:
      console.warn('Unknown message type:', data.type);
  }
});

// Handle API notifications from main thread
function handleApiNotification(event) {
  const { title, body, priority, data } = event.data;

  const notificationOptions = {
    body: body || 'New API notification from MCM Alerts',
    icon: '/mcm-logo-192.png',
    badge: '/mcm-logo-192.png',
    tag: `${NOTIFICATION_TAG_PREFIX}-api-${Date.now()}`,
    silent: false,
    requireInteraction: priority === 'high',
    vibrate: getVibratePattern(priority || 'medium'),
    actions: getActionsForPriority(priority || 'medium'),
    data: {
      url: self.location.origin,
      priority: priority || 'medium',
      timestamp: Date.now(),
      source: 'api',
      ...(data || {})
    },
    timestamp: Date.now(),
    renotify: true,
    sticky: priority === 'high'
  };

  console.log('Showing API notification with options:', notificationOptions);

  self.registration.showNotification(title || 'MCM API Alert', notificationOptions)
    .then(() => {
      console.log('API notification displayed successfully');
      
      // Notify all clients immediately
      notifyAllClients({
        type: 'API_NOTIFICATION_SHOWN',
        notificationData: { title, body, priority, ...notificationOptions.data },
        timestamp: Date.now()
      });

      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, timestamp: Date.now() });
      }
    })
    .catch(error => {
      console.error('Failed to show API notification:', error);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ 
          success: false, 
          error: error.message,
          timestamp: Date.now() 
        });
      }
    });
}

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

  const notificationOptions = {
    body: body || 'New notification from MCM Alerts',
    icon: icon || '/mcm-logo-192.png',
    badge: badge || '/mcm-logo-192.png',
    tag: tag || `${NOTIFICATION_TAG_PREFIX}-${Date.now()}`,
    silent: silent !== undefined ? silent : false,
    requireInteraction: requireInteraction !== undefined ? requireInteraction : (priority === 'high'),
    vibrate: vibrate || getVibratePattern(priority || 'medium'),
    actions: actions || getActionsForPriority(priority || 'medium'),
    data: {
      url: self.location.origin,
      priority: priority || 'medium',
      timestamp: Date.now(),
      ...(data || {})
    },
    timestamp: Date.now(),
    renotify: true,
    sticky: priority === 'high'
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

// Helper function to notify all clients
function notifyAllClients(message) {
  return self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    console.log(`Notifying ${clients.length} clients:`, message);
    
    clients.forEach(client => {
      try {
        client.postMessage(message);
      } catch (error) {
        console.error('Failed to send message to client:', error);
      }
    });
  });
}

// Helper function to focus existing client or open new one
function focusOrOpenClient(targetUrl, message) {
  return self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(function(clientList) {
    // Check if there's already a window open with the target URL
    for (let i = 0; i < clientList.length; i++) {
      const client = clientList[i];
      const clientUrl = new URL(client.url);
      const targetUrlObj = new URL(targetUrl, self.location.origin);
      
      if (clientUrl.origin === targetUrlObj.origin) {
        console.log('Focusing existing client window');
        
        // Send message to the client about the notification click
        try {
          client.postMessage(message);
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
  });
}

// Helper function to store notifications offline
function storeNotificationOffline(notificationData) {
  return caches.open(API_CACHE_NAME).then(cache => {
    const notificationKey = `notification-${Date.now()}`;
    const response = new Response(JSON.stringify(notificationData), {
      headers: { 'Content-Type': 'application/json' }
    });
    return cache.put(notificationKey, response);
  }).catch(error => {
    console.error('Failed to store notification offline:', error);
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

// Helper function to get actions based on priority
function getActionsForPriority(priority) {
  if (priority === 'high') {
    return [
      { action: 'acknowledge', title: 'Acknowledge', icon: '/mcm-logo-192.png' },
      { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' }
    ];
  } else {
    return [
      { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ];
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
  notifyAllClients({
    type: 'NOTIFICATION_CLOSED',
    notificationData: data,
    notificationTag: notification.tag,
    timestamp: Date.now()
  });
});

// Enhanced fetch events for better caching and API interception
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle API notification requests
  if (url.pathname === '/api/notifications' && event.request.method === 'POST') {
    event.respondWith(handleApiNotificationRequest(event.request));
    return;
  }

  // Only handle GET requests for caching
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached version if available
      if (response) {
        console.log('Serving from cache:', event.request.url);
        return response;
      }

      // Otherwise fetch from network
      return fetch(event.request).then(response => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200) {
          return response;
        }

        // Clone the response as it can only be consumed once
        const responseToCache = response.clone();

        // Cache static assets
        if (event.request.url.includes('.js') || 
            event.request.url.includes('.css') || 
            event.request.url.includes('.png') || 
            event.request.url.includes('.jpg') || 
            event.request.url.includes('.gif') ||
            event.request.url.includes('.svg')) {
          
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      });
    }).catch(error => {
      console.error('Fetch failed:', error);
      throw error;
    })
  );
});

// Handle API notification requests for real-time processing
async function handleApiNotificationRequest(request) {
  try {
    // Clone the request to read the body
    const requestClone = request.clone();
    const body = await requestClone.json();
    
    console.log('API notification request intercepted:', body);

    // Show notification immediately for real-time experience
    if (body.title && body.message) {
      const notificationData = {
        title: body.title,
        body: body.message || body.body,
        priority: body.priority || 'medium',
        data: {
          type: body.type || 'api',
          timestamp: Date.now(),
          source: 'api'
        }
      };

      // Show notification via service worker
      await self.registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: '/mcm-logo-192.png',
        badge: '/mcm-logo-192.png',
        tag: `${NOTIFICATION_TAG_PREFIX}-api-${Date.now()}`,
        requireInteraction: notificationData.priority === 'high',
        silent: false,
        vibrate: getVibratePattern(notificationData.priority),
        actions: getActionsForPriority(notificationData.priority),
        data: notificationData.data,
        timestamp: Date.now(),
        renotify: true,
        sticky: notificationData.priority === 'high'
      });

      // Notify all clients immediately
      await notifyAllClients({
        type: 'PUSH_NOTIFICATION_RECEIVED',
        notificationData: notificationData,
        timestamp: Date.now()
      });

      console.log('Real-time API notification shown successfully');
    }

    // Forward the request to the actual API
    const response = await fetch(request);
    return response;

  } catch (error) {
    console.error('Error handling API notification request:', error);
    
    // Return a fallback response
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Service worker processing failed',
      timestamp: Date.now()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle background sync (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', event => {
    console.log('Background sync event:', event.tag);
    
    if (event.tag === 'background-notification-sync') {
      event.waitUntil(
        handleBackgroundSync()
      );
    }
  });
}

// Handle background sync for offline notifications
async function handleBackgroundSync() {
  try {
    console.log('Performing background notification sync');
    
    // Fetch any pending notifications
    const response = await fetch('/api/notifications/sync');
    
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Background sync completed:', data);
    
    // Show any new notifications
    if (data.notifications && data.notifications.length > 0) {
      for (const notification of data.notifications) {
        await self.registration.showNotification(notification.title, {
          body: notification.body,
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png',
          tag: `${NOTIFICATION_TAG_PREFIX}-sync-${Date.now()}`,
          data: notification.data || {},
          timestamp: Date.now()
        });
      }
      
      // Notify clients about synced notifications
      await notifyAllClients({
        type: 'BACKGROUND_SYNC_COMPLETED',
        notifications: data.notifications,
        timestamp: Date.now()
      });
    }
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

console.log('Enhanced Service Worker setup complete with real-time API notification support');
