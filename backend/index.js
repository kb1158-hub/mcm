// backend/index.js - Enhanced version with better notification handling
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080', 'https://your-domain.com'],
  credentials: true
}));
app.use(bodyParser.json());

// Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// VAPID keys from your .env
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Enhanced subscribe endpoint
app.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body;
  
  if (!endpoint || !keys) {
    return res.status(400).json({ error: 'Invalid payload: endpoint and keys are required' });
  }

  try {
    // Check for existing subscription
    const { data: existing, error: findError } = await supabase
      .from('subscriptions')
      .select('id, created_at')
      .eq('endpoint', endpoint)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      console.error('Error checking existing subscription:', findError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existing) {
      console.log('Subscription already exists, updating timestamp');
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existing.id);
        
      if (updateError) {
        console.error('Error updating subscription:', updateError);
      }
      
      return res.status(200).json({ 
        message: 'Already subscribed',
        id: existing.id 
      });
    }

    // Insert new subscription
    const { data, error } = await supabase
      .from('subscriptions')
      .insert([{ 
        endpoint, 
        keys,
        user_agent: req.headers['user-agent'] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Error inserting subscription:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('New subscription created:', data.id);
    res.status(201).json({ 
      message: 'Subscription saved successfully',
      id: data.id 
    });
  } catch (error) {
    console.error('Subscribe endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced notification sending endpoint
app.post('/sendNotification', async (req, res) => {
  const { 
    title = 'MCM Alert',
    body = 'New alert received',
    priority = 'medium',
    type = 'alert',
    data = {},
    targetSubscriptions = null // Optional: specific subscription IDs
  } = req.body;

  console.log('Sending notification:', { title, body, priority, type });

  try {
    // Store notification in database first
    const { data: notificationData, error: notifyError } = await supabase
      .from('notifications')
      .insert([{ 
        title, 
        body, 
        type,
        priority,
        metadata: data,
        created_at: new Date().toISOString(),
        acknowledged: false
      }])
      .select()
      .single();

    if (notifyError) {
      console.error('Error storing notification:', notifyError);
      return res.status(500).json({ error: 'Failed to store notification' });
    }

    // Fetch subscriptions
    let query = supabase.from('subscriptions').select('id, endpoint, keys');
    
    if (targetSubscriptions && Array.isArray(targetSubscriptions)) {
      query = query.in('id', targetSubscriptions);
    }
    
    const { data: subs, error: subsError } = await query;

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      return res.status(500).json({ error: subsError.message });
    }

    if (!subs || subs.length === 0) {
      console.log('No subscriptions found');
      return res.status(200).json({ 
        message: 'Notification stored but no subscriptions to send to',
        notificationId: notificationData.id,
        results: []
      });
    }

    console.log(`Sending to ${subs.length} subscribers`);

    // Prepare notification payload
    const notificationPayload = {
      title,
      body,
      icon: '/mcm-logo-192.png',
      badge: '/mcm-logo-192.png',
      tag: `mcm-${notificationData.id}`,
      requireInteraction: priority === 'high',
      silent: false,
      vibrate: getVibratePattern(priority),
      actions: [
        { action: 'view', title: 'View Dashboard' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: {
        id: notificationData.id,
        url: '/',
        priority,
        type,
        timestamp: Date.now(),
        ...data
      }
    };

    // Send push notifications
    const sendResults = await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys
            },
            JSON.stringify(notificationPayload),
            {
              TTL: priority === 'high' ? 86400 : 3600, // 24h for high priority, 1h for others
              urgency: priority === 'high' ? 'high' : 'normal'
            }
          );
          
          return { 
            subscriptionId: sub.id,
            endpoint: sub.endpoint, 
            success: true,
            timestamp: new Date().toISOString()
          };
        } catch (err) {
          console.error(`Failed to send to subscription ${sub.id}:`, err.message);
          
          // Remove invalid subscriptions
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`Removing invalid subscription: ${sub.id}`);
            await supabase
              .from('subscriptions')
              .delete()
              .eq('id', sub.id);
          }
          
          return { 
            subscriptionId: sub.id,
            endpoint: sub.endpoint, 
            success: false, 
            error: err.message,
            statusCode: err.statusCode,
            timestamp: new Date().toISOString()
          };
        }
      })
    );

    // Process results
    const results = sendResults.map(result => 
      result.status === 'fulfilled' ? result.value : { success: false, error: result.reason?.message }
    );
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`Notification sending complete: ${successCount} success, ${failureCount} failures`);

    // Update notification with send statistics
    await supabase
      .from('notifications')
      .update({ 
        sent_count: successCount,
        failed_count: failureCount,
        sent_at: new Date().toISOString()
      })
      .eq('id', notificationData.id);

    res.status(200).json({ 
      success: true,
      notificationId: notificationData.id,
      totalSubscriptions: subs.length,
      successCount,
      failureCount,
      results: results
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New endpoint to trigger notifications for testing
app.post('/triggerAlert', async (req, res) => {
  const { 
    alertType = 'price_change',
    priority = 'medium',
    customMessage = null 
  } = req.body;

  const alerts = {
    price_change: {
      title: '💰 Price Alert',
      body: customMessage || 'A watched item has changed price significantly!',
      priority: priority
    },
    system_update: {
      title: '🔄 System Update',
      body: customMessage || 'MCM Alerts system has been updated with new features.',
      priority: 'low'
    },
    connection_issue: {
      title: '⚠️ Connection Warning',
      body: customMessage || 'Connection issues detected. Some features may be limited.',
      priority: 'medium'
    },
    critical_alert: {
      title: '🚨 Critical Alert',
      body: customMessage || 'Immediate attention required for your account.',
      priority: 'high'
    }
  };

  const alertConfig = alerts[alertType] || alerts.price_change;
  
  try {
    // Forward to sendNotification endpoint
    const notificationResponse = await fetch(`${req.protocol}://${req.get('host')}/sendNotification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...alertConfig,
        type: alertType,
        data: {
          triggeredBy: 'manual',
          alertType: alertType,
          timestamp: new Date().toISOString()
        }
      })
    });

    const result = await notificationResponse.json();
    res.status(notificationResponse.status).json(result);
  } catch (error) {
    console.error('Trigger alert error:', error);
    res.status(500).json({ error: 'Failed to trigger alert' });
  }
});

// Get subscription info
app.get('/subscription/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, created_at, updated_at, user_agent')
      .eq('id', req.params.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Helper function for vibration patterns
function getVibratePattern(priority) {
  switch (priority) {
    case 'high': return [300, 100, 300, 100, 300];
    case 'low': return [100];
    case 'medium':
    default: return [200, 100, 200];
  }
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 MCM Alerts push server running on port ${PORT}`);
  console.log(`📱 Push notifications enabled with VAPID`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
