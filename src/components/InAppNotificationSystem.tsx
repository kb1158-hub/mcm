// src/components/InAppNotificationSystem.tsx

import React, { useEffect, useState } from 'react';
import { X, Bell, Wifi, WifiOff, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { unifiedNotificationService, UnifiedNotification } from '@/services/unifiedNotificationService';

interface DisplayNotification extends UnifiedNotification {
  isVisible: boolean;
  dismissedAt?: number;
}

const InAppNotificationSystem: React.FC = () => {
  const [notifications, setNotifications] = useState<DisplayNotification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState(unifiedNotificationService.getConnectionStatus());

  useEffect(() => {
    const initializeService = async () => {
      try {
        console.log('Initializing unified notification service...');
        await unifiedNotificationService.initialize();
        console.log('Unified notification service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize unified notification service:', error);
        toast.error('Failed to initialize notifications. Some features may not work.');
      }
    };

    // Initialize the service
    initializeService();

    // Set up in-app notification listener
    const unsubscribeInApp = unifiedNotificationService.addInAppListener((notification) => {
      console.log('Received in-app notification:', notification);

      const displayNotification: DisplayNotification = {
        ...notification,
        isVisible: true,
      };

      setNotifications(prev => [displayNotification, ...prev.slice(0, 4)]); // Keep max 5

      // Show toast notification based on priority
      const toastMessage = `${notification.title}: ${notification.message || notification.body || 'New notification'}`;
      switch (notification.priority) {
        case 'high':
        case 'urgent':
          toast.error(toastMessage, { duration: 8000 });
          break;
        case 'medium':
          toast.success(toastMessage, { duration: 5000 });
          break;
        case 'low':
          toast.info(toastMessage, { duration: 3000 });
          break;
        default:
          toast(toastMessage, { duration: 4000 });
      }
    });

    // Set up push notification listener (for notifications received while app is open)
    const unsubscribePush = unifiedNotificationService.addPushListener((notification) => {
      console.log('Received push notification while app is open:', notification);

      const displayNotification: DisplayNotification = {
        ...notification,
        isVisible: true,
      };

      setNotifications(prev => [displayNotification, ...prev.slice(0, 4)]);

      // Show toast for push notifications too
      const toastMessage = `${notification.title}: ${notification.message || notification.body || 'New notification'}`;
      toast.info(`📱 ${toastMessage}`, { duration: 5000 });
    });

    // Monitor connection status
    const statusInterval = setInterval(() => {
      const status = unifiedNotificationService.getConnectionStatus();
      setConnectionStatus(status);
    }, 2000);

    // Cleanup function
    return () => {
      unsubscribeInApp();
      unsubscribePush();
      clearInterval(statusInterval);
      unifiedNotificationService.disconnect();
    };
  }, []);

  const dismissNotification = async (notification: DisplayNotification) => {
    // Mark as read in the database
    try {
      await unifiedNotificationService.markAsRead(notification.id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }

    // Update local state
    setNotifications(prev =>
      prev.map(n =>
        n.id === notification.id
          ? { ...n, isVisible: false, dismissedAt: Date.now() }
          : n
      )
    );

    // Remove from local state after animation
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 300);
  };

  const clearAllNotifications = async () => {
    // Mark all visible notifications as read
    try {
      const visibleNotificationIds = notifications
        .filter(n => n.isVisible)
        .map(n => n.id);
      
      // Mark each as read (you might want to add a batch operation to your service)
      await Promise.all(
        visibleNotificationIds.map(id => unifiedNotificationService.markAsRead(id))
      );
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }

    // Update local state
    setNotifications(prev =>
      prev.map(n => ({ ...n, isVisible: false, dismissedAt: Date.now() }))
    );

    // Remove from local state after animation
    setTimeout(() => {
      setNotifications([]);
    }, 300);
  };

  const getNotificationIcon = (type: string, priority: string) => {
    if (priority === 'high' || priority === 'urgent') {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }

    switch (type) {
      case 'test':
        return <Bell className="h-5 w-5 text-blue-500" />;
      case 'system':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'price_change':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'push':
        return <Bell className="h-5 w-5 text-purple-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'high':
      case 'urgent':
        return 'bg-red-50 border-red-200 shadow-lg';
      case 'medium':
        return 'bg-blue-50 border-blue-200 shadow-md';
      case 'low':
        return 'bg-gray-50 border-gray-200 shadow-sm';
      default:
        return 'bg-white border-gray-200 shadow-sm';
    }
  };

  const getConnectionStatusText = () => {
    const { supabase, push } = connectionStatus;
    
    if (supabase.isConnected && push.serviceWorkerRegistered) {
      return 'Fully Connected';
    } else if (supabase.isConnected) {
      return 'In-App Connected';
    } else if (push.serviceWorkerRegistered) {
      return 'Push Only';
    } else {
      return 'Disconnected';
    }
  };

  const getConnectionIcon = () => {
    const { supabase } = connectionStatus;
    return supabase.isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />;
  };

  const getConnectionVariant = () => {
    const { supabase, push } = connectionStatus;
    
    if (supabase.isConnected && push.serviceWorkerRegistered) {
      return 'default'; // Green
    } else if (supabase.isConnected || push.serviceWorkerRegistered) {
      return 'secondary'; // Yellow/Orange
    } else {
      return 'destructive'; // Red
    }
  };

  const visibleNotifications = notifications.filter(n => n.isVisible);

  // Helper function to send test notifications
  const sendTestNotification = async (priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium') => {
    try {
      await unifiedNotificationService.sendTestNotification(priority, false);
      toast.success(`Test ${priority} priority notification sent!`);
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast.error('Failed to send test notification');
    }
  };

  return (
    <>
      {/* Connection Status Indicator */}
      <div className="fixed top-4 left-4 z-40 flex items-center gap-2">
        <Badge
          variant={getConnectionVariant()}
          className="flex items-center gap-1"
        >
          {getConnectionIcon()}
          {getConnectionStatusText()}
        </Badge>
        
        {/* Debug Test Buttons - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="flex gap-1">
            <Button
              onClick={() => sendTestNotification('low')}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              Test Low
            </Button>
            <Button
              onClick={() => sendTestNotification('medium')}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              Test Med
            </Button>
            <Button
              onClick={() => sendTestNotification('high')}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              Test High
            </Button>
          </div>
        )}
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
                        variant={
                          notification.priority === 'high' || notification.priority === 'urgent' 
                            ? 'destructive' 
                            : 'outline'
                        }
                        className="text-xs flex-shrink-0"
                      >
                        {notification.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {notification.message || notification.body || 'New notification'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <time className="text-xs text-gray-500">
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </time>
                      {notification.site && (
                        <Badge variant="outline" className="text-xs">
                          {notification.site}
                        </Badge>
                      )}
                    </div>
                    {notification.action_url && (
                      <Button
                        size="sm"
                        variant="link"
                        className="p-0 h-auto text-xs text-blue-600 mt-1"
                        onClick={() => {
                          window.open(notification.action_url, '_blank');
                          dismissNotification(notification);
                        }}
                      >
                        View Details →
                      </Button>
                    )}
                  </div>
                </div>

                {/* Dismiss Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Dismiss notification"
                  onClick={() => dismissNotification(notification)}
                  className="ml-2 text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
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
