// Create this new file: src/services/realTimeNotificationService.ts

export interface RealTimeNotification {
  id: string;
  type: 'alert' | 'system' | 'price_change' | 'test';
  priority: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  timestamp: string;
  data?: any;
}

export class RealTimeNotificationService {
  private eventSource: EventSource | null = null;
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private listeners: ((notification: RealTimeNotification) => void)[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupServiceWorkerListener();
  }

  // Add event listener for notifications
  addListener(callback: (notification: RealTimeNotification) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // Notify all listeners
  private notifyListeners(notification: RealTimeNotification) {
    this.listeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  // Setup service worker message listener for push notifications
  private setupServiceWorkerListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
          const notificationData = event.data.notificationData;
          const realTimeNotification: RealTimeNotification = {
            id: `push-${Date.now()}`,
            type: notificationData.type || 'alert',
            priority: notificationData.priority || 'medium',
            title: notificationData.title || 'MCM Alert',
            message: notificationData.body || notificationData.message || 'New notification',
            timestamp: new Date().toISOString(),
            data: notificationData.data
          };
          
          console.log('Received push notification via service worker:', realTimeNotification);
          this.notifyListeners(realTimeNotification);
        }
      });
    }
  }

  // Connect using Server-Sent Events (fallback for WebSocket)
  private connectSSE() {
    try {
      console.log('Attempting to connect via Server-Sent Events...');
      this.eventSource = new EventSource('/api/notifications/stream');

      this.eventSource.onopen = () => {
        console.log('SSE connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const notification: RealTimeNotification = JSON.parse(event.data);
          console.log('Received SSE notification:', notification);
          this.notifyListeners(notification);
        } catch (error) {
          console.error('Error parsing SSE notification:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.isConnected = false;
        this.reconnectSSE();
      };

    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      this.reconnectSSE();
    }
  }

  // Connect using WebSocket (preferred)
  private connectWebSocket() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/notifications/ws`;
      
      console.log('Attempting to connect via WebSocket:', wsUrl);
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('WebSocket connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      };

      this.websocket.onmessage = (event) => {
        try {
          const notification: RealTimeNotification = JSON.parse(event.data);
          console.log('Received WebSocket notification:', notification);
          this.notifyListeners(notification);
        } catch (error) {
          console.error('Error parsing WebSocket notification:', error);
        }
      };

      this.websocket.onclose = () => {
        console.log('WebSocket connection closed');
        this.isConnected = false;
        this.stopHeartbeat();
        this.reconnectWebSocket();
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        this.isConnected = false;
      };

    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      this.fallbackToSSE();
    }
  }

  // Start heartbeat to keep WebSocket alive
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Every 30 seconds
  }

  // Stop heartbeat
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Reconnect WebSocket with exponential backoff
  private reconnectWebSocket() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max WebSocket reconnection attempts reached, falling back to SSE');
      this.fallbackToSSE();
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`Reconnecting WebSocket in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connectWebSocket();
    }, delay);
  }

  // Reconnect SSE with exponential backoff
  private reconnectSSE() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max SSE reconnection attempts reached, will try polling');
      this.startPolling();
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`Reconnecting SSE in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connectSSE();
    }, delay);
  }

  // Fallback to SSE if WebSocket fails
  private fallbackToSSE() {
    console.log('Falling back to Server-Sent Events');
    this.connectSSE();
  }

  // Start polling as last resort
  private startPolling() {
    console.log('Starting notification polling as fallback');
    let lastTimestamp = Date.now();

    const poll = async () => {
      try {
        const response = await fetch(`/api/notifications/poll?since=${lastTimestamp}`);
        if (response.ok) {
          const notifications: RealTimeNotification[] = await response.json();
          notifications.forEach(notification => {
            this.notifyListeners(notification);
            lastTimestamp = Math.max(lastTimestamp, new Date(notification.timestamp).getTime());
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }

      // Poll every 10 seconds
      setTimeout(poll, 10000);
    };

    poll();
  }

  // Initialize the real-time connection
  async initialize() {
    console.log('Initializing real-time notification service...');
    
    // Try WebSocket first, then fallback to SSE
    this.connectWebSocket();

    // Also listen for visibility changes to reconnect when tab becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !this.isConnected) {
        console.log('Tab became visible, attempting to reconnect...');
        this.reconnectAttempts = 0;
        this.connectWebSocket();
      }
    });
  }

  // Send a test notification request to backend
  async sendTestNotification(priority: 'low' | 'medium' | 'high' = 'medium') {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'test',
          priority,
          title: `Test Notification - ${priority.toUpperCase()}`,
          message: `This is a real-time test notification with ${priority} priority sent at ${new Date().toLocaleTimeString()}`,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Test notification sent:', result);
      return result;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }

  // Clean up connections
  disconnect() {
    console.log('Disconnecting real-time notification service...');
    
    this.isConnected = false;
    this.stopHeartbeat();

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.listeners = [];
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      connectionType: this.websocket ? 'websocket' : this.eventSource ? 'sse' : 'polling',
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create singleton instance
export const realTimeNotificationService = new RealTimeNotificationService();
