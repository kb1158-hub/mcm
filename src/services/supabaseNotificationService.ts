// src/services/supabaseNotificationService.ts
import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useSupabaseNotifications(userId: string, onNotification: (notif: any) => void) {
  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        payload => {
          onNotification(payload.new);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, onNotification]);
}
