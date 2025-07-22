import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { pushService } from '@/services/pushNotificationService';
import { Bell, LogOut, Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    initializePushNotifications();
  }, []);

  const initializePushNotifications = async () => {
    await pushService.initialize();
    
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    });
  };

  const enableNotifications = async () => {
    const permission = await pushService.requestPermission();
    if (permission) {
      await pushService.subscribe();
      setNotificationsEnabled(true);
      toast({
        title: "Notifications Enabled",
        description: "Push notifications have been enabled successfully",
      });
    } else {
      toast({
        title: "Permission Denied",
        description: "Please enable notifications in your browser settings",
        variant: "destructive",
      });
    }
  };

  const sendTestNotification = async () => {
    if (notificationsEnabled) {
      await pushService.sendTestNotification();
      toast({
        title: "Test Notification Sent",
        description: "Check your browser for the notification",
      });
    } else {
      toast({
        title: "Notifications Disabled",
        description: "Please enable notifications first",
        variant: "destructive",
      });
    }
  };

  const mockAlerts = [
    { id: 1, title: "Website Down", description: "example.com is not responding", status: "critical", time: "2 minutes ago" },
    { id: 2, title: "Server Load High", description: "CPU usage above 90%", status: "warning", time: "15 minutes ago" },
    { id: 3, title: "Service Restored", description: "API service back online", status: "resolved", time: "1 hour ago" },
    { id: 4, title: "Database Connected", description: "Connection established successfully", status: "info", time: "2 hours ago" },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'warning': return <Clock className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      case 'resolved': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header showSignIn={false} />
      
      <div className="container mx-auto px-6 py-8">
        {/* Header with Logout */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Monitor your alerts and system status</p>
          </div>
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2</div>
              <p className="text-xs text-muted-foreground">+1 from last hour</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Services Monitored</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">All systems</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">99.9%</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Clock className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">245ms</div>
              <p className="text-xs text-muted-foreground">Average</p>
            </CardContent>
          </Card>
        </div>

        {/* Notification Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Push Notifications</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Push Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive real-time alerts even when the browser is closed
                </p>
              </div>
              <Button
                onClick={enableNotifications}
                disabled={notificationsEnabled}
                variant={notificationsEnabled ? "outline" : "default"}
              >
                {notificationsEnabled ? "Enabled" : "Enable"}
              </Button>
            </div>
            
            {notificationsEnabled && (
              <Button 
                onClick={sendTestNotification}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Send Test Notification
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(alert.status)}
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusVariant(alert.status) as any}>
                      {alert.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;