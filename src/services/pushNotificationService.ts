// src/services/pushNotificationService.ts - Enhanced version
export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private isStackBlitz = false;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private subscriptionCallbacks: Set<(subscription: PushSubscription | null) => void> = new Set();

  constructor() {
    this.isStackBlitz = window.location.hostname.includes('stackblitz') ||
                        window.location.hostname.includes('webcontainer') ||
                        (window.location.hostname === 'localhost' && window.location.port === '8080');
  }

  async initialize() {
    if (this.isInitialized) return;

    if (this.isStackBlitz) {
      console.warn('Service Workers are not supported in this environment. Using fallback notification methods.');
      this.isInitialized = true;
      return;
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        // Register service worker with proper path
        this.registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'none' // Always check for updates
        });
        
        console.log('Service Worker registered:', this.registration);

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        // Listen for service worker updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New service worker installed, updating...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        // Set up message listener
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));

        // Check for existing subscription
        const existingSubscription = await this.registration.pushManager.getSubscription();
        if (existingSubscription) {
          console.log('Found existing push subscription:', existingSubscription);
          await this.sendSubscriptionToBackend(existingSubscription);
        }

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    this.initializeAudio();
    this.isInitialized = true;
  }

  private initializeAudio() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Audio context not supported:', error);
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    const { type, data } = event.data;
    
    switch (type) {
      case 'PLAY_NOTIFICATION_SOUND':
        this.playNotificationSound(data?.priority || 'medium');
        break;
        
      case 'NOTIFICATION_CLICKED':
        console.log('Notification clicked from service worker:', data);
        // Handle notification click
        this.handleNotificationClick(data);
        break;
        
      case 'PUSH_NOTIFICATION_RECEIVED':
        console.log('Push notification received:', data);
        // Handle push notification
        this.handlePushNotification(data);
        break;
        
      default:
        console.log('Unknown service worker message:', event.data);
    }
  }

  private handleNotificationClick(data: any) {
    // Dispatch custom event for notification click
    window.dispatchEvent(new CustomEvent('notificationClick', { detail: data }));
    
    // Mark as acknowledged if needed
    if (data.id) {
      this.acknowledgeNotification(data.id);
    }
  }

  private handlePushNotification(data: any) {
    // Dispatch custom event for new push notification
    window.dispatchEvent(new CustomEvent('pushNotificationReceived', { detail: data }));
  }

  private async acknowledgeNotification(notificationId: string) {
    try {
      await fetch('/.netlify/functions/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: notificationId,
          acknowledged: true
        })
      });
    } catch (error) {
      console.error('Failed to acknowledge notification:', error);
    }
  }

  async playNotificationSound(priority: 'low' | 'medium' | 'high' = 'medium') {
    try {
      if (!this.audioContext) {
        this.initializeAudio();
      }

      if (this.audioContext) {
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        const frequency = priority === 'high' ? 800 : priority === 'medium' ? 600 : 400;
        const duration = priority === 'high' ? 1000 : 500;
        const volume = priority === 'high' ? 0.3 : priority === 'medium' ? 0.2 : 0.1;

        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration / 1000);

        console.log(`Played ${priority} priority notification sound`);
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error);
      
      // Fallback vibration for mobile
      if (navigator.vibrate) {
        const pattern = priority === 'high' ? [300, 100, 300, 100, 300] : [200, 100, 200];
        navigator.vibrate(pattern);
      }
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
        // Check for existing subscription first
        const existingSubscription = await this.registration.pushManager.getSubscription();
        if (existingSubscription) {
          console.log('Using existing subscription');
          await this.sendSubscriptionToBackend(existingSubscription);
          return existingSubscription;
        }

        // Create new subscription
        const subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlB64ToUint8Array(
            'BEl62iUYgUivxIkv69yViEuiBIa40HI0DLLuxazjqAKeFXjWWqlaGSb0TSa1TCEdqNB0NDrWJZnIa5oZUMoMJpE'
          )
        });
        
        console.log('New push subscription created:', subscription);
        await this.sendSubscriptionToBackend(subscription);
        
        // Notify callbacks
        this.subscriptionCallbacks.forEach(callback => callback(subscription));
        
        return subscription;
      } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
        throw error;
      }
    }
    return null;
  }

  private async sendSubscriptionToBackend(subscription: PushSubscription) {
    try {
      // Try netlify function first
      let response = await fetch('/.netlify/functions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: this.arrayBufferToBase64(subscription.getKey('auth'))
          }
        })
      });

      // Fallback to backend server
      if (!response.ok) {
        response = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
              auth: this.arrayBufferToBase64(subscription.getKey('auth'))
            }
          })
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Subscription sent to backend successfully');
    } catch (error) {
      console.error('Error sending subscription to backend:', error);
      throw error;
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

  async sendNotificationViaServiceWorker(
    title: string, 
    body: string, 
    priority: 'low' | 'medium' | 'high' = 'medium',
    options: any = {}
  ): Promise<boolean> {
    try {
      if (!this.registration || !navigator.serviceWorker.controller) {
        await this.initialize();
      }

      if (!navigator.serviceWorker.controller) {
        throw new Error('Service Worker not available');
      }

      return new Promise((resolve, reject) => {
        const messageChannel = new MessageChannel();
        
        messageChannel.port1.onmessage = (event) => {
          if (event.data.success) {
            console.log('Service Worker notification sent successfully');
            resolve(true);
          } else {
            console.error('Service Worker notification failed:', event.data.error);
            reject(new Error(event.data.error));
          }
        };

        navigator.serviceWorker.controller!.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body,
          priority,
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png',
          tag: `mcm-notification-${Date.now()}`,
          requireInteraction: priority === 'high',
          silent: false,
          vibrate: this.getVibratePattern(priority),
          actions: [
            { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
            { action: 'dismiss', title: 'Dismiss' }
          ],
          data: {
            url: '/',
            priority: priority,
            timestamp: Date.now(),
            ...options
          }
        }, [messageChannel.port2]);

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Service Worker notification timeout'));
        }, 5000);
      });
    } catch (error) {
      console.error('Service Worker notification failed:', error);
      throw error;
    }
  }

  private getVibratePattern(priority: 'low' | 'medium' | 'high'): number[] {
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

  async sendTestNotification(priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    const title = `MCM Alert - ${priority.toUpperCase()} Priority`;
    const body = `Test notification from MCM Alerts system (${priority} priority) - ${new Date().toLocaleTimeString()}`;

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      throw new Error('Notification permission not granted');
    }

    // Initialize audio context if suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    try {
      // Always use service worker for notifications
      await this.sendNotificationViaServiceWorker(title, body, priority);
      
      // Play sound
      await this.playNotificationSound(priority);
      
      // Store in backend
      await this.storeNotificationInBackend(title, body, priority);
      
    } catch (error) {
      console.error('Test notification failed:', error);
      throw error;
    }
  }

  private async storeNotificationInBackend(title: string, body: string, priority: string) {
    try {
      // Try netlify function first
      let response = await fetch('/.netlify/functions/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'test_notification',
          title,
          message: body,
          priority,
          timestamp: new Date().toISOString()
        })
      });

      // Fallback to backend server
      if (!response.ok) {
        response = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'test_notification',
            title,
            message: body,
            priority,
            timestamp: new Date().toISOString()
          })
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Notification stored in backend:', result);
    } catch (error) {
      console.error('Failed to store notification in backend:', error);
      // Don't throw here - notification can still work without backend storage
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
      try {
        const subscription = await this.registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          console.log('Push subscription cancelled.');
          
          // Notify callbacks
          this.subscriptionCallbacks.forEach(callback => callback(null));
          
          return true;
        }
      } catch (error) {
        console.error('Failed to unsubscribe:', error);
      }
    }
    return false;
  }

  // Get current subscription status
  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) {
      await this.initialize();
    }

    if (this.registration) {
      return await this.registration.pushManager.getSubscription();
    }
    return null;
  }

  // Add subscription change listener
  onSubscriptionChange(callback: (subscription: PushSubscription | null) => void) {
    this.subscriptionCallbacks.add(callback);
    return () => this.subscriptionCallbacks.delete(callback);
  }

  // Clear all notifications
  async clearAllNotifications(): Promise<void> {
    if (!this.registration) return;

    try {
      const notifications = await this.registration.getNotifications();
      notifications.forEach(notification => {
        if (notification.tag && notification.tag.startsWith('mcm-')) {
          notification.close();
        }
      });
      console.log(`Cleared ${notifications.length} notifications`);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  // Check if notifications are supported
  static isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  // Get notification permission status
  static getPermissionStatus(): NotificationPermission {
    return 'Notification' in window ? Notification.permission : 'denied';
  }
}

export const pushService = new PushNotificationService();
