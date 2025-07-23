export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private isStackBlitz = false;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.isStackBlitz = window.location.hostname.includes('stackblitz') ||
                        window.location.hostname.includes('webcontainer') ||
                        (window.location.hostname === 'localhost' && window.location.port === '8080');
  }

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

        await navigator.serviceWorker.ready; // Ensure the SW is active and ready

        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    } else {
      console.warn('Service Workers or PushManager not supported in this browser.');
    }

    this.initializeAudio();
  }

  private initializeAudio() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Audio context not supported:', error);
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
      this.playNotificationSound(event.data.priority);
    }
    // Optionally, handle a response from the service worker after it displays the notification
    // if (event.data?.type === 'NOTIFICATION_DISPLAYED_CONFIRMATION') {
    //   console.log('Service Worker confirmed notification display.');
    // }
  }

  private async playNotificationSound(priority: 'low' | 'medium' | 'high' = 'medium') {
    // Check if the page is visible to avoid playing sound if the app is in the background
    // and the SW handles the actual notification sound via vibrate option.
    // This can prevent double sounds.
    if (document.visibilityState !== 'visible' && ('serviceWorker' in navigator)) {
        console.log('Page not visible, letting Service Worker handle sound/vibration.');
        return;
    }

    try {
      const frequency = priority === 'high' ? 800 : priority === 'medium' ? 600 : 400;
      const duration = priority === 'high' ? 1000 : 500;

      if (this.audioContext) {
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';

        const volume = priority === 'high' ? 0.3 : priority === 'medium' ? 0.2 : 0.1;
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration / 1000);

        console.log(`Played ${priority} priority notification sound`);
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      throw new Error('This browser does not support notifications');
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission result:', permission);

      if (permission === 'denied') {
        throw new Error('Notification permission was denied. Please enable notifications in your browser settings.');
      }

      if (permission === 'default') {
        throw new Error('Notification permission was not granted. Please try again and click "Allow".');
      }

      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      throw error;
    }
  }

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

        await this.sendSubscriptionToBackend(subscription);
        return subscription;
      } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
      }
    }
    return null;
  }

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

  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
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

  async sendTestNotification(priority: 'low' | 'medium' | 'high' = 'medium', customBody?: string, tag?: string): Promise<void> {
    const title = `MCM Alert - ${priority.toUpperCase()} Priority`;
    const body = customBody || `Test notification from MCM Alerts system (${priority} priority) - ${new Date().toLocaleTimeString()}`;

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      throw new Error('Notification permission not granted');
    }

    // Always attempt to send to Service Worker first
    if (!this.isStackBlitz && this.registration) {
      try {
        const reg = await navigator.serviceWorker.ready;
        
        // Construct notification data to send to Service Worker
        const notificationData = {
          type: 'SHOW_NOTIFICATION',
          title,
          body,
          icon: '/mcm-logo-192.png', // Ensure icons are passed for consistency
          badge: '/mcm-logo-192.png',
          priority,
          silent: false, // Explicitly pass silent
          requireInteraction: priority === 'high',
          vibrate: priority === 'high' ? [300, 100, 300, 100, 300] : [200, 100, 200],
          tag: tag || 'mcm-test-notification', // Use provided tag or default
          actions: [
            { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
            { action: 'dismiss', title: 'Dismiss' }
          ],
          data: {
            url: '/',
            priority: priority,
            timestamp: Date.now()
          }
        };

        // If the page is visible, we can play the sound directly and let the SW only display the notification
        // If the page is in background, the SW's vibrate option will handle the sound/vibration
        if (document.visibilityState === 'visible') {
            await this.playNotificationSound(priority); // Play sound immediately on client
        }

        // Post the full notification data to the service worker
        reg.active?.postMessage(notificationData);
        console.log('Message sent to service worker for notification display and background sound');
      } catch (error) {
        console.error('Failed to post message to service worker:', error);
        // If service worker communication fails for some reason (rare for an active SW),
        // then try the true fallback if Service Workers are supported at all.
        // On mobile, this will likely still fail with 'Illegal constructor' if the SW is active.
        // It's generally better to fix the SW communication rather than relying on this.
        this.showDirectBrowserNotification(title, body, priority, tag);
      }
    } else {
      // This path is for environments where Service Workers are not supported at all (like StackBlitz, or very old browsers)
      this.showDirectBrowserNotification(title, body, priority, tag);
    }

    // Backend logging for all notifications, regardless of display method
    try {
      const response = await fetch('/api/notifications', {
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Notification stored in backend:', result);
    } catch (error) {
      console.error('Failed to store notification in backend:', error);
      throw error;
    }
  }

  // Renamed from showFallbackNotification to clarify its purpose:
  // This is a direct browser Notification, only used if Service Workers are not available or are truly broken.
  // On mobile with an active SW, this *will* cause "Illegal constructor" error.
  private showDirectBrowserNotification(title: string, body: string, priority: 'low' | 'medium' | 'high', tag?: string) {
    // Only attempt this if ServiceWorker API itself is not available
    if (!('serviceWorker' in navigator) && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png',
          silent: false,
          requireInteraction: priority === 'high',
          tag: tag || 'mcm-direct-notification',
          vibrate: priority === 'high' ? [300, 100, 300, 100, 300] : [200, 100, 200],
          data: {
            priority: priority,
            timestamp: Date.now()
          }
        });

        // Auto-close for non-high priority notifications
        if (priority !== 'high') {
          setTimeout(() => {
            try {
              notification.close();
            } catch (e) {
              console.warn('Error closing direct browser notification:', e);
            }
          }, 5000);
        }

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        console.log('Direct browser notification sent successfully (Service Worker not available or failed to communicate)');
      } catch (error) {
        console.error('Direct browser notification failed (likely Illegal constructor on mobile with active SW):', error);
      }
    } else {
      console.warn('Cannot show direct browser notification: Notification API not supported, permission not granted, or Service Worker is active and should handle it.');
    }
  }

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
