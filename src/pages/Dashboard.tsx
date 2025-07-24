import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import TopicManagement from '@/components/TopicManagement';
import { pushService } from '@/services/pushNotificationService';
import { LogOut, Copy, ExternalLink, Search, Filter, Check, Settings, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchRecentNotifications, addNotification, supabase } from '@/services/notificationService';

interface Notification {
  id: string;
  title: string;
  body: string;
  type?: string;
  priority?: 'low' | 'medium' | 'high';
  acknowledged?: boolean;
  created_at: string;
}

const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    initializePushNotifications();
    loadRecentNotifications();
    
    // Set up real-time subscription for notifications
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log('New notification received:', payload.new);
          // Add new notification to the list
          setNotifications(prev => [payload.new as Notification, ...prev.slice(0, 4)]);
          // Increment unread count
          setUnreadCount(prev => prev + 1);
          
          // Show browser notification if enabled and play sound
          if ('Notification' in window && Notification.permission === 'granted') {
            showBrowserNotification(payload.new as Notification);
          } else {
            // Even if browser notifications are disabled, play sound for API notifications
            playNotificationSound((payload.new as Notification).priority || 'medium');
            // Show toast notification as fallback
            toast({
              title: `🔔 ${(payload.new as Notification).title}`,
              description: (payload.new as Notification).body,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Mark notifications as read when viewing them
  const markAsRead = () => {
    setUnreadCount(0);
  };

  const showBrowserNotification = async (notification: Notification) => {
    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.warn('Browser does not support notifications');
        return;
      }

      // Check permission
      if (Notification.permission !== 'granted') {
        console.warn('Notification permission not granted');
        return;
      }

      // Play sound first
      await playNotificationSound(notification.priority || 'medium');
      
      // Show browser notification
      const browserNotification = new Notification(notification.title, {
        body: notification.body,
        icon: '/mcm-logo-192.png',
        badge: '/mcm-logo-192.png',
        tag: 'mcm-realtime',
        requireInteraction: notification.priority === 'high',
        silent: false,
        vibrate: notification.priority === 'high' ? [300, 100, 300, 100, 300] : [200, 100, 200],
        data: {
          priority: notification.priority,
          timestamp: Date.now()
        }
      });

      // Handle notification click
      browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
      };

      // Auto-close after delay
      setTimeout(() => {
        try {
          browserNotification.close();
        } catch (e) {
          // Notification might already be closed
          console.warn('Could not close notification:', e);
        }
      }, notification.priority === 'high' ? 10000 : 5000);

      // Show toast notification
      toast({
        title: `🔔 ${notification.title}`,
        description: notification.body,
        duration: 5000,
      });

    } catch (error) {
      console.error('Failed to show browser notification:', error);
      // Fallback to toast only
      toast({
        title: `🔔 ${notification.title}`,
        description: notification.body,
        duration: 5000,
      });
    }
  };

  const initializePushNotifications = async () => {
    try {
      await pushService.initialize();
      if ('Notification' in window) {
        setNotificationsEnabled(Notification.permission === 'granted');
      }
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      setNotificationsEnabled(false);
    }
  };

  const loadRecentNotifications = async () => {
    try {
      setIsLoading(true);
      // First try with acknowledged column, fallback without it
      const { data, error } = await supabase 
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      // Handle notifications with or without acknowledged column
      const notificationsWithAck = (data || []).map(n => ({
        ...n,
        acknowledged: n.acknowledged || false
      }));
      
      setNotifications(notificationsWithAck);
      setUnreadCount(notificationsWithAck.filter(n => !n.acknowledged).length);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setNotifications([]);
      setUnreadCount(0);
      toast({
        title: "Error Loading Notifications",
        description: "Failed to load recent notifications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out"
    });
  };

  const sendTestNotification = async (priority: 'low' | 'medium' | 'high') => {
    try {
      setIsLoading(true);

      // Check if notifications are supported
      if (!('Notification' in window)) {
        toast({
          title: "Notifications Not Supported",
          description: "Your browser does not support notifications",
          variant: "destructive",
        });
        return;
      }

      // Always request permission first to show browser dialog
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          title: "Notifications Blocked",
          description: "Please click 'Allow' in the browser dialog to enable notifications",
          variant: "destructive",
        });
        return;
      }

      // Update notifications enabled state
      setNotificationsEnabled(true);

      // Send simple browser notification
      const title = `MCM Alert - ${priority.toUpperCase()} Priority`;
      const body = `Test notification (${priority} priority) - ${new Date().toLocaleTimeString()}`;
      
      // Create browser notification
      const notification = new Notification(title, {
        body,
        icon: '/mcm-logo-192.png',
        badge: '/mcm-logo-192.png',
        tag: 'mcm-test',
        requireInteraction: priority === 'high',
        silent: false
      });

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Play sound
      await playNotificationSound(priority);

      // Store in database - with error handling
      try {
        const response = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'test_notification',
            title,
            message: body,
            priority
          })
        });

        if (!response.ok) {
          console.warn('API call failed, notification still shown locally');
        }
      } catch (apiError) {
        console.warn('API call failed:', apiError);
        // Continue - notification was still shown to user
      }

      // Auto-close notification after delay
      setTimeout(() => {
        try {
          notification.close();
        } catch (e) {
          // Notification might already be closed
          console.warn('Could not close test notification:', e);
        }
      }, priority === 'high' ? 10000 : 5000);

      toast({
        title: "✅ Notification Sent!",
        description: `${priority.charAt(0).toUpperCase() + priority.slice(1)} priority notification sent successfully!`,
      });

      // Refresh notifications list
      loadRecentNotifications();
      
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast({
        title: "Notification Failed",
        description: error instanceof Error ? error.message : "Please allow notifications when prompted by your browser",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const playNotificationSound = async (priority: 'low' | 'medium' | 'high') => {
    try {
      // Check if AudioContext is supported
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.warn('AudioContext not supported');
        return;
      }

      // Different sound patterns based on priority
      const soundConfig = {
        low: { frequency: 400, duration: 0.3, volume: 0.1, pattern: [{ freq: 400, dur: 0.3 }] },
        medium: { frequency: 600, duration: 0.5, volume: 0.2, pattern: [{ freq: 600, dur: 0.25 }, { freq: 600, dur: 0.25 }] },
        high: { frequency: 800, duration: 1.0, volume: 0.3, pattern: [
          { freq: 800, dur: 0.2 }, 
          { freq: 1000, dur: 0.2 }, 
          { freq: 800, dur: 0.2 }, 
          { freq: 1000, dur: 0.2 }, 
          { freq: 800, dur: 0.2 }
        ]}
      };

      const config = soundConfig[priority];
      const audioContext = new AudioContext();
      
      // Resume audio context if suspended (required for mobile)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Play sound pattern
      let startTime = audioContext.currentTime;
      
      for (const note of config.pattern) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(note.freq, startTime);
        oscillator.type = priority === 'high' ? 'square' : 'sine'; // Different waveform for high priority
        
        gainNode.gain.setValueAtTime(config.volume, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + note.dur);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + note.dur);
        
        startTime += note.dur + 0.1; // Small gap between notes
      }

      // Clean up
      setTimeout(() => {
        try {
          audioContext.close();
        } catch (e) {
          console.warn('Could not close audio context:', e);
        }
      }, (config.duration + 1) * 1000);

    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  };

  const acknowledgeNotification = async (notificationId: string) => {
    try {
      // Try to update via API first
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: notificationId,
          acknowledged: true
        })
      });

      if (!response.ok) {
        // Fallback to direct Supabase update
        const { error } = await supabase
          .from('notifications')
          .update({ acknowledged: true })
          .eq('id', notificationId);

        if (error) throw error;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, acknowledged: true }
            : n
        )
      );

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));

      toast({
        title: "✅ Notification Acknowledged",
        description: "Notification has been marked as read",
      });
    } catch (error) {
      console.error('Error acknowledging notification:', error);
      toast({
        title: "❌ Error",
        description: "Failed to acknowledge notification",
        variant: "destructive",
      });
    }
  };

  const acknowledgeAllNotifications = async () => {
    try {
      // Try to update via API first
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acknowledgeAll: true
        })
      });

      if (!response.ok) {
        // Fallback to direct Supabase update
        const { error } = await supabase
          .from('notifications')
          .update({ acknowledged: true })
          .eq('acknowledged', false);

        if (error) throw error;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, acknowledged: true }))
      );
      setUnreadCount(0);

      toast({
        title: "✅ All Notifications Acknowledged",
        description: "All notifications have been marked as read",
      });
    } catch (error) {
      console.error('Error acknowledging all notifications:', error);
      toast({
        title: "❌ Error",
        description: "Failed to acknowledge all notifications",
        variant: "destructive",
      });
    }
  };

  // Filter notifications based on search and filters
  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.body.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === "all" || notification.type === filterType;
    const matchesPriority = filterPriority === "all" || notification.priority === filterPriority;
    
    return matchesSearch && matchesType && matchesPriority;
  });

  const copyApiUrl = () => {
    const apiUrl = `${window.location.origin}/api/notifications`;
    navigator.clipboard.writeText(apiUrl);
    toast({
      title: "Copied!",
      description: "API URL copied to clipboard"
    });
  };

  const examplePayload = `{
  "type": "site_down",
  "title": "Site Down Alert", 
  "message": "example.com is not responding",
  "site": "example.com",
  "priority": "high",
  "timestamp": "${new Date().toISOString()}"
}`;

  return (
    <div className="min-h-screen bg-background">
      <Header unreadCount={unreadCount} />
      
      {/* Main container with proper spacing */}
      <main className="container mx-auto px-4 py-6">
        {/* Header with Settings, Notifications, and Logout */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Settings Icon */}
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Notifications Bell with Unread Count */}
            <Button 
              variant="outline" 
              size="sm" 
              className="relative flex items-center gap-2"
              onClick={() => { navigate('/notifications'); markAsRead(); }}
            >
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-bold"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
            
            {/* Logout Button */}
            <Button 
              onClick={handleLogout} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Topic Management */}
            <TopicManagement />

            {/* API Integration */}
            <Card>
              <CardHeader>
                <CardTitle>API Integration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Send notifications via API:
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-sm font-mono break-all">
                      POST {window.location.origin}/api/notifications
                    </code>
                    <Button variant="ghost" size="sm" onClick={copyApiUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Link to="/api-docs">
                  <Button variant="outline" className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    <span>API Documentation</span>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Recent Notifications */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Notifications</CardTitle>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <Button
                        onClick={acknowledgeAllNotifications}
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        disabled={isLoading}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Mark All Read
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { navigate('/notifications'); markAsRead(); }}
                      className="text-xs h-8"
                    >
                      View All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {/* Search and Filter Controls - Fixed Layout */}
              <div className="px-6 pb-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search notifications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="flex-1 h-9">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="flex-1 h-9">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <CardContent onClick={markAsRead}>
                {isLoading ? (
                  <div className="text-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm mt-2 text-muted-foreground">Loading notifications...</p>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="text-center py-6">
                    {searchTerm || filterType !== "all" || filterPriority !== "all" ? (
                      <>
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No notifications match your filters</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Try adjusting your search or filters
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground">No notifications yet</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Test notifications to see them here
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {filteredNotifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-4 rounded-lg border transition-all duration-200 ${
                          !n.acknowledged 
                            ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100 border-l-4 border-l-blue-500' 
                            : 'bg-muted/30 border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{n.title}</div>
                            {!n.acknowledged && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 font-medium flex-shrink-0">
                                New
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge 
                              variant={n.priority === 'high' ? 'destructive' : n.priority === 'medium' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {n.priority || 'medium'}
                            </Badge>
                            {!n.acknowledged && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  acknowledgeNotification(n.id);
                                }}
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100 border-blue-200"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-foreground/80 mb-2 leading-relaxed">{n.body}</div>
                        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                          {new Date(n.created_at).toLocaleString()}
                          {n.acknowledged && (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <Check className="h-3 w-3" />
                              Read
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notification Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-center">🔔 Notification Controls</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Button 
                  onClick={() => sendTestNotification('medium')} 
                  className="w-full mb-4 bg-primary hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send Test Alert"}
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => sendTestNotification('low')} 
                    className="text-xs"
                    disabled={isLoading}
                  >
                    Low Priority
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => sendTestNotification('medium')} 
                    className="text-xs"
                    disabled={isLoading}
                  >
                    Medium Priority
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => sendTestNotification('high')} 
                    className="text-xs"
                    disabled={isLoading}
                  >
                    High Priority
                  </Button>
                </div>
                {!notificationsEnabled && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Click test to enable browser notifications
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
