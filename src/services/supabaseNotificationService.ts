// src/services/supabaseNotificationService.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_APP_SUPABASE_URL!,
  process.env.VITE_APP_SUPABASE_ANON_KEY!
)

export interface Notification {
  id: string
  user_id?: string
  title: string
  message?: string
  body?: string
  type: string
  priority: string
  site?: string
  is_read: boolean
  acknowledged?: boolean
  action_url?: string
  metadata?: any
  timestamp: string
  created_at: string
  updated_at?: string
  expires_at?: string
}

export class SupabaseNotificationService {
  private subscription: any = null
  private listeners: ((notification: Notification) => void)[] = []

  // Add listener for new notifications
  addListener(callback: (notification: Notification) => void) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  // Notify all listeners
  private notifyListeners(notification: Notification) {
    this.listeners.forEach(listener => {
      try {
        listener(notification)
      } catch (error) {
        console.error('Error in notification listener:', error)
      }
    })
  }

  // Play notification sound
  private playNotificationSound(priority: string) {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      const playTone = (frequency: number, duration: number, volume: number) => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
        oscillator.type = 'sine'
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + duration)
      }

      // Different sounds for different priorities
      switch (priority) {
        case 'high':
        case 'urgent':
          playTone(800, 0.3, 0.3)
          setTimeout(() => playTone(1000, 0.3, 0.3), 400)
          break
        case 'normal':
        case 'medium':
          playTone(600, 0.5, 0.2)
          break
        case 'low':
          playTone(400, 0.4, 0.1)
          break
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error)
    }
  }

  // Initialize real-time subscription
  async initialize() {
    console.log('Initializing Supabase notification service...')
    
    // Subscribe to INSERT events on notifications table
    this.subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          console.log('New notification received:', payload.new)
          const notification = payload.new as Notification
          
          // Notify listeners
          this.notifyListeners(notification)
          
          // Show browser notification
          this.showBrowserNotification(notification)
          
          // Play sound
          this.playNotificationSound(notification.priority)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          console.log('Notification updated:', payload.new)
          // You can handle updates here if needed
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })
  }

  // Show browser notification
  private async showBrowserNotification(notification: Notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotification = new Notification(notification.title, {
          body: notification.message || notification.body || 'New notification',
          icon: '/mcm-logo-192.png',
          badge: '/mcm-logo-192.png',
          tag: `mcm-${notification.id}`,
          requireInteraction: notification.priority === 'high' || notification.priority === 'urgent',
          silent: false,
          data: {
            id: notification.id,
            action_url: notification.action_url,
            priority: notification.priority
          }
        })

        browserNotification.onclick = () => {
          window.focus()
          if (notification.action_url) {
            window.location.href = notification.action_url
          }
          browserNotification.close()
          
          // Mark as read when clicked
          this.markAsRead(notification.id).catch(console.error)
        }

        // Auto-close after delay (except for high priority)
        if (notification.priority !== 'high' && notification.priority !== 'urgent') {
          setTimeout(() => {
            browserNotification.close()
          }, 5000)
        }
      } catch (error) {
        console.error('Failed to show browser notification:', error)
      }
    }
  }

  // Request notification permission
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      console.log('Notification permission result:', permission)
      return permission === 'granted'
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }

  // Get user notifications
  async getNotifications(limit = 50, offset = 0, unreadOnly = false) {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data, error } = await query

    if (error) throw error
    return data
  }

  // Mark notification as read
  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        acknowledged: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId)

    if (error) throw error
  }

  // Mark all notifications as read
  async markAllAsRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        acknowledged: true,
        updated_at: new Date().toISOString()
      })
      .eq('is_read', false)

    if (error) throw error
  }

  // Get unread count
  async getUnreadCount() {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

    if (error) throw error
    return count || 0
  }

  // Send test notification (creates in database)
  async sendTestNotification(priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal') {
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          title: `Test Notification - ${priority.toUpperCase()}`,
          message: `This is a test notification with ${priority} priority sent at ${new Date().toLocaleTimeString()}`,
          body: `Real-time test from Supabase notification system`,
          type: 'test',
          priority,
          site: 'system',
          timestamp: new Date().toISOString()
        }
      ])
      .select()

    if (error) throw error
    console.log('Test notification created:', data[0])
    return data[0]
  }

  // Delete notification
  async deleteNotification(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) throw error
  }

  // Get notification stats
  async getStats() {
    const { data, error } = await supabase
      .rpc('get_notification_stats')

    if (error) {
      console.error('Error getting stats:', error)
      // Fallback to basic count
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
      
      return {
        total_count: count || 0,
        unread_count: 0,
        acknowledged_count: 0,
        by_type: {},
        by_priority: {},
        by_site: {}
      }
    }
    
    return data[0] || {}
  }

  // Cleanup
  disconnect() {
    console.log('Disconnecting notification service...')
    if (this.subscription) {
      supabase.removeChannel(this.subscription)
      this.subscription = null
    }
    this.listeners = []
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.subscription !== null,
      connectionType: 'supabase-realtime',
      listenersCount: this.listeners.length
    }
  }
}

export const notificationService = new SupabaseNotificationService()
