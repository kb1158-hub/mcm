// mcm-alert-central/src/services/realTimeNotificationService.ts
import { supabase } from '../supabaseClient';

type Listener = (notification: RealTimeNotification) => void;

let channel: ReturnType<typeof supabase.channel> | null = null;
let activeListener: Listener | null = null;

export const realTimeNotificationService = {
  async initialize(userId: string) {
    if (!userId) {
      console.warn('[RTService] initialize() called without userId');
      return;
    }

    if (channel) {
      console.log('[RTService] Already initialized');
      return;
    }

    channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newNotif = payload.new;

          const realTimeNotification: RealTimeNotification = {
            id: String(newNotif.id),
            type: newNotif.type || 'alert',
            priority: newNotif.priority || 'medium',
            title: newNotif.title || 'MCM Alert',
            message: newNotif.message || '',
            timestamp: newNotif.created_at || new Date().toISOString(),
            data: newNotif.data || {}
          };

          if (activeListener) {
            activeListener(realTimeNotification);
          }
        }
      )
      .subscribe((status) => {
        console.log('[RTService] Supabase channel status:', status);
      });
  },

  addListener(callback: Listener) {
    activeListener = callback;
    return () => {
      activeListener = null;
    };
  },

  getConnectionStatus() {
    return {
      isConnected: !!channel,
      connectionType: 'supabase'
    };
  },

  disconnect() {
    if (channel) {
      supabase.removeChannel(channel);
      console.log('[RTService] Channel disconnected');
      channel = null;
    }
    activeListener = null;
  }
};
