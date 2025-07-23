import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, User } from 'lucide-react';
import NotificationSettingsDialog from './NotificationSettingsDialog';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onSignInClick?: () => void;
  showSignIn?: boolean;
  unreadCount?: number;
}

const Header: React.FC<HeaderProps> = ({
  onSignInClick,
  showSignIn = true,
  unreadCount = 0,
}) => {
  const { isAuthenticated } = useAuth();

  return (
    <header className="w-full py-4 px-6 bg-card shadow-sm border-b border-border" role="banner">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src="/mcm-logo-192.png"
            alt="MCM Alerts Logo"
            className="h-8 w-8 rounded"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold text-foreground">MCM Alerts</h1>
        </div>

        {isAuthenticated ? (
          <div className="flex items-center space-x-6">
            <div className="relative flex items-center space-x-2">
              <button
                aria-label={`Notifications: ${unreadCount} unread`}
                className="relative focus:outline-none focus:ring-2 focus:ring-accent rounded"
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-bold"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </button>
              <NotificationSettingsDialog />
            </div>

            <div className="flex items-center space-x-2" aria-label="User information">
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
            aria-label="Sign in"
          >
            Sign In
          </Button>
        ) : null}
      </div>
    </header>
  );
};

export default Header;
