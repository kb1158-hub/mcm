// Create these files in your netlify/functions directory:

// netlify/functions/notifications-test.js
exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      
      // Simulate sending a real-time notification
      const notification = {
        id: `test-${Date.now()}`,
        type: body.type || 'test',
        priority: body.priority || 'medium',
        title: body.title || 'Test Notification',
        message: body.message || 'This is a test notification',
        timestamp: new Date().toISOString(),
        data: body.data || {}
      };

      console.log('Test notification created:', notification);

      // In a real app, you would:
      // 1. Store the notification in a database
      // 2. Send push notifications to subscribed clients
      // 3. Broadcast via WebSocket/SSE to connected clients

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          notification,
          message: 'Test notification sent successfully'
        })
      };
    } catch (error) {
      console.error('Error sending test notification:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: error.message 
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

// netlify/functions/notifications-stream.js
// This is a simplified version - for production you'd want Redis/Database
let clients = [];
let notifications = [];

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === 'GET') {
    // Server-Sent Events endpoint
    const sseHeaders = {
      ...headers,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    };

    // In a real implementation, you'd maintain persistent connections
    // For Netlify functions, we'll simulate with immediate response
    const recentNotifications = notifications.slice(-5); // Last 5 notifications
    
    let sseData = '';
    recentNotifications.forEach(notification => {
      sseData += `data: ${JSON.stringify(notification)}\n\n`;
    });

    return {
      statusCode: 200,
      headers: sseHeaders,
      body: sseData
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

// netlify/functions/notifications-poll.js
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === 'GET') {
    try {
      const since = parseInt(event.queryStringParameters?.since || '0');
      
      // In a real app, you'd query your database for notifications since timestamp
      const mockNotifications = [
        {
          id: `poll-${Date.now()}`,
          type: 'system',
          priority: 'low',
          title: 'System Update',
          message: 'System is running smoothly',
          timestamp: new Date().toISOString()
        }
      ].filter(n => new Date(n.timestamp).getTime() > since);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(mockNotifications)
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

// netlify/functions/subscribe.js
// Store push subscriptions (in production, use a database)
let subscriptions = [];

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === 'POST') {
    try {
      const subscription = JSON.parse(event.body || '{}');
      
      // Validate subscription data
      if (!subscription.endpoint || !subscription.keys) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Invalid subscription data' 
          })
        };
      }

      // Store subscription (in production, save to database)
      const existingIndex = subscriptions.findIndex(s => s.endpoint === subscription.endpoint);
      if (existingIndex >= 0) {
        subscriptions[existingIndex] = subscription;
      } else {
        subscriptions.push(subscription);
      }

      console.log(`Stored push subscription. Total subscriptions: ${subscriptions.length}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Subscription stored successfully',
          subscriptionCount: subscriptions.length
        })
      };
    } catch (error) {
      console.error('Error storing subscription:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: error.message 
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

// netlify/functions/heartbeat.js
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      
      // In production, you'd update the subscription's last_seen timestamp
      console.log('Heartbeat received from:', body.endpoint);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          timestamp: Date.now()
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: error.message 
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

// netlify/functions/send-push.js
// This would be used by your backend systems to send push notifications
const webpush = require('web-push');

// Configure web-push (you'll need to set these as environment variables)
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI0DLLuxazjqAKeFXjWWqlaGSb0TSa1TCEdqNB0NDrWJZnIa5oZUMoMJpE',
  process.env.VAPID_PRIVATE_KEY || 'your-private-key-here'
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { title, message, priority = 'medium', data = {} } = body;

      const notificationPayload = {
        title,
        body: message,
        priority,
        icon: '/mcm-logo-192.png',
        badge: '/mcm-logo-192.png',
        tag: `mcm-alert-${Date.now()}`,
        data: {
          ...data,
          timestamp: Date.now(),
          url: '/'
        }
      };

      // In production, you'd get subscriptions from your database
      // For now, we'll use the in-memory array
      let successCount = 0;
      let failureCount = 0;

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(subscription, JSON.stringify(notificationPayload));
          successCount++;
        } catch (error) {
          console.error('Failed to send push notification:', error);
          failureCount++;
          
          // Remove invalid subscriptions
          if (error.statusCode === 410) {
            subscriptions = subscriptions.filter(s => s.endpoint !== subscription.endpoint);
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Push notifications sent',
          successCount,
          failureCount,
          totalSubscriptions: subscriptions.length
        })
      };
    } catch (error) {
      console.error('Error sending push notifications:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: error.message 
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
