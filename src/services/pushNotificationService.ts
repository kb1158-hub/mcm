export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private isStackBlitz = false;
  private audioContext: AudioContext | null = null;

  constructor() {
    // Check if running in StackBlitz or similar environments
    this.isStackBlitz = window.location.hostname.includes('stackblitz') || 
                       window.location.hostname.includes('webcontainer') ||
                       (window.location.hostname === 'localhost' && window.location.port === '8080');
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
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
        
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    // Initialize audio context for sound
    this.initializeAudio();
  }

  /**
   * Initialize audio context for notification sounds
   */
  private initializeAudio() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Audio context not supported:', error);
    }
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent) {
    if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
      this.playNotificationSound(event.data.priority);
    }
  }

  /**
   * Play notification sound based on priority
   */
  private async playNotificationSound(priority: 'low' | 'medium' | 'high' = 'medium') {
    try {
      // Create audio element for sound
      const audio = new Audio();
      
      // Generate different tones for different priorities
      const frequency = priority === 'high' ? 800 : priority === 'medium' ? 600 : 400;
      const duration = priority === 'high' ? 1000 : 500;
      
      if (this.audioContext) {
        // Resume audio context if suspended (required for mobile)
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        
        // Create oscillator for notification sound
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        // Set volume based on priority
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
   * Sends a test notification with enhanced sound and mobile support.
   */
  async sendTestNotification(priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    const title = `MCM Alert - ${priority.toUpperCase()} Priority`;
    const body = `Test notification from MCM Alerts system (${priority} priority) - ${new Date().toLocaleTimeString()}`;
    
    // First, ensure we have permission
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      throw new Error('Notification permission not granted');
    }

    // Resume audio context for mobile (required for sound)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Play sound immediately for better mobile support
    await this.playNotificationSound(priority);

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

    // Enhanced browser notification with mobile support
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png',
          silent: false, // Never silent for sound support
          requireInteraction: priority === 'high',
          tag: 'mcm-test-notification',
          vibrate: priority === 'high' ? [300, 100, 300, 100, 300] : [200, 100, 200],
          actions: [
            { action: 'view', title: 'View Dashboard' },
            { action: 'dismiss', title: 'Dismiss' }
          ],
          data: {
            priority: priority,
            timestamp: Date.now()
          }
        });

        // Auto-close after delay for low/medium priority
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