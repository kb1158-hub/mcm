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
import { Settings, Bell, Volume2, X, AlertCircle, CheckCircle, Info, Smartphone, Monitor } from 'lucide-react';
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
  const [inAppEnabled, setInAppEnabled] = useState(true);

  const addNotification = (notification: Omit<InAppNotification, 'id' | 'timestamp'>) => {
    if (!inAppEnabled) return;

    const newNotification: InAppNotification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 4)]); // Keep max 5

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

  // Listen for API notifications
  useEffect(() => {
    const handleApiNotification = (event: CustomEvent) => {
      const data = event.detail;
      addNotification({
        title: data.title,
        message: data.body,
        type: data.priority === 'high' ? 'error' : data.priority === 'low' ? 'info' : 'success',
        autoClose: 5000
      });
    };

    window.addEventListener('api-notification-received', handleApiNotification as EventListener);
    
    return () => {
      window.removeEventListener('api-notification-received', handleApiNotification as EventListener);
    };
  }, []);

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
    <div className={`p-4 rounded-lg border ${getBgColor()} shadow-sm animate-in slide-in-from-right-full`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {getIcon()}
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{notification.title}</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{notification.message}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
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

// Enhanced notification settings dialog
const NotificationSettingsDialog: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('desktop');
  const [isStandalone, setIsStandalone] = useState(false);
  
  const { addNotification, inAppEnabled, setInAppEnabled } = useNotifications();

  useEffect(() => {
    // Detect device type and standalone mode
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    
    setDeviceType(isMobile ? 'mobile' : 'desktop');
    setIsStandalone(standalone);
    
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
          
          // Send test notification to verify it works
          addNotification({
            title: 'MCM Alerts',
            message: 'Great! You will now receive notifications from MCM Alerts 🔔',
            type: 'success',
            autoClose: 5000
          });

          // Also try browser notification
          try {
            await pushService.showApiNotification(
              'MCM Alerts',
              'Notifications are now enabled and working!',
              'medium'
            );
          } catch (error) {
            console.warn('Browser notification test failed:', error);
          }
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
      message: `This is a test notification from MCM Alerts! Everything is working perfectly on your ${deviceType} device. 🚀`,
      type: 'success',
      autoClose: 6000
    });

    // Try different notification methods based on device and permission
    if (Notification.permission === 'granted') {
      try {
        await pushService.sendTestNotification('medium');
        toast.success('✅ Test notification sent successfully!');
      } catch (error) {
        console.error('Test notification failed:', error);
        toast.warning('⚠️ In-app notification shown, but browser notification may not work on this device');
      }
    } else {
      // Show instructions for enabling notifications
      addNotification({
        title: 'Enable Browser Notifications',
        message: 'Click the toggle above to enable browser notifications for the best experience!',
        type: 'info',
        autoClose: 7000
      });
      
      toast.info('💡 Enable browser notifications for the complete experience!');
    }
  };

  const getStatusBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">✅ Enabled</Badge>;
      case 'denied':
        return <Badge variant="destructive">❌ Blocked</Badge>;
      default:
        return <Badge variant="outline">⏳ Not Set</Badge>;
    }
  };

  const getDeviceSpecificHelp = () => {
    if (deviceType === 'mobile') {
      return (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Smartphone className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300">Mobile Device Detected</p>
              <p className="text-blue-700 dark:text-blue-400 mt-1">
                {isStandalone 
                  ? "Great! You're using the installed app. Notifications will work in the background."
                  : "For best results, install this app to your home screen for background notifications."
                }
              </p>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Monitor className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-green-800 dark:text-green-300">Desktop Browser</p>
              <p className="text-green-700 dark:text-green-400 mt-1">
                Perfect! Desktop browsers fully support all notification features including sound and background alerts.
              </p>
            </div>
          </div>
        </div>
      );
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
          {/* Device-specific help */}
          {getDeviceSpecificHelp()}

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="font-medium">Browser Notifications</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
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
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get notified about important alerts {deviceType === 'mobile' ? 'even when app is closed' : 'in your browser'}
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

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="h-5 w-5 text-green-600" />
              <div>
                <Label htmlFor="sound" className="font-medium">
                  Notification Sounds
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Play sound with notifications {deviceType === 'mobile' ? '(may require interaction first)' : ''}
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
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>Notifications Blocked:</strong> {deviceType === 'mobile' 
                  ? 'Go to your browser settings and allow notifications for this site, then refresh the page.'
                  : 'Click the lock icon in your browser\'s address bar and allow notifications, then refresh the page.'
                }
              </p>
            </div>
          )}

          {deviceType === 'mobile' && !isStandalone && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Tip:</strong> Add this app to your home screen for the best notification experience on mobile!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;
