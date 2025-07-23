import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { pushService } from "@/services/pushNotificationService";
import InAppNotificationSystem from "@/components/InAppNotificationSystem";
import Index from "./pages/Index";
import ApiDocumentation from "./pages/ApiDocumentation";
import NotFound from "./pages/NotFound";
import AllNotifications from "./pages/AllNotifications";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Initialize push notification service when app starts
    const initializePushService = async () => {
      try {
        await pushService.initialize();
        console.log('Push notification service initialized');
      } catch (error) {
        console.error('Failed to initialize push notification service:', error);
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
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            {/* In-App Notification System - positioned at the app level */}
            <InAppNotificationSystem />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
