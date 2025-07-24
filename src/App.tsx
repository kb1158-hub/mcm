// src/App.tsx
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { pushService } from "@/services/pushNotificationService";
import { autoRefreshNotificationService } from "@/services/autoRefreshNotificationService";
import InAppNotificationSystem from "@/components/InAppNotificationSystem";

// Page Components
import Index from "./pages/Index";
import ApiDocumentation from "./pages/ApiDocumentation";
import NotFound from "./pages/NotFound";
import AllNotifications from "./pages/AllNotifications";
// ...import other pages as needed

const queryClient = new QueryClient();

const App: React.FC = () => {
  useEffect(() => {
    const initializeNotificationServices = async () => {
      try {
        console.log('Initializing notification services...');

        // Initialize push notification service
        await pushService.initialize();
        console.log("Push notification service initialized");

        // Restore notification state after refresh
        autoRefreshNotificationService.restoreNotificationState();

        // Start auto-refresh notification polling
        autoRefreshNotificationService.startPolling();
        console.log("Auto-refresh notification service started");

        // Set up service worker message listeners for push notifications
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('App received service worker message:', event.data);
            
            // Handle different types of service worker messages
            switch (event.data?.type) {
              case 'PUSH_NOTIFICATION_RECEIVED':
                console.log('Push notification received in app:', event.data.notificationData);
                
                // Set refresh flag for immediate page refresh on push notifications
                try {
                  localStorage.setItem('mcm_refresh_required', JSON.stringify({
                    reason: 'Push notification received',
                    timestamp: Date.now()
                  }));
                  
                  // Force refresh after short delay
                  autoRefreshNotificationService.forceRefresh('Push notification received', 1500);
                } catch (error) {
                  console.error('Failed to set refresh flag:', error);
                }
                break;
                
              case 'NOTIFICATION_CLICKED':
                console.log('Notification clicked:', event.data);
                // Bring the app to focus and refresh to show latest data
                window.focus();
                autoRefreshNotificationService.forceRefresh('Notification clicked', 500);
                break;
                
              case 'NOTIFICATION_DISMISSED':
                console.log('Notification dismissed:', event.data);
                break;
                
              default:
                console.log('Unknown service worker message type:', event.data?.type);
            }
          });
        }

        // Set up visibility change listener
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            console.log('Tab became visible, checking notification services...');
            
            // Check service status
            const status = autoRefreshNotificationService.getStatus();
            console.log('Auto-refresh service status:', status);
            
            // If polling stopped, restart it
            if (!status.isPolling) {
              console.log('Restarting auto-refresh polling...');
              autoRefreshNotificationService.startPolling();
            }
          }
        });

        // Show service status in console
        const logStatus = () => {
          const status = autoRefreshNotificationService.getStatus();
          console.log('📱 Auto-refresh service status:', status);
        };

        // Log status every 30 seconds
        const statusInterval = setInterval(logStatus, 30000);
        logStatus(); // Log immediately

        // Cleanup interval on unmount
        return () => clearInterval(statusInterval);

      } catch (error) {
        console.error("Failed to initialize notification services:", error);
      }
    };

    initializeNotificationServices();

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up notification services...');
      autoRefreshNotificationService.stopPolling();
    };
  }, []);

  // Handle custom events from notification services
  useEffect(() => {
    const handlePushNotificationReceived = (event: CustomEvent) => {
      console.log('Custom push notification event received:', event.detail);
      // Trigger immediate refresh for push notifications
      autoRefreshNotificationService.forceRefresh('Push notification received', 1000);
    };

    const handleNotificationClicked = (event: CustomEvent) => {
      console.log('Custom notification click event received:', event.detail);
      // Trigger immediate refresh when notification is clicked
      autoRefreshNotificationService.forceRefresh('Notification interaction', 500);
    };

    const handleFallbackNotification = (event: CustomEvent) => {
      console.log('Fallback notification event received:', event.detail);
      // Even fallback notifications should trigger refresh
      autoRefreshNotificationService.forceRefresh('Fallback notification', 2000);
    };

    // Add event listeners
    window.addEventListener('push-notification-received', handlePushNotificationReceived as EventListener);
    window.addEventListener('notification-clicked', handleNotificationClicked as EventListener);
    window.addEventListener('fallback-notification', handleFallbackNotification as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('push-notification-received', handlePushNotificationReceived as EventListener);
      window.removeEventListener('notification-clicked', handleNotificationClicked as EventListener);
      window.removeEventListener('fallback-notification', handleFallbackNotification as EventListener);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner 
            position="top-center"
            expand={true}
            richColors={true}
            closeButton={true}
          />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/api-docs" element={<ApiDocumentation />} />
              <Route path="/notifications" element={<AllNotifications />} />
              {/* Add other routes above this */}
              <Route path="*" element={<NotFound />} />
            </Routes>

            {/* Enhanced In-App Notification System with Auto-refresh */}
            <InAppNotificationSystem />
            
            {/* Auto-refresh Status Component */}
            <AutoRefreshStatus />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

// Component to show auto-refresh status and manual controls
const AutoRefreshStatus: React.FC = () => {
  const [status, setStatus] = React.useState(autoRefreshNotificationService.getStatus());
  const [showControls, setShowControls] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStatus(autoRefreshNotificationService.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleTestNotification = () => {
    autoRefreshNotificationService.triggerTestNotification();
  };

  const handleForceRefresh = () => {
    autoRefreshNotificationService.forceRefresh('Manual refresh requested', 1000);
  };

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border p-3">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => setShowControls(!showControls)}
        >
          <div className={`w-2 h-2 rounded-full ${status.isPolling ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs font-medium">Auto-refresh</span>
          <span className="text-xs text-gray-500">
            {status.isPolling ? 'Active' : 'Inactive'}
          </span>
        </div>
        
        {showControls && (
          <div className="mt-2 pt-2 border-t space-y-1">
            <button
              onClick={handleTestNotification}
              className="w-full text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
            >
              Test Notification
            </button>
            <button
              onClick={handleForceRefresh}
              className="w-full text-xs px-2 py-1 bg-green-100 hover:bg-green-200 rounded text-green-700"
            >
              Force Refresh
            </button>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Last check: {status.lastCheck ? new Date(status.lastCheck).toLocaleTimeString() : 'Never'}</div>
              <div>Interval: {status.pollingInterval}ms</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
