import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Landing from './Landing';
import Login from './Login';
import Dashboard from './Dashboard';
import { pushService } from '@/services/pushNotificationService';

const Index = () => {
  const { isAuthenticated } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    // Initialize PWA and push notifications
    pushService.initialize();
    
    // Register service worker if not already registered
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, []);

  if (isAuthenticated) {
    return <Dashboard />;
  }

  if (showLogin) {
    return <Login onBackToLanding={() => setShowLogin(false)} />;
  }

  return <Landing onSignInClick={() => setShowLogin(true)} />;
};

export default Index;
