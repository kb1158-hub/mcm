require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
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

// Subscribe endpoint
app.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys) return res.status(400).json({ error: 'Invalid payload' });

  // Check for existing subscription
  const { data: existing, error: findError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('endpoint', endpoint);

  if (existing && existing.length > 0) {
    return res.status(200).json({ message: 'Already subscribed' });
  }

  // Insert new subscription
  const { error } = await supabase
    .from('subscriptions')
    .insert([{ endpoint, keys }]);

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: 'Subscription saved.' });
});

// Send notification to all subscribers and log it
app.post('/sendNotification', async (req, res) => {
  const payload = req.body.payload || {
    title: 'MCM Alert',
    body: 'New alert received',
    icon: '/mcm-logo-192.png',
  };

  // Log notification in Supabase
  await supabase
    .from('notifications')
    .insert([{ title: payload.title, body: payload.body }]);

  // Fetch all subscribers
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('endpoint, keys');

  if (error) return res.status(500).json({ error: error.message });

  // Send push notifications
  const sendResults = await Promise.all(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys
          },
          JSON.stringify(payload)
        );
        return { endpoint: sub.endpoint, success: true };
      } catch (err) {
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

  res.status(200).json({ results: sendResults });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Push server running on port ${PORT}`);
});
