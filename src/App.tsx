// src/App.tsx
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { pushService } from "@/services/pushNotificationService";
import { realTimeNotificationService } from "@/services/realTimeNotificationService";
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

        // Initialize real-time notification service
        await realTimeNotificationService.initialize();
        console.log("Real-time notification service initialized");

        // Set up service worker message listeners
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('App received service worker message:', event.data);
            
            // Handle different types of service worker messages
            switch (event.data?.type) {
              case 'PUSH_NOTIFICATION_RECEIVED':
                console.log('Push notification received in app:', event.data.notificationData);
                break;
              case 'NOTIFICATION_CLICKED':
                console.log('Notification clicked:', event.data);
                // Handle notification click - maybe navigate to specific page
                break;
              case 'NOTIFICATION_DISMISSED':
                console.log('Notification dismissed:', event.data);
                break;
              default:
                console.log('Unknown service worker message type:', event.data?.type);
            }
          });
        }

        // Set up visibility change listener to reconnect when tab becomes active
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            console.log('Tab became visible, checking notification services...');
            
            // Check if services are still connected
            const status = realTimeNotificationService.getConnectionStatus();
            if (!status.isConnected) {
              console.log('Reconnecting notification services...');
              realTimeNotificationService.initialize();
            }
          }
        });

      } catch (error) {
        console.error("Failed to initialize notification services:", error);
      }
    };

    initializeNotificationServices();

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up notification services...');
      realTimeNotificationService.disconnect();
    };
  }, []);

  // Handle custom events from notification services
  useEffect(() => {
    const handlePushNotificationReceived = (event: CustomEvent) => {
      console.log('Custom push notification event received:', event.detail);
      // You can add custom handling here if needed
    };

    const handleNotificationClicked = (event: CustomEvent) => {
      console.log('Custom notification click event received:', event.detail);
      // You can add custom navigation or actions here
    };

    const handleFallbackNotification = (event: CustomEvent) => {
      console.log('Fallback notification event received:', event.detail);
      // Handle fallback notifications that couldn't be shown as browser notifications
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

            {/* Enhanced In-App Notification System with Real-time Support */}
            <InAppNotificationSystem />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
