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
          <ul>
            {notifications.map((n) => (
              <li key={n.id} style={{ marginBottom: 8 }}>
                <strong>{n.title}</strong> - {n.body}{' '}
                <span style={{ fontSize: 12, color: '#888' }}>
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default AllNotifications;
