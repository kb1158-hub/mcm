// src/App.tsx
import { useEffect, useRef, useState } from 'react';
import { useSupabaseNotifications } from './services/supabaseNotificationService';
import { registerServiceWorker, showBrowserNotification } from './services/pushNotificationService';

const VAPID_PUBLIC_KEY = '<YOUR_VAPID_PUBLIC_KEY>';

function App() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userId] = useState('<CURRENT_USER_ID>'); // Replace with your auth/user context

  const playSound = () => {
    const audio = new Audio('/notification.mp3'); // Place your sound file in public/
    audio.play();
  };

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useSupabaseNotifications(userId, notification => {
    setNotifications(prev => [notification, ...prev]);
    playSound();
    if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      showBrowserNotification({
        title: notification.title || 'New Notification',
        body: notification.body || '',
        url: notification.url
      });
    }
  });

  return (
    <div>
      <h1>Notifications Center</h1>
      <ul>
        {notifications.map(notif => (
          <li key={notif.id}>
            <strong>{notif.title}</strong>
            <p>{notif.body}</p>
          </li>
        ))}
      </ul>
      {/* You can add NotificationSettingsDialog here if desired */}
    </div>
  );
}

export default App;
