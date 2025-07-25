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
import { unifiedNotificationService, UnifiedNotification } from '@/services/unifiedNotificationService';
import { LogOut, Copy, ExternalLink, Search, Filter, Check, Settings, Bell, User, ChevronDown, Menu, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { logout, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(unifiedNotificationService.getConnectionStatus());
  const navigate = useNavigate();

  useEffect(() => {
    initializeNotifications();
    loadRecentNotifications();
    setupNotificationListeners();
    
    // Status monitoring
    const statusInterval = setInterval(() => {
      setConnectionStatus(unifiedNotificationService.getConnectionStatus());
    }, 5000);

    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  const initializeNotifications = async () => {
    try {
      console.log('[Dashboard] Initializing notifications...');
      
      // Check if service is already initialized
      const status = unifiedNotificationService.getConnectionStatus();
      if (!status.isInitialized) {
        await unifiedNotificationService.initialize();
      }
      
      // Check notification permission
      if ('Notification' in window) {
        setNotificationsEnabled(Notification.permission === 'granted');
      }
      
      // Subscribe to push if supported
      if (status.push.supported && Notification.permission === 'granted') {
        await unifiedNotificationService.subscribeToPush();
      }
      
      console.log('[Dashboard] Notifications initialized successfully');
    } catch (error) {
      console.error('[Dashboard] Failed to initialize notifications:', error);
      setNotificationsEnabled(false);
    }
  };

  const setupNotificationListeners = () => {
    console.log('[Dashboard] Setting up notification listeners...');
    
    // Listen for in-app notifications
    const unsubscribeInApp = unifiedNotificationService.addInAppListener((notification) => {
      console.log('[Dashboard] In-app notification received:', notification);
      
      // Add to notifications list
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (!exists) {
          setUnreadCount(prevCount => prevCount + 1);
          
          // Show toast notification
          toast({
            title: `🔔 ${notification.title}`,
            description: notification.message || notification.body || 'New notification',
            duration: 5000,
          });
          
          return [notification, ...prev.slice(0, 49)];
        }
        return prev;
      });
    });

    // Listen for push notifications
    const unsubscribePush = unifiedNotificationService.addPushListener((notification) => {
      console.log('[Dashboard] Push notification received:', notification);
      
      // Add to notifications list
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (!exists) {
          setUnreadCount(prevCount => prevCount + 1);
          
          // Show toast notification
          toast({
            title: `📱 ${notification.title}`,
            description: notification.message || notification.body || 'New push notification',
            duration: 5000,
          });
          
          return [notification, ...prev.slice(0, 49)];
        }
        return prev;
      });
    });

    // Listen for global notification events
    const handleGlobalNotification = (event: CustomEvent) => {
      const { notification, type } = event.detail;
      console.log(`[Dashboard] Global ${type} notification:`, notification);
    };

    window.addEventListener('unified-notification-received', handleGlobalNotification as EventListener);

    return () => {
      unsubscribeInApp();
      unsubscribePush();
      window.removeEventListener('unified-notification-received', handleGlobalNotification as EventListener);
    };
  };

  const loadRecentNotifications = async () => {
    try {
      setIsLoading(true);
      console.log('[Dashboard] Loading recent notifications...');
      
      const recentNotifications = await unifiedNotificationService.getNotifications(50, 0, false);
      setNotifications(recentNotifications);
      
      const unreadCountFromService = await unifiedNotificationService.getUnreadCount();
      setUnreadCount(unreadCountFromService);
      
      console.log(`[Dashboard] Loaded ${recentNotifications.length} notifications, ${unreadCountFromService} unread`);
    } catch (error) {
      console.error('[Dashboard] Error loading notifications:', error);
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
    // Cleanup notification service
    unifiedNotificationService.disconnect();
    
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out"
    });
  };

  const sendTestNotification = async (priority: 'low' | 'medium' | 'high' | 'urgent') => {
    try {
      setIsLoading(true);
      console.log(`[Dashboard] Sending test notification with ${priority} priority...`);

      // Request permission if not already granted
      if (!notificationsEnabled) {
        const hasPermission = await unifiedNotificationService.requestNotificationPermission();
        if (!hasPermission) {
          toast({
            title: "Notifications Blocked",
            description: "Please allow notifications in your browser settings",
            variant: "destructive",
          });
          return;
        }
        setNotificationsEnabled(true);
      }

      // Send test notification using unified service
      const notification = await unifiedNotificationService.sendTestNotification(priority, true);
      
      toast({
        title: "✅ Test Notification Sent!",
        description: `${priority.charAt(0).toUpperCase() + priority.slice(1)} priority notification sent successfully!`,
      });

      console.log('[Dashboard] Test notification sent:', notification);
      
      // Reload notifications to show the new test notification
      await loadRecentNotifications();
      
    } catch (error: any) {
      console.error('[Dashboard] Test notification error:', error);
      toast({
        title: "Notification Failed",
        description: error?.message || "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const acknowledgeNotification = async (notificationId: string) => {
    try {
      console.log(`[Dashboard] Acknowledging notification: ${notificationId}`);
      
      await unifiedNotificationService.markAsRead(notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: true, acknowledged: true }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      toast({
        title: "✅ Notification Acknowledged",
        description: "Notification has been marked as read",
      });
    } catch (error) {
      console.error('[Dashboard] Error acknowledging notification:', error);
      toast({
        title: "❌ Error",
        description: "Failed to acknowledge notification",
        variant: "destructive",
      });
    }
  };

  const acknowledgeAllNotifications = async () => {
    try {
      console.log('[Dashboard] Acknowledging all notifications...');
      
      await unifiedNotificationService.markAllAsRead();

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, acknowledged: true }))
      );
      setUnreadCount(0);

      toast({
        title: "✅ All Notifications Acknowledged",
        description: "All notifications have been marked as read",
      });
    } catch (error) {
      console.error('[Dashboard] Error acknowledging all notifications:', error);
      toast({
        title: "❌ Error",
        description: "Failed to acknowledge all notifications",
        variant: "destructive",
      });
    }
  };

  const markAsRead = async () => {
    if (unreadCount > 0) {
      await acknowledgeAllNotifications();
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (notification.message || notification.body || '').toLowerCase().includes(searchTerm.toLowerCase());

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
                <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${
                  connectionStatus.supabase.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}></div>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">MCM Alerts</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {connectionStatus.isInitialized ? 'Real-time Monitoring System' : 'Initializing...'}
                </p>
              </div>
            </div>

            {/* Center: Status Indicators (hidden on mobile) */}
            <div className="hidden lg:flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                connectionStatus.supabase.isConnected 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className={`h-2 w-2 rounded-full ${
                  connectionStatus.supabase.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}></div>
                <span className={`text-xs font-medium ${
                  connectionStatus.supabase.isConnected 
                    ? 'text-green-700 dark:text-green-300' 
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {connectionStatus.supabase.isConnected ? 'System Online' : 'System Offline'}
                </span>
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
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    connectionStatus.supabase.isConnected 
                      ? 'bg-green-50 dark:bg-green-900/20' 
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}>
                    <div className={`h-2 w-2 rounded-full ${
                      connectionStatus.supabase.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`}></div>
                    <span className={`text-sm font-medium ${
                      connectionStatus.supabase.isConnected 
                        ? 'text-green-700 dark:text-green-300' 
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {connectionStatus.supabase.isConnected ? 'System Online' : 'System Offline'}
                    </span>
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

            {/* Connection Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${
                      connectionStatus.isInitialized ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-sm">Service: {connectionStatus.isInitialized ? 'Ready' : 'Initializing'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${
                      connectionStatus.supabase.isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-sm">Database: {connectionStatus.supabase.isConnected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${
                      connectionStatus.push.supported ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <span className="text-sm">Push: {connectionStatus.push.supported ? 'Supported' : 'Not Supported'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${
                      connectionStatus.push.pushSubscribed ? 'bg-green-500' : 'bg-yellow-500'
                    }`}></div>
                    <span className="text-sm">Subscription: {connectionStatus.push.pushSubscribed ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  In-App Listeners: {connectionStatus.listeners.inApp} | Push Listeners: {connectionStatus.listeners.push}
                </div>
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
                      <SelectItem value="api">API</SelectItem>
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
                      <SelectItem value="urgent">Urgent</SelectItem>
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
                              !n.is_read 
                                ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100 border-l-4 border-l-blue-500' 
                                : 'bg-muted/30 border-border'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate">{n.title}</div>
                                {!n.is_read && (
                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 font-medium flex-shrink-0">
                                    New
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge 
                                  variant={
                                    n.priority === 'urgent' || n.priority === 'high' ? 'destructive' : 
                                    n.priority === 'medium' ? 'secondary' : 'outline'
                                  }
                                  className="text-xs"
                                >
                                  {n.priority || 'medium'}
                                </Badge>
                                {!n.is_read && (
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
                            <div className="text-sm text-foreground/80 mb-2 leading-relaxed">
                              {n.message || n.body || 'No message'}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                              {new Date(n.created_at).toLocaleString()}
                              {n.is_read && (
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
                <div className="grid grid-cols-2 gap-2 mb-4">
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
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => sendTestNotification('high')} 
                    className="text-xs"
                    disabled={isLoading}
                  >
                    High Priority
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => sendTestNotification('urgent')} 
                    className="text-xs bg-red-600 hover:bg-red-700"
                    disabled={isLoading}
                  >
                    Urgent Priority
                  </Button>
                </div>
                {!notificationsEnabled && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Click any button to enable browser notifications
                  </p>
                )}
                {!connectionStatus.isInitialized && (
                  <p className="text-xs text-yellow-600 mt-2 text-center">
                    Notification service is still initializing...
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
