import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Landing from './Landing';
import Login from './Login';
import Dashboard from './Dashboard';
import { unifiedNotificationService } from '@/services/unifiedNotificationService';

const Index = () => {
  const { isAuthenticated } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [isServiceReady, setIsServiceReady] = useState(false);

  useEffect(() => {
    // Initialize notification service if not already done
    const initializeNotificationService = async () => {
      try {
        console.log('[Index] Checking unified notification service status...');
        
        const status = unifiedNotificationService.getConnectionStatus();
        
        if (!status.isInitialized) {
          console.log('[Index] Initializing unified notification service...');
          await unifiedNotificationService.initialize();
        }
        
        setIsServiceReady(true);
        console.log('[Index] Unified notification service ready');
        
        // Request notification permission if not already granted
        const hasPermission = await unifiedNotificationService.requestNotificationPermission();
        
        if (hasPermission) {
          console.log('[Index] Notification permission granted');
          
          // Subscribe to push notifications if supported
          const pushSubscription = await unifiedNotificationService.subscribeToPush();
          if (pushSubscription) {
            console.log('[Index] Push subscription created successfully');
          }
        } else {
          console.warn('[Index] Notification permission denied or not available');
        }
        
      } catch (error) {
        console.error('[Index] Failed to initialize notification service:', error);
        setIsServiceReady(false);
      }
    };

    initializeNotificationService();

    // Set up global notification listeners for app-level handling
    const setupGlobalListeners = () => {
      // Listen for PWA install prompts
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        console.log('[Index] PWA install prompt available');
        
        // Store the event for later use
        (window as any).deferredPrompt = e;
        
        // Dispatch custom event to notify components
        const installEvent = new CustomEvent('pwa-install-available', { detail: e });
        window.dispatchEvent(installEvent);
      };

      const handleAppInstalled = () => {
        console.log('[Index] PWA installed successfully');
        (window as any).deferredPrompt = null;
        
        // Show success message
        const installedEvent = new CustomEvent('pwa-installed');
        window.dispatchEvent(installedEvent);
      };

      // Connection status monitoring
      const handleConnectionChange = () => {
        const isOnline = navigator.onLine;
        console.log(`[Index] Connection status changed: ${isOnline ? 'online' : 'offline'}`);
        
        const connectionEvent = new CustomEvent('connection-status-changed', {
          detail: { isOnline }
        });
        window.dispatchEvent(connectionEvent);
        
        // Attempt to reconnect notification service if back online
        if (isOnline && isServiceReady) {
          const status = unifiedNotificationService.getConnectionStatus();
          if (!status.supabase.isConnected) {
            console.log('[Index] Attempting to reconnect notification service...');
            unifiedNotificationService.initialize().catch(console.error);
          }
        }
      };

      // Unified notification service listeners
      const setupNotificationListeners = () => {
        // Listen for in-app notifications
        const unsubscribeInApp = unifiedNotificationService.addInAppListener((notification) => {
          console.log('[Index] Global in-app notification received:', notification);
          
          // Dispatch global event for components to handle
          const notificationEvent = new CustomEvent('unified-notification-received', {
            detail: { notification, type: 'in-app' }
          });
          window.dispatchEvent(notificationEvent);
        });

        // Listen for push notifications
        const unsubscribePush = unifiedNotificationService.addPushListener((notification) => {
          console.log('[Index] Global push notification received:', notification);
          
          // Dispatch global event for components to handle
          const notificationEvent = new CustomEvent('unified-notification-received', {
            detail: { notification, type: 'push' }
          });
          window.dispatchEvent(notificationEvent);
        });

        return () => {
          unsubscribeInApp();
          unsubscribePush();
        };
      };

      // Add event listeners
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
      window.addEventListener('online', handleConnectionChange);
      window.addEventListener('offline', handleConnectionChange);

      // Initial connection status check
      handleConnectionChange();

      // Set up notification listeners
      const cleanupNotificationListeners = setupNotificationListeners();

      // Return cleanup function
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        window.removeEventListener('online', handleConnectionChange);
        window.removeEventListener('offline', handleConnectionChange);
        
        if (cleanupNotificationListeners) {
          cleanupNotificationListeners();
        }
      };
    };

    // Wait for service to be ready before setting up listeners
    let cleanupListeners: (() => void) | null = null;
    
    if (isServiceReady) {
      cleanupListeners = setupGlobalListeners();
    }

    return () => {
      if (cleanupListeners) {
        cleanupListeners();
      }
    };
  }, [isServiceReady]);

  // Status logging for debugging
  useEffect(() => {
    const interval = setInterval(() => {
      if (isServiceReady) {
        const status = unifiedNotificationService.getConnectionStatus();
        console.log('[Index] Notification service status check:', {
          initialized: status.isInitialized,
          supabaseConnected: status.supabase.isConnected,
          pushSupported: status.push.supported,
          pushSubscribed: status.push.pushSubscribed,
          listeners: status.listeners
        });
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isServiceReady]);

  // Show different content based on authentication status
  if (isAuthenticated) {
    return <Dashboard />;
  }

  if (showLogin) {
    return <Login onBackToLanding={() => setShowLogin(false)} />;
  }

  return <Landing onSignInClick={() => setShowLogin(true)} />;
};

export default Index;
