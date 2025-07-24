import React, { useEffect, useState, createContext, useContext } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, Bell, Volume2, X, AlertCircle, CheckCircle, Info, Smartphone } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { pushService } from '@/services/pushNotificationService';

// In-app notification types
type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  persistent?: boolean;
  autoClose?: number;
}

// Context for managing in-app notifications
const NotificationContext = createContext<{
  notifications: InAppNotification[];
  addNotification: (notification: Omit<InAppNotification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  inAppEnabled: boolean;
  setInAppEnabled: (enabled: boolean) => void;
}>({
  notifications: [],
  addNotification: () => {},
  removeNotification: () => {},
  clearAll: () => {},
  inAppEnabled: true,
  setInAppEnabled: () => {}
});

// In-app notification provider
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [inAppEnabled, setInAppEnabled] = useState(() => {
    const saved = localStorage.getItem('mcm-inapp-notifications');
    return saved ? JSON.parse(saved) : true;
  });

  // Save in-app preference
  useEffect(() => {
    localStorage.setItem('mcm-inapp-notifications', JSON.stringify(inAppEnabled));
  }, [inAppEnabled]);

  const addNotification = (notification: Omit<InAppNotification, 'id' | 'timestamp'>) => {
    if (!inAppEnabled) return;

    const newNotification: InAppNotification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 4)]); // Keep max 5 notifications

    // Auto-remove if specified
    if (notification.autoClose && !notification.persistent) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, notification.autoClose);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll,
      inAppEnabled,
      setInAppEnabled
    }}>
      {children}
      <InAppNotificationContainer />
    </NotificationContext.Provider>
  );
};

// Hook to use notifications
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

