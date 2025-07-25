// src/components/InAppNotificationSystem.tsx

import React, { useEffect, useState } from 'react';
import { X, Bell, Wifi, WifiOff, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { pushService } from '@/services/pushNotificationService';
import { realTimeNotificationService } from '@/services/realTimeNotificationService';

interface RealTimeNotification {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  timestamp: string;
  data?: any;
}

interface DisplayNotification extends RealTimeNotification {
  isVisible: boolean;
  dismissedAt?: number;
}

// Static user with id '1'
const user = { id: '1' };

const InAppNotificationSystem: React.FC = () => {
  const [notifications, setNotifications] = useState<DisplayNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('disconnected');
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  useEffect(() => {
    // Initialize audio context
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(ctx);
    } catch (error) {
      console.warn('Audio context not supported:', error);
    }

    const initializeServices = async () => {
      try {
        // Initialize push notification service
        await pushService.initialize();
        console.log('Push service initialized');

        // Initialize real-time notification service with static user id
        if (user?.id) {
          await realTimeNotificationService.initialize(user.id);
          console.log('Real-time notification service initialized');
        } else {
          console.warn('User not logged in, skipping real-time notifications initialization');
        }

        // Set up real-time notification listener
        const unsubscribe = realTimeNotificationService.addListener((notification) => {
          console.log('Received real-time notification:', notification);

          const displayNotification: DisplayNotification = {
            ...notification,
            isVisible: true,
          };

          setNotifications(prev => [displayNotification, ...prev.slice(0, 4)]); // Keep max 5

          playNotificationSound(notification.priority);

          const toastMessage = `${notification.title}: ${notification.message}`;
          switch (notification.priority) {
            case 'high':
              toast.error(toastMessage, { duration: 8000 });
              break;
            case 'medium':
              toast.success(toastMessage, { duration: 5000 });
              break;
            case 'low':
              toast.info(toastMessage, { duration: 3000 });
              break;
          }
        });

        // Monitor connection status
        const statusInterval = setInterval(() => {
          const status = realTimeNotificationService.getConnectionStatus();
          setIsConnected(status.isConnected);
          setConnectionType(status.connectionType);
        }, 2000);

        return () => {
          unsubscribe();
          clearInterval(statusInterval);
        };
      } catch (error) {
        console.error('Failed to initialize notification services:', error);
        toast.error('Failed to initialize notifications. Some features may not work.');
      }
    };

    initializeServices();

    // Listen for service worker messages (push notifications)
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
        const notificationData = event.data.notificationData;
        const realTimeNotification: RealTimeNotification = {
          id: `sw-${Date.now()}`,
          type: notificationData.type || 'alert',
          priority: notificationData.priority || 'medium',
          title: notificationData.title || 'MCM Alert',
          message: notificationData.body || notificationData.message || 'New notification',
          timestamp: new Date().toISOString(),
          data: notificationData.data
        };

        const displayNotification: DisplayNotification = {
          ...realTimeNotification,
          isVisible: true,
        };

        setNotifications(prev => [displayNotification, ...prev.slice(0, 4)]);
        playNotificationSound(realTimeNotification.priority);

        console.log('Received push notification from service worker:', realTimeNotification);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      realTimeNotificationService.disconnect();
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audioContext]);

  const playNotificationSound = async (priority: 'low' | 'medium' | 'high') => {
    if (!audioContext) return;

    try {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const frequency = priority === 'high' ? 800 : priority === 'medium' ? 600 : 400;
      const duration = priority === 'high' ? 1.0 : 0.5;

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';

      const volume = priority === 'high' ? 0.3 : priority === 'medium' ? 0.2 : 0.1;
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);

      if (priority === 'high') {
        setTimeout(() => {
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();

          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);

          oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime);
          oscillator2.type = 'sine';
          gainNode2.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

          oscillator2.start(audioContext.currentTime);
          oscillator2.stop(audioContext.currentTime + 0.3);
        }, 200);
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === id
          ? { ...n, isVisible: false, dismissedAt: Date.now() }
          : n
      )
    );

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 300);
  };

  const clearAllNotifications = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, isVisible: false, dismissedAt: Date.now() }))
    );

    setTimeout(() => {
      setNotifications([]);
    }, 300);
  };

  const getNotificationIcon = (type: string, priority: string) => {
    if (priority === 'high') {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }

    switch (type) {
      case 'test':
        return <Bell className="h-5 w-5 text-blue-500" />;
      case 'system':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'price_change':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 border-red-200 shadow-lg';
      case 'medium':
        return 'bg-blue-50 border-blue-200 shadow-md';
      case 'low':
        return 'bg-gray-50 border-gray-200 shadow-sm';
      default:
        return 'bg-white border-gray-200 shadow-sm';
    }
  };

  const visibleNotifications = notifications.filter(n => n.isVisible);

  return (
    <>
      {/* Connection Status Indicator */}
      <div className="fixed top-4 left-4 z-40">
        <Badge
          variant={isConnected ? 'default' : 'destructive'}
          className="flex items-center gap-1"
        >
          {isConnected ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {isConnected ? `Connected (${connectionType})` : 'Disconnected'}
        </Badge>
      </div>

      {/* Notification Container */}
      {visibleNotifications.length > 0 && (
        <div className="fixed top-16 right-4 z-50 space-y-3 max-w-sm">
          {/* Clear All Button */}
          {visibleNotifications.length > 1 && (
            <div className="text-center">
              <Button
                onClick={clearAllNotifications}
                variant="outline"
                size="sm"
                className="bg-white/90 backdrop-blur-sm"
              >
                Clear All ({visibleNotifications.length})
              </Button>
            </div>
          )}

          {/* Notification Items */}
          {visibleNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`
                p-4 rounded-lg border transition-all duration-300 ease-in-out
                ${getPriorityStyles(notification.priority)}
                ${notification.isVisible
                  ? 'animate-in slide-in-from-right-full opacity-100 scale-100'
                  : 'animate-out slide-out-to-right-full opacity-0 scale-95'
                }
              `}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  {getNotificationIcon(notification.type, notification.priority)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 text-sm truncate">
                        {notification.title}
                      </h4>
                      <Badge
                        variant={notification.priority === 'high' ? 'destructive' : 'outline'}
                        className="text-xs flex-shrink-0"
                      >
                        {notification.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{notification.message}</p>
                    <time className="text-xs text-gray-500 mt-1 block">
                      {new Date(notification.timestamp).toLocaleTimeString()}
                    </time>
                  </div>
                </div>

                {/* Dismiss Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Dismiss notification"
                  onClick={() => dismissNotification(notification.id)}
                  className="ml-2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default InAppNotificationSystem;
