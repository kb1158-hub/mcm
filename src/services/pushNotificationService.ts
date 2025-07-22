export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;

  /**
   * Initializes and registers the service worker for push notifications.
   */
  async initialize() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        // Make sure the path matches your deployed service worker!
        this.registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });
        console.log('Service Worker registered:', this.registration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  /**
   * Requests permission from the user for notifications.
   */
  async requestPermission(): Promise<boolean> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  /**
   * Subscribes the user to push notifications using the VAPID key.
   */
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

  /**
   * Converts a base64 string to a Uint8Array for the VAPID key.
   */
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

  /**
   * Sends a test notification to the user via the service worker.
   */
  async sendTestNotification(): Promise<void> {
    if ('serviceWorker' in navigator && this.registration) {
      // Use whichever is available: active, waiting, installing
      const sw = this.registration.active || this.registration.waiting || this.registration.installing;
      if (sw) {
        sw.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: 'MCM Alert',
          body: 'Test notification from MCM Alerts system',
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png'
        });
      } else {
        console.warn('No active service worker found to send notification.');
      }
    }
  }

  /**
   * Unsubscribes the user from push notifications.
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.registration) {
      await this.initialize();
    }
    if (this.registration) {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        console.log('Push subscription cancelled.');
        return true;
      }
    }
    return false;
  }
}

export const pushService = new PushNotificationService();