// Individual notification component
const NotificationItem: React.FC<{ notification: InAppNotification }> = ({ notification }) => {
  const { removeNotification } = useNotifications();

  const getIcon = () => {
    switch (notification.type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default: return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (notification.type) {
      case 'success': return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'error': return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      default: return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getBgColor()} shadow-lg backdrop-blur-sm animate-in slide-in-from-right-full duration-300`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-tight">
              {notification.title}
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-words">
              {notification.message}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {notification.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeNotification(notification.id)}
          className="h-6 w-6 p-0 shrink-0 ml-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Container for all in-app notifications
const InAppNotificationContainer: React.FC = () => {
  const { notifications, clearAll } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm w-full max-h-screen overflow-y-auto">
      {notifications.length > 3 && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={clearAll}>
            Clear All ({notifications.length})
          </Button>
        </div>
      )}
      {notifications.slice(0, 5).map(notification => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
};

// Enhanced notification service
export class NotificationService {
  private static addInAppNotification: ((notification: Omit<InAppNotification, 'id' | 'timestamp'>) => void) | null = null;

  static setInAppNotifier(fn: (notification: Omit<InAppNotification, 'id' | 'timestamp'>) => void) {
    this.addInAppNotification = fn;
  }

  // Send both browser and in-app notifications
  static async sendDualNotification(options: {
    title: string;
    message: string;
    type?: NotificationType;
    priority?: 'low' | 'medium' | 'high';
    inAppOptions?: {
      persistent?: boolean;
      autoClose?: number;
    };
  }) {
    const { title, message, type = 'info', priority = 'medium', inAppOptions = {} } = options;

    // Always show in-app notification first
    if (this.addInAppNotification) {
      this.addInAppNotification({
        title,
        message,
        type,
        ...inAppOptions
      });
    }

    // Try browser notification
    try {
      await pushService.sendNotification(title, message, priority);
    } catch (error) {
      console.warn('Browser notification failed, but in-app notification was shown:', error);
    }
  }
}

// Main notification settings dialog
const NotificationSettingsDialog: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('mcm-sound-enabled');
    return saved ? JSON.parse(saved) : true;
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { addNotification, inAppEnabled, setInAppEnabled } = useNotifications();

  // Save sound preference
  useEffect(() => {
    localStorage.setItem('mcm-sound-enabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  // Set up notification service
  useEffect(() => {
    NotificationService.setInAppNotifier(addNotification);
  }, [addNotification]);

  // Check initial states
  useEffect(() => {
    const checkNotificationState = async () => {
      if ('Notification' in window) {
        const currentPermission = Notification.permission;
        setPermission(currentPermission);
        setNotificationsEnabled(currentPermission === 'granted');

        // Check push subscription status
        try {
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setPushSubscribed(!!subscription);
          }
        } catch (error) {
          console.error('Error checking push subscription:', error);
        }
      }
    };

    if (isDialogOpen) {
      checkNotificationState();
    }
  }, [isDialogOpen]);

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      setPushSubscribed(false);
      await pushService.unsubscribe();
      toast.success('Notifications have been disabled');
      return;
    }

    setIsLoading(true);
    
    try {
      // Request basic notification permission
      const hasPermission = await pushService.requestPermission();
      
      if (hasPermission) {
        setPermission('granted');
        setNotificationsEnabled(true);

        // Try to set up push subscription
        try {
          const subscription = await pushService.subscribe();
          setPushSubscribed(!!subscription);
          
          if (subscription) {
            toast.success('✅ Push notifications enabled successfully!');
          } else {
            toast.success('✅ Basic notifications enabled successfully!');
          }

          // Send welcome notification
          NotificationService.sendDualNotification({
            title: 'MCM Alerts',
            message: 'Great! You will now receive notifications from MCM Alerts 🔔',
            type: 'success',
            priority: 'medium',
            inAppOptions: {
              autoClose: 5000
            }
          });
          
        } catch (pushError) {
          console.error('Push subscription failed:', pushError);
          toast.success('✅ Basic notifications enabled (push notifications unavailable)');
          
          NotificationService.sendDualNotification({
            title: 'MCM Alerts',
            message: 'Basic notifications enabled. For background notifications, please ensure your browser supports push notifications.',
            type: 'info',
            priority: 'medium',
            inAppOptions: {
              autoClose: 7000
            }
          });
        }
      } else {
        toast.error('❌ Please click "Allow" in the browser dialog to enable notifications');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to request notification permission. Please try again.');
      setNotificationsEnabled(false);
      setPushSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setIsLoading(true);
    
    try {
      // Always show in-app test notification
      addNotification({
        title: '🔔 Test Notification',
        message: 'This is a test notification from MCM Alerts! Everything is working perfectly. 🚀',
        type: 'success',
        autoClose: 5000
      });

      // Try browser/push notification
      if (Notification.permission === 'granted') {
        try {
          await pushService.sendTestNotification('medium');
        } catch (error) {
          console.error('Failed to send test notification:', error);
        }
      }

      toast.success('✅ Test notification sent successfully!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge variant="outline">⏳ Loading...</Badge>;
    }
    
    switch (permission) {
      case 'granted':
        return pushSubscribed ? 
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">✅ Push Enabled</Badge> :
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">✅ Basic Enabled</Badge>;
      case 'denied':
        return <Badge variant="destructive">❌ Blocked</Badge>;
      default:
        return <Badge variant="outline">⏳ Not Set</Badge>;
    }
  };

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open Notification Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Overview */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <p className="font-medium">Notification Status</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getStatusBadge()}
              </p>
              {isMobile && (
                <div className="flex items-center gap-1 mt-1">
                  <Smartphone className="h-3 w-3 text-blue-600" />
                  <span className="text-xs text-blue-600">Mobile Device</span>
                </div>
              )}
            </div>
          </div>

          {/* Browser Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="h-5 w-5 text-blue-600" />
              <div>
                <Label htmlFor="notifications" className="font-medium">
                  Browser Notifications
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isMobile ? 'Get background push notifications' : 'Get desktop notifications'}
                </p>
              </div>
            </div>
            <Switch
              id="notifications"
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationToggle}
              disabled={isLoading}
              aria-checked={notificationsEnabled}
              role="switch"
            />
          </div>

          {/* In-App Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="h-5 w-5 text-purple-600" />
              <div>
                <Label htmlFor="inapp" className="font-medium">
                  In-App Notifications
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Show notifications while using the app
                </p>
              </div>
            </div>
            <Switch
              id="inapp"
              checked={inAppEnabled}
              onCheckedChange={setInAppEnabled}
              aria-checked={inAppEnabled}
              role="switch"
            />
          </div>

          {/* Sound Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="h-5 w-5 text-green-600" />
              <div>
                <Label htmlFor="sound" className="font-medium">
                  Notification Sounds
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Play sound with notifications
                </p>
              </div>
            </div>
            <Switch
              id="sound"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
              aria-checked={soundEnabled}
              role="switch"
            />
          </div>

          {/* Test Button */}
          <div className="pt-4 border-t dark:border-gray-700">
            <Button
              onClick={sendTestNotification}
              className="w-full"
              variant="outline"
              disabled={isLoading}
              aria-label="Send Test Notification"
            >
              {isLoading ? (
                <>⏳ Sending...</>
              ) : (
                <>🔔 Send Test Notification</>
              )}
            </Button>
          </div>

          {/* Help Messages */}
          {permission === 'denied' && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Notifications Blocked:</strong> {isMobile ? 
                  'Go to your browser settings and allow notifications for this site, then refresh the page.' :
                  'Click the lock icon in your browser\'s address bar and allow notifications, then refresh the page.'
                }
              </p>
            </div>
          )}

          {isMobile && isStandalone && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>PWA Mode:</strong> Background notifications work best in PWA mode. Make sure to allow notifications when prompted.
              </p>
            </div>
          )}

          {notificationsEnabled && !pushSubscribed && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Limited Mode:</strong> Basic notifications are enabled. Push notifications are not available in your current environment.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Demo component for testing
const NotificationDemo: React.FC = () => {
  const { addNotification } = useNotifications();

  const sendDemoNotifications = () => {
    // Show different types of notifications with delay
    setTimeout(() => {
      NotificationService.sendDualNotification({
        title: 'Price Alert',
        message: 'Your watched item dropped 15% in price!',
        type: 'success',
        priority: 'high',
        inAppOptions: { autoClose: 6000 }
      });
    }, 500);

    setTimeout(() => {
      addNotification({
        title: 'System Update',
        message: 'New features available in your dashboard.',
        type: 'info',
        autoClose: 5000
      });
    }, 1500);

    setTimeout(() => {
      addNotification({
        title: 'Connection Warning',
        message: 'Slow network detected. Some features may be limited.',
        type: 'warning',
        autoClose: 7000
      });
    }, 2500);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">MCM Alerts Dashboard</h1>
        <NotificationSettingsDialog />
      </div>
      
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400">
          Configure your notification preferences and test the notification system.
        </p>
        
        <Button onClick={sendDemoNotifications} className="w-full">
          Send Demo Notifications
        </Button>
      </div>
    </div>
  );
};

export { NotificationSettingsDialog };
