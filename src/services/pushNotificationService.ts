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

        await navigator.serviceWorker.ready;

        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
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
  }

  private async playNotificationSound(priority: 'low' | 'medium' | 'high' = 'medium') {
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

  // Fixed method - always use Service Worker for notifications on mobile
  private async showServiceWorkerNotification(title: string, body: string, priority: 'low' | 'medium' | 'high'): Promise<boolean> {
    try {
      if (!this.registration) {
        await this.initialize();
      }

      if (this.registration) {
        // Use MessageChannel for better communication with Service Worker
        const messageChannel = new MessageChannel();
        
        return new Promise((resolve, reject) => {
          messageChannel.port1.onmessage = (event) => {
            if (event.data.success) {
              console.log('Service Worker notification sent successfully');
              resolve(true);
            } else {
              console.error('Service Worker notification failed:', event.data.error);
              reject(new Error(event.data.error));
            }
          };

          // Send message to service worker
          this.registration!.active?.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            body,
            priority,
            icon: '/mcm-logo-192.png',
            badge: '/mcm-logo-192.png',
            tag: 'mcm-test-notification',
            requireInteraction: priority === 'high',
            silent: false,
            vibrate: priority === 'high' ? [300, 100, 300, 100, 300] : [200, 100, 200],
            actions: [
              { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
              { action: 'dismiss', title: 'Dismiss' }
            ],
            data: {
              url: '/',
              priority: priority,
              timestamp: Date.now()
            }
          }, [messageChannel.port2]);

          // Timeout after 5 seconds
          setTimeout(() => {
            reject(new Error('Service Worker notification timeout'));
          }, 5000);
        });
      }
      
      throw new Error('Service Worker not available');
    } catch (error) {
      console.error('Service Worker notification failed:', error);
      throw error;
    }
  }

  // Mobile-safe fallback that doesn't use the Notification constructor
  private showMobileSafeFallback(title: string, body: string, priority: 'low' | 'medium' | 'high') {
    console.warn('Using mobile-safe notification fallback (no visual notification)');
    
    // Just play sound and log - don't try to show visual notification
    this.playNotificationSound(priority);
    
    // You could show an in-app notification banner here instead
    // For example, dispatch a custom event that your app can listen to
    window.dispatchEvent(new CustomEvent('fallback-notification', {
      detail: { title, body, priority }
    }));
  }

  async sendTestNotification(priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    const title = `MCM Alert - ${priority.toUpperCase()} Priority`;
    const body = `Test notification from MCM Alerts system (${priority} priority) - ${new Date().toLocaleTimeString()}`;

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      throw new Error('Notification permission not granted');
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Always try Service Worker first, even on desktop
    if (!this.isStackBlitz && 'serviceWorker' in navigator) {
      try {
        await this.showServiceWorkerNotification(title, body, priority);
        console.log('Service Worker notification sent successfully');
      } catch (error) {
        console.error('Service Worker notification failed, using fallback:', error);
        this.showMobileSafeFallback(title, body, priority);
      }
    } else {
      this.showMobileSafeFallback(title, body, priority);
    }

    // Store notification in backend
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
