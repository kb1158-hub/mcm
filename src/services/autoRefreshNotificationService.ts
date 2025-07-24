// Create/Update: src/services/autoRefreshNotificationService.ts

export interface NotificationTrigger {
  id: string;
  type: 'alert' | 'system' | 'price_change' | 'emergency';
  priority: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  timestamp: string;
  shouldRefresh?: boolean;
  refreshDelay?: number; // milliseconds
}

export class AutoRefreshNotificationService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastNotificationCheck: number = Date.now();
  private isPolling = false;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private notificationQueue: NotificationTrigger[] = [];
  private readonly POLLING_INTERVAL = 5000; // 5 seconds
  private readonly DEFAULT_REFRESH_DELAY = 2000; // 2 seconds after showing notification

  constructor() {
    this.setupVisibilityListener();
    this.setupBeforeUnloadListener();
  }

  // Start polling for new notifications
  startPolling() {
    if (this.isPolling) {
      console.log('Auto-refresh polling already active');
      return;
    }

    console.log('Starting auto-refresh notification polling...');
    this.isPolling = true;
    this.lastNotificationCheck = Date.now();

    this.pollingInterval = setInterval(async () => {
      try {
        await this.checkForNewNotifications();
      } catch (error) {
        console.error('Error checking for notifications:', error);
      }
    }, this.POLLING_INTERVAL);

    // Also check immediately
    this.checkForNewNotifications();
  }

  // Stop polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }

    this.isPolling = false;
    console.log('Auto-refresh notification polling stopped');
  }

  // Check for new notifications from backend
  private async checkForNewNotifications() {
    try {
      const response = await fetch(`/api/notifications/check?since=${this.lastNotificationCheck}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check notifications: ${response.status}`);
      }

      const data = await response.json();
      const notifications: NotificationTrigger[] = data.notifications || [];

      if (notifications.length > 0) {
        console.log(`Found ${notifications.length} new notifications:`, notifications);
        
        // Process each notification
        for (const notification of notifications) {
          await this.processNotification(notification);
        }

        // Update last check timestamp
        this.lastNotificationCheck = Date.now();
      }
    } catch (error) {
      console.error('Failed to check for notifications:', error);
      
      // Fallback: check localStorage for notification flags set by other tabs/service workers
      this.checkLocalStorageFlags();
    }
  }

  // Process individual notification
  private async processNotification(notification: NotificationTrigger) {
    console.log('Processing notification:', notification);

    // Add to queue
    this.notificationQueue.push(notification);

    // Show notification immediately
    this.showNotification(notification);

    // Play sound based on priority
    this.playNotificationSound(notification.priority);

    // Schedule page refresh if needed
    if (notification.shouldRefresh !== false) { // Default to true unless explicitly false
      const delay = notification.refreshDelay || this.DEFAULT_REFRESH_DELAY;
      
      // For high priority, refresh immediately after a short delay
      if (notification.priority === 'high') {
        this.scheduleRefresh(Math.min(delay, 1000), `High priority alert: ${notification.title}`);
      } 
      // For medium priority, use normal delay
      else if (notification.priority === 'medium') {
        this.scheduleRefresh(delay, `New alert: ${notification.title}`);
      }
      // For low priority, only refresh if multiple notifications or after longer delay
      else {
        if (this.notificationQueue.length > 2) {
          this.scheduleRefresh(delay * 2, 'Multiple new alerts received');
        }
      }
    }
  }

  // Show notification using available methods
  private showNotification(notification: NotificationTrigger) {
    // Try browser notification first
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png',
          tag: `mcm-alert-${notification.id}`,
          requireInteraction: notification.priority === 'high',
          silent: false,
          data: {
            id: notification.id,
            type: notification.type,
            priority: notification.priority,
            timestamp: notification.timestamp
          }
        });

        browserNotification.onclick = () => {
          window.focus();
          browserNotification.close();
        };

        // Auto-close after delay (except for high priority)
        if (notification.priority !== 'high') {
          setTimeout(() => {
            browserNotification.close();
          }, 5000);
        }

        return;
      } catch (error) {
        console.error('Failed to show browser notification:', error);
      }
    }

    // Fallback: Show in-page notification
    this.showInPageNotification(notification);
  }

  // Show in-page notification as fallback
  private showInPageNotification(notification: NotificationTrigger) {
    // Create notification element
    const notificationEl = document.createElement('div');
    notificationEl.className = `
      fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg border-l-4 
      transform transition-all duration-300 ease-in-out translate-x-full
      ${notification.priority === 'high' ? 'bg-red-50 border-red-500' : 
        notification.priority === 'medium' ? 'bg-blue-50 border-blue-500' : 
        'bg-gray-50 border-gray-500'}
    `;

    notificationEl.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-1">
          <h4 class="font-semibold text-gray-900 text-sm">${notification.title}</h4>
          <p class="text-sm text-gray-700 mt-1">${notification.message}</p>
          <p class="text-xs text-gray-500 mt-2">${new Date(notification.timestamp).toLocaleTimeString()}</p>
        </div>
        <button class="text-gray-400 hover:text-gray-600 ml-2" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(notificationEl);

    // Animate in
    setTimeout(() => {
      notificationEl.style.transform = 'translateX(0)';
    }, 100);

    // Auto-remove after delay
    setTimeout(() => {
      notificationEl.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notificationEl.parentNode) {
          notificationEl.parentNode.removeChild(notificationEl);
        }
      }, 300);
    }, notification.priority === 'high' ? 8000 : 5000);
  }

  // Play notification sound
  private playNotificationSound(priority: 'low' | 'medium' | 'high') {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playTone = (frequency: number, duration: number, volume: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
      };

      // Different sounds for different priorities
      switch (priority) {
        case 'high':
          playTone(800, 0.3, 0.3);
          setTimeout(() => playTone(1000, 0.3, 0.3), 400);
          setTimeout(() => playTone(800, 0.3, 0.3), 800);
          break;
        case 'medium':
          playTone(600, 0.5, 0.2);
          setTimeout(() => playTone(700, 0.3, 0.15), 600);
          break;
        case 'low':
          playTone(400, 0.4, 0.1);
          break;
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }

  // Schedule page refresh
  private scheduleRefresh(delay: number, reason: string) {
    // Clear any existing refresh timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    console.log(`Scheduling page refresh in ${delay}ms. Reason: ${reason}`);

    // Show refresh countdown
    this.showRefreshCountdown(delay, reason);

    this.refreshTimeout = setTimeout(() => {
      console.log(`Refreshing page. Reason: ${reason}`);
      
      // Store notification state before refresh
      this.storeNotificationState();
      
      // Perform refresh
      window.location.reload();
    }, delay);
  }

  // Show refresh countdown notification
  private showRefreshCountdown(delay: number, reason: string) {
    const countdownEl = document.createElement('div');
    countdownEl.className = `
      fixed bottom-4 right-4 z-50 p-3 bg-blue-600 text-white rounded-lg shadow-lg
      transform transition-all duration-300 ease-in-out translate-y-full
    `;

    let remainingTime = Math.ceil(delay / 1000);
    
    const updateCountdown = () => {
      countdownEl.innerHTML = `
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          <span class="text-sm">
            ${reason} - Refreshing in <strong>${remainingTime}s</strong>
          </span>
          <button class="ml-2 text-white/80 hover:text-white" onclick="this.parentElement.parentElement.remove()">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
          </button>
        </div>
      `;
    };

    updateCountdown();
    document.body.appendChild(countdownEl);

    // Animate in
    setTimeout(() => {
      countdownEl.style.transform = 'translateY(0)';
    }, 100);

    // Update countdown every second
    const countdownInterval = setInterval(() => {
      remainingTime--;
      if (remainingTime > 0) {
        updateCountdown();
      } else {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Remove after delay
    setTimeout(() => {
      if (countdownEl.parentNode) {
        countdownEl.style.transform = 'translateY(100%)';
        setTimeout(() => {
          if (countdownEl.parentNode) {
            countdownEl.parentNode.removeChild(countdownEl);
          }
        }, 300);
      }
      clearInterval(countdownInterval);
    }, delay);
  }

  // Store notification state before refresh
  private storeNotificationState() {
    try {
      const state = {
        lastCheck: this.lastNotificationCheck,
        queueLength: this.notificationQueue.length,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem('notification_refresh_state', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to store notification state:', error);
    }
  }

  // Restore notification state after refresh
  restoreNotificationState() {
    try {
      const stateStr = sessionStorage.getItem('notification_refresh_state');
      if (stateStr) {
        const state = JSON.parse(stateStr);
        this.lastNotificationCheck = state.lastCheck || Date.now();
        
        // Clear the stored state
        sessionStorage.removeItem('notification_refresh_state');
        
        console.log('Restored notification state after refresh:', state);
      }
    } catch (error) {
      console.error('Failed to restore notification state:', error);
    }
  }

  // Check localStorage for flags set by service workers or other tabs
  private checkLocalStorageFlags() {
    try {
      const refreshFlag = localStorage.getItem('mcm_refresh_required');
      if (refreshFlag) {
        const flagData = JSON.parse(refreshFlag);
        console.log('Found refresh flag in localStorage:', flagData);
        
        // Clear the flag
        localStorage.removeItem('mcm_refresh_required');
        
        // Schedule refresh
        this.scheduleRefresh(1000, flagData.reason || 'Alert received from background');
      }
    } catch (error) {
      console.error('Error checking localStorage flags:', error);
    }
  }

  // Setup visibility change listener
  private setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('Tab became visible, checking for missed notifications...');
        
        // Check immediately when tab becomes visible
        if (this.isPolling) {
          this.checkForNewNotifications();
        }
        
        // Check for localStorage flags
        this.checkLocalStorageFlags();
      }
    });
  }

  // Setup beforeunload listener to clean up
  private setupBeforeUnloadListener() {
    window.addEventListener('beforeunload', () => {
      this.stopPolling();
    });
  }

  // Force refresh with reason
  forceRefresh(reason: string, delay: number = 1000) {
    console.log(`Force refresh requested: ${reason}`);
    this.scheduleRefresh(delay, reason);
  }

  // Manual trigger for testing
  async triggerTestNotification() {
    const testNotification: NotificationTrigger = {
      id: `test-${Date.now()}`,
      type: 'alert',
      priority: 'medium',
      title: 'Test Alert',
      message: 'This is a test notification that will trigger a page refresh',
      timestamp: new Date().toISOString(),
      shouldRefresh: true,
      refreshDelay: 3000
    };

    await this.processNotification(testNotification);
  }

  // Get service status
  getStatus() {
    return {
      isPolling: this.isPolling,
      queueLength: this.notificationQueue.length,
      lastCheck: new Date(this.lastNotificationCheck).toLocaleTimeString(),
      hasRefreshPending: this.refreshTimeout !== null
    };
  }
}

// Create singleton instance
export const autoRefreshNotificationService = new AutoRefreshNotificationService();
