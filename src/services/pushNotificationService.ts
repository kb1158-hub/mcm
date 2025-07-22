export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;

  async initialize() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('Service Worker registered:', this.registration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  async requestPermission(): Promise<boolean> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  async subscribe(): Promise<PushSubscription | null> {
    if (!this.registration) {
      await this.initialize();
    }

    if (this.registration) {
      try {
        const subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlB64ToUint8Array(
            'BEl62iUYgUivxIkv69yViEuiBIa40HI0DLLuxazjqAKeFXjWWqlaGSb0TSa1TCEdqNB0NDrWJZnIa5oZUMoMJpE'
          )
        });
        console.log('Push subscription:', subscription);
        return subscription;
      } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
      }
    }
    return null;
  }

  private urlB64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async sendTestNotification(): Promise<void> {
    if ('serviceWorker' in navigator && this.registration) {
      // Send test notification via service worker
      this.registration.active?.postMessage({
        type: 'SHOW_NOTIFICATION',
        title: 'MCM Alert',
        body: 'Test notification from MCM Alerts system',
        icon: '/mcm-logo-192.png',
        badge: '/mcm-logo-192.png'
      });
    }
  }
}

export const pushService = new PushNotificationService();