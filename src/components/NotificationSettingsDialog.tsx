import React, { useEffect, useState } from 'react';
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
import { Settings, Bell, Volume2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';

// Helper function to send messages to the Service Worker
// This will resolve or reject based on the Service Worker's reply
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

      // Send the message to the active Service Worker
      navigator.serviceWorker.controller.postMessage(
        notificationData,
        [messageChannel.port2] // Transfer port2 for the SW to reply
      );
    });
  } else {
    // Fallback for browsers without Service Worker or if it's not active
    // You might want to display a different message or simply log a warning
    console.warn("Service Worker not active or supported. Cannot send notification via SW.");
    toast.info("Notifications might not work in the background. Please ensure Service Worker is active.");
    
    // For the immediate user experience, if SW is not available,
    // you could still try to show a non-persistent notification on desktop
    // but on mobile PWA, this is exactly what causes the error.
    // For robust PWA, the expectation is SW is always there for notifications.
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

const NotificationSettingsDialog: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Update permission and toggle status on dialog open or mount
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
          // REFRACTORED: Send welcome notification via Service Worker
          sendNotificationToServiceWorker({
            type: 'SHOW_NOTIFICATION', // Matches the type in your sw.js message listener
            title: 'MCM Alerts',
            body: 'Great! You will now receive notifications from MCM Alerts 🔔',
            icon: '/mcm-logo-192.png',
            tag: 'welcome',
            requireInteraction: false,
            data: { url: '/' } // Optional data for the notification click
          }).catch(error => {
            console.error('Failed to show welcome notification via SW:', error);
            toast.error('Failed to show welcome notification. Check Service Worker.');
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

  const sendTestNotification = async () => { // Made async
    if (Notification.permission !== 'granted') {
      toast.error('❌ Please enable notifications first by toggling the switch above');
      return;
    }

    try {
      // REFRACTORED: Send test notification via Service Worker
      await sendNotificationToServiceWorker({
        type: 'SHOW_NOTIFICATION', // Matches the type in your sw.js message listener
        title: '🔔 Test Notification',
        body: 'This is a test notification from MCM Alerts! Everything is working perfectly. 🚀',
        icon: '/mcm-logo-192.png',
        tag: 'test',
        requireInteraction: false,
        data: { url: '/dashboard', priority: 'medium' } // Example: add data
      });

      // Original sound playback logic (this can stay in main thread)
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
    } catch (error) {
      console.error('Failed to send test notification via Service Worker:', error);
      toast.error('Failed to send test notification. Check Service Worker and permissions.');
    }
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

          {notificationsEnabled && (
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
          )}

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

export default NotificationSettingsDialog;
