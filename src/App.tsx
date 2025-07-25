import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import InAppNotificationSystem from '@/components/InAppNotificationSystem';
import Index from '@/pages/Index';
import Dashboard from '@/pages/Dashboard';
import AllNotifications from '@/pages/AllNotifications';
import ApiDocumentation from '@/pages/ApiDocumentation';
import NotFound from '@/pages/NotFound';
import { unifiedNotificationService } from '@/services/unifiedNotificationService';
import './App.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  useEffect(() => {
    // Initialize PWA and notification services on app start
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing MCM Alerts App...');
        
        // Initialize unified notification service (replaces pushService)
        await unifiedNotificationService.initialize();
        console.log('✅ Unified notification service initialized');

        // Register service worker for PWA functionality
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
              scope: '/',
              updateViaCache: 'none'
            });
            
            console.log('✅ Service Worker registered successfully:', registration.scope);
            
            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('🔄 New service worker available');
                    // Optionally notify user about update
                  }
                });
              }
            });

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
              console.log('📨 Message from service worker:', event.data);
              
              if (event.data && event.data.type === 'PUSH_NOTIFICATION_RECEIVED') {
                // Dispatch custom event for push notifications
                const customEvent = new CustomEvent('push-notification-received', {
                  detail: event.data.notificationData
                });
                window.dispatchEvent(customEvent);
              }
            });

          } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
          }
        } else {
          console.warn('⚠️ Service Worker not supported in this browser');
        }

        // Set up PWA install prompt handling
        let deferredPrompt: any = null;
        
        window.addEventListener('beforeinstallprompt', (e) => {
          console.log('📲 PWA install prompt triggered');
          e.preventDefault();
          deferredPrompt = e;
          
          // Dispatch custom event to show install button
          const installEvent = new CustomEvent('pwa-install-available', { detail: e });
          window.dispatchEvent(installEvent);
        });

        window.addEventListener('appinstalled', () => {
          console.log('✅ PWA installed successfully');
          deferredPrompt = null;
        });

        // Handle online/offline status
        const updateOnlineStatus = () => {
          const status = navigator.onLine ? 'online' : 'offline';
          console.log(`🌐 Connection status: ${status}`);
          
          // Dispatch custom event for connection status changes
          const connectionEvent = new CustomEvent('connection-status-changed', {
            detail: { isOnline: navigator.onLine }
          });
          window.dispatchEvent(connectionEvent);
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        
        // Initial status check
        updateOnlineStatus();

        // Set up API notification endpoint listener
        // This creates a global handler for notifications sent via the API
        const setupApiNotificationHandler = () => {
          // Listen for push notifications from service worker
          window.addEventListener('push-notification-received', (event: any) => {
            console.log('🔔 Push notification received in app:', event.detail);
            
            // The unified service already handles these via its internal listeners
            // Just log for debugging - the service will handle display automatically
          });

          // Listen for direct API notifications (when app is open)
          window.addEventListener('api-notification-received', (event: any) => {
            console.log('📡 API notification received:', event.detail);
            
            // You can add custom handling here if needed
            // The unified service handles most cases automatically
          });

          // Set up unified service listeners for in-app notifications
          unifiedNotificationService.addInAppListener((notification) => {
            console.log('🔔 In-app notification:', notification);
            // Additional custom handling can go here
          });

          unifiedNotificationService.addPushListener((notification) => {
            console.log('📱 Push notification:', notification);
            // Additional custom handling can go here
          });
        };

        setupApiNotificationHandler();

        console.log('🎉 MCM Alerts App initialized successfully');

      } catch (error) {
        console.error('❌ Failed to initialize app:', error);
      }
    };

    initializeApp();

    // Cleanup function
    return () => {
      // Clean up unified notification service
      unifiedNotificationService.disconnect();
      
      // Remove event listeners
      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <Router>
            <div className="App">
              {/* Global notification system overlay */}
              <InAppNotificationSystem />
              
              {/* Main application routes */}
              <Routes>
                {/* Main entry point */}
                <Route path="/" element={<Index />} />
                
                {/* Dashboard (authenticated) */}
                <Route path="/dashboard" element={<Dashboard />} />
                
                {/* Notifications page */}
                <Route path="/notifications" element={<AllNotifications />} />
                
                {/* API Documentation */}
                <Route path="/api-docs" element={<ApiDocumentation />} />
                
                {/* Settings page redirect to dashboard for now */}
                <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
                
                {/* Catch-all route for 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              
              {/* Global toast notifications */}
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    border: '1px solid hsl(var(--border))',
                  },
                }}
              />
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
