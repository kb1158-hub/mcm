// src/App.tsx
import React, { useEffect } from "react";
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
// ...import other pages as needed

const queryClient = new QueryClient();

const App: React.FC = () => {
  useEffect(() => {
    const initializePushService = async () => {
      try {
        await pushService.initialize();
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
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/api-docs" element={<ApiDocumentation />} />
              <Route path="/notifications" element={<AllNotifications />} />
              {/* Add other routes above this */}
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
