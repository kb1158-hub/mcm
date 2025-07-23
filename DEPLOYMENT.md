# MCM Alerts - Netlify Deployment Guide

This guide will walk you through deploying the MCM Alerts application to Netlify with full Service Worker and push notification support.

## Prerequisites

1. **GitHub Account**: Your code should be in a GitHub repository
2. **Netlify Account**: Sign up at [netlify.com](https://netlify.com)
3. **Supabase Account**: Set up at [supabase.com](https://supabase.com)
4. **VAPID Keys**: For push notifications (we'll generate these)

## Step 1: Prepare Your Repository

1. **Commit all changes to your GitHub repository:**
   ```bash
   git add .
   git commit -m "Add Netlify deployment configuration and Service Worker support"
   git push origin main
   ```

## Step 2: Set Up Supabase Database

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)

2. **Create the required tables** by running these SQL commands in the Supabase SQL editor:

   ```sql
   -- Create notifications table
   CREATE TABLE notifications (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     title TEXT NOT NULL,
     body TEXT NOT NULL,
     type TEXT DEFAULT 'custom',
     priority TEXT DEFAULT 'medium',
     metadata JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Create subscriptions table for push notifications
   CREATE TABLE subscriptions (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     endpoint TEXT UNIQUE NOT NULL,
     keys JSONB NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Enable Row Level Security
   ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
   ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

   -- Create policies for public access (adjust as needed for your security requirements)
   CREATE POLICY "Allow public read on notifications" ON notifications FOR SELECT USING (true);
   CREATE POLICY "Allow public insert on notifications" ON notifications FOR INSERT WITH CHECK (true);
   CREATE POLICY "Allow public read on subscriptions" ON subscriptions FOR SELECT USING (true);
   CREATE POLICY "Allow public insert on subscriptions" ON subscriptions FOR INSERT WITH CHECK (true);
   CREATE POLICY "Allow public delete on subscriptions" ON subscriptions FOR DELETE USING (true);

    -- Create topics table
    CREATE TABLE topics (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN DEFAULT TRUE,
      last_checked TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Enable Row Level Security for topics
    ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

    -- Create policies for public access (adjust as needed for your security requirements)
    CREATE POLICY "Allow public read on topics" ON topics FOR SELECT USING (true);
    CREATE POLICY "Allow public insert on topics" ON topics FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow public update on topics" ON topics FOR UPDATE USING (true);
    CREATE POLICY "Allow public delete on topics" ON topics FOR DELETE USING (true);
   ```

3. **Get your Supabase credentials:**
   - Go to Settings > API
   - Copy the `Project URL` and `anon public` key

## Step 3: Generate VAPID Keys

1. **Install web-push globally:**
   ```bash
   npm install -g web-push
   ```

2. **Generate VAPID keys:**
   ```bash
   web-push generate-vapid-keys
   ```

3. **Save the output** - you'll need both the public and private keys.

## Step 4: Deploy to Netlify

1. **Connect your repository:**
   - Go to [netlify.com](https://netlify.com) and log in
   - Click "New site from Git"
   - Choose GitHub and select your repository
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`

2. **Configure environment variables:**
   - Go to Site settings > Environment variables
   - Add the following variables:

   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VAPID_PUBLIC_KEY=your_vapid_public_key
   VAPID_PRIVATE_KEY=your_vapid_private_key
   ```

3. **Deploy the site:**
   - Click "Deploy site"
   - Wait for the build to complete

## Step 5: Configure Domain and HTTPS

1. **Set up custom domain (optional):**
   - Go to Site settings > Domain management
   - Add your custom domain
   - Configure DNS settings as instructed

2. **Ensure HTTPS is enabled:**
   - Netlify automatically provides HTTPS
   - Service Workers require HTTPS to function properly

## Step 6: Test the Deployment

1. **Visit your deployed site**
2. **Test the login:**
   - Username: `user`
   - Password: `123456`

3. **Test notifications:**
   - Click the "Test Notification" button
   - Try different priority levels (Low, Medium, High)
   - Check that notifications appear in the "Recent Notifications" section
   - Verify that sounds play and vibrations work on mobile devices

4. **Test API endpoints:**
   - Use the API documentation page
   - Test with Postman using the provided examples
   - Endpoint: `https://your-site.netlify.app/api/notifications`
   - Verify that external API calls create notifications that appear in the dashboard

5. **Test PWA functionality:**
   - On mobile, look for "Add to Home Screen" prompt
   - Install the PWA and test offline functionality
   - Verify push notifications work when app is in background

## Step 7: Verify Service Worker

1. **Open browser developer tools**
2. **Go to Application tab > Service Workers**
3. **Verify the service worker is registered and active**
4. **Test push notifications work properly with sound and vibration**
5. **Check that notifications work in background/when app is closed**

## API Endpoints

After deployment, your API endpoints will be:

- **Send Notification**: `POST https://your-site.netlify.app/api/notifications`
- **Get Notifications**: `GET https://your-site.netlify.app/api/notifications`
- **Subscribe to Push**: `POST https://your-site.netlify.app/api/subscribe`
- **Send Push Notification**: `POST https://your-site.netlify.app/api/send-notification`

## Testing with Postman

1. **Send a test notification:**
   ```json
   POST https://your-site.netlify.app/api/notifications
   Content-Type: application/json

   {
     "type": "test",
     "title": "Test from Postman",
     "message": "This is a test notification from Postman",
     "priority": "high"
   }
   ```

2. **Verify the notification appears in the dashboard immediately**

## Troubleshooting

### 403 Errors from Postman
- Ensure CORS headers are properly configured in Netlify functions
- Check that the API endpoint URL is correct
- Verify Supabase RLS policies allow public access

### Service Worker Issues
- Ensure HTTPS is enabled
- Check browser console for Service Worker registration errors
- Verify `service-worker.js` is accessible at the root
- Clear browser cache and re-register service worker

### Push Notifications Not Working
- Verify VAPID keys are correctly set in environment variables
- Check that notification permissions are granted
- Ensure Supabase tables are created correctly
- Test on actual mobile device (not just desktop browser)

### Sound Issues
- Ensure user has interacted with the page before sounds can play
- Check browser's autoplay policies
- Test on different browsers and devices
- Verify audio context is properly initialized

### API Endpoints Failing
- Check Netlify function logs in the dashboard
- Verify environment variables are set correctly
- Ensure Supabase credentials are valid
- Check CORS configuration

### Build Failures
- Check that all dependencies are installed
- Verify `netlify.toml` configuration is correct
- Check build logs for specific error messages
- Ensure all required files are committed to repository

### PWA Installation Issues
- Verify manifest.json is properly configured
- Check that all required PWA criteria are met
- Test on different devices and browsers
- Ensure HTTPS is enabled

## Environment Variables Reference

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# VAPID Keys for Push Notifications
VAPID_PUBLIC_KEY=your_vapid_public_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here
```

## Security Notes

1. **Never commit sensitive keys to your repository**
2. **Use environment variables for all secrets**
3. **Configure proper Row Level Security policies in Supabase**
4. **Consider implementing proper authentication for production use**
5. **Review CORS settings for production security**

## Support

If you encounter issues during deployment:

1. Check the Netlify build logs
2. Review the browser console for errors
3. Verify all environment variables are set correctly
4. Ensure Supabase database tables are created properly
5. Test API endpoints individually
6. Verify PWA manifest and service worker registration

## Next Steps

After successful deployment:

1. **Set up monitoring** for your notification system
2. **Configure proper authentication** for production use
3. **Implement rate limiting** for API endpoints
4. **Set up analytics** to track notification delivery
5. **Create backup strategies** for your Supabase data
6. **Optimize for different mobile platforms**
7. **Set up automated testing** for notification functionality

Your MCM Alerts application is now ready for production use with full PWA capabilities, Service Worker support, push notifications with sound and vibration, and mobile optimization!