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
import { Settings, Bell, Volume2, X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';

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
  const [inAppEnabled, setInAppEnabled] = useState(true);

  const addNotification = (notification: Omit<InAppNotification, 'id' | 'timestamp'>) => {
    if (!inAppEnabled) return;

    const newNotification: InAppNotification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    };

    setNotifications(prev => [newNotification, ...prev]);

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
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getBgColor()} shadow-sm animate-in slide-in-from-right-full`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {getIcon()}
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">{notification.title}</h4>
            <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
            <p className="text-xs text-gray-500 mt-2">
              {notification.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeNotification(notification.id)}
          className="h-6 w-6 p-0"
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
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
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

// Helper function to send messages to the Service Worker (your existing function)
const sendNotificationToServiceWorker = async (notificationData: {
  type: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  actions?: { action: string; title: string; icon?: string }[];
  data?: any;
}) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(event.data);
        } else {
          reject(new Error(event.data.error || 'Failed to show notification via SW.'));
        }
      };

      navigator.serviceWorker.controller.postMessage(
        notificationData,
        [messageChannel.port2]
      );
    });
  } else {
    console.warn("Service Worker not active or supported. Cannot send notification via SW.");
    toast.info("Notifications might not work in the background. Please ensure Service Worker is active.");
    
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            tag: notificationData.tag,
            requireInteraction: notificationData.requireInteraction,
            silent: notificationData.silent,
            vibrate: notificationData.vibrate,
            actions: notificationData.actions,
            data: notificationData.data
        });
        resolve({ success: true, message: "Displayed non-persistent notification." });
    } else {
        reject(new Error("Notification API not available or permission not granted."));
    }
  }
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
    browserOptions?: {
      icon?: string;
      tag?: string;
      requireInteraction?: boolean;
      silent?: boolean;
      data?: any;
    };
    inAppOptions?: {
      persistent?: boolean;
      autoClose?: number;
    };
  }) {
    const { title, message, type = 'info', browserOptions = {}, inAppOptions = {} } = options;

    // Always show in-app notification first
    if (this.addInAppNotification) {
      this.addInAppNotification({
        title,
        message,
        type,
        ...inAppOptions
      });
    }

    // Try browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        await sendNotificationToServiceWorker({
          type: 'SHOW_NOTIFICATION',
          title,
          body: message,
          icon: '/mcm-logo-192.png',
          ...browserOptions
        });
      } catch (error) {
        console.warn('Browser notification failed, but in-app notification was shown:', error);
      }
    }
  }
}

// Your enhanced notification settings dialog
const NotificationSettingsDialog: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { addNotification, inAppEnabled, setInAppEnabled } = useNotifications();

  // Set up notification service
  useEffect(() => {
    NotificationService.setInAppNotifier(addNotification);
  }, [addNotification]);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, [isDialogOpen]);

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      try {
        const permission = await Notification.requestPermission();
        setPermission(permission);
        setNotificationsEnabled(permission === 'granted');

        if (permission === 'granted') {
          toast.success('✅ Notifications enabled successfully!');
          
          // Send dual notification (both browser and in-app)
          NotificationService.sendDualNotification({
            title: 'MCM Alerts',
            message: 'Great! You will now receive notifications from MCM Alerts 🔔',
            type: 'success',
            browserOptions: {
              tag: 'welcome',
              data: { url: '/' }
            },
            inAppOptions: {
              autoClose: 5000
            }
          });
        } else {
          toast.error('❌ Please click "Allow" in the browser dialog to enable notifications');
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        toast.error('Failed to request notification permission. Please try again.');
      }
    } else {
      setNotificationsEnabled(false);
      toast.success('Notifications have been disabled');
    }
  };

  const sendTestNotification = async () => {
    // Always show in-app test notification
    addNotification({
      title: '🔔 Test Notification',
      message: 'This is a test notification from MCM Alerts! Everything is working perfectly. 🚀',
      type: 'success',
      autoClose: 5000
    });

    // Also try browser notification if enabled
    if (Notification.permission === 'granted') {
      try {
        await sendNotificationToServiceWorker({
          type: 'SHOW_NOTIFICATION',
          title: '🔔 Test Notification',
          body: 'This is a test notification from MCM Alerts! Everything is working perfectly. 🚀',
          icon: '/mcm-logo-192.png',
          tag: 'test',
          requireInteraction: false,
          data: { url: '/dashboard', priority: 'medium' }
        });
      } catch (error) {
        console.error('Failed to send browser notification:', error);
      }
    }

    // Sound playback
    if (soundEnabled) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch {
        // Fail silently if AudioContext is unavailable
      }
    }

    toast.success('✅ Test notification sent successfully!');
  };

  const getStatusBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge className="bg-green-100 text-green-800">✅ Enabled</Badge>;
      case 'denied':
        return <Badge variant="destructive">❌ Blocked</Badge>;
      default:
        return <Badge variant="outline">⏳ Not Set</Badge>;
    }
  };

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
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Browser Notifications</p>
              <p className="text-sm text-gray-600">
                Status: {getStatusBadge()}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="h-5 w-5 text-blue-600" />
              <div>
                <Label htmlFor="notifications" className="font-medium">
                  Browser Notifications
                </Label>
                <p className="text-sm text-gray-600">
                  Get notified about important alerts
                </p>
              </div>
            </div>
            <Switch
              id="notifications"
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationToggle}
              aria-checked={notificationsEnabled}
              role="switch"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="h-5 w-5 text-purple-600" />
              <div>
                <Label htmlFor="inapp" className="font-medium">
                  In-App Notifications
                </Label>
                <p className="text-sm text-gray-600">Show notifications while using the app</p>
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

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="h-5 w-5 text-green-600" />
              <div>
                <Label htmlFor="sound" className="font-medium">
                  Notification Sounds
                </Label>
                <p className="text-sm text-gray-600">Play sound with notifications</p>
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

          <div className="pt-4 border-t">
            <Button
              onClick={sendTestNotification}
              className="w-full"
              variant="outline"
              aria-label="Send Test Notification"
            >
              🔔 Send Test Notification
            </Button>
          </div>

          {permission === 'denied' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <p className="text-sm text-red-800">
                <strong>Notifications Blocked:</strong> Click the lock icon in your browser's
                address bar and allow notifications, then refresh the page.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Demo showing the complete system
const App: React.FC = () => {
  const { addNotification } = useNotifications();

  const sendDemoNotifications = () => {
    // Show different types of notifications
    setTimeout(() => {
      NotificationService.sendDualNotification({
        title: 'Price Alert',
        message: 'Your watched item dropped 15% in price!',
        type: 'success',
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
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" />
          MCM Alerts Notification System
        </h2>
        <NotificationSettingsDialog />
      </div>
      
      <div className="space-y-4">
        <p className="text-gray-600">
          This system provides both browser notifications (for background alerts) 
          and in-app notifications (for immediate feedback while using the app).
        </p>
        
        <Button onClick={sendDemoNotifications} className="w-full">
          Send Demo Notifications
        </Button>
      </div>
    </div>
  );
};

// Main export with provider wrapper
const NotificationApp: React.FC = () => {
  return (
    <NotificationProvider>
      <App />
    </NotificationProvider>
  );
};

export default NotificationApp;
