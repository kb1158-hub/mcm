import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import TopicManagement from '@/components/TopicManagement';
import { pushService } from '@/services/pushNotificationService';
import { LogOut, Copy, ExternalLink, Search, Filter, Check, Settings, Bell, User, ChevronDown, Menu, X } from 'lucide-react';
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
  const { logout, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    initializePushNotifications();
    loadRecentNotifications();

    // Set up real-time subscription for notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          // Avoid duplicate notifications
          setNotifications(prev => [payload.new as Notification, ...prev.filter(n => n.id !== payload.new.id)].slice(0, 5));
          setUnreadCount(prev => prev + 1);

          if ('Notification' in window && Notification.permission === 'granted') {
            showBrowserNotification(payload.new as Notification);
          } else {
            playNotificationSound((payload.new as Notification).priority || 'medium');
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
      // Clean up subscription; Supabase v2 uses .unsubscribe()
      channel.unsubscribe && channel.unsubscribe();
    };
    // eslint-disable-next-line
  }, []);

  // Acknowledge all notifications when marking as read
  const markAsRead = async () => {
    if (unreadCount > 0) {
      await acknowledgeAllNotifications();
    }
  };

  const showDirectNotification = async (notification: Notification) => {
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

    browserNotification.onclick = () => {
      window.focus();
      browserNotification.close();
    };

    setTimeout(() => {
      try {
        browserNotification.close();
      } catch (e) {}
    }, notification.priority === 'high' ? 10000 : 5000);
  };

  const showBrowserNotification = async (notification: Notification) => {
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      await playNotificationSound(notification.priority || 'medium');
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(notification.title, {
            body: notification.body,
            icon: '/mcm-logo-192.png',
            badge: '/mcm-logo-192.png',
            tag: 'mcm-realtime',
            requireInteraction: notification.priority === 'high',
            silent: false,
            vibrate: notification.priority === 'high' ? [300, 100, 300, 100, 300] : [200, 100, 200],
            data: {
              priority: notification.priority,
              timestamp: Date.now(),
              url: window.location.origin
            },
            actions: notification.priority === 'high' ? [
              { action: 'acknowledge', title: 'Acknowledge', icon: '/mcm-logo-192.png' }
            ] : []
          });
        } catch (swError) {
          await showDirectNotification(notification);
        }
      } else {
        await showDirectNotification(notification);
      }

      toast({
        title: `🔔 ${notification.title}`,
        description: notification.body,
        duration: 5000,
      });

    } catch (error) {
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
    } catch {
      setNotificationsEnabled(false);
    }
  };

  const loadRecentNotifications = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const notificationsWithAck = (data || []).map(n => ({
        ...n,
        acknowledged: n.acknowledged || false
      }));

      setNotifications(notificationsWithAck);
      setUnreadCount(notificationsWithAck.filter(n => !n.acknowledged).length);
    } catch (err) {
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

      if (!('Notification' in window)) {
        toast({
          title: "Notifications Not Supported",
          description: "Your browser does not support notifications",
          variant: "destructive",
        });
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          title: "Notifications Blocked",
          description: "Please click 'Allow' in the browser dialog to enable notifications",
          variant: "destructive",
        });
        return;
      }

      setNotificationsEnabled(true);

      const title = `MCM Alert - ${priority.toUpperCase()} Priority`;
      const body = `Test notification (${priority} priority) - ${new Date().toLocaleTimeString()}`;

      await playNotificationSound(priority);

      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;

          await registration.showNotification(title, {
            body,
            icon: '/mcm-logo-192.png',
            badge: '/mcm-logo-192.png',
            tag: 'mcm-test',
            requireInteraction: priority === 'high',
            silent: false,
            data: {
              priority,
              timestamp: Date.now(),
              url: window.location.origin
            },
            actions: priority === 'high' ? [
              { action: 'acknowledge', title: 'Acknowledge' }
            ] : []
          });
        } catch (swError) {
          const notification = new Notification(title, {
            body,
            icon: '/mcm-logo-192.png',
            badge: '/mcm-logo-192.png',
            tag: 'mcm-test',
            requireInteraction: priority === 'high',
            silent: false
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };

          setTimeout(() => {
            try {
              notification.close();
            } catch (e) {}
          }, priority === 'high' ? 10000 : 5000);
        }
      } else {
        const notification = new Notification(title, {
          body,
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png',
          tag: 'mcm-test',
          requireInteraction: priority === 'high',
          silent: false
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        setTimeout(() => {
          try {
            notification.close();
          } catch (e) {}
        }, priority === 'high' ? 10000 : 5000);
      }

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
          // Still show locally even if API fails
        }
      } catch {}

      toast({
        title: "✅ Notification Sent!",
        description: `${priority.charAt(0).toUpperCase() + priority.slice(1)} priority notification sent successfully!`,
      });

      loadRecentNotifications();
    } catch (error: any) {
      toast({
        title: "Notification Failed",
        description: error?.message || "Please allow notifications when prompted by your browser",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const playNotificationSound = async (priority: 'low' | 'medium' | 'high') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;

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
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      let startTime = audioContext.currentTime;
      for (const note of config.pattern) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(note.freq, startTime);
        oscillator.type = priority === 'high' ? 'square' : 'sine';
        gainNode.gain.setValueAtTime(config.volume, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + note.dur);
        oscillator.start(startTime);
        oscillator.stop(startTime + note.dur);
        startTime += note.dur + 0.1;
      }
      setTimeout(() => {
        try {
          audioContext.close();
        } catch (e) {}
      }, (config.duration + 1) * 1000);

    } catch {}
  };

  const acknowledgeNotification = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: notificationId,
          acknowledged: true
        })
      });

      if (!response.ok) {
        const { error } = await supabase
          .from('notifications')
          .update({ acknowledged: true })
          .eq('id', notificationId);

        if (error) throw error;
      }

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, acknowledged: true }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      toast({
        title: "✅ Notification Acknowledged",
        description: "Notification has been marked as read",
      });
    } catch {
      toast({
        title: "❌ Error",
        description: "Failed to acknowledge notification",
        variant: "destructive",
      });
    }
  };

  const acknowledgeAllNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgeAll: true })
      });

      if (!response.ok) {
        const { error } = await supabase
          .from('notifications')
          .update({ acknowledged: true })
          .eq('acknowledged', false);

        if (error) throw error;
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, acknowledged: true }))
      );
      setUnreadCount(0);

      toast({
        title: "✅ All Notifications Acknowledged",
        description: "All notifications have been marked as read",
      });
    } catch {
      toast({
        title: "❌ Error",
        description: "Failed to acknowledge all notifications",
        variant: "destructive",
      });
    }
  };

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

  // Prepare user display values (with fallback)
  const displayName = 'MCM User';
  const userEmail = 'user@mcm-alerts.com';

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-2 md:px-4 py-6">

        {/* Enhanced Header Bar with Better UX/UI */}
        <header className="bg-card/80 backdrop-blur-md border border-border/50 rounded-xl p-4 mb-6 shadow-lg">
          <div className="flex items-center justify-between">
            {/* Left: Logo + App Name */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src="/mcm-logo-192.png" 
                  alt="MCM Logo" 
                  className="h-8 w-8 rounded-lg shadow-sm ring-2 ring-primary/10" 
                />
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">MCM Alerts</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Real-time Monitoring System</p>
              </div>
            </div>

            {/* Center: Status Indicators (hidden on mobile) */}
            <div className="hidden lg:flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200 dark:border-green-800">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-700 dark:text-green-300">System Online</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-200 dark:border-blue-800">
                <Bell className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  {notificationsEnabled ? 'Notifications On' : 'Notifications Off'}
                </span>
              </div>
            </div>

            {/* Right: Actions + User Menu */}
            <div className="flex items-center gap-2">
              {/* Notifications Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { navigate('/notifications'); markAsRead(); }} 
                className="relative hover:bg-accent/50 transition-colors"
                aria-label="View notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold animate-bounce"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>

              {/* Desktop User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="hidden md:flex">
                  <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-accent/50 transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="/placeholder-avatar.png" alt="User" />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                        {displayName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden lg:block text-left">
                      <p className="text-sm font-medium leading-none">{displayName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center gap-2 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="/placeholder-avatar.png" alt="User" />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {displayName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{displayName}</p>
                      <p className="text-xs text-muted-foreground">{userEmail}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/api-docs')} className="cursor-pointer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    <span>API Documentation</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t border-border">
              <div className="flex flex-col space-y-3">
                {/* User Info */}
                <div className="flex items-center gap-3 p-3 bg-accent/10 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="/placeholder-avatar.png" alt="User" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {displayName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">System Online</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Bell className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {notificationsEnabled ? 'Notifications Enabled' : 'Notifications Disabled'}
                    </span>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="flex flex-col space-y-1">
                  <Button 
                    variant="ghost" 
                    className="justify-start h-auto py-3 px-3" 
                    onClick={() => { navigate('/settings'); setMobileMenuOpen(false); }}
                  >
                    <Settings className="mr-3 h-4 w-4" />
                    <span>Settings</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="justify-start h-auto py-3 px-3" 
                    onClick={() => { navigate('/api-docs'); setMobileMenuOpen(false); }}
                  >
                    <ExternalLink className="mr-3 h-4 w-4" />
                    <span>API Documentation</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="justify-start h-auto py-3 px-3 text-destructive hover:text-destructive hover:bg-destructive/10" 
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    <span>Sign Out</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
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
              
              {/* Search and Filter Controls */}
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
              
              <CardContent className="p-0">
                <div className="px-6 pb-4" onClick={markAsRead}>
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
                    <div className="max-h-96 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      <div className="space-y-3 pr-2">
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
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Notification Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-center">🔔 Notification Controls</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
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
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Click any button to enable browser notifications
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
