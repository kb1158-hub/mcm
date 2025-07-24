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
import { NotificationProvider } from "@/components/NotificationSettingsDialog";

// Page Components
import Index from "./pages/Index";
import ApiDocumentation from "./pages/ApiDocumentation";
import NotFound from "./pages/NotFound";
import AllNotifications from "./pages/AllNotifications";
// ...import other pages as needed

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pushServiceReady, setPushServiceReady] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log("App is back online");
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log("App is offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const initializePushService = async () => {
      try {
        console.log("Initializing push notification service...");
        await pushService.initialize();
        setPushServiceReady(true);
        console.log("Push notification service initialized");
      } catch (error) {
        console.error("Failed to initialize push notification service:", error);
      }
    };

    initializePushService();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/api-docs" element={<ApiDocumentation />} />
                <Route path="/notifications" element={<AllNotifications />} />
                {/* Add other routes here */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              {/* In-App Notification System */}
              <InAppNotificationSystem />
            </BrowserRouter>
          </TooltipProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
