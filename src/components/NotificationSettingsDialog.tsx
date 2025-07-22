import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, Bell, Volume2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';

const NotificationSettingsDialog: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Check notification permission on mount and dialog open
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, [isDialogOpen]);

  // Handle notification toggle
  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      try {
        const permission = await Notification.requestPermission();
        setPermission(permission);
        setNotificationsEnabled(permission === 'granted');
        
        if (permission === 'granted') {
          toast.success('✅ Browser notifications enabled!');
          
          // Send test notification
          new Notification('MCM Alerts', {
            body: 'Notifications are now enabled! 🔔',
            icon: '/mcm-logo-192.png',
            tag: 'welcome'
          });
        } else {
          toast.error('❌ Notification permission denied');
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        toast.error('Failed to enable notifications');
      }
    } else {
      setNotificationsEnabled(false);
      toast.success('Notifications disabled');
    }
  };

  // Test notification
  const sendTestNotification = () => {
    if (Notification.permission === 'granted') {
      new Notification('Test Notification', {
        body: 'This is a test notification from MCM Alerts! 🚀',
        icon: '/mcm-logo-192.png',
        tag: 'test'
      });
      
      if (soundEnabled) {
        // Simple beep sound
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
      }
      
      toast.success('✅ Test notification sent!');
    } else {
      toast.error('Please enable notifications first');
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
        <Button variant="ghost" size="icon" className="h-9 w-9">
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
          {/* Notification Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Browser Notifications</p>
              <p className="text-sm text-gray-600">Status: {getStatusBadge()}</p>
            </div>
          </div>

          {/* Enable/Disable Notifications */}
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
            />
          </div>

          {/* Sound Settings */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="h-5 w-5 text-green-600" />
              <div>
                <Label htmlFor="sound" className="font-medium">
                  Notification Sounds
                </Label>
                <p className="text-sm text-gray-600">
                  Play sound with notifications
                </p>
              </div>
            </div>
            <Switch
              id="sound"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
          </div>

          {/* Test Button */}
          {notificationsEnabled && (
            <div className="pt-4 border-t">
              <Button 
                onClick={sendTestNotification}
                className="w-full"
                variant="outline"
              >
                🔔 Send Test Notification
              </Button>
            </div>
          )}

          {/* Help Text */}
          {permission === 'denied' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Notifications Blocked:</strong> Click the lock icon in your browser's address bar and allow notifications, then refresh the page.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;