import React, { useEffect, useState } from 'react';
import { unifiedNotificationService } from '@/services/unifiedNotificationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Bell, CheckCircle, Clock } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface Notification {
  id: string;
  title: string;
  message?: string;
  body?: string;
  type: string;
  priority: string;
  is_read: boolean;
  created_at: string;
  timestamp: string;
  site?: string;
}

const AllNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      // Fetch all notifications (increased limit for "All Notifications" page)
      const data = await unifiedNotificationService.getNotifications(100, 0, false);
      setNotifications(data || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadNotifications();
      toast.success('Notifications refreshed');
    } catch (error) {
      toast.error('Failed to refresh notifications');
    } finally {
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await unifiedNotificationService.markAsRead(notificationId);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true }
            : n
        )
      );
      
      toast.success('Marked as read');
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await unifiedNotificationService.markAllAsRead();
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'test':
        return '🧪';
      case 'alert':
        return '🚨';
      case 'system':
        return '⚙️';
      case 'price_change':
        return '💰';
      default:
        return '📢';
    }
  };

  useEffect(() => {
    loadNotifications();

    // Set up real-time listener for new notifications
    const removeListener = unifiedNotificationService.addInAppListener((newNotification) => {
      setNotifications(prev => [newNotification, ...prev]);
    });

    return removeListener;
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            All Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading notifications...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            All Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} unread
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No notifications found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-4 rounded-lg border transition-all hover:shadow-sm ${
                  notification.is_read 
                    ? 'bg-muted/30 border-muted' 
                    : 'bg-background border-border shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getTypeIcon(notification.type)}</span>
                      <div className="font-semibold text-foreground">
                        {notification.title}
                      </div>
                      <Badge className={getPriorityColor(notification.priority)}>
                        {notification.priority}
                      </Badge>
                      {!notification.is_read && (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          New
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-muted-foreground mb-3">
                      {notification.message || notification.body}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span>
                          {new Date(notification.created_at || notification.timestamp).toLocaleString()}
                        </span>
                        {notification.site && (
                          <span className="text-blue-600">
                            Source: {notification.site}
                          </span>
                        )}
                        <span className="text-green-600">
                          Type: {notification.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(notification.id)}
                      className="shrink-0"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AllNotifications;
