// mcm-alert-central/src/services/realTimeNotificationService.ts
import { supabase } from '../supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js'; 

type Listener = (notification: RealTimeNotification) => void;

let channel: RealtimeChannel | null = null;
let activeListener: Listener | null = null;
// Track the last known successful status, or 'disconnected' initially
let lastChannelStatus: string = 'disconnected'; 

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
                lastChannelStatus = 'SUBSCRIBED'; // Update status on successful data
            }
        )
        .subscribe((status, err) => { // Added 'err' parameter here!
            console.log('[RTService] Supabase channel status:', status);
            lastChannelStatus = status; // Always update the last known status

            if (err) {
                // IMPORTANT: If err is an object, stringify it to see full details
                console.error('[RTService] Supabase channel error details:', JSON.stringify(err, null, 2)); 
            }

            if (status === 'SUBSCRIBED') {
                console.log('[RTService] Successfully subscribed to channel!');
                reconnectAttempts = 0; // Reset attempts on successful subscription
                clearTimeout(reconnectTimeoutId); // Clear any pending reconnects
            } else if (
                status === 'CHANNEL_ERROR' || 
                status === 'CLOSED' ||        
                status === 'TIMED_OUT'        
            ) {
                console.warn(`[RTService] Channel disconnected or errored: ${status}. Attempting to reconnect...`);
                
                clearTimeout(reconnectTimeoutId); 

                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
                    const actualDelay = Math.min(delay, 30000); // Cap delay at 30 seconds
                    console.log(`[RTService] Retrying in ${actualDelay / 1000} seconds... (Attempt ${reconnectAttempts})`);

                    reconnectTimeoutId = setTimeout(() => {
                        console.log(`[RTService] Executing reconnect attempt ${reconnectAttempts}...`);
                        realTimeNotificationService.initialize(userId); // Re-initialize
                    }, actualDelay);
                } else {
                    console.error('[RTService] Max reconnection attempts reached. Giving up on Realtime notifications.');
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

        // Use the `lastChannelStatus` to check if already connected,
        // as `channel.status()` seems to be problematic.
        // If `channel` exists and the last known status was 'SUBSCRIBED'
        // or 'JOINING' (which means it's actively trying to connect/already connected)
        if (channel && (lastChannelStatus === 'SUBSCRIBED' || lastChannelStatus === 'JOINING')) { 
            console.log('[RTService] Already initialized and connected');
            return;
        }
        
        console.log('[RTService] Initializing Realtime service...');
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
        // Report status based on the `lastChannelStatus` variable
        const isConnected = lastChannelStatus === 'SUBSCRIBED';
        
        return {
            isConnected: isConnected,
            connectionType: 'supabase',
            channelStatus: lastChannelStatus, // Report the last known status
            reconnectAttempts: reconnectAttempts 
        };
    },

    disconnect() {
        if (channel) {
            supabase.removeChannel(channel);
            console.log('[RTService] Channel disconnected');
            channel = null;
        }
        activeListener = null;
        clearTimeout(reconnectTimeoutId); 
        reconnectAttempts = 0; 
        lastChannelStatus = 'disconnected'; // Reset status on explicit disconnect
    }
};
