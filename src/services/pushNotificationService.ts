export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private isStackBlitz = false;
  private audioContext: AudioContext | null = null;
  private notificationQueue: Array<{title: string, body: string, priority: 'low' | 'medium' | 'high'}> = [];
  private isProcessingQueue = false;

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

        // Enhanced message handling for real-time notifications
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
        
        // Listen for push events from service worker
        this.setupPushEventListener();
        
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    this.initializeAudio();
    this.setupVisibilityListener();
  }

  private setupPushEventListener() {
    // Listen for messages from service worker about push notifications
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
        const { notificationData } = event.data;
        
        // Show in-app notification immediately if page is visible
        if (document.visibilityState === 'visible') {
          this.showInAppNotification(notificationData);
        }
        
        // Always play sound for API notifications
        this.playNotificationSound(notificationData.priority || 'medium');
        
        // Dispatch custom event for app components to listen
        window.dispatchEvent(new CustomEvent('api-notification-received', {
          detail: notificationData
        }));
      }
    });
  }

  private setupVisibilityListener() {
    // Handle visibility changes for better mobile behavior
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.notificationQueue.length > 0) {
        this.processNotificationQueue();
      }
    });
  }

  private async processNotificationQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();
      if (notification) {
        await this.showInAppNotification(notification);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between notifications
      }
    }

    this.isProcessingQueue = false;
  }

  private showInAppNotification(notification: {title: string, body: string, priority: 'low' | 'medium' | 'high'}) {
    // Create in-app notification element
    const notificationEl = document.createElement('div');
    notificationEl.className = `fixed top-4 right-4 z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm transform translate-x-full transition-transform duration-300 ease-out`;
    
    // Priority-based styling
    const priorityClasses = {
      high: 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20',
      medium: 'border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
      low: 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'
    };
    
    notificationEl.className += ` ${priorityClasses[notification.priority]}`;
    
    notificationEl.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-1">
          <h4 class="font-semibold text-gray-900 dark:text-gray-100 text-sm">${notification.title}</h4>
          <p class="text-gray-700 dark:text-gray-300 text-sm mt-1">${notification.body}</p>
          <p class="text-gray-500 dark:text-gray-400 text-xs mt-2">${new Date().toLocaleTimeString()}</p>
        </div>
        <button class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ml-2" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(notificationEl);
    
    // Animate in
    setTimeout(() => {
      notificationEl.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after delay
    setTimeout(() => {
      notificationEl.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notificationEl.parentElement) {
          notificationEl.remove();
        }
      }, 300);
    }, notification.priority === 'high' ? 8000 : 5000);
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
      if (!this.audioContext) return;

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const soundConfig = {
        low: { frequency: 400, duration: 0.3, volume: 0.1 },
        medium: { frequency: 600, duration: 0.5, volume: 0.2 },
        high: { frequency: 800, duration: 1.0, volume: 0.3 }
      };

      const config = soundConfig[priority];
      
      // Create multiple tones for high priority
      const tones = priority === 'high' ? 
        [{ freq: 800, dur: 0.2 }, { freq: 1000, dur: 0.2 }, { freq: 800, dur: 0.2 }] : 
        [{ freq: config.frequency, dur: config.duration }];

      let startTime = this.audioContext.currentTime;
      
      for (const tone of tones) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(tone.freq, startTime);
        oscillator.type = priority === 'high' ? 'square' : 'sine';

        gainNode.gain.setValueAtTime(config.volume, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + tone.dur);

        oscillator.start(startTime);
        oscillator.stop(startTime + tone.dur);
        
        startTime += tone.dur + (priority === 'high' ? 0.1 : 0);
      }

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

  // Enhanced method for real-time API notifications
  async showApiNotification(title: string, body: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    console.log('Showing API notification:', { title, body, priority });
    
    // Always play sound immediately for API notifications
    await this.playNotificationSound(priority);
    
    // Check if page is visible
    if (document.visibilityState === 'visible') {
      // Show in-app notification immediately
      this.showInAppNotification({ title, body, priority });
    } else {
      // Queue for when page becomes visible
      this.notificationQueue.push({ title, body, priority });
    }

    // Try to show browser notification if permission granted
    const hasPermission = Notification.permission === 'granted';
    if (hasPermission) {
      try {
        await this.showServiceWorkerNotification(title, body, priority);
      } catch (error) {
        console.warn('Service Worker notification failed:', error);
        // Fallback to direct notification for desktop
        if (!this.isMobileDevice()) {
          this.showDirectNotification(title, body, priority);
        }
      }
    }
  }

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.matchMedia('(display-mode: standalone)').matches;
  }

  private showDirectNotification(title: string, body: string, priority: 'low' | 'medium' | 'high') {
    try {
      const notification = new Notification(title, {
        body,
        icon: '/mcm-logo-192.png',
        badge: '/mcm-logo-192.png',
        tag: 'mcm-api-notification',
        requireInteraction: priority === 'high',
        silent: false,
        vibrate: this.getVibratePattern(priority),
        data: {
          priority,
          timestamp: Date.now()
        }
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after delay
      setTimeout(() => {
        try {
          notification.close();
        } catch (e) {}
      }, priority === 'high' ? 10000 : 5000);

    } catch (error) {
      console.error('Direct notification failed:', error);
    }
  }

  private getVibratePattern(priority: 'low' | 'medium' | 'high'): number[] {
    switch (priority) {
      case 'high': return [300, 100, 300, 100, 300];
      case 'medium': return [200, 100, 200];
      case 'low': return [100];
      default: return [200, 100, 200];
    }
  }

  private async showServiceWorkerNotification(title: string, body: string, priority: 'low' | 'medium' | 'high'): Promise<boolean> {
    try {
      if (!this.registration) {
        await this.initialize();
      }

      if (this.registration) {
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

          this.registration!.active?.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            body,
            priority,
            icon: '/mcm-logo-192.png',
            badge: '/mcm-logo-192.png',
            tag: 'mcm-api-notification',
            requireInteraction: priority === 'high',
            silent: false,
            vibrate: this.getVibratePattern(priority),
            actions: priority === 'high' ? [
              { action: 'acknowledge', title: 'Acknowledge', icon: '/mcm-logo-192.png' }
            ] : [
              { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
              { action: 'dismiss', title: 'Dismiss' }
            ],
            data: {
              url: window.location.origin,
              priority: priority,
              timestamp: Date.now(),
              source: 'api'
            }
          }, [messageChannel.port2]);

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

    // Always try Service Worker first for consistency
    if (!this.isStackBlitz && 'serviceWorker' in navigator) {
      try {
        await this.showServiceWorkerNotification(title, body, priority);
        console.log('Service Worker test notification sent successfully');
      } catch (error) {
        console.error('Service Worker test notification failed, using fallback:', error);
        if (!this.isMobileDevice()) {
          this.showDirectNotification(title, body, priority);
        }
      }
    } else {
      if (!this.isMobileDevice()) {
        this.showDirectNotification(title, body, priority);
      }
    }

    // Always show in-app notification for tests
    this.showInAppNotification({ title, body, priority });

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
        console.warn(`Backend storage failed with status: ${response.status}`);
      } else {
        const result = await response.json();
        console.log('Test notification stored in backend:', result);
      }
    } catch (error) {
      console.error('Failed to store test notification in backend:', error);
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
