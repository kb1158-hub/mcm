// src/components/NotificationSettingsDialog.tsx
import { useState } from 'react';

export default function NotificationSettingsDialog() {
  const [status, setStatus] = useState(Notification.permission);

  const request = async () => {
    const p = await Notification.requestPermission();
    setStatus(p);
  };

  return (
    <div>
      <h2>Push Notifications</h2>
      <p>Status: {status}</p>
      {status !== 'granted' && (
        <button onClick={request}>Enable Push Notifications</button>
      )}
    </div>
  );
}
