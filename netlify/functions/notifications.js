const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rswwlwybqsinzckzwcpb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzd3dsd3licXNpbnpja3p3Y3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMzY0MjcsImV4cCI6MjA2ODcxMjQyN30.OFDBSFnSWbage9xI5plqis7RAFKnJPuzO1JWUHE7yDM';

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  // Enhanced CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  console.log('Request method:', event.httpMethod);
  console.log('Request body:', event.body);
  console.log('Request headers:', event.headers);

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { type, title, message, priority = 'medium', ...otherData } = body;

      console.log('Parsed body:', { type, title, message, priority, otherData });

      if (!title || !message) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Missing required fields: title and message are required',
            received: { title, message }
          }),
        };
      }

      // Store notification in Supabase
      const { data, error } = await supabase
        .from('notifications')
        .insert([
          {
            title,
            body: message,
            type: type || 'custom',
            priority,
            metadata: otherData,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to store notification',
            details: error.message 
          }),
        };
      }

      console.log('Notification stored successfully:', data[0]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Notification received and stored successfully',
          notification: data[0]
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

  if (event.httpMethod === 'GET') {
    try {
      // Get recent notifications
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Supabase error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to fetch notifications',
            details: error.message 
          }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          notifications: data || []
        }),
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
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