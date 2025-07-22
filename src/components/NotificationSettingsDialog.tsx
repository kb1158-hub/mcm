import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';

const NotificationSettingsDialog: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

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
              onCheckedChange={(checked) => setPushEnabled(checked === true)}
            />
            <Label htmlFor="push">Browser push notifications</Label>
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
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;