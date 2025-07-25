// mcm-alert-central/src/services/realTimeNotificationService.ts
import { supabase } from '../supabaseClient';
import { RealtimeChannel, RealtimeChannelState, RealtimeChannelStatus } from '@supabase/supabase-js';

type Listener = (notification: RealTimeNotification) => void;

let channel: RealtimeChannel | null = null;
let activeListener: Listener | null = null;

// New state variables for reconnection management
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10; // Max number of times to retry
const BASE_RECONNECT_DELAY = 1000; // 1 second
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Function to handle the actual subscription process
function subscribeToChannel(userId: string) {
    if (!userId) {
        console.warn('[RTService] subscribeToChannel() called without userId');
        return;
    }

    // Clear any previous channel if it somehow wasn't removed cleanly
    if (channel) {
        supabase.removeChannel(channel);
        channel = null;
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
                reconnectAttempts = 0; // Reset attempts on successful data reception
                clearTimeout(reconnectTimeoutId); // Clear any pending reconnects
            }
        )
        .subscribe((status, err) => { // Added 'err' parameter here!
            console.log('[RTService] Supabase channel status:', status);
            if (err) {
                console.error('[RTService] Supabase channel error details:', err); // Log the error!
            }

            if (status === 'SUBSCRIBED') {
                console.log('[RTService] Successfully subscribed to channel!');
                reconnectAttempts = 0; // Reset attempts on successful subscription
                clearTimeout(reconnectTimeoutId); // Clear any pending reconnects
            } else if (
                status === RealtimeChannelStatus.ChannelError || // 'CHANNEL_ERROR'
                status === RealtimeChannelStatus.Closed ||      // 'CLOSED'
                status === RealtimeChannelStatus.TimedOut       // 'TIMED_OUT'
            ) {
                console.warn(`[RTService] Channel disconnected or errored: ${status}. Attempting to reconnect...`);
                
                // Clear any existing reconnect timeout to prevent multiple
                clearTimeout(reconnectTimeoutId); 

                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
                    const actualDelay = Math.min(delay, 30000); // Cap delay at 30 seconds
                    console.log(`[RTService] Retrying in ${actualDelay / 1000} seconds... (Attempt ${reconnectAttempts})`);

                    reconnectTimeoutId = setTimeout(() => {
                        console.log(`[RTService] Executing reconnect attempt ${reconnectAttempts}...`);
                        // Call initialize again to re-attempt the subscription
                        // Ensure initialize can handle being called multiple times gracefully
                        realTimeNotificationService.initialize(userId);
                    }, actualDelay);
                } else {
                    console.error('[RTService] Max reconnection attempts reached. Giving up on Realtime notifications.');
                    // Optionally, inform the user or log to an error tracking service (e.g., Sentry)
                    // You might also want to call realTimeNotificationService.disconnect() here
                    // to explicitly clean up resources if you're truly giving up.
                }
            }
        });
}


export const realTimeNotificationService = {
    async initialize(userId: string) {
        if (!userId) {
            console.warn('[RTService] initialize() called without userId. Realtime will not be started.');
            return;
        }

        // Only proceed if a channel is not currently attempting to subscribe or is already subscribed
        // The previous `if (channel)` check only saw if the variable was set.
        // We need to know if it's actually in a connected state.
        // The `getConnectionStatus().isConnected` check is better for this.
        const currentStatus = realTimeNotificationService.getConnectionStatus();
        if (channel && currentStatus.isConnected) { // if channel exists and is connected
            console.log('[RTService] Already initialized and connected');
            return;
        }
        
        // If it's not connected, or channel is null, proceed to subscribe
        console.log('[RTService] Initializing Realtime service...');
        // Clear any previous reconnection timeouts if a new explicit initialize call is made
        clearTimeout(reconnectTimeoutId); 
        reconnectAttempts = 0; // Reset attempts for a fresh start

        subscribeToChannel(userId); // Call the new subscription function
    },

    addListener(callback: Listener) {
        activeListener = callback;
        return () => {
            activeListener = null;
        };
    },

    getConnectionStatus() {
        const isConnected = channel?.status === RealtimeChannelStatus.Subscribed;
        // Or if you want to be more nuanced, check for 'joining' too
        // const isConnected = channel?.status === RealtimeChannelStatus.Subscribed || channel?.status === RealtimeChannelStatus.Joining;
        
        // Return more detailed status if channel exists
        return {
            isConnected: isConnected,
            connectionType: 'supabase',
            channelStatus: channel ? channel.status : 'disconnected', // Add current channel status
            reconnectAttempts: reconnectAttempts // Add reconnect attempt count
        };
    },

    disconnect() {
        if (channel) {
            supabase.removeChannel(channel);
            console.log('[RTService] Channel disconnected');
            channel = null;
        }
        activeListener = null;
        clearTimeout(reconnectTimeoutId); // Clear any pending reconnects
        reconnectAttempts = 0; // Reset attempts
    }
};
