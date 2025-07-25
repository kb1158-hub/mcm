// src/services/pushNotificationService.ts

/**
 * Register the service worker for push notifications.
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
      console.log('[PushService] Service worker registered');
    } catch (err) {
      console.error('[PushService] Service worker registration failed:', err);
    }
  }
}

/**
 * Get the current push subscription from the browser.
 */
async function getPushSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return await reg?.pushManager.getSubscription();
}

/**
 * Subscribe the user to push notifications.
 * Replace the `vapidPublicKey` with your actual VAPID public key.
 */
async function subscribeUserToPush(vapidPublicKey: string) {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });

  // Send subscription to your backend
  await fetch('/.netlify/functions/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: { 'Content-Type': 'application/json' }
  });

  return subscription;
}

/**
 * Convert a Base64 VAPID key into a Uint8Array for pushManager.
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return new Uint8Array([...raw].map(char => char.charCodeAt(0)));
}

/**
 * Show a notification immediately if the site is open and permission is granted.
 */
async function showBrowserNotification({
  title,
  body,
  url
}: {
  title: string;
  body: string;
  url?: string;
}) {
  if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.showNotification(title, {
      body,
      data: { url }
    });
  }
}

/**
 * Request notification permission from the user.
 */
async function requestPermission() {
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

/**
 * High-level push notification service API used in InAppNotificationSystem
 */
export const pushService = {
  /**
   * Initialize push notification system
   */
  async initialize() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('[PushService] Push notifications not supported');
      return;
    }

    await registerServiceWorker();
    await requestPermission();

    // Optional: subscribe user to push notifications with your public VAPID key
    const VAPID_PUBLIC_KEY = 'BCk21-ioklyur883nJg0PbBZxhkOvVzvmUzASZHLwHTW6qQjnkNdjo0GU23LycsD9Om27Ihx8qXfDEGqFqaePDc'; // TODO: replace this
    if (Notification.permission === 'granted') {
      const subscription = await getPushSubscription();
      if (!subscription) {
        await subscribeUserToPush(VAPID_PUBLIC_KEY);
      }
    }
  },

  registerServiceWorker,
  getPushSubscription,
  subscribeUserToPush,
  showBrowserNotification
};
