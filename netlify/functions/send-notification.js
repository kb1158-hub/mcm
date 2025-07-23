const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rswwlwybqsinzckzwcpb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzd3dsd3licXNpbnpja3p3Y3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMzY0MjcsImV4cCI6MjA2ODcxMjQyN30.OFDBSFnSWbage9xI5plqis7RAFKnJPuzO1JWUHE7yDM';

const supabase = createClient(supabaseUrl, supabaseKey);

// VAPID keys - in production, these should be environment variables
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI0DLLuxazjqAKeFXjWWqlaGSb0TSa1TCEdqNB0NDrWJZnIa5oZUMoMJpE';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'your-vapid-private-key-here';

webpush.setVapidDetails(
  'mailto:admin@mcm-alerts.com',
  vapidPublicKey,
  vapidPrivateKey
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body);
      
      // Enhanced notification payload for mobile background notifications
      const notificationPayload = {
        title: payload.title || 'MCM Alert',
        body: payload.message || payload.body || 'New alert received',
        icon: '/mcm-logo-192.png',
        badge: '/mcm-logo-192.png',
        tag: 'mcm-background-alert',
        requireInteraction: payload.priority === 'high',
        silent: false, // Never silent for mobile sound support
        vibrate: payload.priority === 'high' ? [300, 100, 300, 100, 300] : 
                 payload.priority === 'low' ? [100] : [200, 100, 200],
        actions: [
          { action: 'view', title: 'View Dashboard', icon: '/mcm-logo-192.png' },
          { action: 'dismiss', title: 'Dismiss' }
        ],
        data: {
          url: '/',
          priority: payload.priority || 'medium',
          timestamp: Date.now(),
          source: 'api'
        }
      };

      // Log notification in database FIRST (for real-time updates)
      const { data: notificationData, error: logError } = await supabase
        .from('notifications')
        .insert([{
          title: notificationPayload.title,
          body: notificationPayload.body,
          type: payload.type || 'api_notification',
          priority: payload.priority || 'medium',
          metadata: payload,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (logError) {
        console.error('Failed to log notification:', logError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to store notification',
            details: logError.message 
          }),
        };
      }

      console.log('Notification stored successfully:', notificationData);

      // Fetch all subscribers for push notifications
      const { data: subs, error } = await supabase
        .from('subscriptions')
        .select('endpoint, keys');

      if (error) {
        console.error('Failed to fetch subscriptions:', error);
      } else {
        // Send push notifications to all subscribers in background
        const sendResults = await Promise.all(
          subs.map(async sub => {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: sub.keys
                },
                JSON.stringify(notificationPayload)
              );
              return { endpoint: sub.endpoint, success: true };
            } catch (err) {
              console.error('Push notification failed:', err);
              
              // Remove invalid subscriptions
              if (err.statusCode === 410 || err.statusCode === 404) {
                await supabase
                  .from('subscriptions')
                  .delete()
                  .eq('endpoint', sub.endpoint);
              }
              
              return { endpoint: sub.endpoint, success: false, error: err.message };
            }
          })
        );

        console.log('Push notification results:', sendResults);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Notification received, stored, and push notifications sent',
          notification: notificationData,
          pushResults: subs ? `${subs.length} subscribers notified` : 'No subscribers'
        }),
      };
    } catch (error) {
      console.error('Error processing notification:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Internal server error',
          details: error.message 
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};