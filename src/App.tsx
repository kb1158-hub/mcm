// src/App.tsx - Enhanced with real-time notifications
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { pushService } from "@/services/pushNotificationService";
import InAppNotificationSystem from "@/components/InAppNotificationSystem";
import { createClient } from '@supabase/supabase-js';

// Page Components
import Index from "./pages/Index";
import ApiDocumentation from "./pages/ApiDocumentation";
import NotFound from "./pages/NotFound";
import AllNotifications from "./pages/AllNotifications";

const queryClient = new QueryClient();

// Supabase client setup for real-time
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rswwlwybqsinzckzwcpb.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzd3dsd3licXNpbnpja3p3Y3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMzY0MjcsImV4cCI6MjA2ODcxMjQyN30.OFDBSFnSWbage9xI5plqis7RAFKnJPuzO1JWUHE7yDM';

const supabase = createClient(supabaseUrl, supabaseKey);

// Global notification state
interface NotificationData {
  id: string;
  title: string;
  body: string;
  type?: string;
  priority?: 'low' | 'medium' | 'high';
  created_at: string;
  acknowledged: boolean;
  metadata?: any;
}

const App: React.FC = () => {
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [lastNotificationCheck, setLastNotificationCheck] = useState<Date>(new Date());

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize push service
        await pushService.initialize();
        console.log("Push notification service initialized");

        // Initialize audio context on first user interaction
        const initAudioContext = () => {
          if (!isAudioInitialized) {
            // Create a silent audio context to enable future audio
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioContext.state === 'suspended') {
              audioContext.resume();
            }
            setIsAudioInitialized(true);
            console.log("Audio context initialized");
            
            // Remove the event listeners after first interaction
            document.removeEventListener('click', initAudioContext);
            document.removeEventListener('touchstart', initAudioContext);
            document.removeEventListener('keydown', initAudioContext);
          }
        };

        // Add event listeners for first user interaction
        document.addEventListener('click', initAudioContext);
        document.addEventListener('touchstart', initAudioContext);
        document.addEventListener('keydown', initAudioContext);

        // Set up real-time notification listener
        setupRealtimeNotifications();
        
        // Set up service worker message listener
        setupServiceWorkerListener();
        
        // Start polling as fallback
        startNotificationPolling();

      } catch (error) {
        console.error("Failed to initialize app:", error);
      }
    };

    initializeApp();

    // Cleanup
    return () => {
      if (window.notificationChannel) {
        window.notificationChannel.unsubscribe();
      }
      if (window.notificationPollInterval) {
        clearInterval(window.notificationPollInterval);
      }
    };
  }, []);

  const setupRealtimeNotifications = () => {
    try {
      // Subscribe to real-time changes in notifications table
      const channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications'
          },
          (payload) => {
            console.log('Real-time notification received:', payload);
            handleNewNotification(payload.new as NotificationData);
          }
        )
        .subscribe((status) => {
          console.log('Supabase real-time subscription status:', status);
        });

      // Store channel reference for cleanup
      (window as any).notificationChannel = channel;
    } catch (error) {
      console.error('Failed to setup real-time notifications:', error);
    }
  };

  const setupServiceWorkerListener = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, notificationData } = event.data;
        
        switch (type) {
          case 'PUSH_NOTIFICATION_RECEIVED':
            console.log('Push notification received via service worker:', notificationData);
            handleNewNotification(notificationData);
            break;
            
          case 'NOTIFICATION_CLICKED':
            console.log('Notification clicked:', notificationData);
            // Handle notification click - maybe navigate to specific page
            break;
            
          case 'NOTIFICATION_ACKNOWLEDGED':
            console.log('Notification acknowledged:', notificationData);
            // Handle acknowledgment
            break;
            
          default:
            console.log('Unknown service worker message:', event.data);
        }
      });
    }
  };

  const startNotificationPolling = () => {
    // Poll for new notifications every 30 seconds as fallback
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/.netlify/functions/notifications');
        const data = await response.json();
        
        if (data.success && data.notifications) {
          // Check for new notifications since last check
          const newNotifications = data.notifications.filter((notif: NotificationData) => 
            new Date(notif.created_at) > lastNotificationCheck && !notif.acknowledged
          );
          
          newNotifications.forEach((notif: NotificationData) => {
            handleNewNotification(notif);
          });
          
          if (newNotifications.length > 0) {
            setLastNotificationCheck(new Date());
          }
        }
      } catch (error) {
        console.error('Polling failed:', error);
      }
    }, 30000); // 30 seconds

    // Store interval reference for cleanup
    (window as any).notificationPollInterval = pollInterval;
  };

  const handleNewNotification = async (notification: NotificationData) => {
    console.log('Processing new notification:', notification);
    
    try {
      // Play notification sound
      await playNotificationSound(notification.priority || 'medium');
      
      // Show browser notification via service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: notification.title,
          body: notification.body,
          priority: notification.priority || 'medium',
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png',
          tag: `notification-${notification.id}`,
          requireInteraction: notification.priority === 'high',
          data: {
            id: notification.id,
            url: '/',
            timestamp: Date.now()
          }
        });
      }
      
      // Trigger custom event for in-app notifications
      window.dispatchEvent(new CustomEvent('newNotification', {
        detail: notification
      }));
      
      // Show toast notification
      if (notification.priority === 'high') {
        Sonner.error(`🔴 ${notification.title}`, {
          description: notification.body,
          duration: 8000,
        });
      } else if (notification.priority === 'low') {
        Sonner.info(`🔵 ${notification.title}`, {
          description: notification.body,
          duration: 4000,
        });
      } else {
        Sonner.success(`🟢 ${notification.title}`, {
          description: notification.body,
          duration: 6000,
        });
      }

      // Vibrate on mobile if supported
      if (navigator.vibrate) {
        const pattern = notification.priority === 'high' ? [300, 100, 300, 100, 300] : [200, 100, 200];
        navigator.vibrate(pattern);
      }

    } catch (error) {
      console.error('Error handling notification:', error);
    }
  };

  const playNotificationSound = async (priority: 'low' | 'medium' | 'high' = 'medium') => {
    try {
      // Only play sound if audio is initialized (user has interacted)
      if (!isAudioInitialized) {
        console.log('Audio not initialized, skipping sound');
        return;
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different frequencies for different priorities
      const frequency = priority === 'high' ? 800 : priority === 'medium' ? 600 : 400;
      const duration = priority === 'high' ? 1.0 : 0.5;
      const volume = priority === 'high' ? 0.3 : priority === 'medium' ? 0.2 : 0.1;

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);

      console.log(`Played ${priority} priority notification sound`);
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner 
            position="top-right"
            closeButton
            richColors
            expand={true}
            visibleToasts={5}
          />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/api-docs" element={<ApiDocumentation />} />
              <Route path="/notifications" element={<AllNotifications />} />
              <Route path="*" element={<NotFound />} />
            </Routes>

            {/* In-App Notification System */}
            <InAppNotificationSystem />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
