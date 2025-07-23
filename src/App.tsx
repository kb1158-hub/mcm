import React, { useEffect, useState } from 'react';
import { X, Bell } from 'lucide-react';

interface FallbackNotification {
  id: string;
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
}

const InAppNotificationSystem: React.FC = () => {
  const [notifications, setNotifications] = useState<FallbackNotification[]>([]);

  useEffect(() => {
    const handleFallbackNotification = (event: CustomEvent) => {
      const { title, body, priority } = event.detail;
      
      const notification: FallbackNotification = {
        id: `fallback-${Date.now()}-${Math.random()}`,
        title,
        body,
        priority,
        timestamp: Date.now()
      };

      setNotifications(prev => [...prev, notification]);

      // Auto-remove notification after delay based on priority
      const autoRemoveDelay = priority === 'high' ? 10000 : priority === 'medium' ? 7000 : 5000;
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, autoRemoveDelay);
    };

    window.addEventListener('fallback-notification', handleFallbackNotification as EventListener);
    return () => window.removeEventListener('fallback-notification', handleFallbackNotification as EventListener);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getPriorityStyles = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high':
        return 'border-red-500 bg-red-50 text-red-900';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 text-yellow-900';
      case 'low':
        return 'border-blue-500 bg-blue-50 text-blue-900';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-900';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            border-l-4 p-4 rounded-lg shadow-lg backdrop-blur-sm bg-opacity-95
            transition-all duration-300 ease-in-out
            animate-in slide-in-from-right-2
            ${getPriorityStyles(notification.priority)}
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <Bell className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm leading-tight">
                  {notification.title}
                </h4>
                <p className="text-sm mt-1 opacity-90">
                  {notification.body}
                </p>
                <p className="text-xs mt-2 opacity-70">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InAppNotificationSystem;
