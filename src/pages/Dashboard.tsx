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
import { LogOut, Copy, ExternalLink, Search, Filter, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchRecentNotifications, addNotification, supabase } from '@/services/notificationService';

const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
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
          setNotifications(prev => [payload.new, ...prev.slice(0, 4)]);
          // Increment unread count
          setUnreadCount(prev => prev + 1);
          
          // Show browser notification if enabled
          if ('Notification' in window && Notification.permission === 'granted') {
            showBrowserNotification(payload.new);
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
  const showBrowserNotification = async (notification) => {
    try {
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

      // Auto-close after delay
      setTimeout(() => {
        try {
          browserNotification.close();
        } catch (e) {
          // Notification might already be closed
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
    }
  };

  const initializePushNotifications = async () => {
    await pushService.initialize();
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  };

  const loadRecentNotifications = async () => {
    try {
      const { data, error } = await supabase 
        .from('notifications')
        .select('*, acknowledged')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.acknowledged).length || 0);
    } catch (err) {
      setNotifications([]);
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

      // Play sound
      await playNotificationSound(priority);

      // Store in database
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'test_notification',
          title,
          message: body,
          priority
        })
      });

      // Auto-close notification after delay
      setTimeout(() => {
        try {
          notification.close();
        } catch (e) {
          // Notification might already be closed
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
        description: error.message || "Please allow notifications when prompted by your browser",
        variant: "destructive",
      });
    }
  };

  const playNotificationSound = async (priority: 'low' | 'medium' | 'high') => {
    try {
      const frequency = priority === 'high' ? 800 : priority === 'medium' ? 600 : 400;
      const duration = priority === 'high' ? 1.0 : 0.5;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume audio context if suspended (required for mobile)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';
      
      const volume = priority === 'high' ? 0.3 : priority === 'medium' ? 0.2 : 0.1;
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  };

  const acknowledgeNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ acknowledged: true })
        .eq('id', notificationId);

      if (error) throw error;

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
      const { error } = await supabase
        .from('notifications')
        .update({ acknowledged: true })
        .eq('acknowledged', false);

      if (error) throw error;

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
      <div className="container mx-auto px-4 py-6">
        {/* Header with Logout */}
        <div className="flex items-center justify-end mb-6">
          <Button onClick={handleLogout} variant="outline" className="flex items-center space-x-2">
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
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
              <CardContent className="space-y-3">
                <p className="text-muted-foreground">
                  Send notifications via API:
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-sm font-mono">POST {window.location.origin}/api/notifications</code>
                    <Button variant="ghost" size="sm" onClick={copyApiUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Link to="/api-docs">
                  <Button variant="outline" className="flex items-center space-x-2">
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Recent Notifications</CardTitle>
                <div className="flex gap-2">
                  {unreadCount > 0 && (
                    <Button
                      onClick={acknowledgeAllNotifications}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Mark All Read
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { navigate('/notifications'); markAsRead(); }}>
                    View All
                  </Button>
                </div>
                
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search notifications..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-32">
                        <Filter className="h-4 w-4 mr-1" />
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
                      <SelectTrigger className="w-32">
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
              </CardHeader>
              <CardContent onClick={markAsRead}>
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-6">
                    {searchTerm || filterType !== "all" || filterPriority !== "all" ? (
                      <>
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No notifications match your filters</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
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
                  <div className="space-y-2">
                    {filteredNotifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-3 rounded-lg border-l-4 border-l-primary transition-all duration-200 ${
                          !n.acknowledged 
                            ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100' 
                            : 'bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm">{n.title}</div>
                            {!n.acknowledged && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                New
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={n.priority === 'high' ? 'destructive' : n.priority === 'medium' ? 'secondary' : 'outline'}>
                              {n.priority || 'medium'}
                            </Badge>
                            {!n.acknowledged && (
                              <Button
                                onClick={() => acknowledgeNotification(n.id)}
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{n.body}</div>
                        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                          {new Date(n.created_at).toLocaleString()}
                          {n.acknowledged && (
                            <span className="flex items-center gap-1 text-green-600">
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

            {/* Test Notification */}
            <Card>
              <CardHeader>
                <CardTitle className="text-center">🔔 Test Notifications</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Button onClick={() => sendTestNotification('medium')} className="w-full mb-4 bg-primary hover:bg-primary/90">
                  Test Notification
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" onClick={() => sendTestNotification('low')} className="text-xs">
                    Low
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => sendTestNotification('medium')} className="text-xs">
                    Medium
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => sendTestNotification('high')} className="text-xs">
                    High
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;