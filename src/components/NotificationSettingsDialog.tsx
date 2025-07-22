import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings, AlertCircle } from 'lucide-react';
import { pushService } from '@/services/pushNotificationService';
import { toast } from '@/components/ui/sonner'; // Or your chosen toast library
import { Alert, AlertDescription } from '@/components/ui/alert';

const NotificationSettingsDialog: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(Notification.permission);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Check push subscription on mount
  useEffect(() => {
    (async () => {
      await pushService.initialize();
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setPushEnabled(!!sub);
        } catch (error) {
          console.warn('Service worker not available:', error);
        }
      }
      setPermission(Notification.permission);
    })();
  }, []);

  // Update permission state when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      setPermission(Notification.permission);
    }
  }, [isDialogOpen]);

  // Handle push notification enable/disable
  const handlePushChange = async (checked: boolean) => {
    setPushLoading(true);
    
    if (checked) {
      try {
        // First request permission
        const granted = await pushService.requestPermission();
        setPermission(Notification.permission);
        
        if (granted) {
          // Then subscribe to push notifications
          const sub = await pushService.subscribe();
          setPushEnabled(!!sub);
          if (sub) {
            toast.success('Browser push notifications enabled successfully!');
          } else {
            toast.error('Failed to subscribe to push notifications');
          }
        } else {
          setPushEnabled(false);
          toast.error('Notification permission denied. Please enable notifications in your browser settings.');
        }
      } catch (error) {
        console.error('Error enabling push notifications:', error);
        setPushEnabled(false);
        toast.error('Failed to enable push notifications: ' + error.message);
      }
    } else {
      try {
        // Disable push notifications
        const result = await pushService.unsubscribe();
        setPushEnabled(!result);
        if (result) {
          toast.success('Browser push notifications disabled.');
        }
      } catch (error) {
        console.error('Error disabling push notifications:', error);
        toast.error('Failed to disable push notifications');
      }
    }
    setPushLoading(false);
  };

  // Handle manual permission request
  const handleRequestPermission = async () => {
    setPushLoading(true);
    try {
      const granted = await pushService.requestPermission();
      setPermission(Notification.permission);
      
      if (granted) {
        toast.success('Notification permission granted! You can now enable push notifications.');
      } else {
        toast.error('Notification permission denied. Please check your browser settings.');
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request notification permission');
    }
    setPushLoading(false);
  };

  const getPermissionStatusText = () => {
    switch (permission) {
      case 'granted':
        return pushEnabled ? 'Push notifications enabled' : 'Permission granted (click to enable)';
      case 'denied':
        return 'Permission denied - check browser settings';
      case 'default':
        return 'Permission not requested yet';
      default:
        return 'Unknown permission status';
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
          
          {permission === 'denied' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Browser notifications are blocked. To enable them:
                <br />
                1. Click the lock/info icon in your browser's address bar
                <br />
                2. Set "Notifications" to "Allow"
                <br />
                3. Refresh the page and try again
              </AlertDescription>
            </Alert>
          )}
          
          {permission === 'default' && (
            <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p>Click the checkbox below to request notification permission from your browser.</p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="push" 
              checked={pushEnabled}
              onCheckedChange={async (checked) => {
                if (!pushLoading) await handlePushChange(checked === true);
              }}
              disabled={pushLoading}
            />
            <Label htmlFor="push">
              Browser push notifications
              {pushLoading && <span className="ml-2 text-gray-400">...</span>}
            </Label>
            {permission === 'denied' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRequestPermission}
                disabled={pushLoading}
                className="ml-2"
              >
                Request Permission
              </Button>
            )}
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
          <strong>Status:</strong> {getPermissionStatusText()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;
