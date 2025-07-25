// src/App.tsx
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
// CHANGE: Replace old pushService with new Supabase service
import { notificationService } from "@/services/supabaseNotificationService";
import InAppNotificationSystem from "@/components/InAppNotificationSystem";

// Page Components
import Index from "./pages/Index";
import ApiDocumentation from "./pages/ApiDocumentation";
import NotFound from "./pages/NotFound";
import AllNotifications from "./pages/AllNotifications";

const queryClient = new QueryClient();

const App: React.FC = () => {
  useEffect(() => {
    const initializeNotificationService = async () => {
      try {
        // Request notification permission first
        const hasPermission = await notificationService.requestPermission();
        if (hasPermission) {
          console.log("Notification permission granted");
        } else {
          console.warn("Notification permission denied");
        }

        // Initialize real-time subscription regardless of permission
        await notificationService.initialize();
        console.log("Supabase notification service initialized");

        // Add a listener to log notifications (optional)
        const removeListener = notificationService.addListener((notification) => {
          console.log("New notification received:", notification);
          // You can add additional handling here like showing toasts
        });

        // Return cleanup function
        return () => {
          removeListener();
          notificationService.disconnect();
        };
      } catch (error) {
        console.error("Failed to initialize notification service:", error);
      }
    };

    initializeNotificationService();

    // Cleanup on component unmount
    return () => {
      notificationService.disconnect();
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
