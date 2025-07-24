// Create: netlify/functions/notifications-check.js

// In-memory storage for demo (use database in production)
let notifications = [];
let notificationCounter = 0;

// Simulate some background process that creates notifications
const simulateBackgroundAlerts = () => {
  const alertTypes = [
    { type: 'alert', priority: 'high', title: 'Critical System Alert', message: 'High memory usage detected on server' },
    { type: 'price_change', priority: 'medium', title: 'Price Alert', message: 'Stock XYZ dropped by 5%' },
    { type: 'system', priority: 'low', title: 'System Update', message: 'New features available' },
    { type: 'alert', priority: 'medium', title: 'Network Alert', message: 'Slow response time detected' }
  ];

  // Randomly create notifications (simulate real alerts)
  if (Math.random() < 0.1) { // 10% chance every time function is called
    const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const notification = {
      id: `auto-${++notificationCounter}`,
      ...randomAlert,
      timestamp: new Date().toISOString(),
      shouldRefresh: true,
      refreshDelay: randomAlert.priority === 'high' ? 1000 : 2000
    };

    notifications.push(notification);
    console.log('Auto-generated notification:', notification);
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === 'GET') {
    try {
      // Simulate background processes creating alerts
      simulateBackgroundAlerts();

      const since = parseInt(event.queryStringParameters?.since || '0');
      console.log(`Checking for notifications since: ${new Date(since).toISOString()}`);

      // Filter notifications that are newer than the 'since' timestamp
      const newNotifications = notifications.filter(notification => {
        const notificationTime = new Date(notification.timestamp).getTime();
        return notificationTime > since;
      });

      console.log(`Found ${newNotifications.length} new notifications out of ${notifications.length} total`);

      // Clean up old notifications (keep last 50)
      if (notifications.length > 50) {
        notifications = notifications.slice(-50);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          notifications: newNotifications,
          totalCount: notifications.length,
          checkTime: new Date().toISOString()
        })
      };
    } catch (error) {
      console.error('Error checking notifications:', error);
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

  if (event.httpMethod === 'POST') {
    // Allow manual creation of notifications for testing
    try {
      const body = JSON.parse(event.body || '{}');
      
      const notification = {
        id: `manual-${++notificationCounter}`,
        type: body.type || 'alert',
        priority: body.priority || 'medium',
        title: body.title || 'Manual Alert',
        message: body.message || 'This is a manually created alert',
        timestamp: new Date().toISOString(),
        shouldRefresh: body.shouldRefresh !== false,
        refreshDelay: body.refreshDelay || (body.priority === 'high' ? 1000 : 2000)
      };

      notifications.push(notification);
      console.log('Manually created notification:', notification);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          notification,
          message: 'Notification created successfully'
        })
      };
    } catch (error) {
      console.error('Error creating notification:', error);
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
