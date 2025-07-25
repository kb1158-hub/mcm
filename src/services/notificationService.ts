// src/services/notificationService.ts
import { supabase } from '../supabaseClient'; // adjust the relative path as needed

export async function fetchRecentNotifications(limit = 5) {
  try {
    // Try to fetch from API first (for real-time updates)
    const response = await fetch('/api/notifications');
    if (response.ok) {
      const result = await response.json();
      return result.notifications?.slice(0, limit) || [];
    }
  } catch (error) {
    console.warn('API fetch failed, trying direct Supabase:', error);
  }

  // Fallback to direct Supabase query
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
}

export async function fetchAllNotifications() {
  try {
    // Try to fetch from API first
    const response = await fetch('/api/notifications');
    if (response.ok) {
      const result = await response.json();
      return result.notifications || [];
    }
  } catch (error) {
    console.warn('API fetch failed, trying direct Supabase:', error);
  }

  // Fallback to direct Supabase query
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch all notifications:', error);
    return [];
  }
}

export async function addNotification({ title, body }: { title: string; body: string }) {
  try {
    // Try to add via API first
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        message: body,
        type: 'manual',
        priority: 'medium'
      }),
    });

    if (response.ok) {
      const result = await response.json();
      return result.notification;
    }
  } catch (error) {
    console.warn('API add failed, trying direct Supabase:', error);
  }

  // Fallback to direct Supabase insert
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{ title, body }])
      .select();
    if (error) throw error;
    return data?.[0];
  } catch (error) {
    console.error('Failed to add notification:', error);
    throw error;
  }
}
