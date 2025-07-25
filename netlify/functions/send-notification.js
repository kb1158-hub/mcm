// netlify/functions/send-notification.js
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const VAPID_SUBJECT = 'mailto:you@example.com';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event) => {
  const { user_id, title, body, url } = JSON.parse(event.body);

  // Retrieve all subscriptions for the user
  const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', user_id);
  const payload = JSON.stringify({ title, body, url });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
    } catch {}
  }
  return { statusCode: 200, body: 'Pushed' };
};
