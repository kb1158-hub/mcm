import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
import { pushService } from '@/services/pushNotificationService';
import { toast } from '@/components/ui/sonner'; // Or your chosen toast library

const NotificationSettingsDialog: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(Notification.permission);

  // Check push subscription on mount
  useEffect(() => {
    (async () => {
      await pushService.initialize();
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      }
      setPermission(Notification.permission);
    })();
  }, []);

  // Handle push notification enable/disable
  const handlePushChange = async (checked: boolean) => {
    setPushLoading(true);
    if (checked) {
      // Enable push notifications
      const granted = await pushService.requestPermission();
      setPermission(granted ? 'granted' : 'denied');
      if (granted) {
        const sub = await pushService.subscribe();
        setPushEnabled(!!sub);
        if (sub) toast.success('Browser push notifications enabled!');
      } else {
        toast.error('Notification permission denied.');
      }
    } else {
      // Disable push notifications
      const result = await pushService.unsubscribe();
      setPushEnabled(!result);
      if (result) toast.success('Browser push notifications unsubscribed.');
    }
    setPushLoading(false);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="sound" 
              checked={soundEnabled}
              onCheckedChange={(checked) => setSoundEnabled(checked === true)}
            />
            <Label htmlFor="sound">Play sound for notifications</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="push" 
              checked={pushEnabled}
              onCheckedChange={async (checked) => {
                if (!pushLoading) await handlePushChange(checked === true);
              }}
              disabled={permission === 'denied' || pushLoading}
            />
            <Label htmlFor="push">
              Browser push notifications
              {permission === 'denied' && <span className="text-red-500 ml-2">(Denied)</span>}
              {pushLoading && <span className="ml-2 text-gray-400">...</span>}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="email" 
              checked={emailEnabled}
              onCheckedChange={(checked) => setEmailEnabled(checked === true)}
            />
            <Label htmlFor="email">Email notifications</Label>
          </div>
        </div>
        <div className="pt-2 text-sm text-muted-foreground">
          <strong>Status:</strong> {permission === 'granted'
            ? (pushEnabled ? 'Push enabled' : 'Permission granted (not subscribed)')
            : (permission === 'denied' ? 'Push denied' : 'Permission not requested')}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;
