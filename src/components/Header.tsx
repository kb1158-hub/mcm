import React from 'react';
import { Button } from '@/components/ui/button';
import mcmLogo from '@/assets/mcm-logo.png';

interface HeaderProps {
  onSignInClick?: () => void;
  showSignIn?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onSignInClick, showSignIn = true }) => {
  return (
    <header className="w-full py-4 px-6 bg-card shadow-sm border-b border-border">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src={mcmLogo} alt="MCM Alerts Logo" className="h-8 w-8" />
          <h1 className="text-2xl font-bold text-foreground">MCM Alerts</h1>
        </div>
        {showSignIn && (
          <Button 
            onClick={onSignInClick}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Sign In
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;