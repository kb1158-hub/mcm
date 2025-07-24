// src/App.tsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { pushService } from "@/services/pushNotificationService";
import InAppNotificationSystem from "@/components/InAppNotificationSystem";

// Page Components
import Index from "./pages/Index";
import ApiDocumentation from "./pages/ApiDocumentation";
import NotFound from "./pages/NotFound";
import AllNotifications from "./pages/AllNotifications";
import Dashboard from "./pages/Dashboard";

const queryClient = new QueryClient();

const App: React.FC = () => {
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);

  useEffect(() => {
    const initializePushService = async () => {
      try {
        await pushService.initialize();
        console.log("Push notification service initialized");
        setIsServiceWorkerReady(true);

        // Set up service worker message listeners for real-time notifications
        setupServiceWorkerListeners();
        
        // Register for push subscription if supported
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          try {
            await pushService.subscribe();
            console.log("Push subscription established");
          } catch (error) {
            console.warn("Push subscription failed:", error);
          }
        }

      } catch (error) {
        console.error("Failed to initialize push notification service:", error);
        setIsServiceWorkerReady(false);
      }
    };

    const setupServiceWorkerListeners = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('App received SW message:', event.data);
          
          switch (event.data?.type) {
            case 'PUSH_NOTIFICATION_RECEIVED':
              handlePushNotificationReceived(event.data);
              break;
              
            case 'API_NOTIFICATION_SHOWN':
              handleApiNotificationShown(event.data);
              break;
              
            case 'NOTIFICATION_CLICKED':
              handleNotificationClicked(event.data);
              break;
              
            case 'NOTIFICATION_ACKNOWLEDGED':
              handleNotificationAcknowledged(event.data);
              break;
              
            case 'BACKGROUND_SYNC_COMPLETED':
              handleBackgroundSyncCompleted(event.data);
              break;
              
            default:
              console.log('Unhandled SW message type:', event.data?.type);
          }
        });

        // Listen for service worker updates
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('Service worker controller changed - reloading');
          window.location.reload();
        });
      }
    };

    const handlePushNotificationReceived = (data: any) => {
      console.log('Push notification received in app:', data);
      
      // Dispatch custom event for components to listen to
      window.dispatchEvent(new CustomEvent('push-notification', {
        detail: data.notificationData
      }));

      // Update UI indicators, refresh notification lists, etc.
      // This can be handled by individual components listening to the custom event
    };

    const handleApiNotificationShown = (data: any) => {
      console.log('API notification shown:', data);
      
      // Dispatch custom event for real-time API notifications
      window.dispatchEvent(new CustomEvent('api-notification-received', {
        detail: data.notificationData
      }));
    };

    const handleNotificationClicked = (data: any) => {
      console.log('Notification clicked in app:', data);
      
      // Handle navigation based on notification data
      if (data.targetUrl && data.targetUrl !== window.location.pathname) {
        window.history.pushState({}, '', data.targetUrl);
      }
      
      // Focus the window
      window.focus();
    };

    const handleNotificationAcknowledged = (data: any) => {
      console.log('Notification acknowledged:', data);
      
      // Dispatch event to update UI
      window.dispatchEvent(new CustomEvent('notification-acknowledged', {
        detail: data
      }));
    };

    const handleBackgroundSyncCompleted = (data: any) => {
      console.log('Background sync completed:', data);
      
      // Refresh notification data
      window.dispatchEvent(new CustomEvent('background-sync-completed', {
        detail: data
      }));
    };

    // Initialize the push service
    initializePushService();

    // Set up visibility change listener for better mobile behavior
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('App became visible - refreshing notifications');
        
        // Dispatch event to refresh notifications when app becomes visible
        window.dispatchEvent(new CustomEvent('app-became-visible'));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up online/offline listeners
    const handleOnline = () => {
      console.log('App came online');
      window.dispatchEvent(new CustomEvent('app-online'));
    };

    const handleOffline = () => {
      console.log('App went offline');
      window.dispatchEvent(new CustomEvent('app-offline'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for unhandled promise rejections (helpful for debugging)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // Don't show notification-related errors to users as they might be expected
      if (event.reason?.message?.includes('notification') || 
          event.reason?.message?.includes('permission')) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/api-docs" element={<ApiDocumentation />} />
              <Route path="/notifications" element={<AllNotifications />} />
              {/* Add other routes above this */}
              <Route path="*" element={<NotFound />} />
            </Routes>

            {/* In-App Notification System - only render when SW is ready */}
            {isServiceWorkerReady && <InAppNotificationSystem />}
            
            {/* Connection Status Indicator */}
            <ConnectionStatusIndicator />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

// Connection status indicator component
const ConnectionStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(true);
      
      // Hide indicator after 3 seconds
      setTimeout(() => setShowIndicator(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showIndicator) return null;

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
      isOnline 
        ? 'bg-green-500 text-white' 
        : 'bg-red-500 text-white'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-white'}`} />
        <span className="text-sm font-medium">
          {isOnline ? 'Back online' : 'No internet connection'}
        </span>
      </div>
    </div>
  );
};

export default App;
