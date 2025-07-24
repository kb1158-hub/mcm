// src/components/InAppNotificationSystem.tsx - Real-time in-app notifications
import React, { useEffect, useState } from 'react';
import { X, Bell, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface InAppNotification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
  persistent?: boolean;
  autoClose?: number;
  acknowledged?: boolean;
}

const InAppNotificationSystem: React.FC = () => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Listen for new notifications from various sources
    const handleNewNotification = (event: CustomEvent) => {
      const notificationData = event.detail;
      addNotification({
        id: notificationData.id || generateId(),
        title: notificationData.title,
        body: notificationData.body || notificationData.message,
        type: mapPriorityToType(notificationData.priority),
        priority: notificationData.priority || 'medium',
        timestamp: new Date(notificationData.created_at || Date.now()),
        persistent: notificationData.priority === 'high',
        autoClose: getAutoCloseDelay(notificationData.priority)
      });
    };

    const handlePushNotification = (event: CustomEvent) => {
      const notificationData = event.detail;
      addNotification({
        id: notificationData.id || generateId(),
        title: notificationData.title,
        body: notificationData.body,
        type: mapPriorityToType(notificationData.priority),
        priority: notificationData.priority || 'medium',
        timestamp: new Date(),
        persistent: notificationData.priority === 'high',
        autoClose: getAutoCloseDelay(notificationData.priority)
      });
    };

    const handleNotificationClick = (event: CustomEvent) => {
      const notificationData = event.detail;
      // Mark notification as acknowledged when clicked from browser notification
      if (notificationData.id) {
        markAsAcknowledged(notificationData.id);
      }
    };

    // Add event listeners
    window.addEventListener('newNotification', handleNewNotification as EventListener);
    window.addEventListener('pushNotificationReceived', handlePushNotification as EventListener);
    window.addEventListener('notificationClick', handleNotificationClick as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('newNotification', handleNewNotification as EventListener);
      window.removeEventListener('pushNotificationReceived', handlePushNotification as EventListener);
      window.removeEventListener('notificationClick', handleNotificationClick as EventListener);
    };
  }, []);

  const generateId = (): string => {
    return Math.random().toString(36).substr(2, 9);
  };

  const mapPriorityToType = (priority?: string): 'info' | 'success' | 'warning' | 'error' => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'info';
    }
  };

  const getAutoCloseDelay = (priority?: string): number => {
    switch (priority) {
      case 'high': return 0; // Don't auto close high priority
      case 'medium': return 8000;
      case 'low': return 5000;
      default: return 6000;
    }
  };

  const addNotification = (notification: InAppNotification) => {
    setNotifications(prev => {
      // Remove duplicate notifications (same ID)
      const filtered = prev.filter(n => n.id !== notification.id);
      return [notification, ...filtered].slice(0, 10); // Keep max 10 notifications
    });

    // Auto remove if specified
    if (notification.autoClose && notification.autoClose > 0) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, notification.autoClose);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAsAcknowledged = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, acknowledged: true } : n)
    );
    
    // Remove after a short delay to show the acknowledged state
    setTimeout(() => {
      removeNotification(id);
    }, 1000);
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default: return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getBgColor = (type: string, priority: string) => {
    const baseColors = {
      success: 'bg-green-50 border-green-200',
      error: 'bg-red-50 border-red-200',
      warning: 'bg-yellow-50 border-yellow-200',
      info: 'bg-blue-50 border-blue-200'
    };

    if (priority === 'high') {
      return `${baseColors[type as keyof typeof baseColors]} ring-2 ring-red-300 animate-pulse`;
    }

    return baseColors[type as keyof typeof baseColors];
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };

    return (
      <Badge className={`text-xs ${colors[priority as keyof typeof colors]}`}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  if (!isVisible || notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
      {/* Header with clear all button */}
      {notifications.length > 1 && (
        <div className="flex justify-between items-center bg-white rounded-lg shadow-sm border p-2">
          <div className="flex items-center space-x-2">
            <Bell className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAll}
              className="text-xs h-6 px-2"
            >
              Clear All
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsVisible(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Notification list */}
      {notifications.slice(0, 5).map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={removeNotification}
          onAcknowledge={markAsAcknowledged}
          getIcon={getIcon}
          getBgColor={getBgColor}
          getPriorityBadge={getPriorityBadge}
        />
      ))}

      {/* Show count if more notifications exist */}
      {notifications.length > 5 && (
        <div className="text-center bg-white rounded-lg shadow-sm border p-2">
          <span className="text-sm text-gray-600">
            and {notifications.length - 5} more notification{notifications.length - 5 !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

interface NotificationItemProps {
  notification: InAppNotification;
  onRemove: (id: string) => void;
  onAcknowledge: (id: string) => void;
  getIcon: (type: string) => React.ReactNode;
  getBgColor: (type: string, priority: string) => string;
  getPriorityBadge: (priority: string) => React.ReactNode;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRemove,
  onAcknowledge,
  getIcon,
  getBgColor,
  getPriorityBadge
}) => {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = () => {
    setIsRemoving(true);
    setTimeout(() => onRemove(notification.id), 300);
  };

  const handleAcknowledge = () => {
    onAcknowledge(notification.id);
  };

  const handleClick = () => {
    if (notification.priority === 'high' && !notification.acknowledged) {
      handleAcknowledge();
    }
  };

  return (
    <div
      className={`
        p-4 rounded-lg border shadow-sm transition-all duration-300 cursor-pointer
        ${getBgColor(notification.type, notification.priority)}
        ${isRemoving ? 'opacity-0 transform translate-x-full' : 'opacity-100 transform translate-x-0'}
        ${notification.acknowledged ? 'opacity-50' : ''}
        animate-in slide-in-from-right-full
      `}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {getIcon(notification.type)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium text-gray-900 text-sm truncate">
                {notification.title}
              </h4>
              {getPriorityBadge(notification.priority)}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-2">
              {notification.body}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {notification.timestamp.toLocaleTimeString()}
              </p>
              {notification.acknowledged && (
                <span className="text-xs text-green-600 font-medium">
                  ✓ Acknowledged
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 ml-2">
          {notification.priority === 'high' && !notification.acknowledged && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAcknowledge();
              }}
              className="h-6 px-2 text-xs bg-white hover:bg-gray-50"
            >
              Ack
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="h-6 w-6 p-0 hover:bg-white hover:bg-opacity-80"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InAppNotificationSystem;
