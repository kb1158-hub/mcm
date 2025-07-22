import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, User } from 'lucide-react';
import mcmLogo from '@/assets/mcm-logo.png';
import NotificationSettingsDialog from './NotificationSettingsDialog';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onSignInClick?: () => void;
  showSignIn?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onSignInClick, showSignIn = true }) => {
  const { isAuthenticated } = useAuth();

  return (
    <header className="w-full py-4 px-6 bg-card shadow-sm border-b border-border">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src={mcmLogo} alt="MCM Alerts Logo" className="h-8 w-8" />
          <h1 className="text-2xl font-bold text-foreground">MCM Alerts</h1>
        </div>
        
        {isAuthenticated ? (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <NotificationSettingsDialog />
            </div>
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="text-right">
                <p className="text-sm font-medium">MCM User</p>
                <p className="text-xs text-muted-foreground">user@mcm-alerts.com</p>
              </div>
            </div>
          </div>
        ) : showSignIn ? (
          <Button 
            onClick={onSignInClick}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Sign In
          </Button>
        ) : null}
      </div>
    </header>
  );
};

export default Header;