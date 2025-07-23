import React, { useEffect, useState } from 'react';
import { fetchAllNotifications } from '@/services/notificationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AllNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchAllNotifications().then(setNotifications);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p>No notifications found.</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className="p-4 bg-muted/50 rounded-lg border">
                <div className="font-semibold text-foreground mb-2">{n.title}</div>
                <div className="text-muted-foreground mb-3">{n.body}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
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
