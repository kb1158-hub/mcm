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
    
    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('PWA Service Worker registered: ', registration);
        })
        .catch(registrationError => {
          console.log('PWA Service Worker registration failed: ', registrationError);
        });
    }

    // Add PWA install prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log('PWA install prompt available');
    });
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
