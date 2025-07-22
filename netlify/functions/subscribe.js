const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rswwlwybqsinzckzwcpb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzd3dsd3licXNpbnpja3p3Y3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMzY0MjcsImV4cCI6MjA2ODcxMjQyN30.OFDBSFnSWbage9xI5plqis7RAFKnJPuzO1JWUHE7yDM';

const supabase = createClient(supabaseUrl, supabaseKey);

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
      const { endpoint, keys } = JSON.parse(event.body);

      if (!endpoint || !keys) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid payload' }),
        };
      }

      // Check for existing subscription
      const { data: existing, error: findError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('endpoint', endpoint);

      if (findError) {
        console.error('Database error:', findError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Database error' }),
        };
      }

      if (existing && existing.length > 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Already subscribed' }),
        };
      }

      // Insert new subscription
      const { error } = await supabase
        .from('subscriptions')
        .insert([{ endpoint, keys }]);

      if (error) {
        console.error('Insert error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: error.message }),
        };
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ message: 'Subscription saved.' }),
      };
    } catch (error) {
      console.error('Error processing subscription:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};