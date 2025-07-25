import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/notificationService';
import Landing from '@/components/Landing';
import Dashboard from '@/components/Dashboard'; // Your full dashboard component
import NotificationCenter from '@/components/NotificationCenter';
import Settings from '@/components/Settings';
import ApiDocs from '@/components/ApiDocs';
import LoadingSpinner from '@/components/LoadingSpinner';

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

// Main App content
const AppContent: React.FC = () => {
  const { isAuthenticated, loading, signInWithEmail } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Landing onSignInClick={() => setShowSignIn(true)} />
              )
            } 
          />
          
          {/* Protected Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/notifications" 
            element={
              <ProtectedRoute>
                <NotificationCenter />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/api-docs" 
            element={
              <ProtectedRoute>
                <ApiDocs />
              </ProtectedRoute>
            } 
          />
          
          {/* Catch all route */}
          <Route 
            path="*" 
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} 
          />
        </Routes>
        
        {/* Global Toast Notifications */}
        <Toaster />
        
        {/* Sign In Modal/Dialog - you can implement this as needed */}
        {showSignIn && !isAuthenticated && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">Sign In to MCM Alerts</h2>
              <p className="text-muted-foreground mb-4">
                Enter your email to sign in or create an account.
              </p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const email = e.target.email.value;
                signInWithEmail(email);
                setShowSignIn(false);
              }}>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  className="w-full p-3 border rounded-lg mb-4"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-primary text-white p-3 rounded-lg hover:bg-primary/90"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSignIn(false)}
                    className="px-4 py-3 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
};

// Main App component with providers
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
