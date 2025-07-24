export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private isStackBlitz = false;
  private audioContext: AudioContext | null = null;
  private pollingInterval: number | null = null;
  private lastNotificationCheck = 0;

  constructor() {
    this.isStackBlitz = window.location.hostname.includes('stackblitz') ||
                        window.location.hostname.includes('webcontainer') ||
                        (window.location.hostname === 'localhost' && window.location.port === '8080');
  }

  async initialize() {
    if (this.isStackBlitz) {
      console.warn('Service Workers are not supported in this environment. Using fallback notification methods.');
      this.startNotificationPolling();
      return;
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        this.registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'none'
        });
        
        console.log('Service Worker registered:', this.registration);

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        // Handle service worker updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New service worker installed, will update on next page load');
              }
            });
          }
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));

        // Start real-time notification polling
        this.startNotificationPolling();

      } catch (error) {
        console.error('Service Worker registration failed:', error);
        // Fallback to polling without service worker
        this.startNotificationPolling();
      }
    } else {
      console.warn('Service Workers or Push Manager not supported');
      this.startNotificationPolling();
    }

    this.initializeAudio();
  }

  private startNotificationPolling() {
    // Poll for new notifications every 30 seconds
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = window.setInterval(async () => {
      try {
        await this.checkForNewNotifications();
      } catch (error) {
        console.error('Error checking for notifications:', error);
      }
    }, 30000); // 30 seconds

    // Initial check
    this.checkForNewNotifications();
  }

  private async checkForNewNotifications() {
    try {
      const response = await fetch(`/api/notifications/recent?since=${this.lastNotificationCheck}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const notifications = await response.json();
        
        if (notifications && notifications.length > 0) {
          console.log(`Found ${notifications.length} new notifications`);
          
          for (const notification of notifications) {
            await this.showRealtimeNotification(notification);
          }
          
          this.lastNotificationCheck = Date.now();
        }
      }
    } catch (error) {
      console.error('Failed to check for new notifications:', error);
    }
  }

  private async showRealtimeNotification(notification: any) {
    const title = notification.title || 'MCM Alert';
    const body = notification.message || notification.body || 'New notification received';
    const priority = notification.priority || 'medium';

    // Show notification with proper mobile handling
    await this.sendNotification(title, body, priority);
  }

  private initializeAudio() {
    // Initialize audio context on user interaction
    const initAudio = () => {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        document.removeEventListener('click', initAudio);
        document.removeEventListener('touchstart', initAudio);
      } catch (error) {
        console.warn('Audio context not supported:', error);
      }
    };

    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    console.log('Received message from service worker:', event.data);
    
    if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
      this.playNotificationSound(event.data.priority);
    } else if (event.data?.type === 'NOTIFICATION_CLICKED') {
      // Handle notification click events
      console.log('Notification was clicked:', event.data);
    }
  }

  private async playNotificationSound(priority: 'low' | 'medium' | 'high' = 'medium') {
    try {
      if (!this.audioContext) {
        return;
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const frequency = priority === 'high' ? 800 : priority === 'medium' ? 600 : 400;
      const duration = priority === 'high' ? 1000 : 500;

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
      let permission = Notification.permission;
      
      if (permission === 'default') {
        // Request permission with user gesture
        permission = await Notification.requestPermission();
      }
      
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
        // Check if already subscribed
        const existingSubscription = await this.registration.pushManager.getSubscription();
        if (existingSubscription) {
          console.log('Already subscribed to push notifications');
          return existingSubscription;
        }

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
        throw error;
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
        throw new Error(`Failed to send subscription to backend: ${response.status}`);
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

  private async showServiceWorkerNotification(title: string, body: string, priority: 'low' | 'medium' | 'high'): Promise<boolean> {
    try {
      if (!this.registration) {
        throw new Error('Service Worker not registered');
      }

      if (!this.registration.active) {
        throw new Error('Service Worker not active');
      }

      // Use MessageChannel for reliable communication
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Service Worker notification timeout'));
        }, 10000);

        messageChannel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          if (event.data.success) {
            console.log('Service Worker notification sent successfully');
            resolve(true);
          } else {
            console.error('Service Worker notification failed:', event.data.error);
            reject(new Error(event.data.error || 'Service Worker notification failed'));
          }
        };

        // Send message to service worker
        this.registration!.active!.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body,
          priority,
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png',
          tag: `mcm-notification-${Date.now()}`,
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
      });
    } catch (error) {
      console.error('Service Worker notification failed:', error);
      throw error;
    }
  }

  private showFallbackNotification(title: string, body: string, priority: 'low' | 'medium' | 'high') {
    console.log('Using fallback notification method');
    
    // Play sound
    this.playNotificationSound(priority);
    
    // Dispatch custom event for in-app notification
    window.dispatchEvent(new CustomEvent('fallback-notification', {
      detail: { title, body, priority }
    }));

    // Try browser notification API as last resort (desktop only)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (!isMobile && !isStandalone && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/mcm-logo-192.png',
          tag: `mcm-fallback-${Date.now()}`,
          requireInteraction: priority === 'high',
          silent: false
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        setTimeout(() => {
          notification.close();
        }, priority === 'high' ? 10000 : 5000);

      } catch (error) {
        console.error('Fallback browser notification failed:', error);
      }
    }
  }

  async sendNotification(title: string, body: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    // Always try to get permission first
    const hasPermission = await this.requestPermission().catch(() => false);
    
    if (!hasPermission) {
      console.warn('Notification permission not granted, using fallback');
      this.showFallbackNotification(title, body, priority);
      return;
    }

    // Resume audio context if needed
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.error('Failed to resume audio context:', error);
      }
    }

    // Try Service Worker notification first (works on mobile)
    if (!this.isStackBlitz && 'serviceWorker' in navigator && this.registration) {
      try {
        await this.showServiceWorkerNotification(title, body, priority);
        console.log('Service Worker notification sent successfully');
        return;
      } catch (error) {
        console.error('Service Worker notification failed, using fallback:', error);
      }
    }

    // Fallback notification
    this.showFallbackNotification(title, body, priority);
  }

  async sendTestNotification(priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    const title = `MCM Alert - ${priority.toUpperCase()} Priority`;
    const body = `Test notification from MCM Alerts system (${priority} priority) - ${new Date().toLocaleTimeString()}`;

    await this.sendNotification(title, body, priority);

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
      // Don't throw here - notification was shown successfully
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (this.isStackBlitz) {
      return false;
    }

    // Clear polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        console.log('Push subscription cancelled.');
        return true;
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    }
    
    return false;
  }

  // Cleanup method
  destroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const pushService = new PushNotificationService();
