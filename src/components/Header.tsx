import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, User, Menu, X } from 'lucide-react';
import NotificationSettingsDialog from './NotificationSettingsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="w-full py-4 px-4 sm:px-6 bg-card shadow-sm border-b border-border" role="banner">
      <div className="container mx-auto flex items-center justify-between">
        {/* Logo + Title */}
        <div className="flex items-center space-x-3">
          <img src="/mcm-logo-192.png" alt="MCM Alerts Logo" className="h-8 w-8 rounded" aria-hidden="true" />
          <h1 className="text-xl md:text-2xl font-bold text-foreground">MCM Alerts</h1>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-6">
          {isAuthenticated ? (
            <>
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

              <div className="flex items-center space-x-2 text-right" aria-label="User information">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">MCM User</p>
                  <p className="text-xs text-muted-foreground">user@mcm-alerts.com</p>
                </div>
              </div>
            </>
          ) : showSignIn && (
            <Button
              onClick={onSignInClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              aria-label="Sign in"
            >
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden focus:outline-none"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-4 px-4 space-y-4 bg-background border-t border-border pt-4 pb-6 animate-slide-in-down">
          {isAuthenticated ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Notifications ({unreadCount})</span>
                </div>
                <NotificationSettingsDialog />
              </div>

              <div className="flex items-center space-x-2 mt-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">MCM User</p>
                  <p className="text-xs text-muted-foreground">user@mcm-alerts.com</p>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="flex flex-col space-y-2 mt-4">
                <Link to="/" className="text-foreground hover:underline">Home</Link>
                <Link to="/notifications" className="text-foreground hover:underline">Notifications</Link>
                <Link to="/api-docs" className="text-foreground hover:underline">API Docs</Link>
                <Button className="mt-2 w-full bg-destructive text-destructive-foreground">Logout</Button>
              </nav>
            </>
          ) : showSignIn && (
            <Button
              onClick={onSignInClick}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              aria-label="Sign in"
            >
              Sign In
            </Button>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
