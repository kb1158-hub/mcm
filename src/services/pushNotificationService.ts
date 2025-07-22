export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private isStackBlitz = false;

  constructor() {
    // Check if running in StackBlitz or similar environments
    this.isStackBlitz = window.location.hostname.includes('stackblitz') || 
                       window.location.hostname.includes('webcontainer') ||
                       window.location.hostname.includes('localhost');
  }

  /**
   * Initializes and registers the service worker for push notifications.
   */
  async initialize() {
    if (this.isStackBlitz) {
      console.warn('Service Workers are not supported in this environment. Using fallback notification methods.');
      return;
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        this.registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });
        console.log('Service Worker registered:', this.registration);
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
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
    if (this.isStackBlitz) {
      console.log('Push subscriptions not available in this environment');
      return null;
    }

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
        
        // Send subscription to backend
        await this.sendSubscriptionToBackend(subscription);
        return subscription;
      } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
      }
    }
    return null;
  }

  /**
   * Sends subscription to backend for storage
   */
  private async sendSubscriptionToBackend(subscription: PushSubscription) {
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: this.arrayBufferToBase64(subscription.getKey('auth'))
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send subscription to backend');
      }
    } catch (error) {
      console.error('Error sending subscription to backend:', error);
    }
  }

  /**
   * Converts ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
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
   * Sends a test notification with sound to the user.
   */
  async sendTestNotification(priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    const title = `MCM Alert - ${priority.toUpperCase()} Priority`;
    const body = `Test notification from MCM Alerts system (${priority} priority) - ${new Date().toLocaleTimeString()}`;
    
    // First, ensure we have permission
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      return;
    }

    // Try service worker notification first (for production)
    if (!this.isStackBlitz && this.registration) {
      try {
        const sw = this.registration.active || this.registration.waiting || this.registration.installing;
        if (sw) {
          sw.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            body,
            icon: '/mcm-logo-192.png',
            badge: '/mcm-logo-192.png',
            priority: priority
          });
        }
      } catch (error) {
        console.error('Service worker notification failed:', error);
      }
    }

    // Fallback to browser notification API (works in all environments)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png',
          silent: false,
          requireInteraction: priority === 'high',
          tag: 'mcm-test-notification',
          vibrate: priority === 'high' ? [200, 100, 200] : [100],
          actions: [
            { action: 'view', title: 'View Dashboard' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        });

        // Auto-close after 5 seconds for low/medium priority
        if (priority !== 'high') {
          setTimeout(() => {
            notification.close();
          }, 5000);
        }

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        console.log('Browser notification sent successfully');
      } catch (error) {
        console.error('Browser notification failed:', error);
      }
    }

    // Also send to backend API to store in database
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'test_notification',
          title,
          message: body,
          priority,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to store notification in backend:', error);
    }
  }

  /**
   * Unsubscribes the user from push notifications.
   */
  async unsubscribe(): Promise<boolean> {
    if (this.isStackBlitz) {
      return false;
    }

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