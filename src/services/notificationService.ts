import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rswwlwybqsinzckzwcpb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzd3dsd3licXNpbnpja3p3Y3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMzY0MjcsImV4cCI6MjA2ODcxMjQyN30.OFDBSFnSWbage9xI5plqis7RAFKnJPuzO1JWUHE7yDM';
export const supabase = createClient(supabaseUrl, supabaseKey);

export async function fetchRecentNotifications(limit = 5) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function fetchAllNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addNotification({ title, body }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert([{ title, body }]);
  if (error) throw error;
  return data[0];
}
