// src/services/pushNotificationService.ts
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/service-worker.js');
  }
}

export async function getPushSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return await reg?.pushManager.getSubscription();
}

export async function subscribeUserToPush(vapidPublicKey: string) {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });
  // send subscription to backend
  await fetch('/.netlify/functions/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: { 'Content-Type': 'application/json' }
  });
  return subscription;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return new Uint8Array([...raw].map(char => char.charCodeAt(0)));
}

// Show notification in browser if site is open
export async function showBrowserNotification({ title, body, url }: 
  { title: string, body: string, url?: string }
) {
  if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.showNotification(title, {
      body,
      data: { url }
    });
  }
}
