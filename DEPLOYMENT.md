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

   -- Create policies (adjust as needed for your security requirements)
   CREATE POLICY "Allow all operations on notifications" ON notifications FOR ALL USING (true);
   CREATE POLICY "Allow all operations on subscriptions" ON subscriptions FOR ALL USING (true);
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

4. **Test API endpoints:**
   - Use the API documentation page
   - Test with Postman using the provided examples
   - Endpoint: `https://your-site.netlify.app/api/notifications`

## Step 7: Verify Service Worker

1. **Open browser developer tools**
2. **Go to Application tab > Service Workers**
3. **Verify the service worker is registered and active**
4. **Test push notifications work properly**

## API Endpoints

After deployment, your API endpoints will be:

- **Send Notification**: `POST https://your-site.netlify.app/api/notifications`
- **Subscribe to Push**: `POST https://your-site.netlify.app/api/subscribe`
- **Send Push Notification**: `POST https://your-site.netlify.app/api/send-notification`

## Troubleshooting

### Service Worker Issues
- Ensure HTTPS is enabled
- Check browser console for Service Worker registration errors
- Verify `service-worker.js` is accessible at the root

### Push Notifications Not Working
- Verify VAPID keys are correctly set in environment variables
- Check that notification permissions are granted
- Ensure Supabase tables are created correctly

### API Endpoints Failing
- Check Netlify function logs in the dashboard
- Verify environment variables are set correctly
- Ensure Supabase credentials are valid

### Build Failures
- Check that all dependencies are installed
- Verify `netlify.toml` configuration is correct
- Check build logs for specific error messages

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

## Support

If you encounter issues during deployment:

1. Check the Netlify build logs
2. Review the browser console for errors
3. Verify all environment variables are set correctly
4. Ensure Supabase database tables are created properly

## Next Steps

After successful deployment:

1. **Set up monitoring** for your notification system
2. **Configure proper authentication** for production use
3. **Implement rate limiting** for API endpoints
4. **Set up analytics** to track notification delivery
5. **Create backup strategies** for your Supabase data

Your MCM Alerts application is now ready for production use with full Service Worker and push notification support!